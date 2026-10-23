import test from 'node:test';
import assert from 'node:assert/strict';
import {deadlineDays,kstDate,safeUrl,normalizeRows,selectJobs,classify,employeeCount,annualSalary,compareKnownNumbers} from '../dist/model.js';
test('deadlines use Korean calendar days including midnight and unknown dates',()=>{
  assert.equal(kstDate(new Date('2026-10-23T15:00:00Z')),'2026-10-24');
  assert.equal(deadlineDays('2026-10-23','2026-10-23'),0);
  assert.equal(deadlineDays('2026. 10. 30','2026-10-23'),7);
  assert.equal(deadlineDays('2026-10-22','2026-10-23'),-1);
  assert.equal(deadlineDays('채용시 마감','2026-10-23'),null);
  assert.equal(deadlineDays('2026-02-31','2026-10-23'),null);
});
test('extract sheet flags, real hyperlink, and duplicate jobs without blank rows',()=>{
  const row=(number,values)=>({number,cells:values.map(value=>typeof value==='object'?value:{value})});
  const data=[row(1,['지원 여부','관심 공고','기업명','직무','요구 기술','연봉','매출액','직원수','모집 마감일','공고 링크']),row(2,[true,'TRUE','테스트 기업','PLC 엔지니어','PLC, Python','','','','2026-10-30',{value:'공고 보기',link:'https://example.com/job'}]),row(3,['','','','','']),row(4,[false,false,'테스트 기업','PLC 엔지니어','PLC','','','','2026-10-30',{value:'공고 보기',link:'https://example.com/job'}])];
  const jobs=normalizeRows(data);assert.equal(jobs.length,1);assert.equal(jobs[0].saved,true);assert.equal(jobs[0].applied,true);assert.equal(jobs[0].url,'https://example.com/job');assert.equal(jobs[0].salary,'미공개');
  assert.equal(safeUrl('javascript:alert(1)'), '');assert.equal(safeUrl('data:text/html,hello'),'');
});
test('filter unknown deadlines, closing boundary, search, and explicit local false overrides',()=>{
  const jobs=[{id:'a',row:2,company:'A',title:'PLC 엔지니어',skills:'Python',deadline:'2026-10-22',category:'PLC·자동제어',saved:true},{id:'b',row:3,company:'B',title:'PLC 엔지니어',skills:'Python',deadline:'2026-10-30',category:'PLC·자동제어',saved:true},{id:'c',row:4,company:'C',title:'ROS2',skills:'SLAM',deadline:'채용시 마감',category:'로봇·자율주행',saved:false}];
  assert.deepEqual(selectJobs(jobs,{}, {},'2026-10-23').map(j=>j.id),['b','c']);
  assert.deepEqual(selectJobs(jobs,{closing:true},{},'2026-10-23').map(j=>j.id),['b']);
  assert.equal(selectJobs(jobs,{view:'saved'},{b:{saved:false}},'2026-10-23').length,0);
  assert.deepEqual(selectJobs(jobs,{query:'plc python'},{},'2026-10-23').map(j=>j.id),['b']);
  assert.equal(classify('AMR 물류자동화 PLC 엔지니어',''),'PLC·자동제어');
});
test('parse headcounts without using year/source metadata',()=>{
  assert.equal(employeeCount('1,234명 (2026, 국민연금)'),1234);
  assert.equal(employeeCount('1.2만명'),12000);
  assert.equal(employeeCount('50~100명 (2026)'),50);
  assert.equal(employeeCount('확인 불가 (2026)'),null);
});
test('compare salary floor consistently across annual/monthly ranges and currencies',()=>{
  assert.equal(annualSalary('4,000~5,000만원'),40000000);
  assert.equal(annualSalary('연 3,500~4,000만원'),35000000);
  assert.equal(annualSalary('월 380~450만원 (면접 후 결정)'),45600000);
  assert.equal(annualSalary('월급 3,000,000원'),36000000);
  assert.equal(annualSalary('연봉 1억원'),100000000);
  assert.equal(annualSalary('미공개 (인턴기간 정규급여 100%)'),null);
  assert.equal(annualSalary('시급 12,000원'),null);
  assert.equal(annualSalary('회사 내규'),null);
});
test('both sort directions keep unknown amounts at the end',()=>{
  const jobs=[{id:'a',row:2,salary:'미공개',employees:'확인 불가'},{id:'b',row:3,salary:'4,000만원',employees:'20명'},{id:'c',row:4,salary:'월 380만원',employees:'100명'}];
  assert.deepEqual(selectJobs(jobs,{sort:'salary-desc'}).map(j=>j.id),['c','b','a']);
  assert.deepEqual(selectJobs(jobs,{sort:'salary-asc'}).map(j=>j.id),['b','c','a']);
  assert.deepEqual(selectJobs(jobs,{sort:'employees-desc'}).map(j=>j.id),['c','b','a']);
  assert.deepEqual(selectJobs(jobs,{sort:'employees-asc'}).map(j=>j.id),['b','c','a']);
});
