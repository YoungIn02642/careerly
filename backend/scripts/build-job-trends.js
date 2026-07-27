/* 수집된 채용공고 → 직무별 역량 요구 빈도 집계 → data/job-trends.json

   선행: node scripts/fetch-worknet-jobs.js   (data/worknet-jobs.json 생성)
   실행: node scripts/build-job-trends.js

   네트워크를 타지 않는다. 수집(fetch-*)과 집계(build-*)를 나눠 둔 이유는,
   추출 규칙(jd-competency.js 의 keywords)을 고칠 때마다 API 를 다시 부르지 않고
   집계만 다시 돌리기 위해서다. 규칙은 앞으로 자주 손볼 부분이다. */
const trends = require('../src/job-trends');

try {
  const out = trends.build();

  console.log('집계 완료 —', out.totalJobs, '건');
  console.log('기준 텍스트:', out.basedOn, `(표본 ${out.minSample}건 미만 직무는 화면에서 숨김)`);

  const rows = Object.entries(out.trends)
    .sort((a, b) => b[1].sample - a[1].sample)
    .slice(0, 10);

  for (const [key, b] of rows) {
    const top = b.competencies.slice(0, 4).map(c => `${c.label} ${c.pct}%`).join(' · ');
    const thin = b.sample < out.minSample ? '  ← 표본 부족(숨김)' : '';
    console.log(`  ${key} (공고 ${b.sample}건)${thin}\n     ${top || '(추출된 역량 없음)'}`);
  }
} catch (e) {
  console.error('실패:', e.message);
  process.exit(1);
}
