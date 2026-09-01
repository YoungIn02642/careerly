/* 자소서 빈출 문항 — 유형 분류·프레임 테스트
   초안 프롬프트가 문항 유형에 맞는 골격을 끼우는 근거다. 엉뚱하게 분류하면 성격 장단점을
   STAR 골격으로 쓰는 식의 사고가 난다. 유형별 대표 문구를 고정해 둔다. */
const QF = require('../frontend/js/question-frames.js');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };
const type = q => QF.classify(q)?.id ?? null;

console.log('── 1. 빈출 문항 표의 6유형을 맞히는가 ──');
const CASES = [
  ['지원 동기와 입사 후 포부를 기술해 주십시오.', 'motive'],
  ['왜 우리 회사에 지원했는지 서술하시오.', 'motive'],
  ['직무 수행에 필요한 역량을 갖추기 위해 노력한 경험을 서술하시오.', 'competency'],
  ['본인의 실무 경험과 직무 역량을 기술하시오.', 'competency'],
  ['가장 어려웠던 문제를 해결한 경험을 기술하시오.', 'challenge'],
  ['도전적인 목표를 이룬 성취 경험을 서술하시오.', 'challenge'],
  ['팀으로 일하며 갈등을 해결한 경험을 기술하시오.', 'collab'],
  ['협업 과정에서 의견 차이를 조율한 사례를 작성하시오.', 'collab'],
  ['성장 과정에서 본인에게 영향을 준 경험을 서술하시오.', 'growth'],
  ['본인의 성격의 장단점을 기술하시오.', 'trait'],
  ['본인의 강점과 약점을 서술하시오.', 'trait'],
];
CASES.forEach(([q, want]) => ok(`${want.padEnd(11)} ← ${q.slice(0, 26)}…`, type(q) === want, `→ ${type(q)}`));

console.log('\n── 2. 성격 장단점(약점)이 직무역량(강점)으로 새지 않는가 ──');
/* trait 이 competency 보다 앞에 있어야 "강점과 약점" 이 trait 으로 간다. */
ok('"강점과 약점"은 성격 장단점', type('본인의 강점과 약점을 기술하시오.') === 'trait');
ok('"강점을 직무에 활용"은 직무역량', type('본인의 강점을 직무에 어떻게 활용할지 서술하시오.') === 'competency');

console.log('\n── 3. 각 유형에 골격(frame)이 있는가 ──');
/* 유형 규칙·분량 배분은 2026-09-01 에 backend/src/question-prompts.js 로 옮겼다.
   두 파일이 id 로 1:1 인지는 test/question-prompts.test.js 가 본다. */
QF.TYPES.forEach(t => {
  ok(`${t.id.padEnd(11)} frame 있음`, typeof t.frame === 'string' && t.frame.length > 20);
  ok(`${t.id.padEnd(11)} rules 는 여기 없다`, t.rules === undefined);
});

console.log('\n── 4. frameFor / 미분류 ──');
ok('frameFor(trait) = 성격 유형', QF.frameFor('trait')?.id === 'trait');
ok('분류 안 되는 문항은 null', QF.classify('여기에 자유롭게 적어 주세요') === null);
ok('빈 문항은 null', QF.classify('') === null);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail) process.exit(1);
