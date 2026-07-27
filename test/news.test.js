/* 회사 뉴스 키워드 추출 테스트
   네트워크를 타지 않는다 — 가짜 기사를 함수에 직접 넣어 '무엇을 키워드로 보는가'만 검증한다.
   이 기능의 위험은 느린 것이 아니라 **엉뚱한 말을 자소서 키워드라고 내미는 것**이라,
   걸러내기가 제대로 도는지가 핵심이다. */
const NEWS = require('../backend/src/news');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

const items = [
  { title: '아주산업, 에스와이삼양과 특수콘크리트 기술협력 맞손',
    summary: '아주산업이 21일 서울 서초구 본사에서 전략적 파트너십 MOU를 체결했다고 밝혔다.',
    url: 'https://www.news1.kr/industry/123' },
  { title: '아주산업 특수콘크리트 사업 확대… 기술협력 잇는다',
    summary: '아주산업은 에스와이삼양과 MOU를 맺고 파트너십을 통해 77만원 규모 계약을 전개한다.',
    url: 'https://www.yna.co.kr/view/AKR123' },
  { title: '아주산업 보도자료 | Aju 홈페이지',
    summary: 'www.aju.co.kr/kor/about/news/view.do 보도자료 목록입니다.',
    url: 'https://www.aju.co.kr/kor/about/news/list.do' },
];

const kws = NEWS.newsKeywords(items, '아주산업');
const terms = kws.map(k => k.term);

console.log('── 1. 실제로 반복된 말을 뽑는가 ──');
ok('특수콘크리트', terms.includes('특수콘크리트'), `→ ${terms.join(', ')}`);
ok('에스와이삼양', terms.includes('에스와이삼양'));
ok('기술협력', terms.includes('기술협력'));
ok('MOU 같은 영문 약어도 남긴다', terms.includes('MOU'));

console.log('\n── 2. 자소서 키워드가 아닌 것을 걸러내는가 ──');
ok('회사명 자체는 키워드가 아니다', !terms.includes('아주산업'));
ok('주소 조각(www·view·about)이 섞이지 않는다',
   !terms.some(t => ['www', 'view', 'about', 'news', 'list', 'kr', 'co'].includes(t.toLowerCase())), `→ ${terms.join(', ')}`);
ok('기사 주소의 영문 사명(Aju)이 키워드로 남지 않는다', !terms.some(t => t.toLowerCase() === 'aju'));
ok('숫자로 시작하는 말(77만원·21일)은 뺀다', !terms.some(t => /^\d/.test(t)));
ok('서술어(밝혔다·체결했다)는 뺀다', !terms.some(t => t.length >= 3 && /다$/.test(t)));
ok('뉴스 관용어(보도자료)는 뺀다', !terms.includes('보도자료'));

console.log('\n── 3. 근거를 추적할 수 있는가 ──');
const one = kws.find(k => k.term === '특수콘크리트');
ok('키워드마다 등장한 기사 번호를 남긴다', Array.isArray(one.articles) && one.articles.length === one.count,
   `→ 기사 ${one.articles.join(',')} / ${one.count}건`);
ok('한 기사에 여러 번 나와도 1건으로 센다', kws.every(k => k.count <= items.length));
ok('기사 1건에만 나온 말은 버린다', kws.every(k => k.count >= 2));

console.log('\n── 4. HTML·주소 정리 ──');
ok('수치 실체참조(&#x27;)가 x27 로 남지 않는다',
   !NEWS.tokenize('맞손 &#x27; 기술협력').includes('x27'));
ok('빈 입력에도 죽지 않는다', NEWS.newsKeywords([], '아무회사').length === 0);

console.log('\n── 5. 지원동기 작성 지침 ──');
const g = NEWS.MOTIVE_GUIDE;
ok('작성 순서 골격이 있다', g.frame.includes('①') && g.frame.includes('⑤'));
ok('감점 표현을 알려준다', g.avoid.length >= 2 && g.avoid.some(a => a.includes('성장하는 기업')));
ok('면접 예상질문이 있다', !!g.followup);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
