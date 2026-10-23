// Small, read-only XLSX decoder. No remote script or API key is needed.
const decoder=new TextDecoder();
const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const elements=(node,name)=>Array.from(node.getElementsByTagNameNS(MAIN,name));
function xml(text) {
  const result=new DOMParser().parseFromString(text,'application/xml');
  if(result.getElementsByTagName('parsererror').length)throw new Error('시트 응답을 해석할 수 없습니다.');
  return result;
}
export async function unzip(buffer) {
  const view=new DataView(buffer), bytes=new Uint8Array(buffer);
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('시트 파일에 접근할 수 없습니다. 공유 설정을 확인해 주세요.');
  const count=view.getUint16(end+10,true);let pos=view.getUint32(end+16,true);const files=new Map();
  for(let i=0;i<count;i++){
    if(view.getUint32(pos,true)!==0x02014b50)throw new Error('올바른 시트 파일이 아닙니다.');
    const method=view.getUint16(pos+10,true),size=view.getUint32(pos+20,true),expanded=view.getUint32(pos+24,true);
    const nameLength=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true);
    const name=decoder.decode(bytes.subarray(pos+46,pos+46+nameLength));pos+=46+nameLength+extra+comment;
    if(!/^(xl\/workbook.xml|xl\/_rels\/workbook.xml.rels|xl\/sharedStrings.xml|xl\/worksheets\/sheet\d+.xml|xl\/worksheets\/_rels\/sheet\d+.xml.rels)$/.test(name))continue;
    if(expanded>25_000_000)throw new Error('시트가 너무 큽니다.');
    files.set(name,async()=>{
      const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);
      const data=bytes.subarray(start,start+size);
      if(method===0)return decoder.decode(data);
      if(method!==8)throw new Error('지원하지 않는 시트 압축 형식입니다.');
      const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    });
  }
  return files;
}
export async function readXlsx(buffer, sheetName='시트1') {
  const files=await unzip(buffer);
  const read=async name=>{if(!files.has(name))throw new Error(`필수 시트 파일이 없습니다: ${name}`);return xml(await files.get(name)());};
  const book=await read('xl/workbook.xml');
  const sheet=elements(book,'sheet').find(s=>s.getAttribute('name')===sheetName);
  if(!sheet)throw new Error(`원본에서 '${sheetName}' 탭을 찾지 못했습니다.`);
  const rels=await read('xl/_rels/workbook.xml.rels');
  const relation=Array.from(rels.getElementsByTagName('Relationship')).find(r=>r.getAttribute('Id')===sheet.getAttributeNS(REL,'id'));
  if(!relation)throw new Error('시트 연결 정보를 찾지 못했습니다.');
  const target=relation.getAttribute('Target');
  const sheetPath=target.startsWith('/')?target.slice(1):`xl/${target}`;
  const doc=await read(sheetPath);
  const strings=files.has('xl/sharedStrings.xml')?elements(await read('xl/sharedStrings.xml'),'si').map(si=>elements(si,'t').map(t=>t.textContent).join('')):[];
  const linkPath=sheetPath.replace(/\/([^/]+)$/,'/_rels/$1.rels');
  const linkRels=files.has(linkPath)?await read(linkPath):null;
  const linkTargets=Object.fromEntries(linkRels?Array.from(linkRels.getElementsByTagName('Relationship')).map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]):[]);
  const links=Object.fromEntries(elements(doc,'hyperlink').map(h=>[h.getAttribute('ref'),linkTargets[h.getAttributeNS(REL,'id')]]));
  return elements(doc,'row').map(row=>{
    const cells=[];
    for(const c of elements(row,'c')){
      const ref=c.getAttribute('r')||'';const letters=ref.replace(/\d/g,'');
      let col=0;for(const char of letters)col=col*26+char.charCodeAt(0)-64;
      if(!col)continue;
      const type=c.getAttribute('t'),v=elements(c,'v')[0]?.textContent??'';
      let value=type==='s'?strings[Number(v)]??'':type==='inlineStr'?elements(c,'t').map(t=>t.textContent).join(''):type==='b'?v==='1':v;
      // Dates in this sheet are text; support Excel serial dates in the deadline column too.
      const formula=elements(c,'f')[0]?.textContent||'';
      const formulaLink=formula.match(/(?:_xlfn\.)?HYPERLINK\(\s*"((?:[^"]|"")*)"/i)?.[1]?.replaceAll('""','"');
      cells[col-1]={value,link:links[ref]||formulaLink||''};
    }
    return {number:Number(row.getAttribute('r')),cells};
  }).map((row,i,rows)=>{
    const header=rows.find(r=>r.cells.some(c=>c?.value==='모집 마감일'));
    const col=header?.cells.findIndex(c=>c?.value==='모집 마감일');
    const cell=col>=0?row.cells[col]:null;
    if(cell&&/^\d{5}(\.\d+)?$/.test(String(cell.value))){cell.value=new Date((Number(cell.value)-25569)*86400000).toISOString().slice(0,10);}
    return row;
  });
}
