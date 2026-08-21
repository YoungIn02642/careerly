/* 취업 업종 분류 — 회사 찾기 화면이 쓰는 업종 이름.

   네트워크를 부르지 않는다. 분류표(job-industry.js)와 캐시 파일만 읽는 순수 로직이라
   여기서 전부 검증된다.

   ── 이 테스트가 지키는 것 ──
   분류표는 사람이 손으로 채운 표다. 규칙 한 줄을 고치다가 회사가 통째로 엉뚱한 칸에
   들어가도 화면은 조용히 잘못된 이름을 보여 준다 — 학생은 그걸 믿는다. */
const J = require('../backend/src/job-industry.js');
const S = require('../backend/src/company-sectors.js');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

console.log('── 1. 분류표 자체 ──');
const minors = J.TAXONOMY.flatMap(([, m]) => m);
ok('대분류가 열 개다', J.TAXONOMY.length === 10, `→ ${J.TAXONOMY.length}개`);
ok('중분류 이름이 겹치지 않는다', new Set(minors).size === minors.length,
   '겹치면 어느 대분류에 속하는지 정할 수 없다');

/* 규칙이 분류표에 없는 이름을 가리키면 classify 가 던진다. 그 전에 여기서 잡는다. */
const pointed = [...new Set([...Object.values(J.BY_CODE), ...Object.values(J.BY_NAME)])];
const orphan = pointed.filter(m => !minors.includes(m));
ok('규칙이 가리키는 중분류가 전부 분류표에 있다', orphan.length === 0, `→ ${orphan.join(', ')}`);

/* 아무도 안 쓰는 칸은 화면에 안 나온다. 표에 남아 있으면 있는 줄 알고 찾게 된다. */
const publicMinors = J.TAXONOMY.find(([m]) => m === '기관·공공')[1];
const unused = minors.filter(m => !pointed.includes(m) && !publicMinors.includes(m));
ok('쓰이지 않는 중분류가 없다', unused.length === 0, `→ ${unused.join(', ')}`);

console.log('\n── 2. 긴 코드가 이긴다 ──');
/* 204(기타 화학제품)는 통째로 석유·화학인데 그 안의 2042(세제·화장품)만 빠진다.
   이 규칙이 깨지면 아모레퍼시픽이 '석유·화학' 이 된다. */
ok('2042(화장품)가 204(화학)보다 먼저다',
   J.minorOfCode('20423') === '화장품·생활용품' && J.minorOfCode('20499') === '석유·화학');
ok('5821(게임)이 582(소프트웨어)보다 먼저다',
   J.minorOfCode('5821') === '게임' && J.minorOfCode('58221') === '소프트웨어·솔루션');
ok('64992(지주회사)가 649보다 먼저다', J.minorOfCode('64992') === '지주회사');
ok('64911(캐피탈)은 지주회사가 아니다', J.minorOfCode('64911') === '캐피탈·여신');
ok('모르는 코드는 null (억지로 묶지 않는다)', J.minorOfCode('99999') === null);
ok('빈 값도 null', J.minorOfCode('') === null && J.minorOfCode(null) === null);

console.log('\n── 3. 이름 예외는 코드보다 먼저다 ──');
/* 예외를 둔 이유가 코드가 틀려서다. 순서가 뒤집히면 예외가 무력해진다. */
const es = J.classify('에스와이', '1090');
ok('에스와이는 건축자재 (사료 코드로 신고돼 있다)', es.minor === '인테리어·건축자재');
ok('예외로 옮긴 회사는 by=name 으로 표시된다', es.by === 'name',
   '업종 추천을 셀 때 이 회사들을 빼야 한다');
ok('코드로 분류된 회사는 by=code', J.classify('유한양행', '212').by === 'code');

console.log('\n── 4. 실제 회사 (눈으로 확인한 것) ──');
const cases = [
  ['삼성전자',     '264',   '반도체·전자부품'],   // 신고는 통신·방송장비(휴대폰)
  ['SK하이닉스',   '2612',  '반도체·전자부품'],
  ['넷마블',       '5821',  '게임'],
  ['카카오',       '63120', '포털·인터넷콘텐츠'],
  ['아모레퍼시픽', '20423', '화장품·생활용품'],
  ['농심',         '108',   '식품·음료'],          // 코드가 한 칸 밀려 있어도 같은 칸
  ['한일사료',     '109',   '식품·음료'],          // 위와 같은 이유로 같은 칸에 떨어진다
  ['유한양행',     '212',   '제약'],
  ['셀트리온',     '21100', '바이오·진단'],
  ['LG에너지솔루션', '28202', '배터리·2차전지'],
  ['현대건설',     '41221', '건설·건축'],
  ['대한항공',     '511',   '호텔·여행·항공'],
  ['한국타이어앤테크놀로지', '221', '자동차·자동차부품'],
  ['코웨이',       '969',   '렌탈·임대'],
];
for (const [name, code, want] of cases) {
  const got = J.classify(name, code);
  ok(`${name} → ${want}`, got && got.minor === want, got ? `→ ${got.minor}` : '→ 분류 실패');
}

console.log('\n── 5. 목록 전체가 분류된다 ──');
const r = S.sectors();
if (!r.total) {
  console.log(`  SKIP  DART 기업 캐시가 없어 목록 검증은 건너뜁니다 (${r.reason || ''})`);
} else {
  const all = r.sectors.flatMap(s => s.companies).filter(c => c.size && c.size !== 'public');
  const missed = all.filter(c => !J.classify(c.name, c.code));
  /* 분류 못 한 회사는 목록에서 사라진다 — 아무도 못 찾고, 왜 없는지도 알 수 없다. */
  ok('민간 회사가 빠짐없이 분류된다', missed.length === 0,
     `→ ${all.length}곳 중 실패 ${missed.length}곳 ${missed.slice(0, 3).map(c => c.name).join(', ')}`);
  ok('회사마다 원본 업종코드가 붙어 있다', all.every(c => c.code),
     '5자리 규칙(2042 화장품 등)을 쓰려면 2자리로 줄이기 전 값이 필요하다');

  const tree = S.industryTree();
  ok('트리 합계가 목록과 맞는다',
     tree.total === all.length + (S.publicOrgs().total || 0),
     `→ ${tree.total}곳`);
  ok('빈 칸은 만들지 않는다', tree.order.every(([maj, mins]) => mins.length > 0));
  ok('공공기관이 대분류 하나로 들어간다', !!tree.tree['기관·공공']);

  /* 같은 회사가 두 칸에 있으면 "몇 곳인가"를 셀 수 없다. */
  const names = [];
  (function walk(n) {
    for (const v of Object.values(n)) Array.isArray(v) ? v.forEach(c => names.push(c.n)) : walk(v);
  })(tree.tree);
  ok('같은 회사가 두 업종에 겹치지 않는다', new Set(names).size === names.length,
     `→ ${names.length}곳 중 중복 ${names.length - new Set(names).size}건`);

  console.log('\n── 6. 직무 → 업종 추천 ──');
  /* 이름으로 옮긴 회사는 추천의 근거에서 빠져야 한다. 네패스아크(업종코드 73)를
     반도체로 옮겨 뒀더니 코드 73이 들어간 직무마다 '반도체·전자부품' 이 추천으로 붙었다. */
  const f = S.industryFocus('14');   // 건설·부동산 쪽 2차 분류
  ok('건설 직무에 건설 업종이 추천된다', f.minors.includes('건설·건축'), `→ ${f.minors.join(', ')}`);
  ok('건설 직무에 반도체가 딸려오지 않는다', !f.minors.includes('반도체·전자부품'));
  ok('모르는 직무는 matched=false', S.industryFocus('없는코드').matched === false);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
