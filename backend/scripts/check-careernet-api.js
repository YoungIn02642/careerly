/* 커리어넷 학교정보 API 점검 — 서버를 띄우지 않고 키·응답 형식을 확인한다.
   check-ai.js · check-news-api.js 와 같은 용도다.

   ── 왜 수집 스크립트와 따로 두는가 ──
   이 API 규격은 **문서를 보고 적은 것**이지 실호출로 확인한 게 아니다.
   data.go.kr 등록이 'LINK' 형식이라 명세가 커리어넷 쪽에만 있고, 다른 공공 API 에서
   이미 문서와 실제가 어긋난 전례가 있다(고용24 명세서의 coNm/coClcdNm 오타 — 작업정리 3-3).
   그래서 **파서를 확정하기 전에 여기서 실제 응답 필드를 눈으로 본다.**

     node scripts/check-careernet-api.js
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const KEY = (process.env.CAREERNET_API_KEY || '').trim();
const API = 'https://www.career.go.kr/cnet/openapi/getOpenApi';

/* 문서상 대학 구분 코드. 이 값이 맞는지도 확인 대상이다. */
const SCH1 = { '100322': '전문대학', '100323': '대학(4년제)' };

function url(params) {
  return `${API}?${new URLSearchParams({
    apiKey: KEY, svcType: 'api', svcCode: 'SCHOOL', contentType: 'json',
    gubun: 'univ_list', thisPage: '1', perPage: '5', ...params,
  })}`;
}

/* 응답 어디에 목록이 들어 있는지 모르니 흔한 자리를 훑는다.
   구조를 단정하지 않는 게 이 스크립트의 목적이다. */
function findList(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return null;
  if (Array.isArray(obj)) return obj.length ? obj : null;
  for (const [k, v] of Object.entries(obj)) {
    const hit = findList(v, depth + 1);
    if (hit) return hit;
    if (Array.isArray(v) && v.length) return v;
  }
  return null;
}

(async () => {
  console.log('── 커리어넷 학교정보 API 점검\n');

  if (!KEY) {
    console.error('CAREERNET_API_KEY 가 .env 에 없습니다.');
    console.error('  발급: https://www.career.go.kr/cnet/front/openapi/openApiApply01Center.do');
    console.error('  (공공데이터포털 키와 다른, 커리어넷 자체 키입니다)');
    process.exit(1);
  }
  console.log(`키: ${KEY.slice(0, 6)}…${KEY.slice(-4)} (${KEY.length}자)\n`);

  for (const [code, label] of Object.entries(SCH1)) {
    const t0 = Date.now();
    let res, text;
    try {
      res = await fetch(url({ sch1: code }));
      text = await res.text();
    } catch (e) {
      console.error(`  ${label}: 호출 실패 — ${e.message}`);
      continue;
    }
    const ms = Date.now() - t0;

    let json = null;
    try { json = JSON.parse(text); } catch { /* JSON 이 아니면 아래에서 원문을 보여준다 */ }

    if (!json) {
      console.log(`  ${label} (sch1=${code}) — ${res.status} · ${ms}ms · JSON 아님`);
      console.log('    응답 앞부분:', text.slice(0, 300).replace(/\s+/g, ' '));
      console.log('    → contentType=json 이 안 먹거나 오류 페이지입니다.\n');
      continue;
    }

    const list = findList(json);
    console.log(`  ${label} (sch1=${code}) — ${res.status} · ${ms}ms · ${list ? list.length + '건' : '목록 못 찾음'}`);
    if (!list) {
      console.log('    최상위 키:', Object.keys(json).join(', '));
      console.log('    원문:', JSON.stringify(json).slice(0, 300), '\n');
      continue;
    }
    console.log('    필드:', Object.keys(list[0]).join(', '));
    console.log('    예시:', JSON.stringify(list[0], null, 6).split('\n').join('\n    '), '\n');
  }

  console.log('※ 위 "필드" 를 fetch-universities.js 의 파서와 대조하세요.');
  console.log('   문서에는 schoolName·schoolGubun·schoolType·estType·region·adres·seq 로 적혀 있습니다.');
})().catch(e => {
  console.error('실패:', e.message);
  process.exit(1);
});
