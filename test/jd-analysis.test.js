/* 역량 분석 결과를 자소서(회사)마다 보관하는가

   ── 왜 이 테스트가 있나 (사용자 지시 2026-09-01) ──
   분석 결과가 `_last` 라는 **메모리 변수**에만 있어서, 보관함에서 '이어쓰기'로 들어오거나
   새로고침하면 역량이 0개가 됐다. 그러면 **AI 초안 넣기가 조용히 동작하지 않는다** —
   에러가 나는 게 아니라 버튼이 아무것도 안 만든다. 화면 없이 확인할 수 있는 것은
   저장소 계약이므로 그것만 고정한다(복원 배선은 화면에서 확인했다).

   화면을 띄우지 않으므로 localStorage 를 흉내 낸다. jd-coach.js 는 `root` 를
   globalThis 로 잡으니 여기에 붙이면 그대로 쓴다. */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
};
/* jd-coach.js 안의 $ 는 document 를 쓴다. 저장소 함수만 부를 것이라 빈 껍데기면 충분하다. */
globalThis.document = { querySelector: () => null };

const JD = require('../frontend/js/jd-coach.js');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

const result = (n = 2) => ({
  items: Array.from({ length: n }, (_, i) => ({
    label: `역량${i + 1}`, quotes: [`공고 문장 ${i + 1}`], reads: '무엇을 보는가', frame: '① → ②',
  })),
  cliches: [], aiTells: [],
});

console.log('── 1. 저장하고 꺼낸다 ──');
ok('저장하면 true', JD.saveAnalysis('삼성전자', result(), '1. 지원동기\n2. 직무역량') === true);
const got = JD.analysisOf('삼성전자');
ok('꺼내진다', Boolean(got));
ok('역량이 그대로 있다', got.r.items.length === 2 && got.r.items[0].label === '역량1');
ok('초안 재료(quotes·reads·frame)가 살아 있다',
  got.r.items[0].quotes[0] === '공고 문장 1' && got.r.items[0].reads === '무엇을 보는가' && got.r.items[0].frame === '① → ②');
/* 문항을 같이 안 남기면 탭이 역량 단위로 바뀌고 **저장 키가 달라져** 쓰던 글을 못 찾는다. */
ok('문항 문구도 같이 남는다', got.questions === '1. 지원동기\n2. 직무역량');
ok('저장 시각이 남는다', typeof got.at === 'number' && got.at > 0);

console.log('\n── 2. 자소서(회사)마다 따로 남는가 ──');
JD.saveAnalysis('LG전자', result(3), '1. 성장과정');
ok('회사가 다르면 따로 저장된다', JD.analysisOf('LG전자').r.items.length === 3);
ok('먼저 저장한 회사가 안 덮인다', JD.analysisOf('삼성전자').r.items.length === 2);
ok('없는 회사는 null', JD.analysisOf('없는회사') === null);
ok('빈 회사명은 null', JD.analysisOf('') === null);
ok('앞뒤 공백은 같은 회사로 본다', JD.analysisOf('  삼성전자  ')?.r.items.length === 2);

console.log('\n── 3. 빈 결과로 덮어 쓰지 않는가 ──');
/* 공고 없이 시작하면(guideJd) 역량이 안 온다. 그걸 그대로 저장하면 멀쩡히 저장돼 있던
   분석이 사라지고, 이어쓰기가 다시 깨진다. */
ok('items 가 비면 저장하지 않는다', JD.saveAnalysis('삼성전자', { items: [] }, '') === false);
ok('그래도 옛 분석은 그대로', JD.analysisOf('삼성전자').r.items.length === 2);
ok('결과가 없어도 저장하지 않는다', JD.saveAnalysis('삼성전자', null, '') === false);
ok('회사명이 없으면 저장하지 않는다', JD.saveAnalysis('', result(), '') === false);

console.log('\n── 4. 무한정 쌓이지 않는가 ──');
/* 결과 하나가 수십 KB 라 회사 수를 제한한다. 지워져도 분석을 다시 돌리면 그만이고,
   초안 본문은 다른 키(careerly_jd_drafts_v1)라 같이 지워지지 않는다. */
for (let i = 0; i < JD.ANALYSIS_MAX + 5; i++) JD.saveAnalysis(`회사${i}`, result(), '');
const kept = JSON.parse(globalThis.localStorage.getItem('careerly_jd_analysis_v1'));
ok(`보관 상한 ${JD.ANALYSIS_MAX}개를 지킨다`, Object.keys(kept).length <= JD.ANALYSIS_MAX,
  `→ ${Object.keys(kept).length}개`);
ok('가장 최근 것은 남아 있다', Boolean(JD.analysisOf(`회사${JD.ANALYSIS_MAX + 4}`)));
ok('가장 오래된 것부터 버린다', JD.analysisOf('회사0') === null);

console.log('\n── 5. 지우기 ──');
JD.saveAnalysis('한화', result(), '');
ok('지우면 없다', (JD.forgetAnalysis('한화'), JD.analysisOf('한화')) === null);
ok('남의 회사는 안 지워진다', Boolean(JD.analysisOf(`회사${JD.ANALYSIS_MAX + 4}`)));

console.log('\n── 6. 깨진 저장값을 만나도 죽지 않는가 ──');
/* 다른 버전이 남긴 값·손으로 고친 값이 들어올 수 있다. 여기서 예외가 나면 작성 화면이
   통째로 안 그려진다 — 분석 하나 못 읽는 것보다 훨씬 나쁘다. */
globalThis.localStorage.setItem('careerly_jd_analysis_v1', '{망가진 JSON');
ok('깨진 JSON 이면 null 로 넘어간다', JD.analysisOf('삼성전자') === null);
ok('깨진 뒤에도 저장은 된다', JD.saveAnalysis('삼성전자', result(), '') === true);
ok('저장 후 다시 읽힌다', JD.analysisOf('삼성전자').r.items.length === 2);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail) process.exit(1);
