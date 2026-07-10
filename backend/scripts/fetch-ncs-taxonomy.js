/* NCS 공식 분류(대/중/소) 수집 → data/ncs-taxonomy.json
   15128213 NCS 기준정보 조회. NCS001 대분류 / NCS002 중분류 / NCS003 소분류. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'), path = require('path');
const KEY = (process.env.DATA_GO_KR_SERVICE_KEY||'').trim();
const CLS = 'https://apis.data.go.kr/B490007/hrdkapi';
const get = async u => (await fetch(u)).json();
const items = j => { const it = j?.response?.body?.items?.item ?? []; return Array.isArray(it)?it:(it?[it]:[]); };
const q = (op,p={}) => `${CLS}/${op}?serviceKey=${KEY}&numOfRows=1000&pageNo=1&dataFormat=json&${new URLSearchParams(p)}`;
// 차수 중복 제거: 같은 코드 중 최신 차수만
function dedupLatest(arr, codeKey, nameKey) {
  const m = new Map();
  for (const x of arr) {
    const c = x[codeKey]; const cur = m.get(c);
    if (!cur || (x.NCS_DEGR||0) > (cur.NCS_DEGR||0)) m.set(c, x);
  }
  return [...m.values()].sort((a,b)=>a[codeKey].localeCompare(b[codeKey]));
}
(async () => {
  const tree = [];
  const lcls = dedupLatest(items(await get(q('NCS001'))), 'NCS_LCLAS_CD');
  for (const L of lcls) {
    const mcls = dedupLatest(items(await get(q('NCS002',{NCS_LCLAS_CD:L.NCS_LCLAS_CD}))), 'NCS_MCLAS_CD');
    const middles = [];
    for (const M of mcls) {
      const scls = dedupLatest(items(await get(q('NCS003',{NCS_LCLAS_CD:L.NCS_LCLAS_CD, NCS_MCLAS_CD:M.NCS_MCLAS_CD}))), 'NCS_SCLAS_CD');
      middles.push({ code: M.NCS_MCLAS_CD, name: M.NCS_MCLAS_CDNM,
        smalls: scls.map(s => ({ code: s.NCS_SCLAS_CD, name: s.NCS_SCLAS_CDNM })) });
    }
    tree.push({ code: L.NCS_LCLAS_CD, name: L.NCS_LCLAS_CDNM, middles });
    console.log(`${L.NCS_LCLAS_CD} ${L.NCS_LCLAS_CDNM}: 중분류 ${middles.length}, 소분류 ${middles.reduce((a,m)=>a+m.smalls.length,0)}`);
  }
  const out = path.join(__dirname, '..', 'data', 'ncs-taxonomy.json');
  fs.writeFileSync(out, JSON.stringify(tree, null, 2));
  console.log('\n저장:', out, '| 대분류', tree.length);
})().catch(e=>{ console.error('실패:', e.message); process.exit(1); });
