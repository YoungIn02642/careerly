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
/* ── 2026-09-01: 자동 배분은 3개 → **1개**로 줄었다 (사용자 지시·심사) ──────────
   초안이 실제로 쓰는 역량은 늘 하나였는데(서버가 문자열 하나를 받았다) 화면만 3개라고
   말하고 있었다. 이제 기본 1개를 붙이고 문항마다 사용자가 0~2개로 조정한다.
   개수 계약은 test/comp-pick.test.js 가 자세히 본다. */
ok('직무역량 문항에는 상위 역량 1개를 기본으로 붙인다',
   JD.competenciesFor(JD.classifyQuestion('직무 역량을 쓰시오'), items).length === 1);
ok('그 1개는 공고 요구 1순위다',
   JD.competenciesFor(JD.classifyQuestion('직무 역량을 쓰시오'), items)[0].label === items[0].label);
ok('지원동기는 기본 0개다 (축이 역량이 아니라 회사 근거다)',
   JD.competenciesFor(JD.classifyQuestion('지원 동기를 기술하시오'), items).length === 0);
ok('역량이 없으면 빈 배열 (죽지 않는다)',
   JD.competenciesFor(JD.classifyQuestion('직무 역량'), []).length === 0);

console.log('\n── 7. STAR 가 얼마나 찼는가 ──');
/* 사용자 지시(2026-08-28) — 정성스펙과 STAR 는 **막는 조건이 아니다.** 없어도 분석은
   돌아가고, 있으면 AI 초안이 내 경험으로 채워진다. 그래서 이 규칙은 버튼을 잠그는 데
   쓰이지 않고 **무엇이 비었는지 말하는 데**만 쓰인다(카드 배지 · 사이드바 한 줄).
   한 곳에 두는 이유는 그 세 자리의 말이 갈리지 않게 하기 위해서다. */
const FULL_STAR = { S: '3인 팀 캡스톤', T: '응답속도 절반', A: '캐시 도입', R: '820ms→300ms' };

ok('한 칸도 안 적었으면 empty (아직 안 쓴 칸을 혼내지 않는다)',
   JD.starGate({}).empty === true && JD.starGate({}).ok === false);
ok('빈 칸을 이름으로 짚어 준다',
   JD.starGate({ S: '있음', A: '있음' }).why.includes('T·R'),
   `→ ${JD.starGate({ S: '있음', A: '있음' }).why}`);
ok('빈 칸 목록을 그대로 준다 (화면이 개수를 센다)',
   JD.starGate({ S: '있음' }).missing.join(',') === 'T,A,R');
ok('공백만 적은 칸은 적은 것으로 보지 않는다',
   JD.starGate({ ...FULL_STAR, R: '   ' }).ok === false);
ok('넷 다 있으면 ok', JD.starGate(FULL_STAR).ok === true);
ok('null 을 줘도 죽지 않는다', JD.starGate(null).ok === false);
/* 일부만 적은 상태와 아예 안 적은 상태는 화면에서 다르게 보인다
   ('STAR 2/4' 배지 vs 'STAR 없음'). 그래서 empty 를 따로 돌려준다. */
ok('일부만 적었으면 empty 가 아니다', JD.starGate({ S: '있음' }).empty === false);

console.log('\n── 8. 활동을 가리키는 키 ──');
/* 활동은 화면으로 나올 때 id 를 안 싣는다(repo.toActivity). 순번을 키로 쓰면 활동
   하나를 지웠을 때 문항의 소재가 조용히 옆 활동으로 바뀐다. */
const A1 = { type: 'project', name: '캡스톤', org: '한국대', duration: '2025.03~06' };
ok('유형·이름·기관·기간으로 키를 만든다', JD.actKeyOf(A1) === 'project|캡스톤|한국대|2025.03~06');
ok('같은 내용이면 같은 키', JD.actKeyOf({ ...A1 }) === JD.actKeyOf(A1));
ok('기간이 다르면 다른 키', JD.actKeyOf({ ...A1, duration: '2024.03~06' }) !== JD.actKeyOf(A1));
ok('빈 활동도 죽지 않는다', typeof JD.actKeyOf({}) === 'string');

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
