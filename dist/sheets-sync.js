import {SHEET_ID,normalizeRows} from './model.js';
import {GOOGLE_CLIENT_ID,GOOGLE_PICKER_API_KEY,GOOGLE_PROJECT_NUMBER} from './sync-config.js';

const SCOPE='https://www.googleapis.com/auth/drive.file';
const API=`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
const TAB='시트1';
export const isSyncConfigured=()=>Boolean(GOOGLE_CLIENT_ID&&GOOGLE_PICKER_API_KEY&&GOOGLE_PROJECT_NUMBER);
export function columnName(index){let name='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;}
export function sheetSnapshot(payload){
  const sheet=payload.sheets?.find(s=>s.properties.title===TAB);
  if(!sheet)throw new Error('시트1 탭을 찾을 수 없습니다.');
  const rows=(sheet.data||[]).flatMap(block=>(block.rowData||[]).map((row,i)=>({number:(block.startRow||0)+i+1,cells:(row.values||[]).map(cell=>({value:cell.effectiveValue?.boolValue??cell.formattedValue??cell.effectiveValue?.stringValue??cell.effectiveValue?.numberValue??'',link:cell.hyperlink||'',validation:cell.dataValidation}))})));
  const header=rows.find(row=>row.cells.some(c=>c.value==='기업명')&&row.cells.some(c=>c.value==='직무'));
  if(!header)throw new Error('시트 열 이름을 확인해 주세요.');
  const columns=Object.fromEntries(header.cells.map((cell,index)=>[cell.value,index]));
  const occurrences=new Map();
  rows.filter(row=>row.number>header.number).forEach(row=>normalizeRows([header,row]).forEach(job=>occurrences.set(job.id,(occurrences.get(job.id)||0)+1)));
  return {jobs:normalizeRows(rows),rows,columns,duplicates:new Set([...occurrences].filter(([,count])=>count>1).map(([id])=>id))};
}
export function prepareMarkWrite(snapshot,id,key,value){
  if(!['saved','applied'].includes(key)||typeof value!=='boolean')throw new Error('저장할 상태가 올바르지 않습니다.');
  const matches=snapshot.jobs.filter(job=>job.id===id);
  if(snapshot.duplicates?.has(id))throw new Error('동일한 공고가 여러 행에 있습니다. 원본 시트에서 중복을 확인해 주세요.');
  if(matches.length!==1)throw new Error('공고가 변경되었거나 삭제되었습니다. 새로고침 후 다시 시도해 주세요.');
  const job=matches[0],header=key==='saved'?'관심 공고':'지원 여부',column=snapshot.columns[header];
  if(!Number.isInteger(column))throw new Error(`${header} 열을 찾을 수 없습니다.`);
  const row=snapshot.rows.find(r=>r.number===job.row),cell=row.cells[column];
  const validation=cell?.validation?.condition;
  if(validation&&(validation.type!=='BOOLEAN'||validation.values?.length))throw new Error('표시 열이 기본 체크박스 형식이 아닙니다. 원본 시트를 확인해 주세요.');
  return {job,range:`'${TAB}'!${columnName(column)}${job.row}`,value,key};
}
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');const timer=setTimeout(()=>{s.remove();reject(new Error('Google 연결 시간이 초과되었습니다. 다시 시도해 주세요.'));},20000);s.src=src;s.async=true;s.onload=()=>{clearTimeout(timer);resolve();};s.onerror=()=>{clearTimeout(timer);reject(new Error('Google 연결 도구를 불러오지 못했습니다.'));};
    document.head.append(s);
  });
}
export class SheetsSync {
  constructor({fetchImpl=(...args)=>fetch(...args),onState=()=>{}}={}){this.fetchImpl=fetchImpl;this.onState=onState;this.token=null;this.expires=0;this.client=null;this.ready=null;this.connecting=false;this.authorized=false;}
  get hasToken(){return Boolean(this.token&&Date.now()<this.expires);}
  get connected(){return this.hasToken&&this.authorized;}
  prepare(){
    if(!isSyncConfigured())return Promise.resolve(false);
    if(!this.ready)this.ready=Promise.all([loadScript('https://accounts.google.com/gsi/client'),loadScript('https://apis.google.com/js/api.js')]).then(()=>new Promise((resolve,reject)=>{
      window.gapi.load('picker',{callback:()=>{this.client=window.google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:SCOPE,include_granted_scopes:false,callback:()=>{},error_callback:()=>{this.disconnect();this.rejectConnection?.(new Error('로그인 창이 닫혔거나 차단되었습니다. 다시 연결해 주세요.'));}});resolve(true);},onerror:()=>reject(new Error('파일 선택 도구를 불러오지 못했습니다.')),timeout:20000,ontimeout:()=>reject(new Error('파일 선택 도구 연결 시간이 초과되었습니다.'))});
    })).catch(error=>{this.ready=null;throw error;});
    return this.ready;
  }
  // Invoke synchronously from a click handler so popup blockers do not suppress Google sign-in.
  connect(){
    if(!isSyncConfigured())return Promise.reject(new Error('Google 연결 설정을 마무리해야 합니다.'));
    if(!this.client)return Promise.reject(new Error('Google 연결 준비 중입니다. 잠시 후 다시 눌러 주세요.'));
    if(this.connecting)return Promise.reject(new Error('Google 연결을 진행 중입니다.'));
    this.connecting=true;this.onState('connecting');
    if(this.hasToken)return this.finishConnection();
    return new Promise((resolve,reject)=>{
      this.rejectConnection=reject;
      this.client.callback=async response=>{
        if(response.error||!response.access_token){this.disconnect();reject(new Error('Google 연결을 허용하지 않았습니다.'));return;}
        if(!window.google.accounts.oauth2.hasGrantedAllScopes(response,SCOPE)){this.disconnect();reject(new Error('선택한 시트에 대한 접근 권한이 필요합니다.'));return;}
        this.token=response.access_token;this.expires=Date.now()+(Number(response.expires_in)-60)*1000;
        try{resolve(await this.finishConnection());}catch(error){reject(error);}
      };
      this.client.requestAccessToken({prompt:''});
    });
  }
  async finishConnection(){
    try{
      await this.ensureSheetAccess();
      const snapshot=await this.read();
      this.authorized=true;this.connecting=false;this.onState('connected');return snapshot;
    }catch(error){
      if(error.pickerRetryable&&this.hasToken){this.authorized=false;this.connecting=false;this.onState('file-required');}
      else this.disconnect();
      throw error;
    }
  }
  async ensureSheetAccess(){
    const endpoint=`https://www.googleapis.com/drive/v3/files/${SHEET_ID}?fields=id,isAppAuthorized,capabilities(canEdit)`;
    let file;
    try{file=await this.request(endpoint);}catch(error){if(![403,404].includes(error.status))throw error;}
    if(!file?.isAppAuthorized){await this.pickSheet();file=await this.request(endpoint);}
    if(file?.id!==SHEET_ID||!file.isAppAuthorized)throw new Error('선택한 채용 시트의 접근 권한을 확인하지 못했습니다. 다시 연결해 주세요.');
    if(!file.capabilities?.canEdit)throw new Error('현재 Google 계정은 이 시트를 수정할 수 없습니다. 시트 소유자 계정으로 연결해 주세요.');
  }
  pickSheet(){
    return new Promise((resolve,reject)=>{
      const g=window.google;
      let picker,timer,settled=false;
      const recovery=document.createElement('button');recovery.type='button';recovery.className='picker-recovery';recovery.textContent='파일 선택 창 닫기 · 다시 시도';
      const retryError=message=>Object.assign(new Error(message),{pickerRetryable:true});
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);recovery.remove();picker?.dispose();error?reject(error):resolve();};
      recovery.addEventListener('click',()=>finish(retryError('Google 로그인은 유지됩니다. 파일 선택을 다시 시도해 주세요.')));
      const view=new g.picker.DocsView(g.picker.ViewId.SPREADSHEETS).setMode(g.picker.DocsViewMode.LIST).setQuery('지원 후보 리스트');
      picker=new g.picker.PickerBuilder().addView(view).setOAuthToken(this.token).setDeveloperKey(GOOGLE_PICKER_API_KEY).setAppId(GOOGLE_PROJECT_NUMBER).setOrigin(location.origin).setLocale('ko').setTitle('동기화할 ‘지원 후보 리스트’를 선택하세요').setCallback(data=>{
        if(data.action===g.picker.Action.PICKED){const selected=data.docs?.[0];finish(selected?.id!==SHEET_ID?retryError('연결된 채용 시트 ‘지원 후보 리스트’를 선택해 주세요.'):null);}
        if(data.action===g.picker.Action.CANCEL)finish(retryError('시트 선택을 취소했습니다. 파일 선택을 다시 시도할 수 있습니다.'));
      }).build();
      timer=setTimeout(()=>finish(retryError('Google 파일 선택기가 응답하지 않았습니다. 로그인은 유지되며 파일 선택만 다시 시도할 수 있습니다.')),120000);
      picker.setVisible(true);
      document.body.append(recovery);
    });
  }
  disconnect(){this.token=null;this.expires=0;this.authorized=false;this.connecting=false;this.onState('disconnected');}
  async request(url,options={}){
    if(!this.hasToken){this.disconnect();throw new Error('Google 연결이 만료되었습니다. 다시 연결해 주세요.');}
    const response=await this.fetchImpl(url,{...options,cache:'no-store',headers:{Authorization:`Bearer ${this.token}`,...options.headers},signal:AbortSignal.timeout(20000)});
    if(!response.ok){
      if(response.status===401)this.disconnect();
      const error=new Error(response.status===401?'Google 연결이 만료되었습니다. 다시 연결해 주세요.':response.status===403?'시트 수정 권한을 확인해 주세요.':response.status===429?'요청이 많습니다. 잠시 후 다시 저장해 주세요.':`시트 연결 오류 (${response.status})`);error.status=response.status;throw error;
    }
    return response.json();
  }
  async read(){
    const query=new URLSearchParams({ranges:`'${TAB}'`,fields:'sheets(properties(sheetId,title),data(startRow,rowData(values(formattedValue,effectiveValue,hyperlink,dataValidation))))'});
    return sheetSnapshot(await this.request(`${API}?${query}`));
  }
  async save(id,key,value){
    // Re-resolve by company + title + link instead of trusting the row displayed earlier.
    const snapshot=await this.read();
    const write=prepareMarkWrite(snapshot,id,key,value);
    if(write.job[key]===value)return snapshot;
    const url=`${API}/values/${encodeURIComponent(write.range)}?valueInputOption=RAW&includeValuesInResponse=true&responseValueRenderOption=UNFORMATTED_VALUE`;
    const result=await this.request(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({range:write.range,majorDimension:'ROWS',values:[[value]]})});
    if(result.updatedCells!==1||result.updatedData?.values?.[0]?.[0]!==value)throw new Error('저장 결과를 확인하지 못했습니다. 새로고침해 주세요.');
    write.job[key]=value;
    return snapshot;
  }
}
