/* 자사 채용페이지 표 — 회사 리포트의 채용공고 칸이 쓰는 링크.

   네트워크를 부르지 않는다. 링크가 살아 있는지는 scripts/check-career-pages.js 가
   보고, 여기서는 **표 자체가 말이 되는지**를 본다.

   ── 이 테스트가 지키는 것 ──
   표는 사람이 손으로 채운다. 회사 이름을 한 글자 틀리면 링크가 조용히 안 나온다 —
   에러도 안 나고 화면도 멀쩡해서 아무도 모른다. 그게 여기서 잡으려는 것이다. */
const CAREER = require('../backend/src/career-pages.js');
const S = require('../backend/src/company-sectors.js');
const table = require('../backend/data/career-pages.json');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

console.log('── 1. 표 자체 ──');
const entries = Object.entries(table.pages || {});
ok('표가 비어 있지 않다', entries.length > 0, `→ ${entries.length}곳`);
ok('전부 https 다', entries.every(([, u]) => /^https:\/\//.test(u)),
   `→ ${entries.filter(([, u]) => !/^https:\/\//.test(u)).map(([n]) => n).join(', ') || '전부 통과'}`);
ok('중복된 회사가 없다', new Set(entries.map(([n]) => n)).size === entries.length);
ok('같은 URL 을 두 회사가 쓰지 않는다',
   new Set(entries.map(([, u]) => u)).size === entries.length,
   /* 그룹 통합 채용이면 있을 수 있다. 그때는 이 테스트를 고치되 **왜 같은지**를
      같이 적는다 — 복사·붙여넣기 실수와 구분이 안 되기 때문이다. */
   '(그룹 통합이면 사유를 적고 고칠 것)');

console.log('\n── 2. 이름이 우리 회사 목록에 있는가 ──');
const tree = S.industryTree();
if (!tree.total) {
  console.log(`  건너뜀 — 회사 목록이 비어 있습니다(${tree.reason})`);
} else {
  const names = new Set();
  (function walk(node) {
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(c => names.add(c.n));
      else walk(v);
    }
  })(tree.tree);
  const unknown = entries.map(([n]) => n).filter(n => !names.has(n));
  ok('표의 회사가 전부 목록에 있다', unknown.length === 0,
     unknown.length ? `→ 목록에 없음: ${unknown.join(', ')}` : `→ ${entries.length}곳 확인`);
}

console.log('\n── 3. 조회 ──');
const first = entries[0][0];
ok('이름으로 찾는다', CAREER.urlOf(first) === table.pages[first], `→ ${first}`);
/* 24-7 과 같은 함정 — DART 기업개황은 '삼성전자(주)' 로 준다. 표는 '삼성전자' 다. */
ok('법인격 표기가 붙어도 찾는다', CAREER.urlOf(`${first}(주)`) === table.pages[first]);
ok('공백이 섞여도 찾는다', CAREER.urlOf(` ${first} `) === table.pages[first]);
ok('주식회사 표기도 찾는다', CAREER.urlOf(`주식회사 ${first}`) === table.pages[first]);
ok('없는 회사는 null', CAREER.urlOf('있을리없는회사이름123') === null);
ok('빈 값은 null', CAREER.urlOf('') === null && CAREER.urlOf(null) === null);
ok('개수를 센다', CAREER.count() === entries.length, `→ ${CAREER.count()}곳`);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
