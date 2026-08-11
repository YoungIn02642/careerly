/* 계열별 기업 목록 — 회사 찾기 첫 화면의 재료.

   네트워크를 부르지 않는다. 캐시 파일(dart-corps.json · ftc-large-groups.json ·
   work24-companies.json)만 읽어 묶는 순수 로직이라 여기서 전부 검증된다. */
const S = require('../backend/src/company-sectors.js');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const r = S.sectors();

console.log('── 1. 업종코드 → 계열 ──');
ok('반도체(26x)를 반도체·디스플레이로 묶는다', S.sectorOfCode('264') === '반도체·디스플레이');
ok('소프트웨어(582xx)를 IT·소프트웨어로 묶는다', S.sectorOfCode('58221') === 'IT·소프트웨어');
ok('금융(66xxx)을 금융·보험으로 묶는다', S.sectorOfCode('66199') === '금융·보험');
ok('자동차(30x)를 자동차·운송장비로 묶는다', S.sectorOfCode('303') === '자동차·운송장비');
/* 2자리만 보고 판단하므로 길이가 달라도 같은 계열이어야 한다 */
ok('코드 길이가 달라도 같은 계열', S.sectorOfCode('26') === S.sectorOfCode('26429'));
ok('모르는 코드는 null (억지로 묶지 않는다)', S.sectorOfCode('99999') === null);
ok('빈 값도 null', S.sectorOfCode('') === null && S.sectorOfCode(null) === null);

console.log('\n── 2. 계열 목록 ──');
/* 캐시가 없는 환경(신규 클론)에서는 목록이 비고 사유가 온다 — 그때는 아래를 건너뛴다. */
if (!r.total) {
  console.log(`  SKIP  DART 기업 캐시가 없어 목록 검증은 건너뜁니다 (${r.reason || ''})`);
} else {
  ok('계열이 여러 개 나온다', r.sectors.length >= 10, `→ ${r.sectors.length}개`);
  ok('기업 수 합계가 각 계열의 합과 맞는다',
     r.total === r.sectors.reduce((n, s) => n + s.companies.length, 0), `→ ${r.total}곳`);
  ok('빈 계열은 목록에 넣지 않는다', r.sectors.every(s => s.companies.length > 0));
  ok('회사마다 이름이 있다', r.sectors.every(s => s.companies.every(c => c.name && c.name.trim())));

  /* 같은 회사가 두 계열에 동시에 들어가면 "몇 곳인가"를 셀 수 없다. */
  const all = r.sectors.flatMap(s => s.companies.map(c => c.name));
  ok('같은 회사가 두 계열에 겹치지 않는다', new Set(all).size === all.length,
     `→ ${all.length}곳 중 중복 ${all.length - new Set(all).size}건`);

  ok('계열 안은 가나다순이다', r.sectors.every(s => {
    const names = s.companies.map(c => c.name);
    return names.every((n, i) => i === 0 || names[i - 1].localeCompare(n, 'ko') <= 0);
  }));

  /* 이 화면의 목적이 "몰랐던 회사를 만나는 것"이라 목록이 너무 작으면 의미가 없다. */
  ok('첫 화면에 보여줄 만큼은 모인다', r.total >= 300, `→ ${r.total}곳`);

  /* 두 번 불러도 같은 결과여야 한다(캐시를 재사용한다). */
  ok('두 번째 호출이 같은 객체를 준다(캐시)', S.sectors() === r);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
