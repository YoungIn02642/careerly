/* 자소서 초안 — 문항별 정성스펙 0~3개 분기 테스트 (사용자 지시 2026-08-31)
   모든 문항을 STAR 로 밀어붙이지 않는다: 고른 경험이 0개면 STAR 강요 안 함(지원동기 등),
   1개면 그 STAR 가 본문, 2~3개면 공통점으로 묶는다. 프롬프트에 그 분기가 실제로 들어가는지 본다. */
const D = require('../backend/src/draft-coach.js');
let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name); };

const S1 = { S: '상황하나', T: '과제하나', A: '행동하나', R: '결과하나' };
const S2 = { S: '상황둘', A: '행동둘', R: '결과둘' };
const base = { competency: '협업', question: '팀으로 협업한 경험을 기술하시오.', limit: 600 };
const P = extra => D.buildPrompt({ ...base, ...extra });

console.log('── 1. 0개: STAR 를 강요하지 않는다 (지원동기 문제 해결) ──');
const p0 = P({ picks: [] });
ok('STAR 를 안 고름 안내', /특정 경험\(STAR\)을 고르지 않았다/.test(p0));
ok('STAR 순서 규칙(4번)이 빠진다', !/STAR 순서를 지키되/.test(p0));
ok('성취담 강요 금지 규칙', /성취담으로 억지로 만들지 마라/.test(p0));
ok('STAR 나쁜 예(14번)가 빠진다', !/절대로 내놓으면 안 되는 답의 예/.test(p0));

console.log('\n── 2. 1개: 그 STAR 가 본문 ──');
const p1 = P({ picks: [{ name: 'A동아리', star: S1 }] });
ok('유일한 사실 안내', /유일한 사실이다/.test(p1));
ok('STAR 내용 포함', /상황하나/.test(p1) && /결과하나/.test(p1));
ok('STAR 순서 규칙 있음', /STAR 순서를 지키되/.test(p1));
ok('묶기 규칙은 없음', !/공통점으로 묶어/.test(p1));

console.log('\n── 3. 2~3개: 공통점으로 묶는다 ──');
const p2 = P({ picks: [{ name: 'A동아리', star: S1 }, { name: 'B프로젝트', star: S2 }] });
ok('고른 경험 2개 안내', /고른 경험 2개/.test(p2));
ok('두 경험 이름 모두 포함', /A동아리/.test(p2) && /B프로젝트/.test(p2));
ok('공통점으로 묶기 규칙', /공통점으로 묶어/.test(p2));
ok('경험별로 쪼개지면 틀린 답', /경험별로 쪼개지면 틀린 답/.test(p2));

console.log('\n── 4. 상한 3개 · 빈 STAR 는 제외 ──');
const p4 = P({ picks: [
  { name: 'A', star: S1 }, { name: 'B', star: S2 }, { name: 'C', star: { S: '상황셋', A: '행동셋', R: '결과셋' } },
  { name: 'D', star: { S: '넘침' } }, { name: 'E', star: {} },
] });
ok('4개째부터는 안 들어감(3개 상한)', !/넘침/.test(p4));
ok('빈 STAR(E)는 제외', /고른 경험 3개/.test(p4));

console.log('\n── 5. 하위호환: picks 없이 옛 star 하나 ──');
const pLegacy = P({ star: S1 });
ok('옛 단일 star → 1개로 취급', /유일한 사실이다/.test(pLegacy) && /상황하나/.test(pLegacy));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail) process.exit(1);
