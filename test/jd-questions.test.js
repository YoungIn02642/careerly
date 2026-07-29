/* 자소서 문항 분류 테스트
   화면을 띄우지 않는다 — 규칙(정규식)에 문항 문구를 직접 넣어 '무엇을 어느 유형으로 보는가'만 본다.

   이 기능의 위험은 느린 것이 아니라 **엉뚱한 유형으로 분류해 잘못된 소재를 권하는 것**이다.
   특히 지원동기 문항을 직무역량으로 잘못 보면 공고 역량을 붙여버리는데, 그러면 학생이
   "왜 우리 회사인가" 자리에 직무 이야기를 쓰게 된다. 그래서 유형별 대표 문구를 고정해 둔다. */
const JD = require('../frontend/js/jd-coach.js');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

const type = q => JD.classifyQuestion(q)?.id ?? null;

console.log('── 1. 유형별 대표 문구를 맞히는가 ──');
const CASES = [
  ['지원 동기와 입사 후 포부를 기술해 주십시오.', 'motive'],
  ['왜 우리 회사에 지원했는지 서술하시오.', 'motive'],
  ['직무 수행에 필요한 역량을 갖추기 위해 노력한 경험을 서술해 주십시오.', 'competency'],
  ['본인의 강점과 그것을 직무에 어떻게 활용할지 기술하시오.', 'competency'],
  ['팀으로 일하며 갈등을 해결한 경험을 기술해 주십시오.', 'collab'],
  ['타인을 설득하여 목표를 달성한 사례를 작성하시오.', 'collab'],
  ['실패를 극복한 경험과 그때 배운 점을 서술하시오.', 'challenge'],
  ['가장 어려웠던 문제 해결 경험을 기술하시오.', 'challenge'],
  ['성장 과정에서 본인에게 영향을 준 사건을 서술하시오.', 'growth'],
  ['본인의 가치관이 형성된 계기를 기술하시오.', 'growth'],
];
CASES.forEach(([q, want]) => ok(`${want.padEnd(10)} ← ${q.slice(0, 28)}…`, type(q) === want, `→ ${type(q)}`));

console.log('\n── 2. 지원동기와 직무역량을 헷갈리지 않는가 ──');
/* 이 둘은 근거가 다르다(뉴스 vs 공고). 뒤바뀌면 화면이 엉뚱한 소재를 가리킨다. */
ok('"입사 후 포부"는 직무역량이 아니라 지원동기', type('입사 후 포부를 밝혀 주십시오.') === 'motive');
ok('"직무 역량"은 지원동기가 아니라 직무역량', type('해당 직무에 필요한 역량은 무엇이라 생각합니까?') === 'competency');
ok('지원동기 문항은 뉴스를 근거로 지목한다',
   JD.classifyQuestion('지원 동기를 쓰시오.').pick === 'news');
ok('직무역량 문항은 공고 역량을 근거로 지목한다',
   JD.classifyQuestion('직무 역량을 쓰시오.').pick === 'top');

console.log('\n── 3. 모르는 문항을 지어내지 않는가 ──');
/* 억지로 유형을 붙이면 근거 없는 조언이 나간다. 모르면 모른다고 해야 화면이
   "유형 미확인"으로 안전하게 빠진다. */
ok('분류할 수 없는 문항은 null 을 돌려준다', type('좋아하는 색깔은 무엇입니까?') === null);
ok('빈 문자열도 죽지 않는다', type('') === null);

console.log('\n── 4. 문항 파싱 ──');
/* 학생은 공고에서 문항을 통째로 복사해 붙인다. 번호 매김이 제각각이라 다 받아야 한다. */
const parsed = (() => {
  // parseQuestions 는 DOM 을 읽으므로 같은 정규식만 떼어 확인한다
  const raw = `1. 지원 동기를 기술하시오.
2) 직무 역량을 서술하시오.
- 협업 경험을 쓰시오.
• 실패 경험을 쓰시오.

짧음`;
  return raw.split(/\r?\n/)
    .map(s => s.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
    .filter(s => s.length >= 5);
})();
ok('번호(1.) · 괄호(2)) · 하이픈 · 불릿을 모두 떼어낸다',
   parsed.length === 4 && parsed.every(p => !/^[\d\-•)]/.test(p)), `→ ${JSON.stringify(parsed)}`);
ok('너무 짧은 줄과 빈 줄은 문항으로 보지 않는다', !parsed.includes('짧음'));

console.log('\n── 5. 초안 저장 키 ──');
/* 문항 문구를 고쳐도 초안이 남아야 한다. 그래서 키는 문구가 아니라 순번이다. */
ok('키는 순번만 쓴다 (문구가 섞이지 않는다)', JD.questionDraftKey(0) === '문항1');
ok('문항이 달라도 같은 자리면 같은 키', JD.questionDraftKey(2) === '문항3');

console.log('\n── 6. 역량 배분 ──');
const items = [
  { label: '데이터 분석' }, { label: '협업·커뮤니케이션' },
  { label: '문제 해결' }, { label: '고객 이해' },
];
const soft = JD.competenciesFor(JD.classifyQuestion('갈등을 해결한 경험'), items);
ok('협업 문항에는 소프트 역량을 우선 배분한다',
   soft.some(c => /협업/.test(c.label)), `→ ${soft.map(c => c.label).join(', ')}`);
ok('직무역량 문항에는 상위 역량을 최대 3개까지',
   JD.competenciesFor(JD.classifyQuestion('직무 역량을 쓰시오'), items).length === 3);
ok('역량이 없으면 빈 배열 (죽지 않는다)',
   JD.competenciesFor(JD.classifyQuestion('직무 역량'), []).length === 0);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
