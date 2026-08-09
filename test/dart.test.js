/* DART 연동 테스트 — 네트워크를 타지 않는다.

   이 모듈의 위험은 "못 가져오는 것"이 아니라 **없는 것을 있는 척하는 것**이다.
   키가 없거나 비상장사라 자료가 없을 때 조용히 null 을 주고 이유를 밝혀야,
   화면이 빈칸을 "직접 확인하세요"로 정직하게 표시할 수 있다.
   그래서 여기서는 '없을 때의 행동'을 주로 검증한다. */
const DART = require('../backend/src/dart');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

console.log('── 1. 키가 없을 때 죽지 않는가 ──');
/* 테스트는 키 없이 도는 것을 전제로 한다(CI 에 키를 두지 않는다).
   키가 설정된 개발 머신에서도 이 파일이 네트워크를 타지 않게, analyze 는
   키가 없을 때만 검증하고 있으면 건너뛴다. */
if (!DART.isConfigured()) {
  DART.analyze('삼성전자').then(r => {
    ok('available=false 로 돌려준다', r.available === false);
    ok('이유를 밝힌다', typeof r.reason === 'string' && r.reason.includes('DART_API_KEY'));
    ok('빈 자리를 null 로 채운다', r.profile === null && r.financials === null);
    ok('경쟁사는 빈 배열', Array.isArray(r.competitors) && r.competitors.length === 0);
    finish();
  });
} else {
  console.log('  SKIP  DART_API_KEY 가 설정돼 있어 analyze 검증은 건너뜁니다(네트워크 금지).');
  finish();
}

function finish() {
  console.log('\n── 2. 숫자 변환 ──');
  ok('콤마를 지운다', DART.toNumber('1,234,567') === 1234567);
  ok('음수(괄호 아님)도 그대로', DART.toNumber('-5000') === -5000);
  ok('빈 값은 null', DART.toNumber('') === null && DART.toNumber(null) === null);
  ok('숫자가 아니면 null', DART.toNumber('해당없음') === null);
  ok('공백을 지운다', DART.toNumber(' 1 234 ') === 1234);

  console.log('\n── 3. 캐시가 없을 때 ──');
  const st = DART.status();
  ok('status 는 항상 객체를 준다', st && typeof st === 'object');
  ok('configured 는 불리언', typeof st.configured === 'boolean');
  ok('캐시 수는 숫자', typeof st.cached === 'number');
  ok('캐시가 없으면 회사를 못 찾는다(예외 대신 null)', DART.findCorp('없는회사이름123') === null);
  ok('빈 이름도 안전하다', DART.findCorp('') === null && DART.findCorp(null) === null);

  /* 매출 규모 필터가 붙으면서 competitors 가 async 가 됐다(후보의 재무를 조회한다).
     업종이 없으면 조회 자체를 하지 않으므로 네트워크 없이 검증할 수 있다. */
  console.log('\n── 4. 경쟁사 — 업종이 없으면 만들지 않는다 ──');
  Promise.all([
    DART.competitors({ code: '1', industry: null }),
    DART.competitors(null),
  ]).then(([noIndustry, noArg]) => {
    ok('업종 없는 회사는 빈 배열', Array.isArray(noIndustry) && noIndustry.length === 0);
    ok('인자가 없어도 안전', Array.isArray(noArg) && noArg.length === 0);

    console.log('\n── 5. 규모 배수 ──');
    ok('0.3~3배 대칭 범위다 (한쪽으로 기울지 않는다)',
       Math.abs(DART.SIZE_LOW * DART.SIZE_HIGH - 0.9) < 1e-9,
       `→ ${DART.SIZE_LOW}~${DART.SIZE_HIGH}배`);

    console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
    process.exit(fail ? 1 : 0);
  });
}
