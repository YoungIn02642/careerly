/* 지방공기업·지방출자출연기관 수집 → data/local-public-orgs.json
   기업규모 분류(src/company-classify.js)의 '공공기관' 판별을 메우는 네 번째 소스.

   왜 필요한가:
     기존 공공기관 캐시(scripts/fetch-public-orgs.js)가 쓰는 재정경제부
     지정현황 355건은 공공기관운영법 대상 — 즉 중앙정부 산하만 담는다.
     지방공기업법·지방출연기관법 대상인 지자체 산하 기관은 별도 고시라
     그 명단에 없고, 그래서 서울교통공사·서울시설공단·용인문화재단 같은
     누가 봐도 공기업인 곳이 기본값 '중소기업' 으로 떨어졌다.

   출처: 행정안전부 지방공기업평가원 (data.go.kr, 둘 다 파일데이터)
     - 지방공기업 설립현황        15048282  (직영기업·공사·공단)
     - 지방출자출연기관 설립현황  15048281  (출자기관·출연기관)

   fetch-public-orgs.js 와 같은 방식이다 — 파일데이터 자동변환 API 라
   호스트가 api.odcloud.kr 이고, 연도마다 리소스(uddi)가 새로 생기므로
   uddi 를 박지 않고 OAS 명세에서 최신 고시본을 찾아 쓴다.

   ※ 파일데이터는 데이터셋마다 활용신청이 따로 필요하다(즉시 자동승인).
     안 하면 키가 멀쩡해도 401 이 떨어진다. 아래 두 페이지에서 신청할 것:
       https://www.data.go.kr/data/15048282/fileData.do
       https://www.data.go.kr/data/15048281/fileData.do

     node scripts/fetch-local-public-orgs.js
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const KEY = (process.env.DATA_GO_KR_SERVICE_KEY || '').trim();
const OAS = 'https://infuser.odcloud.kr/oas/docs?namespace=';
const API = 'https://api.odcloud.kr/api';

const DATASETS = [
  { id: '15048282', label: '지방공기업 설립현황',       kind: '지방공기업' },
  { id: '15048281', label: '지방출자출연기관 설립현황', kind: '지방출자출연기관' },
];

/* 명세의 경로들 중 가장 최신 고시본을 고른다.
   summary 예: '행정안전부 지방공기업평가원_지방공기업 설립현황_20250724'
   — 뒤의 8자리 날짜로 비교한다. 날짜가 없는 옛 표기는 후보에서 뺀다. */
async function findLatestResource(id) {
  const res = await fetch(`${OAS}${id}/v1`);
  if (!res.ok) throw new Error(`OAS ${res.status}`);
  const oas = await res.json();

  const cands = Object.entries(oas.paths || {}).map(([p, v]) => {
    const summary = v.get?.summary || '';
    const ymd = summary.match(/(20\d{6})/)?.[1];
    return ymd ? { path: p, ymd, summary } : null;
  }).filter(Boolean);

  if (!cands.length) throw new Error(`${id}: 날짜가 붙은 리소스를 찾지 못했습니다.`);
  cands.sort((a, b) => b.ymd.localeCompare(a.ymd));
  return cands[0];
}

/* 컬럼명이 고시본마다 흔들린다(기관명 / 공사·공단명 / 법인명 …).
   데이터셋 스키마를 코드에 박는 대신 후보 패턴으로 첫 일치 컬럼을 집는다.
   이러면 내년 고시에서 컬럼명이 바뀌어도 대개 그대로 돈다. */
function pick(row, patterns) {
  for (const re of patterns) {
    const k = Object.keys(row).find(k => re.test(k));
    if (k && row[k] != null && String(row[k]).trim()) return String(row[k]).trim();
  }
  return null;
}

const NAME_PATTERNS = [/기관\s*명/, /공사.*공단.*명/, /법인\s*명/, /기업\s*명/, /^명칭/, /명$/];
const TYPE_PATTERNS = [/유형/, /구분/, /형태/];
const REGION_PATTERNS = [/시\s*도/, /지역/, /광역/, /자치단체/, /소재/];

async function fetchAll(ds) {
  const latest = await findLatestResource(ds.id);
  const rows = [];
  let page = 1, total = Infinity;

  /* 지방공기업 400여 / 출자출연 800여 건이라 보통 한 페이지면 끝나지만,
     늘어나도 조용히 잘리지 않게 페이지네이션을 돌린다. */
  while (rows.length < total) {
    const url = `${API}${latest.path}?page=${page}&perPage=1000&serviceKey=${encodeURIComponent(KEY)}`;
    const res = await fetch(url);
    if (res.status === 401) {
      throw new Error(
        `${ds.id} 활용신청이 안 돼 있습니다(401). ` +
        `https://www.data.go.kr/data/${ds.id}/fileData.do 에서 활용신청하면 즉시 승인됩니다.`
      );
    }
    if (!res.ok) throw new Error(`${ds.id} API ${res.status}: ${(await res.text()).slice(0, 120)}`);

    const body = await res.json();
    total = body.totalCount ?? 0;
    const data = body.data || [];
    if (!data.length) break;
    rows.push(...data);
    page += 1;
  }

  return { latest, rows };
}

(async () => {
  if (!KEY) throw new Error('DATA_GO_KR_SERVICE_KEY 가 .env 에 없습니다.');

  const organizations = [];
  const resources = [];
  const seen = new Set();

  for (const ds of DATASETS) {
    const { latest, rows } = await fetchAll(ds);
    console.log(`${ds.label}: ${latest.summary} — ${rows.length}건`);
    resources.push(latest.summary);

    let kept = 0;
    rows.forEach(r => {
      const name = pick(r, NAME_PATTERNS);
      if (!name) return;
      /* 같은 기관이 두 데이터셋에 겹쳐 들어오는 경우가 있다(예: 공단이 출연기관을 겸함) */
      if (seen.has(name)) return;
      seen.add(name);
      organizations.push({
        name,
        type: '공공기관',
        kind: ds.kind,                        // 지방공기업 / 지방출자출연기관
        raw: pick(r, TYPE_PATTERNS),          // '공사' '공단' '출연기관' 등 원문 유형
        region: pick(r, REGION_PATTERNS),     // '서울특별시' 등
      });
      kept += 1;
    });
    console.log(`  → 기관명 추출 ${kept}건`);

    if (!kept && rows.length) {
      console.warn('  ⚠ 기관명 컬럼을 못 찾았습니다. 실제 컬럼:', Object.keys(rows[0]).join(', '));
    }
  }

  const out = {
    source: '행정안전부 지방공기업평가원_지방공기업/지방출자출연기관 설립현황 (data.go.kr 15048282, 15048281)',
    resources,
    fetchedAt: new Date().toISOString(),
    count: organizations.length,
    organizations,
  };

  const dest = path.join(__dirname, '..', 'data', 'local-public-orgs.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));

  const byKind = {};
  organizations.forEach(o => { byKind[o.kind] = (byKind[o.kind] || 0) + 1; });
  console.log('\n저장:', dest);
  console.log('기관 수:', organizations.length);
  Object.entries(byKind).forEach(([k, v]) => console.log('  ', k.padEnd(20), v));
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
