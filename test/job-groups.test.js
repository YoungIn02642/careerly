/* 직무 그룹 — backend/src/job-groups.js

   커리어 로드맵의 1차 분류를 '취업 시장의 말' 로 다시 묶는 층이다. 조용히 틀리는
   방식이 둘 있어서 테스트가 꼭 필요하다.

     ① 직업 이름을 오타로 적으면 그 직업이 **어느 그룹에도 안 들어간다.** 에러는
        안 나고 '그 외 직무' 로 흘러가서 눈에 안 띈다.
     ② 그룹을 늘리다 보면 461개 중 일부가 새어 나갈 수 있다. 목록에서 사라진 직업은
        그 직업을 고르려던 사람에게만 보이는 고장이다.

   그래서 **461개가 빠짐없이 어딘가에 정확히 한 번씩** 들어가는지를 못 박는다. */
const G = require('../backend/src/job-groups.js');
const WAGE = require('../backend/src/wage-jobs.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const tree = WAGE.catalog();
const built = G.build(tree);

// ── 1. 화면에 나갈 목록 ──────────────────────────────────────
console.log('── 1. 사용자가 요청한 16개 + 그 외 ──');
ok('그룹 정의가 16개다', G.GROUPS.length === 16, `→ ${G.GROUPS.length}`);
ok('화면에는 그 외까지 17칸', built.groups.length === 17);
ok('마지막 칸이 그 외 직무', built.groups[built.groups.length - 1].id === 'etc');

/* 순서가 곧 화면 순서다. 사용자가 준 칩 순서를 그대로 따른다. */
const WANT = ['기획/전략/경영', '인사/총무', '재무/회계', '마케팅/운영/홍보', '전시/컨벤션',
  '영업/고객상담', '상품기획/MD', '구매/자재/재고', '무역사무/수출입', '디자인',
  '생산/제조', '자동차/조선/기계', '반도체/디스플레이', '연구개발/설계',
  'IT/개발/데이터', '금융권'];
ok('라벨과 순서가 요청과 같다',
   G.GROUPS.map(g => g.label).join('|') === WANT.join('|'),
   G.GROUPS.map(g => g.label).join(' · '));

ok('id 가 겹치지 않는다', new Set(G.GROUPS.map(g => g.id)).size === G.GROUPS.length);
ok('모든 그룹에 설명이 있다', G.GROUPS.every(g => g.desc && g.emoji));

// ── 2. 적어 둔 이름이 실제로 있는가 ──────────────────────────
console.log('\n── 2. 오타는 조용히 사라진다 ──');
/* 실측: company-sectors 에서 직업 코드를 지어 적어 7개가 전부 틀렸다. 여기서는
   코드 대신 이름으로 적는데, 이름도 틀릴 수 있으므로 같은 방식으로 못 박는다. */
ok('카탈로그에서 못 찾은 이름이 없다', built.missing.length === 0,
   built.missing.join(' | ') || '전부 확인됨');

// ── 3. 461개가 빠짐없이 정확히 한 번씩 ────────────────────────
console.log('\n── 3. 직업이 새어 나가지 않는가 ──');
const all = [];
tree.majors.forEach(M => M.middles.forEach(m => m.jobs.forEach(j => all.push(j.code))));

const placed = [];
built.groups.forEach(g => g.middles.forEach(m => placed.push(...m.jobCodes)));

ok('모든 직업이 어딘가에 들어갔다', placed.length === all.length,
   `→ ${placed.length} / ${all.length}`);
ok('같은 직업이 두 그룹에 들어가지 않는다', new Set(placed).size === placed.length);
ok('빠진 직업이 없다', all.every(c => placed.includes(c)),
   all.filter(c => !placed.includes(c)).length + '개 빠짐');
ok('jobCount 가 실제 개수와 맞는다',
   built.groups.every(g => g.jobCount === g.middles.reduce((n, m) => n + m.jobCodes.length, 0)));

/* '그 외 직무' 칸을 지우는 것은 이 저장소가 한 번 했다가 되돌린 일이다
   (job-filter.js → catalog-db.js jobCatalog 주석, 2026-08-11 사용자 결정).
   교육·보건의료 같은 직업이 목록에서 사라지면 그 직업을 고르려던 사람만 겪는 고장이다. */
const etc = built.groups.find(g => g.id === 'etc');
ok('그 외 칸이 실제로 직업을 담고 있다', etc.jobCount > 0, `→ ${etc.jobCount}개`);
ok('교육직이 사라지지 않았다', etc.middles.some(m => m.code === '21'));
ok('보건·의료직도 남아 있다', etc.middles.some(m => m.code === '30'));

// ── 4. 그룹 → 2차 분류 ───────────────────────────────────────
console.log('\n── 4. 한 그룹이 여러 대분류에 걸친다 ──');
/* 영업/고객상담은 61(영업·판매직)과 02(경영·행정·사무직)에 걸친다. major 를 같이
   들고 있지 않으면 화면이 눌렀을 때 어느 대분류인지 몰라 조회가 깨진다. */
const sales = built.groups.find(g => g.id === 'sales');
ok('영업 그룹이 두 개 이상의 2차 분류를 갖는다', sales.middles.length >= 2);
ok('2차 분류마다 major 를 들고 있다', sales.middles.every(m => m.major && m.code));
ok('영업·판매직(61)이 들어 있다', sales.middles.some(m => m.code === '61'));

/* 인사/총무는 경영·행정·사무직 37개 중 6개만 가져간다 — 통째로 가져가면
   그룹으로 좁힌 뜻이 사라진다. */
const hr = built.groups.find(g => g.id === 'hr');
const office = tree.majors.find(M => M.code === '0').middles.find(m => m.code === '02');
ok('인사/총무는 사무직 일부만 가져간다',
   hr.jobCount > 0 && hr.jobCount < office.jobs.length,
   `→ ${hr.jobCount} / ${office.jobs.length}`);

/* IT 는 정보통신 연구개발직을 통째로 가져간다(+ 정보통신 관리자). */
const it = built.groups.find(g => g.id === 'it');
ok('IT 는 정보통신 연구개발직을 담는다', it.middles.some(m => m.code === '13'));

// ── 5. 관리직을 업종으로 흩었는가 ────────────────────────────
console.log('\n── 5. 관리직 24개를 한 칸에 몰지 않는다 ──');
/* 관리직(01)에는 기업 임원·금융관리자·교장·정부 고위공무원이 같이 있다. 통째로
   '기획/전략/경영' 에 넣었더니 그 밑에 학교가 떴다. 업종을 따라 흩어 놓는다. */
const nameOf = new Map();
tree.majors.forEach(M => M.middles.forEach(m => m.jobs.forEach(j => nameOf.set(j.code, j.name))));
const groupOfName = name => {
  const code = [...nameOf.entries()].find(([, n]) => n === name)?.[0];
  return built.groups.find(g => g.middles.some(m => m.jobCodes.includes(code)))?.id || null;
};
ok('금융관리자는 금융권으로', groupOfName('금융관리자') === 'bank');
ok('정보 통신 관련 관리자는 IT 로', groupOfName('정보 통신 관련 관리자') === 'it');
ok('제품 생산 관련 관리자는 생산/제조로', groupOfName('제품 생산 관련 관리자') === 'production');
ok('기업 고위 임원은 기획/전략/경영으로', groupOfName('기업 대표 및 기업 고위 임원') === 'plan');
/* 교장은 기획/전략/경영이 아니어야 한다 — 학교는 경영 직무가 아니다. */
ok('초·중·고 교장은 기획/전략/경영에 없다',
   groupOfName('초·중·고등학교 교장 및 교감') !== 'plan',
   `→ ${groupOfName('초·중·고등학교 교장 및 교감')}`);

// ── 6. 빈 입력 ───────────────────────────────────────────────
console.log('\n── 6. 트리가 없을 때 ──');
ok('빈 트리에도 깨지지 않는다', G.build({}).groups.every(g => g.jobCount === 0));
ok('빈 트리면 그 외 칸을 만들지 않는다', !G.build({}).groups.some(g => g.id === 'etc'));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
