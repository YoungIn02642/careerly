/* 내 자소서 보관함 저장소 테스트 (frontend/js/drafts.js)
   화면을 띄우지 않는다 — localStorage 만 흉내 내고 store 의 규칙만 본다.

   이 저장소의 위험은 느린 것이 아니라 **글이 조용히 사라지거나 남는 것**이다.
   자소서는 다시 쓰기 어려운 글이라, 지웠는데 목록에 남거나(즐겨찾기 찌꺼기)
   저장했는데 안 보이는 일이 생기면 사용자는 서비스를 못 믿는다. */

/* localStorage 흉내. 값은 문자열로만 들고 있는다 — 진짜 localStorage 도 그렇다
   (객체를 그대로 넣어도 통과하는 가짜를 만들면, 브라우저에서만 깨진다). */
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
  clear: () => mem.clear(),
};
globalThis.document = { querySelector: () => null };

const { store, unwrap } = require('../frontend/js/drafts.js');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };
const reset = () => mem.clear();

console.log('── 1. 옛 저장 형식도 읽는다 ──');
/* 처음에는 문자열만 넣었다(v1). 나중에 "언제 쓴 글인지"가 필요해 { text, at } 로
   바꿨는데(v2), 이미 저장해 둔 초안을 버릴 수는 없다. */
ok('문자열(v1)을 읽는다', unwrap('옛 초안').text === '옛 초안');
ok('객체(v2)를 읽는다', unwrap({ text: '새 초안', at: 123 }).at === 123);
ok('망가진 값도 죽지 않는다', unwrap(null).text === '' && unwrap(7).text === '');

console.log('\n── 2. 저장·읽기 ──');
reset();
store.set('삼성전자', '문항1', '지원 동기는…');
ok('저장한 글을 그대로 읽는다', store.get('삼성전자', '문항1') === '지원 동기는…');
ok('없는 글은 빈 문자열', store.get('없는회사', '문항1') === '');
ok('저장하면 시각이 붙는다', typeof store.entries()[0].drafts[0].at === 'number');

/* 빈 글은 흔적을 남기지 않는다 — 지운 자리에 제목만 남으면 목록이 거짓말을 한다. */
store.set('삼성전자', '문항1', '   ');
ok('공백만 저장하면 항목이 사라진다', store.count() === 0);
ok('회사에 남은 글이 없으면 회사도 사라진다', store.entries().length === 0);

console.log('\n── 3. 즐겨찾기 (자소서=회사 단위) ──');
/* 즐겨찾기는 문항이 아니라 **자소서(회사) 하나** 를 담는다(2026-09-01). */
reset();
store.set('네이버', '문항1', 'A');
store.set('네이버', '문항2', 'B');
ok('처음에는 즐겨찾기가 아니다', store.isFav('네이버') === false);
ok('누르면 켜진다', store.toggleFav('네이버') === true && store.isFav('네이버'));
ok('다시 누르면 꺼진다', store.toggleFav('네이버') === false && !store.isFav('네이버'));

/* 즐겨찾기는 "다시 볼 자소서" 라 목록 맨 위에 있어야 뜻이 있다. */
reset();
store.set('카카오', '문항1', 'A');
store.set('네이버', '문항1', 'B');
store.toggleFav('네이버');
ok('즐겨찾기한 회사가 먼저 온다', store.entries()[0].company === '네이버');
ok('그 회사의 fav 플래그가 선다', store.entries()[0].fav === true);

/* 옛 '회사::항목' 형태로 저장돼 있어도 회사 즐겨찾기로 읽는다(하위호환). */
reset();
store.set('현대차', '문항1', 'A');
localStorage.setItem('careerly_jd_fav_v1', JSON.stringify(['현대차::문항1']));
ok('옛 문항 단위 즐겨찾기도 회사로 읽는다', store.isFav('현대차') === true);
ok('옛 값을 끄면 회사 흔적까지 지운다', store.toggleFav('현대차') === false && store.isFav('현대차') === false);

console.log('\n── 4. 삭제 ──');
reset();
store.set('카카오', '문항1', 'A');
store.set('카카오', '문항2', 'B');
store.toggleFav('카카오');
store.remove('카카오', '문항1');
ok('한 문항을 지워도 남은 글이 있으면 회사 즐겨찾기는 남는다', store.isFav('카카오') === true);
store.remove('카카오', '문항2');
ok('마지막 글까지 지우면 목록에서 사라진다', store.count() === 0);
/* 즐겨찾기 찌꺼기를 남기면, 같은 이름으로 새 글을 쓸 때 별이 켜진 채로 나타난다. */
ok('회사가 비면 즐겨찾기도 같이 지운다', store.isFav('카카오') === false);

/* 회사 통째 삭제(removeCompany)도 즐겨찾기를 남기지 않는다. */
reset();
store.set('토스', '문항1', 'A');
store.toggleFav('토스');
store.removeCompany('토스');
ok('회사를 통째로 지우면 즐겨찾기도 사라진다', store.isFav('토스') === false && store.count() === 0);

console.log('\n── 5. 회사별 묶음 ──');
reset();
store.set('LG전자', '문항1', 'A');
store.set('SK하이닉스', '문항1', 'B');
store.set('SK하이닉스', '문항2', 'C');
const groups = store.entries();
ok('회사별로 묶는다', groups.length === 2);
ok('전체 건수를 센다', store.count() === 3);
ok('즐겨찾기가 있는 회사가 먼저 온다', (() => {
  store.toggleFav('LG전자');
  return store.entries()[0].company === 'LG전자';
})());

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
