import {SHEET_ID,SHEET_URL,CATEGORIES,REFRESH_MS,kstDate,deadlineDays,skillTags,normalizeRows,selectJobs} from './model.js';
import {readXlsx} from './xlsx.js';
import {icon,hydrateIcons} from './icons.js';
import {SheetsSync,isSyncConfigured} from './sheets-sync.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const CACHE_KEY=`career-signal:${SHEET_ID}:cache:v1`,MARKS_KEY=`career-signal:${SHEET_ID}:marks:v1`;
const state={jobs:[],marks:{},query:'',category:'전체',view:'all',includeClosed:false,closing:false,sort:'deadline',limit:24,checkedAt:null,busy:false,saving:false,revision:0,dialogId:null,today:kstDate()};
function readStored(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
function writeStored(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
// Preserve old local marks for export, but never let them mask shared sheet values.
const storedMarks=readStored(MARKS_KEY);
const marked=(job,key)=>typeof state.marks[job.id]?.[key]==='boolean'?state.marks[job.id][key]:job[key];
const sync=new SheetsSync({onState:mode=>{
  $('sync-button').textContent=mode==='connected'?'Google 연결됨':mode==='connecting'?'연결 중…':'Google 연결';
  $('sync-button').classList.toggle('connected',mode==='connected');
}});
hydrateIcons();
document.querySelectorAll('.sheet-link').forEach(a=>a.href=SHEET_URL);
$('today').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());
function renderCategories(){
  $('category-nav').innerHTML=CATEGORIES.slice(1).map(name=>`<button data-category="${name}" class="${state.category===name?'active':''}" aria-pressed="${state.category===name}"><i class="category-dot"></i>${esc(name)}</button>`).join('');
  $('category-chips').innerHTML=CATEGORIES.map(name=>`<button class="chip ${state.category===name?'active':''}" data-category="${name}" aria-pressed="${state.category===name}">${esc(name)}</button>`).join('');
}
function deadlineLabel(job){const days=deadlineDays(job.deadline);return days===null?job.deadline||'마감일 미정':days<0?'마감':days===0?'오늘 마감':`D-${days}`;}
function renderCard(job,index){
  const days=deadlineDays(job.deadline),urgent=days!==null&&days>=0&&days<=7,closed=days!==null&&days<0;
  const name=job.company.replace(/[㈜()\s]/g,'').replace(/^주식회사/,'');
  const palette=['','blue','sand','rose'][name.charCodeAt(0)%4];
  const tags=skillTags(job);
  return `<article class="job-card" data-id="${esc(job.id)}"><div class="card-top"><span class="company-logo ${palette}" aria-hidden="true">${esc(name.slice(0,2))}</span><button class="bookmark-button ${marked(job,'saved')?'selected':''}" data-action="saved" aria-label="${esc(job.company)} 관심 공고 ${marked(job,'saved')?'해제':'저장'}" aria-pressed="${marked(job,'saved')}">${icon('bookmark')}</button></div><p class="company-name">${esc(job.company)}${marked(job,'applied')?'<span class="applied-label">✓ 지원 완료</span>':''}</p><h3 class="job-title"><button data-action="detail">${esc(job.title)}</button></h3><div class="tags"><span class="tag">${esc(job.category)}</span>${tags.slice(0,2).map(tag=>`<span class="tag secondary">${esc(tag)}</span>`).join('')}</div><div class="card-meta">${icon('wallet')}<span>${esc(job.salary)}</span></div><div class="card-bottom"><span class="deadline-badge ${urgent?'urgent':''} ${closed?'closed':''}">${esc(deadlineLabel(job))}</span><button class="card-action" data-action="detail">자세히 보기 ${icon('arrow-up-right')}</button></div></article>`;
}
function render(){
  renderCategories();
  const active=state.jobs.filter(j=>{const d=deadlineDays(j.deadline);return d===null||d>=0;});
  const closing=active.filter(j=>{const d=deadlineDays(j.deadline);return d!==null&&d<=7;});
  const saved=state.jobs.filter(j=>marked(j,'saved')),applied=state.jobs.filter(j=>marked(j,'applied'));
  for(const [id,num] of Object.entries({'stat-open':active.length,'stat-closing':closing.length,'stat-saved':saved.length,'stat-applied':applied.length,'nav-all':state.jobs.length,'nav-saved':saved.length,'nav-applied':applied.length}))$(id).textContent=num.toLocaleString('ko-KR');
  $('spotlight-title').textContent=closing.length?`이번 주에 마감되는 ${closing.length}개의 기회, 놓치지 마세요.`:'나에게 맞는 다음 기회를 발견해 보세요.';
  const today=active.filter(j=>deadlineDays(j.deadline)===0).length;
  $('spotlight-description').textContent=today?`오늘 마감 ${today}건 · 관심 있는 기업의 지원 일정을 확인해 보세요.`:'관심 있는 공고를 저장하고, 나의 속도로 다음 단계를 준비해요.';
  const titles={all:'전체 채용 공고',saved:'나의 관심 공고',applied:'나의 지원 현황'};
  $('jobs-heading').textContent=titles[state.view];$('breadcrumb-view').textContent={all:'전체 공고',saved:'관심 공고',applied:'지원 현황'}[state.view];
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-current',b.dataset.view===state.view?'page':'false');});
  const jobs=selectJobs(state.jobs,state,state.marks);
  $('result-count').textContent=jobs.length;
  $('job-grid').innerHTML=jobs.slice(0,state.limit).map(renderCard).join('');$('job-grid').setAttribute('aria-busy',String(state.busy));
  if(state.sort.startsWith('employees-'))$('job-grid').querySelectorAll('.job-card').forEach((card,i)=>{const metric=document.createElement('p');metric.className='metric-extra';metric.textContent=`직원 수 · ${jobs[i].employees}`;card.querySelector('.card-meta').after(metric);});
  $('empty-state').hidden=jobs.length>0;
  $('load-more').hidden=jobs.length<=state.limit;
  $('load-more').innerHTML=`공고 더 보기 (${Math.min(state.limit,jobs.length)} / ${jobs.length}) ${icon('chevron-down')}`;
  $('include-closed').checked=state.includeClosed;$('sort').value=state.sort;
  $('sort-note').hidden=!/^(salary|employees)-/.test(state.sort);
  $('sort-note').textContent=state.sort.startsWith('salary-')?'연봉 하한액 기준 · 월급은 ×12로 환산 · 미공개는 마지막에 표시합니다.':'직원 수 기준 · 범위는 하한값으로 비교 · 확인 불가 정보는 마지막에 표시합니다.';
  document.querySelectorAll('[data-action="saved"],[data-mark]').forEach(b=>b.disabled=state.saving);
  const filters=[state.category!=='전체'?state.category:'',state.closing?'7일 이내 마감':'',state.query?`“${state.query}” 검색`:''].filter(Boolean);
  $('filter-summary').hidden=!filters.length;$('filter-summary').querySelector('span').textContent=filters.join(' · ');
}
function showNotice(message){$('notice').hidden=!message;$('notice').textContent=message;}
function status(kind,label){$('connection').className=`connection ${kind}`;$('connection').querySelector('span').textContent=label;}
function checkedLabel(){
  if(!state.checkedAt)return;
  const date=new Date(state.checkedAt);
  const time=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
  $('last-checked').textContent=`최근 확인 ${time}`;
}
async function refresh(){
  if(state.busy||state.saving)return;
  if(sync.token&&!sync.connected)sync.disconnect();
  const revision=state.revision;
  state.busy=true;$('refresh').disabled=true;$('job-grid').setAttribute('aria-busy','true');status('loading','최신 정보 확인 중');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
  try{
    let jobs;
    if(sync.connected){jobs=(await sync.read()).jobs;}else{
      const response=await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=0&_=${Date.now()}`,{cache:'no-store',credentials:'omit',signal:controller.signal});
      if(!response.ok)throw new Error(`시트 응답 오류 (${response.status})`);
      const buffer=await response.arrayBuffer();
      if(buffer.byteLength>30_000_000)throw new Error('시트 파일이 너무 큽니다.');
      jobs=normalizeRows(await readXlsx(buffer));
    }
    if(revision!==state.revision)return;
    state.jobs=jobs;state.checkedAt=new Date().toISOString();
    writeStored(CACHE_KEY,{jobs,checkedAt:state.checkedAt});
    checkedLabel();status('','시트 연결됨');showNotice('');
  }catch(error){
    if(revision!==state.revision)return;
    status('error',state.jobs.length?'저장된 자료 표시':'연결 확인 필요');
    showNotice(`${state.jobs.length?'최신 정보를 불러오지 못해 마지막으로 확인한 자료를 표시합니다.':'구글 시트를 불러오지 못했습니다.'} 인터넷 연결과 원본 시트의 ‘링크가 있는 모든 사용자: 뷰어’ 설정을 확인해 주세요. 1분 뒤 다시 시도합니다.`);
    console.warn('Sheet refresh failed:',error.name,error.message);
  }finally{
    clearTimeout(timeout);state.busy=false;$('refresh').disabled=false;render();
    if(state.dialogId&&$('job-dialog').open)renderDialog(state.dialogId);
  }
}
let toastTimeout;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').hidden=true,3500);}
async function toggleMark(job,key){
  if(state.saving)return;
  if(!sync.connected){openSyncDialog();return;}
  const value=!marked(job,key);state.saving=true;state.revision++;
  state.marks={[job.id]:{[key]:value}};
  render();if($('job-dialog').open)renderDialog(job.id);status('loading','시트에 저장 중');
  try{
    const snapshot=await sync.save(job.id,key,value);
    state.jobs=snapshot.jobs;state.checkedAt=new Date().toISOString();
    writeStored(CACHE_KEY,{jobs:state.jobs,checkedAt:state.checkedAt});checkedLabel();showNotice('');
    toast(`${key==='saved'?'관심 공고':'지원 여부'}를 구글 시트에 저장했어요. 다른 기기에도 반영됩니다.`);
  }catch(error){
    showNotice(`${error.message} 화면을 원래 상태로 되돌렸습니다. 연결 후 새로고침으로 저장 여부를 확인해 주세요.`);
    toast('시트 저장을 확인하지 못했습니다.');
  }finally{
    state.marks={};state.saving=false;state.revision++;
    status('','시트 연결됨');render();if($('job-dialog').open)renderDialog(job.id);
  }
}
function renderDialog(id){
  const job=state.jobs.find(j=>j.id===id);if(!job){$('job-dialog').close();return;}
  state.dialogId=id;
  $('dialog-content').innerHTML=`<div class="company-logo" aria-hidden="true">${esc(job.company.replace(/[㈜()\s]/g,'').slice(0,2))}</div><div class="dialog-company">${esc(job.company)}</div><h2 id="dialog-title" class="dialog-title">${esc(job.title)}</h2><div class="tags"><span class="tag">${esc(job.category)}</span><span class="tag secondary">${esc(deadlineLabel(job))}</span></div><dl class="detail-grid"><div><dt>연봉</dt><dd>${esc(job.salary)}</dd></div><div><dt>모집 마감일</dt><dd>${esc(job.deadline||'확인 필요')}</dd></div><div><dt>매출액</dt><dd>${esc(job.revenue)}</dd></div><div><dt>직원수</dt><dd>${esc(job.employees)}</dd></div></dl><h3 class="detail-label">요구 기술 & 지원 자격</h3><p class="detail-text">${esc(job.skills||'원본 공고에서 자세한 자격 요건을 확인해 주세요.')}</p><div class="dialog-actions"><button class="secondary-button" data-mark="saved" aria-pressed="${marked(job,'saved')}">${icon('bookmark')} ${marked(job,'saved')?'관심 저장됨':'관심 저장'}</button><button class="secondary-button" data-mark="applied" aria-pressed="${marked(job,'applied')}">${icon('check-circle')} ${marked(job,'applied')?'지원 완료':'지원 완료 표시'}</button><a class="primary-button" href="${esc(job.url||`${SHEET_URL}&range=C${job.row}:J${job.row}`)}" target="_blank" rel="noopener noreferrer">${job.url?'원본 공고 보기':'시트에서 확인'} ${icon('arrow-up-right')}</a></div><p class="dialog-note">Google 연결 후 변경한 관심·지원 상태는 원본 시트에 저장되어 다른 기기에서도 표시됩니다.<br>지원 마감 시간과 자격 요건은 원본 공고에서 최종 확인해 주세요.</p>`;
  $('dialog-content').querySelectorAll('[data-mark]').forEach(b=>b.disabled=state.saving);
  $('job-dialog').setAttribute('aria-labelledby','dialog-title');
}
function setView(view){state.view=view;state.includeClosed=view!=='all';state.closing=false;state.limit=24;render();}
function reset(){state.query='';state.category='전체';state.closing=false;state.view='all';state.includeClosed=false;state.limit=24;$('search').value='';render();}
function showClosing(){state.view='all';state.closing=true;state.includeClosed=false;state.limit=24;state.category='전체';state.query='';$('search').value='';render();$('jobs-heading').scrollIntoView({behavior:'smooth',block:'start'});}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelectorAll('[data-stat]').forEach(b=>b.addEventListener('click',()=>{const mode=b.dataset.stat;if(mode==='closing')showClosing();else{reset();setView(mode==='open'?'all':mode);$('jobs-heading').scrollIntoView({behavior:'smooth',block:'start'});}}));
for(const id of ['category-nav','category-chips'])$(id).addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){state.category=b.dataset.category;state.limit=24;render();}});
$('search').addEventListener('input',e=>{state.query=e.target.value;state.limit=24;render();});
$('sort').addEventListener('change',e=>{state.sort=e.target.value;render();});
$('include-closed').addEventListener('change',e=>{state.includeClosed=e.target.checked;render();});
$('clear-filters').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);
$('closing-shortcut').addEventListener('click',showClosing);$('refresh').addEventListener('click',refresh);
$('load-more').addEventListener('click',()=>{state.limit+=24;render();});
$('job-grid').addEventListener('click',e=>{const action=e.target.closest('[data-action]'),card=e.target.closest('[data-id]');if(!action||!card)return;const job=state.jobs.find(j=>j.id===card.dataset.id);if(!job)return;if(action.dataset.action==='saved')toggleMark(job,'saved');else{renderDialog(job.id);$('job-dialog').showModal();}});
$('dialog-content').addEventListener('click',e=>{const b=e.target.closest('[data-mark]');if(!b)return;const job=state.jobs.find(j=>j.id===state.dialogId);if(job)toggleMark(job,b.dataset.mark);});
$('dialog-close').addEventListener('click',()=>$('job-dialog').close());
$('job-dialog').addEventListener('click',e=>{if(e.target===$('job-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('job-dialog').addEventListener('close',()=>state.dialogId=null);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('job-dialog').open){e.preventDefault();$('search').focus();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('online',refresh);
function applySnapshot(snapshot){state.revision++;state.jobs=snapshot.jobs;state.checkedAt=new Date().toISOString();writeStored(CACHE_KEY,{jobs:state.jobs,checkedAt:state.checkedAt});checkedLabel();showNotice('');render();if($('job-dialog').open)renderDialog(state.dialogId);}
async function openSyncDialog(){
  $('sync-dialog').showModal();
  $('google-disconnect').hidden=!sync.connected;
  $('google-connect').hidden=sync.connected;
  $('export-local').hidden=!storedMarks||!Object.keys(storedMarks).length;
  if(sync.connected){$('sync-message').textContent='Google 계정에 연결되어 있습니다. 관심·지원 표시를 바꾸면 시트에 저장합니다.';return;}
  $('google-connect').disabled=true;
  if(!isSyncConfigured()){$('sync-message').textContent='Google 연결 설정을 준비하고 있습니다. 설정을 마치면 이 버튼으로 시트를 연결할 수 있어요.';return;}
  $('sync-message').textContent='Google 연결 준비 중…';
  try{await sync.prepare();$('google-connect').disabled=false;$('sync-message').textContent='시트를 수정할 수 있는 Google 계정으로 연결해 주세요.';}catch(error){$('sync-message').textContent=error.message;}
}
$('sync-button').addEventListener('click',openSyncDialog);
$('sync-close').addEventListener('click',()=>$('sync-dialog').close());
$('google-connect').addEventListener('click',()=>{
  const connection=sync.connect(); // Keep the user gesture for the Google popup.
  $('sync-dialog').close(); // Google Picker must be outside a native modal's inert backdrop.
  if($('job-dialog').open)$('job-dialog').close();
  connection.then(snapshot=>{applySnapshot(snapshot);toast('구글 시트에 연결했어요. 이제 모든 기기에서 같은 상태를 확인할 수 있습니다.');}).catch(error=>{$('sync-dialog').showModal();$('sync-message').textContent=error.message;});
});
$('google-disconnect').addEventListener('click',()=>{sync.disconnect();$('sync-dialog').close();toast('현재 기기의 연결을 해제했습니다. 저장된 시트 내용은 유지됩니다.');});
$('export-local').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(storedMarks,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='career-signal-local-marks-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
setInterval(()=>{if(sync.connected&&!document.hidden)refresh();},15_000);
setInterval(()=>{if(!document.hidden)refresh();},REFRESH_MS);
setInterval(()=>{const today=kstDate();if(today!==state.today){state.today=today;render();}},30_000);
const cached=readStored(CACHE_KEY);
if(Array.isArray(cached?.jobs)&&cached.jobs.every(j=>j&&typeof j.id==='string'&&typeof j.company==='string')&&!Number.isNaN(Date.parse(cached.checkedAt))){state.jobs=cached.jobs;state.checkedAt=cached.checkedAt;checkedLabel();showNotice('마지막으로 확인한 자료입니다. 최신 정보를 확인하고 있어요.');render();}else renderCategories();
refresh();
