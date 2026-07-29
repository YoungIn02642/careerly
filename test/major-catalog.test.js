/* 학과 → 통계 분류 매핑 테스트

   이 기능의 위험은 **조용히 엉뚱한 분류로 묶는 것**이다. 간호학과 학생에게 컴공
   합격자 평균이 보여도 화면엔 에러가 안 뜬다. 그래서 두 가지를 고정한다.
     1) 대표 학과명이 맞는 분류로 간다
     2) 해당 분류가 없으면 **억지로 넣지 않고 null 을 돌려준다**

   커리어넷 API 키가 나와 카탈로그를 교체하더라도 이 규칙은 그대로 살아야 한다. */
const { catalog, deptOf } = require('../backend/src/major-catalog');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

const cat = catalog();

console.log('── 1. 카탈로그 ──');
ok('학과 목록이 있다', cat.count >= 150, `→ ${cat.count}개`);
ok('이름·분류 두 필드를 준다', cat.majors.every(m => typeof m.name === 'string' && 'dept' in m));
ok('가나다순으로 정렬돼 있다',
   cat.majors.every((m, i) => i === 0 || cat.majors[i - 1].name.localeCompare(m.name, 'ko') <= 0));
ok('중복된 학과명이 없다', new Set(cat.majors.map(m => m.name)).size === cat.majors.length);

console.log('\n── 2. 대표 학과가 맞는 분류로 간다 ──');
const CASES = [
  ['컴퓨터공학과', 'cs'], ['소프트웨어학과', 'cs'], ['인공지능학과', 'cs'],
  ['통계학과', 'stat'], ['데이터사이언스학과', 'stat'],
  ['경영학과', 'business'], ['무역학과', 'business'],
  ['경제학과', 'economics'], ['회계학과', 'accounting'], ['세무학과', 'accounting'],
  ['법학과', 'law'], ['심리학과', 'psych'], ['신문방송학과', 'media'],
];
CASES.forEach(([n, want]) => ok(`${n} → ${want}`, deptOf(n) === want, `→ ${deptOf(n)}`));

console.log('\n── 3. 목록에 없는 이름도 규칙으로 잡는다 ──');
/* 학과 이름은 학교마다 제각각이라 카탈로그가 절대 다 담지 못한다. */
[
  ['e-커머스전공(컴퓨터융합학부)', 'cs'],
  ['응용소프트웨어공학과', 'cs'],
  ['AI빅데이터학과', 'stat'],
  ['글로벌경영학부', 'business'],
  ['세무회계정보과', 'accounting'],
  ['디지털미디어학과', 'media'],
].forEach(([n, want]) => ok(`${n} → ${want}`, deptOf(n) === want, `→ ${deptOf(n)}`));

console.log('\n── 4. 모르는 계열을 억지로 넣지 않는다 ──');
/* careerly 통계는 아직 8분류뿐이다. 없는 계열을 가까워 보이는 데로 밀어 넣으면
   그 학생에게 남의 학과 합격자 평균이 보인다. 비워 두는 게 맞다. */
['간호학과', '기계공학과', '유아교육과', '음악학과', '의예과', '국어국문학과']
  .forEach(n => ok(`${n} 는 분류하지 않는다`, deptOf(n) === null, `→ ${deptOf(n)}`));

ok('빈 값에도 죽지 않는다', deptOf('') === null && deptOf(null) === null && deptOf(undefined) === null);

console.log('\n── 5. 규칙 우선순위 ──');
/* '경영정보학과'가 '정보' 때문에 cs 로 가면 안 되고,
   '금융경제학과'가 '금융' 때문에 엉뚱한 데로 가면 안 된다. */
ok('경영정보학과 → business (cs 아님)', deptOf('경영정보학과') === 'business', `→ ${deptOf('경영정보학과')}`);
ok('금융경제학과 → economics', deptOf('금융경제학과') === 'economics', `→ ${deptOf('금융경제학과')}`);
ok('정보통계학과 → stat (cs 아님)', deptOf('정보통계학과') === 'stat', `→ ${deptOf('정보통계학과')}`);
ok('회계세무학과 → accounting', deptOf('회계세무학과') === 'accounting');

console.log('\n── 6. 카탈로그와 규칙이 서로 어긋나지 않는가 ──');
/* 카탈로그에 박아둔 분류와 규칙이 다른 답을 내면, 목록에서 고를 때와 직접 칠 때
   결과가 달라진다. 같은 학과가 두 통계에 들어가는 원인이 된다. */
const conflicts = cat.majors.filter(m => m.dept && deptOf(m.name) !== m.dept);
ok('목록에서 고른 값과 직접 친 값의 분류가 같다', conflicts.length === 0,
   conflicts.length ? `→ ${conflicts.slice(0, 3).map(m => `${m.name}: ${m.dept}≠${deptOf(m.name)}`).join(', ')}` : '');

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
