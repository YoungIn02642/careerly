/* 공공기관 지정현황 수집 → data/public-orgs.json
   기업규모 분류(src/company-classify.js)의 '공공기관' 판별 캐시.

   출처: 재정경제부_공공기관 지정현황 (data.go.kr 15088742)
         공공기관운영법에 따라 매년 지정·고시되는 355개 기관.
         https://www.data.go.kr/data/15088742/fileData.do

   파일데이터 자동변환 API 라 호스트가 apis.data.go.kr 이 아니라 api.odcloud.kr 이다.
   연도마다 리소스(uddi)가 새로 생기므로 uddi 를 코드에 박지 않고
   OAS 명세에서 최신판을 찾아 쓴다. 그래야 내년 고시가 나와도 그대로 돈다.

     node scripts/fetch-public-orgs.js
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const KEY = (process.env.DATA_GO_KR_SERVICE_KEY || '').trim();
const NAMESPACE = '15088742/v1';
const OAS = `https://infuser.odcloud.kr/oas/docs?namespace=${NAMESPACE}`;
const API = 'https://api.odcloud.kr/api';

/* 명세의 경로들 중 가장 최신 고시본을 고른다.
   summary 예: '재정경제부_공공기관 지정현황_20260617' — 뒤의 8자리 날짜로 비교한다.
   날짜가 없는 옛 표기('..._02/28/2021')는 후보에서 뺀다. */
async function findLatestResource() {
  const oas = await (await fetch(OAS)).json();
  const cands = Object.entries(oas.paths || {}).map(([p, v]) => {
    const summary = v.get?.summary || '';
    const ymd = summary.match(/(20\d{6})/)?.[1];
    return ymd ? { path: p, ymd, summary } : null;
  }).filter(Boolean);

  if (!cands.length) throw new Error('OAS 에서 날짜가 붙은 리소스를 찾지 못했습니다.');
  cands.sort((a, b) => b.ymd.localeCompare(a.ymd));
  return cands[0];
}

/* 기관유형 → 우리 분류.
   지정현황에 오르면 시장형·준시장형 공기업이든 준정부기관이든 기타공공기관이든
   전부 '공공기관' 한 칸으로 들어간다. 원문 유형은 raw 로 남겨 나중에 세분화 여지를 둔다. */
function toCorpType() { return '공공기관'; }

(async () => {
  if (!KEY) throw new Error('DATA_GO_KR_SERVICE_KEY 가 .env 에 없습니다.');

  const latest = await findLatestResource();
  console.log('최신 고시본:', latest.summary);

  const url = `${API}${latest.path}?page=1&perPage=1000&serviceKey=${encodeURIComponent(KEY)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const body = await res.json();

  const rows = body.data || [];
  if (rows.length < body.totalCount) {
    /* 355건이라 한 페이지에 다 들어오지만, 늘어나면 여기서 걸러진다 */
    throw new Error(`전체 ${body.totalCount}건 중 ${rows.length}건만 받았습니다. perPage 를 늘리거나 페이지네이션이 필요합니다.`);
  }

  const organizations = rows
    .filter(r => r.기관명)
    .map(r => ({
      name: String(r.기관명).trim(),
      type: toCorpType(),
      raw: r.기관유형 || null,      // '공기업(시장형)' 등 원문 유형
      ministry: r.주무부처 || null,
    }));

  const out = {
    source: '재정경제부_공공기관 지정현황 (data.go.kr 15088742)',
    resource: latest.summary,
    fetchedAt: new Date().toISOString(),
    count: organizations.length,
    organizations,
  };

  const dest = path.join(__dirname, '..', 'data', 'public-orgs.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));

  const byRaw = {};
  organizations.forEach(o => { byRaw[o.raw] = (byRaw[o.raw] || 0) + 1; });
  console.log('저장:', dest);
  console.log('기관 수:', organizations.length);
  Object.entries(byRaw).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ', String(k).padEnd(18), v));
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
