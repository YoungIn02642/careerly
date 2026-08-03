/* 대학 목록 수집 → data/universities.json
   스펙 입력 화면의 '학교' 자동완성 카탈로그 캐시.

   출처: 교육부·한국직업능력연구원 커리어넷 학교정보 오픈API
         https://www.career.go.kr/cnet/front/openapi/openApiSchoolCenter.do

   ── 키가 다르다 ──
   다른 fetch-*.js 가 쓰는 DATA_GO_KR_SERVICE_KEY 가 아니라 **커리어넷 자체 키**
   (CAREERNET_API_KEY)다. data.go.kr 등록이 'LINK' 형식이라 호출은 커리어넷으로 직접 간다.

   ── 파서를 고치기 전에 check-careernet-api.js 를 돌릴 것 ──
   아래 필드명은 문서 기준이다. 공공 API 명세서가 실제와 어긋난 전례가 있어
   (고용24 의 coNm/coClcdNm — 작업정리 3-3) 응답 키를 여러 후보로 받아 둔다.
   그래도 0건이면 점검 스크립트로 실제 필드를 먼저 확인한다.

     node scripts/check-careernet-api.js     # 실제 응답 필드 확인
     node scripts/fetch-universities.js      # 수집
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const KEY = (process.env.CAREERNET_API_KEY || '').trim();
const API = 'https://www.career.go.kr/cnet/openapi/getOpenApi';
const OUT = path.join(__dirname, '..', 'data', 'universities.json');

/* 전문대학과 4년제를 모두 받는다. 한쪽만 받으면 그 학교 학생이 자기 학교를
   못 찾고 직접 입력으로 빠지는데, 표기가 제각각이 되어 집계가 흔들린다. */
const KINDS = [
  { sch1: '100322', gubun: '전문대학' },
  { sch1: '100323', gubun: '대학(4년제)' },
];

const PER_PAGE = 100;
const MAX_PAGES = 60;          // 국내 대학은 400여 개다. 안전장치일 뿐 도달할 일이 없다

/* 응답 키가 문서와 다를 수 있어 후보를 순서대로 본다. */
const pick = (row, ...keys) => {
  for (const k of keys) {
    const v = row?.[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
};

/* 목록이 응답 어디에 들어 있는지 단정하지 않는다(check 스크립트와 같은 이유). */
function findList(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return null;
  if (Array.isArray(obj)) return obj.length ? obj : null;
  for (const v of Object.values(obj)) {
    const hit = findList(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

async function fetchPage(sch1, page) {
  const u = `${API}?${new URLSearchParams({
    apiKey: KEY, svcType: 'api', svcCode: 'SCHOOL', contentType: 'json',
    gubun: 'univ_list', sch1, thisPage: String(page), perPage: String(PER_PAGE),
  })}`;
  const res = await fetch(u);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 160)}`);

  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`JSON 이 아닙니다 — ${text.slice(0, 160)}`); }
  return findList(json) || [];
}

(async () => {
  if (!KEY) {
    console.error('CAREERNET_API_KEY 가 .env 에 없습니다.');
    console.error('  발급: https://www.career.go.kr/cnet/front/openapi/openApiApply01Center.do');
    process.exit(1);
  }

  /* 이름을 키로 합친다. 같은 학교가 캠퍼스별로 여러 줄 오는 경우가 있는데,
     학생이 고르는 값은 학교 이름이므로 한 줄로 모은다. */
  const byName = new Map();

  for (const { sch1, gubun } of KINDS) {
    let got = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const rows = await fetchPage(sch1, page);
      if (!rows.length) break;

      for (const r of rows) {
        const name = pick(r, 'schoolName', 'schoolNm', 'scl_nm', 'name');
        if (!name) continue;
        if (!byName.has(name)) {
          byName.set(name, {
            name,
            gubun: pick(r, 'schoolGubun', 'schoolType', 'sch1Nm') || gubun,
            region: pick(r, 'region', 'adres', 'addr'),
            est: pick(r, 'estType', 'est', 'fondTyp'),
          });
        }
      }
      got += rows.length;
      if (rows.length < PER_PAGE) break;      // 마지막 페이지
    }
    console.log(`  ${gubun}: ${got}건 수신`);
  }

  const universities = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  if (!universities.length) {
    throw new Error('0건입니다 — 응답 형식이 다를 수 있습니다. '
      + 'node scripts/check-careernet-api.js 로 실제 필드를 확인하세요.');
  }

  const out = {
    fetchedAt: new Date().toISOString(),
    source: '교육부·한국직업능력연구원 커리어넷 학교정보 오픈API',
    count: universities.length,
    universities,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

  console.log(`\n저장 완료 → ${path.relative(process.cwd(), OUT)}`);
  console.log(`  총 ${universities.length}개교`);
  console.log('  예시:', universities.slice(0, 5).map(u => u.name).join(' · '));
})().catch(e => {
  console.error('실패:', e.message);
  process.exit(1);
});
