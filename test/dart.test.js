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

    /* 캐시가 상장사(3,981건)에서 공시대상 전체(118,000여 건)로 넓어졌다.
       비상장 자회사(캐논코리아)가 "공시 자료 없음"으로 뜨던 문제 때문인데,
       대신 이름이 겹치는 회사가 생겼다 — 그 두 가지를 같이 지킨다.
       네트워크는 타지 않는다(캐시 파일만 읽는다). */
    console.log('\n── 6. 이름 색인 — 비상장사도 찾고, 동명이인은 상장사가 이긴다 ──');
    const st2 = DART.status();
    if (st2.cached > 10000) {
      const canon = DART.findCorp('캐논코리아');
      ok('비상장 자회사를 찾는다 (캐논코리아)', canon && canon.code === '00120580');
      for (const [n, code] of [['쿠팡', '01019166'], ['우아한형제들', '01063273']]) {
        const c = DART.findCorp(n);
        ok(`비상장 ${n}`, c && c.code === code, c ? `→ ${c.name}` : '→ 못 찾음');
      }
      /* 이름이 같은 비상장 법인이 상장사를 가리면 남의 회사 재무를 자소서에 쓰게 된다. */
      for (const n of ['신한', '하나은행', '쇼박스', '삼성전자']) {
        const c = DART.findCorp(n);
        ok(`동명이인이 있어도 상장사로 잡힌다: ${n}`, Boolean(c && c.stock), c ? `→ ${c.name}` : '→ 못 찾음');
      }
      /* 업종코드는 이름 색인과 다른 파일(dart-industry.json)에 있고, 그쪽만 깃에 들어간다.
         한 파일에 같이 뒀을 때 색인을 .gitignore 에 넣자 업종코드가 같이 사라져서
         **배포에서** 계열별 둘러보기가 0곳, 경쟁사가 0곳으로 나갔다(로컬은 멀쩡했다 —
         로컬 파일에는 남아 있었으니까). 파일이 갈라져 있는지, 합쳐서 읽는지를 지킨다. */
      ok('업종코드가 이름 색인 밖에서 붙는다', st2.withIndustry > 3000,
         `→ ${st2.withIndustry.toLocaleString()}건`);
      const listedNoIndustry = DART.allCorps().filter(c => c.stock && !c.industry).length;
      ok('상장사는 대부분 업종코드가 있다', listedNoIndustry < 200,
         `→ 없는 상장사 ${listedNoIndustry}곳`);

      console.log('\n── 7. 브랜드 이름 → 법인명 ──');
      for (const [brand, legal] of [['토스', '비바리퍼블리카'], ['배달의민족', '우아한형제들'],
                                    ['삼성SDS', '삼성에스디에스'], ['한국타이어', '한국타이어앤테크놀로지'],
                                    ['네이버', 'NAVER']]) {
        const c = DART.findCorp(brand);
        ok(`${brand} → ${legal}`, Boolean(c && c.name === legal), c ? `→ ${c.name}` : '→ 못 찾음');
      }
    } else {
      console.log(`  SKIP  전체 캐시가 없습니다(${st2.cached}건). scripts/fetch-dart-corps.js 를 실행하세요.`);
    }

    /* ── 8. 직원현황 접기 ──────────────────────────────────────
       실제로 틀렸던 자리다. 삼성전자 응답에는 부문별 줄 뒤에 '성별합계' 가 한 번 더
       오는데 그것까지 더해서 인원이 두 배(257,762)로 떴고, 사업부문 1위가 '성별합계'
       였다. 아래 고정 응답은 2025년 실제 값이다. */
    console.log('\n── 8. 직원현황 접기 ──');
    const row = (fo_bbm, sm, extra = {}) => ({ fo_bbm, sm: String(sm), ...extra });

    const samsung = DART.foldEmployees([
      row('DX', '38,119'), row('DX', '12,698'),
      row('DS', '56,154'), row('DS', '21,910'),
      row('성별합계', '94,273'), row('성별합계', '34,608'),
    ], 2025);
    ok('합계 줄을 빼고 센다', samsung.count === 128881, `→ ${samsung.count.toLocaleString()}명`);
    ok("'성별합계' 가 부문으로 올라오지 않는다",
       !samsung.segments.some(s => s.name === '성별합계'),
       `→ ${samsung.segments.map(s => s.name).join(', ')}`);
    ok('부문은 인원 순', samsung.segments[0].name === 'DS' && samsung.segments[1].name === 'DX');
    ok('비율은 합계 대비', samsung.segments[0].pct === 61, `→ DS ${samsung.segments[0].pct}%`);

    /* '전사' 는 합계가 아니라 **부문을 안 나눈 회사의 유일한 줄**이다. 이것까지
       걷어내면 카카오·NAVER 의 인원이 0이 된다. */
    const kakao = DART.foldEmployees([row('전사', '2,186'), row('전사', '1,736')], 2025);
    ok("'전사' 는 합계로 보지 않는다", kakao.count === 3922, `→ ${kakao.count.toLocaleString()}명`);

    /* 합계 줄만 온 회사 — 걷어낼 것이 없으니 그대로 쓴다(0명이 되면 안 된다). */
    const onlyTotal = DART.foldEmployees([row('합계', '1,200')], 2025);
    ok('합계 줄만 오면 그것을 쓴다', onlyTotal && onlyTotal.count === 1200);

    /* '〃' 는 앞 줄의 부문을 물려받는다 — 실측: 강남제비스코 도료 583 + 〃 44. */
    const jevisco = DART.foldEmployees([row('도료', '583'), row('〃', '44')], 2025);
    ok("'〃' 를 앞 부문에 합친다",
       jevisco.segments.length === 1 && jevisco.segments[0].count === 627,
       `→ ${jevisco.segments.map(s => `${s.name} ${s.count}`).join(', ')}`);

    ok('빈 응답은 null', DART.foldEmployees([], 2025) === null);

    console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
    process.exit(fail ? 1 : 0);
  });
}
