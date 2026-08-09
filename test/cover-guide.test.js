/* 자소서 작성 기준 테스트 — 상투표현 검사 · AI 흔적 · 첫 문장 틀 · 면접질문

   이 기능의 위험은 느린 것이 아니라 **틀린 판정**이다:
     · 멀쩡한 문장을 상투표현이라고 표시하면 학생이 잘 쓴 문장을 지운다
     · 완성된 문장을 만들어 주면 그대로 제출한다(대필) — 빈칸이 반드시 남아야 한다
   네트워크를 타지 않는다. 전부 순수 함수라 함수에 직접 넣어 검증한다. */
const G = require('../backend/src/cover-guide');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

console.log('── 1. 상투 표현을 찾아내는가 ──');
const cl = G.findCliches('저는 귀사에 기여하고 싶으며 최선을 다하겠습니다.');
ok('걸리는 표현을 잡는다', cl.length >= 2, `→ ${cl.map(c => c.term).join(', ')}`);
ok('이유를 같이 준다', cl.every(c => c.why && c.why.length > 5));
ok('위치를 준다(화면에서 짚어야 한다)', cl.every(c => typeof c.at === 'number' && c.at >= 0));
ok('나온 순서대로 정렬한다', cl[0].at <= cl[cl.length - 1].at);

console.log('\n── 2. 멀쩡한 문장을 걸지 않는가 (오탐이 더 위험하다) ──');
const clean = G.findCliches('전환율이 3.2%에서 4.8%로 올랐고, 그 원인을 로그 분석으로 확인했습니다.');
ok('구체적 수치 문장은 통과', clean.length === 0, `→ ${clean.map(c => c.term).join(', ') || '없음'}`);
ok('빈 입력은 빈 배열', G.findCliches('').length === 0 && G.findCliches(null).length === 0);

console.log('\n── 3. AI 흔적은 횟수로 판정하는가 ──');
ok('한 번 쓴 것은 걸지 않는다', G.findAiTells('데이터를 통해 문제를 찾았습니다.').length === 0);
const many = G.findAiTells('A를 통해 B를 통해 C를 통해 D를 했습니다.');
ok('반복되면 잡는다', many.some(t => t.term === '통해'), `→ ${many.map(t => t.term + '×' + t.count).join(', ')}`);
/* 조사가 을/를 어느 쪽이든 잡혀야 한다 — 사전에 '~을 통해'로 두었다가 '를 통해'를
   통째로 놓친 적이 있다(이 테스트가 그때 잡아냈다). */
ok('조사가 달라도 잡는다', G.findAiTells('A을 통해 B을 통해 C을 통해').some(t => t.term === '통해'));
ok('몇 번 나왔는지 센다', many.every(t => t.count > 0));
ok('countOccurrences 는 겹치지 않게 센다', G.countOccurrences('aaaa', 'aa') === 2);

console.log('\n── 4. 첫 문장 틀 — 완성문을 주지 않는가 (대필 방지의 핵심) ──');
const drafts = G.openingDrafts([{ name: '커머스 데이터 인턴', typeLabel: '인턴십', duration: '6개월' }]);
ok('활동이 있으면 틀을 만든다', drafts.length === 2);
ok('활동 이름이 실제로 들어간다', drafts.every(d => d.text.includes('커머스 데이터 인턴')));
ok('모든 틀에 빈칸이 남는다', drafts.every(d => G.countBlanks(d.text) >= 1),
  `→ ${drafts.map(d => G.countBlanks(d.text)).join(', ')}개`);
ok('어느 활동 기준인지 밝힌다', drafts.every(d => d.basedOn === '커머스 데이터 인턴'));

console.log('\n── 5. 활동이 없으면 문장을 지어내지 않는가 ──');
ok('빈 배열이면 틀도 없다', G.openingDrafts([]).length === 0);
ok('이름 없는 활동이면 만들지 않는다', G.openingDrafts([{ typeLabel: '인턴십' }]).length === 0);
ok('null 도 안전하다', G.openingDrafts(null).length === 0);

console.log('\n── 6. 중복 소재 경고가 틀까지 따라오는가 ──');
const reused = G.openingDrafts([{ name: 'A프로젝트' }], { reuse: true });
ok('reuse 를 표시한다', reused.every(d => d.reuse === true));
ok('경고 문구가 붙는다', reused.every(d => d.warn && d.warn.includes('다른 역량')));
ok('reuse 가 아니면 경고가 없다', G.openingDrafts([{ name: 'A' }])[0].warn === null);

console.log('\n── 7. 빈칸 세기 ──');
ok('대괄호를 센다', G.countBlanks('[숫자]. [무엇]에서 했습니다.') === 2);
ok('없으면 0', G.countBlanks('빈칸이 없는 완성된 문장입니다.') === 0);

console.log('\n── 8. 면접 예상질문 ──');
const qs = G.interviewQuestions({ company: '삼성전자', hasNews: true });
ok('기업분석 질문 3종', qs.filter(q => q.from !== 'competency').length === 3);
ok('회사명이 들어간다', qs.every(q => q.q.includes('삼성전자')));
ok('답하는 법을 같이 준다', qs.every(q => q.how && q.how.length > 5));

const noNews = G.interviewQuestions({ company: '삼성전자', hasNews: false });
ok('뉴스가 없으면 최근이슈 질문을 만들지 않는다', !noNews.some(q => q.from === 'news'),
  '근거 없는 질문은 학생이 답을 찾을 곳이 없다');

const withComp = G.interviewQuestions({
  company: 'A', hasNews: false,
  competencies: [{ label: '문제해결력', followup: '그 원인이 아닐 가능성은?' },
                 { label: '협업', followup: '그 원인이 아닐 가능성은?' }],
});
ok('역량 followup 을 이어 붙인다', withComp.some(q => q.from === 'competency'));
ok('같은 질문을 두 번 넣지 않는다',
  withComp.filter(q => q.q === '그 원인이 아닐 가능성은?').length === 1);

const noName = G.interviewQuestions({});
ok('회사명이 없어도 만든다', noName.length === 2 && noName[0].q.includes('지원 회사'));

console.log('\n── 9. 사전 자체가 비어 있지 않은가 ──');
ok('STAR 4단계', G.STAR.length === 4 && G.STAR.every(s => s.key && s.check));
ok('상투표현 사전', G.CLICHES.length >= 10 && G.CLICHES.every(c => c.term && c.why));
ok('AI 흔적 사전', G.AI_TELLS.length >= 5 && G.AI_TELLS.every(t => typeof t.repeat === 'number'));
ok('제출 체크리스트', G.SUBMIT_CHECKLIST.length >= 5);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
