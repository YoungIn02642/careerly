/* 문항마다 쓸 역량을 사용자가 고른다 (0~2개)

   ── 왜 이 테스트가 있나 (사용자 지시 2026-09-01) ──
   역량은 `competenciesFor` 가 공고 요구 강도 순으로 앞에서 3개를 자동으로 붙였다.
   **문항과의 관련도는 안 봐서** 지원동기에 '협업' 이 붙었다(사용자 지적).

   페르소나 심사에서 이 변경의 함정 셋이 나왔고, 그게 곧 이 파일이 고정하는 것이다.
     1) 자동 매핑을 없애면 안 된다 — 그 정렬이 "공고가 무엇을 요구했는가" 의 유일한 앵커다.
        그래서 **기본값으로 남기고 개수만 1개로 줄인다.**
     2) 상한은 3이 아니라 2다 — 600자면 배분표가 8~9문장이고 가장 큰 덩이가 4문장인데
        규칙 10이 거기에 4요소를 요구한다. 3개면 역량당 1.33문장이라 무엇도 안 남는다.
     3) 역량 0개가 곧 **공고 문장 0개**가 되면 안 된다. quotes 가 역량 항목에 매달려
        있었기 때문인데, 그대로 두면 재료 없는 프롬프트가 지어내기로 간다. */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
};
globalThis.document = { querySelector: () => null };

const JD = require('../frontend/js/jd-coach.js');
const DRAFT = require('../backend/src/draft-coach.js');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

/* jd-competency.js 는 공고 요구 강도(score) 내림차순으로 준다 — 그 순서를 흉내 낸다. */
const items = [
  { label: '데이터 분석력', quotes: ['소비자 데이터를 분석해 전략 수립'], reads: '숫자로 판단하는가', frame: '① → ②' },
  { label: '협업', quotes: ['유관부서와 협업'], reads: '의견을 조율하는가', frame: '① → ②' },
  { label: '문제해결', quotes: ['이슈를 정의하고 해결'], reads: '원인을 짚는가', frame: '① → ②' },
];
const TYPE = id => JD.QUESTION_TYPES.find(t => t.id === id) || null;

console.log('── 1. 기본값(자동 매핑)은 1개다 ──');
/* 예전엔 soft 2개·그 외 3개였다. 그런데 초안이 실제로 쓰는 역량은 늘 하나였고
   화면만 3개라고 말하고 있었다. */
ok('직무역량 문항 기본 1개', JD.competenciesFor(TYPE('competency'), items).length === 1);
ok('기본값은 공고 요구 1순위', JD.competenciesFor(TYPE('competency'), items)[0].label === '데이터 분석력');
ok('협업 문항도 1개', JD.competenciesFor(TYPE('collab'), items).length === 1);
/* 지원동기는 축이 역량이 아니라 회사 근거다(question-prompts.js motive: starMode support). */
ok('지원동기는 기본 0개', JD.competenciesFor(TYPE('motive'), items).length === 0);
ok('역량이 없으면 빈 배열', JD.competenciesFor(TYPE('competency'), []).length === 0);

console.log('\n── 2. 안 고른 문항과 0개를 고른 문항은 다르다 ──');
/* 이걸 못 가르면 지원동기에서 "0개" 가 뜻을 갖지 못한다. */
ok('안 골랐으면 null(=기본값 사용)', JD.cPicks('문항1') === null);
ok('기본값이 쓰인다', JD.resolveComps(TYPE('competency'), '문항1', items)[0].label === '데이터 분석력');
JD.toggleCPick('문항1', '데이터 분석력', ['데이터 분석력']);      // 켜져 있던 것을 끈다 → 0개
ok('0개를 고르면 빈 배열(null 아님)', Array.isArray(JD.cPicks('문항1')) && JD.cPicks('문항1').length === 0);
ok('0개면 기본값으로 안 돌아간다', JD.resolveComps(TYPE('competency'), '문항1', items).length === 0);

console.log('\n── 3. 상한은 2개다 ──');
JD.toggleCPick('문항2', '데이터 분석력', []);
JD.toggleCPick('문항2', '협업', ['데이터 분석력']);
ok('2개까지 들어간다', JD.cPicks('문항2').length === 2);
ok('3번째는 거절한다(false)', JD.toggleCPick('문항2', '문제해결', ['데이터 분석력', '협업']) === false);
ok('거절 뒤에도 2개 그대로', JD.cPicks('문항2').length === 2);
ok('빼면 다시 들어간다',
  (JD.toggleCPick('문항2', '협업', ['데이터 분석력', '협업']),
   JD.toggleCPick('문항2', '문제해결', ['데이터 분석력'])) === true);

console.log('\n── 4. 처음 누를 때 화면에 보이던 것이 출발점이다 ──');
/* 화면에 A 가 붙어 있는데 B 를 누르면 [A,B] 여야 한다. [B] 가 되면 사용자가 놀란다. */
ok('보이던 것 + 누른 것',
  (JD.toggleCPick('문항9', '협업', ['데이터 분석력']),
   JD.cPicks('문항9').join(',')) === '데이터 분석력,협업');

console.log('\n── 5. 자소서(회사)마다 따로 남는가 ──');
ok('문항별로 따로 저장된다', JD.cPicks('문항2').length === 2 && JD.cPicks('문항1').length === 0);
ok('없는 문항은 null', JD.cPicks('문항404') === null);

console.log('\n── 6. 역량 0개여도 공고 문장은 살아 있는가 ──');
/* quotes 가 역량 항목에 매달려 있어서, 역량을 끄면 공고가 같이 꺼지던 것을 끊었다. */
const r = { items };
ok('역량 0개면 상위 역량에서 모아 온다', JD.quotesFor([], r).length > 0);
ok('고른 역량이 있으면 그것 위주', JD.quotesFor([items[1]], r)[0] === '유관부서와 협업');
ok('중복은 걸러진다', new Set(JD.quotesFor([], r)).size === JD.quotesFor([], r).length);
ok('최대 4개', JD.quotesFor([], r).length <= 4);

console.log('\n── 7. 서버 프롬프트가 0·1·2개를 다 받는가 ──');
const mk = o => DRAFT.buildPrompt({
  company: '테스트', jobTitle: '마케팅', question: '지원 동기와 입사 후 포부를 기술해 주십시오.',
  limit: 600, activities: [], picks: [], ...o,
});
const p0 = mk({ competencies: [] }), p1 = mk({ competencies: ['문제해결'] }), p2 = mk({ competencies: ['문제해결', '협업'] });
ok('0개 — 역량 줄이 없다', !p0.includes('이번에 쓸 요구 역량'));
/* 빈 competency 로 규칙 5 를 그대로 두면 `역량 이름("")을 …` 이 프롬프트에 나간다. */
ok('0개 — 규칙 5(역량 이름 금지)가 빠진다', !p0.includes('역량 이름('));
ok('0개 — 문항 골격은 그대로 있다', p0.includes('분량 배분'));
ok('1개 — 역량 줄이 있다', p1.includes('이번에 쓸 요구 역량: 문제해결'));
ok('1개 — 규칙 5가 있다', p1.includes('역량 이름("문제해결")'));
ok('2개 — 라벨을 합쳐 쓴다', p2.includes('문제해결 · 협업'));
/* 정성스펙 2~3개에 걸어 둔 것과 같은 규칙. 없으면 문단이 역량별로 쪼개진다. */
ok('2개 — 묶어 쓰라는 규칙이 붙는다', p2.includes('각각 따로 풀지 말고 한 장면에서'));
ok('1개엔 묶어라 규칙이 없다', !p1.includes('각각 따로 풀지 말고 한 장면에서'));
ok('옛 호출(competency 문자열)도 받는다', mk({ competency: '협업' }).includes('이번에 쓸 요구 역량: 협업'));
ok('3개를 보내도 2개로 자른다',
  !mk({ competencies: ['문제해결', '협업', '데이터 분석력'] }).includes('데이터 분석력'));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail) process.exit(1);
