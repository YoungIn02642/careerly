/* 직업 분류 필터 테스트 — backend/src/job-filter.js
   네트워크를 타지 않는다. 수집해 둔 data/wage-jobs.json 을 원본으로 쓴다.

   이 기능의 위험은 **에러가 나지 않는다**는 것이다.
     1) 제외 목록의 이름을 한 글자라도 틀리면 그 직업은 조용히 계속 노출된다.
        ('패스트푸드 준비원' → '패스트푸드준비원' 처럼 띄어쓰기만 틀려도 그렇다)
     2) 반대로 수집 스크립트를 다시 돌려 원본 이름이 바뀌면, 멀쩡하던 제외가 풀린다.
     3) 2차 분류를 다 뺐는데 1차가 남으면 눌러도 아무것도 없는 칸이 생긴다.
   셋 다 화면을 하나하나 눌러보기 전엔 안 보이므로 여기서 막는다. */
const { catalog } = require('../backend/src/wage-jobs');
const F = require('../backend/src/job-filter');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '  FAIL '), name, extra);
};

const raw = catalog();
const filtered = F.filterTree(raw);
const middles = filtered.majors.flatMap(M => M.middles);
const jobs = middles.flatMap(m => m.jobs);
const jobNames = new Set(jobs.map(j => j.name));

console.log('── 1. 제외 목록이 실제 데이터와 맞는가 (오타 방지) ──');
const v = F.verify(raw);
ok('원본에 없는 2차 코드가 없다', v.unknownMiddles.length === 0,
   v.unknownMiddles.length ? `→ ${v.unknownMiddles.join(', ')}` : '');
ok('원본에 없는 직업명이 없다', v.unknownJobs.length === 0,
   v.unknownJobs.length ? `→ ${v.unknownJobs.join(', ')}` : '');

console.log('\n── 2. 사용자가 지목한 직업이 실제로 사라졌는가 ──');
/* 회의에서 예시로 든 것들. 이게 다시 나타나면 필터가 풀린 것이다. */
[
  '대학교 총장 및 대학학장', '기업 대표 및 기업 고위 임원',   // 경력 종착지
  '패스트푸드 준비원', '청소원', '세탁원 및 다림질원',
  '주차 관리원 및 안내원', '검표원',
].forEach(n => {
  ok(`'${n}' 이 목록에 없다`, !jobNames.has(n));
  ok(`  ('${n}' 은 원본에는 있다 — 이름이 맞다는 뜻)`,
     raw.majors.flatMap(M => M.middles).flatMap(m => m.jobs).some(j => j.name === n));
});

console.log('\n── 3. 전공·면허 경로가 분명한 직업은 남았는가 ──');
/* 2차 분류를 통째로 빼면 이것들이 같이 사라진다. 남아 있어야 한다. */
['한식조리사', '음료 조리사(바리스타포함)', '항공기조종사', '선장 및 항해사·도선사',
 '기술 영업원', '해외영업원', '건축가(건축설계사)', '반도체공학 기술자 및 연구원',
].forEach(n => ok(`'${n}' 이 남아 있다`, jobNames.has(n)));

console.log('\n── 4. 빈 칸이 생기지 않는가 ──');
ok('2차 분류가 0개인 1차는 없다', filtered.majors.every(M => M.middles.length > 0));
ok('직업이 0개인 2차는 없다', middles.every(m => m.jobs.length > 0),
   `→ ${middles.filter(m => !m.jobs.length).map(m => m.name).join(', ') || '없음'}`);
ok('제외한 1차(건설·채굴, 설치·정비·생산, 농림어업)가 통째로 빠졌다',
   !filtered.majors.some(M => ['7', '8', '9'].includes(M.code)));

console.log('\n── 5. 1차 이름이 내용과 맞는가 ──');
/* 1차 이름은 그 안의 2차를 나열한 것이라, 일부를 빼면 이름이 거짓말이 된다.
   '미용·…·경비·청소직' 인데 미용도 경비도 청소도 없으면 눌러 보고 고장이라 여긴다. */
const M5 = filtered.majors.find(M => M.code === '5');
ok('5번 1차 이름에 없어진 갈래(미용·경비·청소)가 안 남아 있다',
   !!M5 && !/미용|경비|청소/.test(M5.name), `→ ${M5?.name}`);
ok('5번 1차에 이모지·설명이 그대로 있다', !!(M5?.emoji && M5?.desc));
const M6 = filtered.majors.find(M => M.code === '6');
ok('6번 1차 이름에 없어진 갈래(운전)가 안 남아 있다',
   !!M6 && !/운전/.test(M6.name), `→ ${M6?.name}`);

console.log('\n── 6. 원본을 건드리지 않는가 ──');
/* filterTree 가 제자리에서 고치면, 캐시된 트리를 두 번 거를 때 결과가 달라진다. */
ok('원본 1차 수가 그대로다(10)', raw.majors.length === 10, `→ ${raw.majors.length}`);
ok('원본 직업 수가 그대로다(461)',
   raw.majors.flatMap(M => M.middles).flatMap(m => m.jobs).length === 461);
const twice = F.filterTree(F.filterTree(raw));
ok('두 번 걸러도 결과가 같다', twice.counts.jobs === filtered.counts.jobs,
   `→ ${twice.counts.jobs} vs ${filtered.counts.jobs}`);

console.log('\n── 7. counts 가 실제 개수와 맞는가 ──');
ok('counts.majors 일치', filtered.counts.majors === filtered.majors.length);
ok('counts.middles 일치', filtered.counts.middles === middles.length);
ok('counts.jobs 일치', filtered.counts.jobs === jobs.length);
ok('걸러낸 뒤 규모가 예상 범위다',
   filtered.majors.length === 7 && middles.length === 19,
   `→ 1차 ${filtered.majors.length} · 2차 ${middles.length} · 직업 ${jobs.length}`);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
