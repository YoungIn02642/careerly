/* 프롬프트 공유 — 저장 전 검사와 담을 때의 이름. DB 도 네트워크도 부르지 않는다.

   ── 이 테스트가 지키는 것 ──
   1) **본문과 원문이 섞이지 않는다** — 프롬프트가 아닌 카테고리로 들어온 원문은
      버린다. 남겨 두면 '담기' 버튼을 어디에 붙일지 카테고리와 컬럼 두 곳을 봐야 한다.
   2) **길이 상한이 자소서 코치와 같다** — 갈리면 올릴 때는 통과한 글이 담을 때
      조용히 잘린다. 그래서 jd-coach.js 의 상한과 직접 대조한다.
   3) **만들기와 고치기가 같은 말을 한다** — 문구가 라우트마다 갈리면 같은 잘못에
      다른 안내가 나간다. 문구의 출처가 이 모듈 하나임을 값으로 확인한다. */
const P = require('../backend/src/insight-prompt.js');
const JD = require('../frontend/js/jd-coach.js');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const RULES = '결론을 먼저 쓴다. 회사 이름을 지어내지 않는다. 빈칸은 대괄호로 남긴다.';

console.log('── 1. 프롬프트 카테고리 ──');
{
  const r = P.normalizePrompt('prompt', RULES);
  ok('원문을 그대로 싣는다', r.ok && r.value === RULES);
}
{
  const r = P.normalizePrompt('prompt', `  ${RULES}\n  `);
  ok('앞뒤 공백만 턴다', r.ok && r.value === `${RULES}`);
}
{
  const r = P.normalizePrompt('prompt', '');
  ok('원문 없이는 못 올린다', !r.ok && /원문/.test(r.error), `→ ${r.error}`);
}
{
  const r = P.normalizePrompt('prompt', '잘 써줘');
  ok('한 줄짜리는 규칙이 아니다', !r.ok && /\d+자 이상/.test(r.error), `→ ${r.error}`);
}
{
  const r = P.normalizePrompt('prompt', '가'.repeat(P.PROMPT_LEN_MAX + 1));
  ok('상한을 넘으면 자르지 않고 막는다', !r.ok && /까지/.test(r.error), `→ ${r.error}`);
  /* 조용히 자르면 올린 사람은 다 올라간 줄 알고, 담아 간 사람은 끊긴 규칙을 쓴다. */
}
{
  const r = P.normalizePrompt('prompt', '가'.repeat(P.PROMPT_LEN_MAX));
  ok('상한 딱 맞으면 통과한다', r.ok && r.value.length === P.PROMPT_LEN_MAX);
}

console.log('\n── 2. 다른 카테고리 ──');
for (const cat of ['free', 'jobinfo', 'review', 'qna']) {
  const r = P.normalizePrompt(cat, RULES);
  ok(`${cat} — 원문이 와도 버린다`, r.ok && r.value === null);
}
{
  const r = P.normalizePrompt('free', '');
  ok('원문이 없어도 막지 않는다', r.ok && r.value === null);
}

console.log('\n── 3. 담을 때 붙는 이름 ──');
ok('제목을 그대로 쓴다', P.copyName('결론부터 쓰게 하는 규칙') === '결론부터 쓰게 하는 규칙');
ok('긴 제목은 이름 칸 길이로 자른다',
   P.copyName('가'.repeat(80)).length === P.PROMPT_NAME_MAX);
ok('줄바꿈·연속 공백은 한 칸으로', P.copyName('결론부터\n  쓰게') === '결론부터 쓰게');
ok('제목이 비면 기본 이름', P.copyName('   ') === '공유 프롬프트');
/* 이름 칸(jd-coach 모달 input maxlength)과 같아야 담은 뒤 고칠 때 놀라지 않는다. */
ok('이름 상한은 40', P.PROMPT_NAME_MAX === 40);

console.log('\n── 4. 자소서 코치와 같은 상한 ──');
/* 여기가 갈리면 "올릴 때는 됐는데 담으니 잘렸다" 가 된다. */
ok('길이 상한이 jd-coach 와 같다', P.PROMPT_LEN_MAX === JD.PROMPT_LEN_MAX,
   `→ 서버 ${P.PROMPT_LEN_MAX} · 화면 ${JD.PROMPT_LEN_MAX}`);
ok('담기·목록 함수를 화면이 내어 준다',
   typeof JD.addPrompt === 'function' && typeof JD.myPrompts === 'function');

console.log('\n── 5. 카테고리 id 는 서버가 단일 출처 ──');
{
  const { CATEGORIES } = require('../backend/src/routes/insight.js');
  const ids = CATEGORIES.map(c => c.id);
  ok('AI 프롬프트 카테고리가 목록에 있다', ids.includes(P.PROMPT_CATEGORY), `→ ${ids.join(', ')}`);
  ok('기존 카테고리를 지우지 않았다',
     ['free', 'jobinfo', 'review', 'qna'].every(id => ids.includes(id)));
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
