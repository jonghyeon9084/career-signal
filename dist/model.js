export const SHEET_ID = '1bFrrWXkjdT-nU1Zqj-Hy_Hoqe6LDtub8__FX7T_Z-vQ';
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`;
export const CATEGORIES = ['전체', 'PLC·자동제어', '로봇·자율주행', 'SW·임베디드', '기타'];
export const REFRESH_MS = 60_000;

export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function kstDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
}
export function deadlineDays(value, today = kstDate()) {
  const match = String(value).match(/(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const target = Date.UTC(y, m - 1, d);
  const check = new Date(target);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return Math.round((target - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
export function classify(title, skills) {
  const text = `${title} ${skills}`;
  // PLC/자동제어 jobs can also mention AMR/AGV, so the primary discipline wins.
  if (/PLC|시퀀스|전기제어|자동제어|전장|제어반|인버터/i.test(text)) return 'PLC·자동제어';
  if (/로봇|자율|SLAM|ROS|LiDAR|모빌리티|AMR|AGV|항법|드론/i.test(text)) return '로봇·자율주행';
  if (/SW|소프트웨어|임베디드|펌웨어|개발|C\+\+|Python|Linux|R&D|제어/i.test(text)) return 'SW·임베디드';
  return '기타';
}
export function skillTags(job) {
  const text = `${job.title} ${job.skills}`;
  const list = [['PLC',/PLC/i],['ROS2',/ROS\s?2/i],['ROS',/\bROS\b(?!2)/i],['SLAM',/SLAM/i],['C++',/C\+\+|C\/C/i],['Python',/Python/i],['Linux',/Linux/i],['CAD',/CAD/i],['LiDAR',/LiDAR/i],['전기제어',/전기제어|전장|시퀀스/i],['자동화',/자동화/i],['임베디드',/임베디드/i]];
  return list.filter(([,re])=>re.test(text)).slice(0,3).map(([name])=>name);
}
export function normalizeRows(rows) {
  const headerIndex = rows.findIndex(row => row.cells.some(cell=>cell.value==='기업명') && row.cells.some(cell=>cell.value==='직무'));
  if (headerIndex < 0) throw new Error('필수 열(기업명, 직무)을 찾지 못했습니다. 원본 시트의 열 이름을 확인해 주세요.');
  const header = rows[headerIndex].cells;
  const index = Object.fromEntries(Array.from(header,(c,i)=>[String(c?.value??'').trim(),i]).filter(([label])=>label));
  const seen = new Set();
  return rows.slice(headerIndex + 1).flatMap(row => {
    const cell = name => row.cells[index[name]] || {};
    const value = name => String(cell(name).value ?? '').trim();
    const company = value('기업명'), title = value('직무');
    if (!company || !title) return [];
    const url = safeUrl(cell('공고 링크').link || value('공고 링크'));
    const key = `${company}|${title}|${url}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const truthy = name=>/^(true|1|yes|y|✓|지원완료)$/i.test(value(name));
    return [{id:key,row:row.number,company,title,skills:value('요구 기술'),salary:value('연봉')||'미공개',revenue:value('매출액')||'확인 불가',employees:value('직원수')||'확인 불가',deadline:value('모집 마감일'),url,category:classify(title,value('요구 기술')),saved:truthy('관심 공고'),applied:truthy('지원 여부')}];
  });
}
export function selectJobs(jobs, {query='', category='전체', view='all', includeClosed=false, closing=false, sort='deadline'}, overrides={}, today=kstDate()) {
  const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const marked=(job,key)=>overrides[job.id]?.[key] ?? job[key];
  return jobs.filter(job=>{
    const days=deadlineDays(job.deadline,today);
    if (!includeClosed && days !== null && days < 0) return false;
    if (closing && (days === null || days < 0 || days > 7)) return false;
    if (category!=='전체' && job.category!==category) return false;
    if (view==='saved' && !marked(job,'saved')) return false;
    if (view==='applied' && !marked(job,'applied')) return false;
    const haystack=`${job.company} ${job.title} ${job.skills} ${job.salary}`.toLocaleLowerCase();
    return terms.every(term=>haystack.includes(term));
  }).sort((a,b)=>{
    if(sort==='sheet')return a.row-b.row;
    if(sort==='company')return a.company.localeCompare(b.company,'ko');
    const da=deadlineDays(a.deadline,today),db=deadlineDays(b.deadline,today);
    const rank=d=>d===null?1e8:d<0?1e9-d:d;
    return rank(da)-rank(db)||a.row-b.row;
  });
}
