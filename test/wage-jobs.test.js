/* 직업 분류 카탈로그(임금직업정보 · KECO) 테스트
   네트워크를 타지 않는다 — 수집해 둔 data/wage-jobs.json 과 overlay 만 검증한다.

   이 기능의 위험은 두 가지다.
     1) **legacy 매핑 누락** — 손으로 짠 표라 조용히 샌다. 실제로 'audit'(회계법인)을
        빠뜨려 회계 전공 98명이 통째로 집계에서 빠졌던 적이 있다. 화면에는 에러가 아니라
        그냥 '데이터 없음'으로 나와서 발견되지 않는다.
     2) **중복 매핑** — 같은 스펙이 두 중분류에 잡히면 합격자 평균이 두 군데서 다르게
        보이고 어느 쪽이 맞는지 알 수 없다.
   둘 다 여기서 막는다. */
const path = require('path');
const { catalog } = require('../backend/src/wage-jobs');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

const cat = catalog();
const middles = cat.majors.flatMap(m => m.middles);
const jobs = middles.flatMap(m => m.jobs);

console.log('── 1. 분류 트리 ──');
ok('대분류를 읽어온다', cat.majors.length === 10, `→ ${cat.majors.length}개`);
ok('중분류가 있다', middles.length >= 30, `→ ${middles.length}개`);
ok('직업이 있다', jobs.length >= 400, `→ ${jobs.length}개`);
ok('대분류마다 이모지·설명이 붙는다', cat.majors.every(m => m.emoji && m.desc));

/* 화면 번호(no)와 공식 코드(code)는 다른 값이다. 이 둘을 섞으면 사이드바를 클릭했을 때
   엉뚱한 분류를 조회하거나 아무것도 안 나온다. */
ok('화면 번호는 1부터 10까지', cat.majors.map(m => m.no).join(',') === '1,2,3,4,5,6,7,8,9,10',
   `→ ${cat.majors.map(m => m.no).join(',')}`);
ok('공식 코드는 0부터 9까지 그대로 둔다', cat.majors.map(m => m.code).join(',') === '0,1,2,3,4,5,6,7,8,9');
ok('2차 코드 앞자리 = 1차 공식 코드 (그래서 code 를 바꾸면 안 된다)',
   cat.majors.every(M => M.middles.every(S => S.code[0] === M.code)));

console.log('\n── 2. 회의에서 예시로 든 경로가 실제로 있는가 ──');
/* 미용·여행·숙박·음식·경비·청소직 → 경호·경비직 → 경호원 */
const M5 = cat.majors.find(m => m.code === '5');
ok('대분류 5 = 미용·여행·숙박·음식·경비·청소직', M5?.name.includes('경비'), `→ ${M5?.name}`);
const S54 = M5?.middles.find(s => s.code === '54');
ok('중분류 54 = 경호·경비직', S54?.name === '경호·경비직', `→ ${S54?.name}`);
ok('그 안에 경호원이 있다', !!S54?.jobs.find(j => j.name === '경호원'));

console.log('\n── 3. 연봉·전망 ──');
const guard = S54?.jobs.find(j => j.name === '경호원');
ok('직업마다 평균임금이 숫자로 있다', typeof guard.avgWage === 'number' && guard.avgWage > 0, `→ ${guard.avgWage}만원`);
ok('일자리 전망이 있다', !!guard.outlook, `→ ${guard.outlook}`);
ok('하는 일 설명이 있다', !!guard.summary);
ok('임금 없는 직업은 0 이 아니라 null 로 둔다', jobs.every(j => j.avgWage === null || j.avgWage > 0));
ok('중분류마다 임금 범위를 계산한다',
   S54.wageRange && S54.wageRange.min <= S54.wageRange.avg && S54.wageRange.avg <= S54.wageRange.max,
   `→ ${JSON.stringify(S54.wageRange)}`);

console.log('\n── 4. legacy 매핑 — 선배 스펙이 실제로 붙는가 ──');
let specs = [];
try {
  specs = require(path.join(__dirname, '..', 'backend', 'data', 'db.json')).userSpecs || [];
} catch { /* db.json 은 gitignore 대상이라 없을 수 있다 */ }

if (!specs.length) {
  console.log('  SKIP  db.json 이 없어 커버율 검사를 건너뜁니다 (백엔드를 한 번 띄우면 생성됩니다)');
} else {
  const match = (legacy, s) =>
    legacy.dept.includes(s.dept) && (!legacy.field?.length || legacy.field.includes(s.field));

  const mapped = middles.filter(m => m.legacy);
  ok('legacy 가 붙은 중분류가 있다', mapped.length >= 5, `→ ${mapped.length}개`);

  const hits = specs.map(() => []);
  mapped.forEach(m => specs.forEach((s, i) => { if (match(m.legacy, s)) hits[i].push(m.code); }));

  const covered = hits.filter(h => h.length).length;
  const pct = Math.round(covered / specs.length * 100);
  ok('저장된 스펙의 90% 이상이 어떤 중분류엔가 잡힌다', pct >= 90,
     `→ ${covered}/${specs.length} (${pct}%)`);

  const dup = hits.filter(h => h.length > 1);
  ok('한 스펙이 두 중분류에 동시에 잡히지 않는다', dup.length === 0,
     dup.length ? `→ ${dup.length}건, 예: ${JSON.stringify(dup[0])}` : '');

  /* 어떤 dept/field 조합이 새고 있는지 이름으로 남긴다 — 다음 사람이 바로 고칠 수 있게 */
  const missing = {};
  specs.forEach((s, i) => { if (!hits[i].length) missing[`${s.dept}/${s.field}`] = (missing[`${s.dept}/${s.field}`] || 0) + 1; });
  ok('매핑에서 빠진 학과·분야 조합이 없다', Object.keys(missing).length === 0,
     Object.keys(missing).length ? `→ ${JSON.stringify(missing)}` : '');
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
