import test from 'node:test';
import assert from 'node:assert/strict';
import {SheetsSync,sheetSnapshot,prepareMarkWrite,columnName} from '../dist/sheets-sync.js';
const cell=value=>typeof value==='boolean'?{effectiveValue:{boolValue:value},dataValidation:{condition:{type:'BOOLEAN'},strict:true}}:{formattedValue:value};
function fixture(row=8,duplicate=false){
  const header=['지원 여부','관심 공고','기업명','직무','요구 기술','연봉','매출액','직원수','모집 마감일','공고 링크'].map(cell);
  const values=[false,false,'회사 A','PLC 엔지니어','PLC','4000만원','미공개','50명','2026-12-01','공고 보기'].map(cell);values[9].hyperlink='https://example.com/job/42';
  return {sheets:[{properties:{title:'시트1',sheetId:0},data:[{startRow:0,rowData:[{values:header}]},{startRow:row-1,rowData:duplicate?[{values},{values}]:[{values}]}]}]};
}
test('write target follows a moved job and edits one boolean field only',()=>{
  const old=sheetSnapshot(fixture(8)),latest=sheetSnapshot(fixture(15));
  const write=prepareMarkWrite(latest,old.jobs[0].id,'saved',true);
  assert.equal(write.range,"'시트1'!B15");assert.equal(write.value,true);
  assert.equal(prepareMarkWrite(latest,old.jobs[0].id,'applied',true).range,"'시트1'!A15");
  assert.equal(columnName(26),'AA');
});
test('reject unknown jobs, duplicated jobs, arbitrary fields, and nonboolean writes',()=>{
  const snapshot=sheetSnapshot(fixture()),id=snapshot.jobs[0].id;
  assert.throws(()=>prepareMarkWrite(snapshot,'stale','saved',true));
  assert.throws(()=>prepareMarkWrite(snapshot,id,'salary',true));
  assert.throws(()=>prepareMarkWrite(snapshot,id,'saved','TRUE'));
  assert.throws(()=>prepareMarkWrite(sheetSnapshot(fixture(8,true)),id,'saved',true));
});
test('successful save requires the API to echo the stored boolean',async()=>{
  const calls=[];
  const sync=new SheetsSync({fetchImpl:async(url,options)=>{
    calls.push({url,options});return {ok:true,json:async()=>options.method==='PUT'?{updatedCells:1,updatedData:{values:[[true]]}}:fixture(23)};
  }});sync.token='test-only';sync.expires=Date.now()+60000;
  const id=sheetSnapshot(fixture()).jobs[0].id;
  const result=await sync.save(id,'saved',true);
  assert.equal(result.jobs[0].saved,true);assert.equal(result.jobs[0].applied,false);
  const body=JSON.parse(calls[1].options.body);assert.equal(body.range,"'시트1'!B23");assert.deepEqual(body.values,[[true]]);assert.equal(calls.length,2);
});
test('network rejection never reports a successful save; revoked tokens disconnect',async()=>{
  const sync=new SheetsSync({fetchImpl:async()=>({ok:false,status:401})});sync.token='test-only';sync.expires=Date.now()+60000;
  await assert.rejects(()=>sync.save('job','saved',true),/만료/);assert.equal(sync.connected,false);
});
test('another device reads exactly the latest remote status',async()=>{
  const data=fixture();data.sheets[0].data[1].rowData[0].values[1]=cell(true);
  const device=new SheetsSync({fetchImpl:async()=>({ok:true,json:async()=>data})});device.token='test-only';device.expires=Date.now()+60000;
  assert.equal((await device.read()).jobs[0].saved,true);
});

test('pending Google connection prevents duplicate attempts and resets on denial',async()=>{
  const sync=new SheetsSync();sync.client={requestAccessToken(){}};
  const attempt=sync.connect();
  assert.equal(sync.connecting,true);
  await assert.rejects(sync.connect(),/진행 중/);
  const denied=assert.rejects(attempt,/허용하지/);
  await sync.client.callback({error:'access_denied'});
  await denied;
  assert.equal(sync.connecting,false);assert.equal(sync.connected,false);
});

test('previous explicit file grants skip Picker; public visibility alone does not',async()=>{
  const {SHEET_ID}=await import('../dist/model.js');
  const sync=new SheetsSync();let chosen=0;
  sync.request=async()=>({id:SHEET_ID,isAppAuthorized:true,capabilities:{canEdit:true}});
  sync.pickSheet=async()=>{chosen++;};
  await sync.ensureSheetAccess();assert.equal(chosen,0);
  let reads=0;sync.request=async()=>({id:SHEET_ID,isAppAuthorized:++reads>1,capabilities:{canEdit:true}});
  await sync.ensureSheetAccess();assert.equal(chosen,1);
  sync.request=async()=>({id:SHEET_ID,isAppAuthorized:true,capabilities:{canEdit:false}});
  await assert.rejects(sync.ensureSheetAccess(),/수정할 수 없습니다/);
});
