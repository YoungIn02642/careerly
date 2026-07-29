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

console.log('\n── 6. 주간 대표 기사 ──');
/* 이 기능의 위험은 '엉뚱한 기사를 그 주의 대표라고 내미는 것' 과
   '같은 사건인데 말머리 때문에 안 묶여서 화제성이 1로 보이는 것' 두 가지다. */
const NOW = Date.parse('2026-07-29');
const ago = n => new Date(NOW - n * 86400000).toISOString().slice(0, 10);
const wItems = [
  { title: '삼성전자, HBM4 양산 시작', summary: '반도체 수주 계약', url: 'u1', date: ago(1) },
  { title: '[단독] 삼성전자, HBM4 양산 시작한다', summary: '', url: 'u2', date: ago(2) },
  { title: '삼성전자 HBM4 양산 시작 — 종합', summary: '', url: 'u3', date: ago(2) },
  { title: '삼성전자가 HBM4 양산을 시작했다', summary: '', url: 'u9', date: ago(3) },
  { title: '삼성전자 사회공헌 행사', summary: '봉사', url: 'u4', date: ago(3) },
  { title: '삼성전자 신제품 냉장고 출시', summary: '', url: 'u5', date: ago(9) },
  { title: '삼성전자 하반기 공채 시작, 신입 채용 확대', summary: '조직 개편', url: 'u6', date: ago(10) },
  { title: '삼성전자 미국 진출 투자 발표', summary: '신사업 전략', url: 'u7', date: ago(22) },
  { title: '삼성전자 오래된 기사', summary: '', url: 'u8', date: ago(45) },
];
const clustered = NEWS.cluster(wItems);
const hbm = clustered.find(c => c.title.includes('HBM4'));
ok('말머리(단독·종합)와 어미가 달라도 같은 사건으로 묶는다', hbm.count === 4, `→ ${hbm.count}건`);
ok('대표 제목은 가장 짧은 것을 쓴다', hbm.title === '삼성전자, HBM4 양산 시작', `→ ${hbm.title}`);
ok('대표 제목과 링크가 같은 기사에서 온다', hbm.url === 'u1', `→ ${hbm.url}`);

const picks = NEWS.weeklyPicks(clustered, NOW);
ok('주마다 한 건씩만 고른다', new Set(picks.map(p => p.week)).size === picks.length);
ok('5주 범위 밖 기사는 빼다', !picks.some(p => p.title.includes('오래된')), `→ ${picks.map(p => p.week).join(',')}`);
ok('여러 언론사가 다룬 기사가 그 주의 대표가 된다',
   picks[0].title.includes('HBM4') && picks[0].outlets === 4);
ok('화제성이 같으면 직무트렌드 기사를 올린다',
   picks.find(p => p.week === 1)?.title.includes('공채'),
   `→ ${picks.find(p => p.week === 1)?.title}`);
ok('주 라벨을 붙인다', picks[0].weekLabel === '이번 주' && picks.some(p => /주 전$/.test(p.weekLabel)));
ok('최대 5건을 넘지 않는다', picks.length <= NEWS.WEEKS);
ok('날짜가 없으면(웹 폴백) 주간 정리를 만들지 않는다',
   NEWS.weeklyPicks(NEWS.cluster([{ title: '삼성전자 무언가', summary: '', url: 'x', date: null }]), NOW).length === 0);

/* 실측 회귀: '아주산업' 이번 주 대표가 본문에 회사명이 한 번 스친 남의 기사
   ("박춘원 전북은행장 무거운 발걸음")로 뽑혔다. 제목에 회사가 있는 기사를 우선해야 한다. */
const loose = [
  { title: '박춘원 전북은행장 무거운 발걸음', summary: '아주산업 등 지역 기업과 협약', url: 'a', date: ago(1) },
  { title: '박춘원 전북은행장 무거운 발걸음은', summary: '아주산업 협약', url: 'b', date: ago(1) },
  { title: '아주산업, 특수콘크리트 기술 협력', summary: '', url: 'c', date: ago(2) },
];
const loosePick = NEWS.weeklyPicks(NEWS.cluster(loose), NOW, '아주산업')[0];
ok('제목에 회사명이 있는 기사를 대표로 올린다 (화제성이 낮아도)',
   loosePick.title.startsWith('아주산업'), `→ ${loosePick.title}`);
ok('제목 우선이라도 같은 주 기사 수는 전부 센다', loosePick.alsoInWeek === 1);
ok('제목에 회사가 있으면 looseMatch 가 아니다', loosePick.looseMatch === false);

const onlyLoose = NEWS.weeklyPicks(NEWS.cluster([loose[0]]), NOW, '아주산업')[0];
ok('제목 후보가 하나도 없으면 그때만 본문 언급을 쓰고 경고를 남긴다',
   onlyLoose && onlyLoose.looseMatch === true, `→ ${onlyLoose?.title}`);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
