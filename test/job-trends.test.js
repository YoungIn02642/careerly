/* 직무 트렌드 집계 테스트
   인증키 승인 전에도 파이프라인이 맞는지 확인하려고, 실제 캐시 파일 대신
   가짜 공고를 함수에 직접 넣는다. data/ 에 가짜 데이터를 만들지 않는 게 중요하다 —
   시드와 실데이터가 섞이면 "선배 1,188명"이 시드였던 일이 반복된다. */
const T = require('../backend/src/job-trends');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

/* 제목만 있는 공고 40건 — 절반은 데이터 분석, 4건만 글로벌 */
const jobs = [];
for (let i = 0; i < 40; i++) {
  const t = i < 20 ? '마케팅 성과 데이터 분석 담당자 모집'
          : i < 24 ? '해외영업 담당 (영어 가능자)'
          : '마케팅 프로모션 기획 담당자';
  jobs.push({ keyword: '기획사무', title: t });
}
/* 표본이 적은 직무도 하나 넣는다(숨김 동작 확인용) */
jobs.push({ keyword: '보건·의료', title: '데이터 분석 간호행정' });

const out = T.aggregate({ source: 'test', fetchedAt: 'now', jobs });

console.log('── 1. 집계 ──');
const 기획 = out.trends['기획사무'];
ok('키워드별로 공고 수를 센다', 기획.sample === 40, `→ ${기획.sample}`);
ok('데이터 분석력이 50%', 기획.competencies.find(c => c.id === 'data-analysis')?.pct === 50,
   `→ ${기획.competencies.find(c => c.id === 'data-analysis')?.pct}%`);
ok('글로벌은 10%', 기획.competencies.find(c => c.id === 'global')?.pct === 10);
ok('많이 요구된 순으로 정렬', 기획.competencies[0].count >= 기획.competencies[1].count);
ok('공고 1건에서 같은 역량이 여러 번 걸려도 1건으로 센다',
   기획.competencies.every(c => c.count <= 기획.sample));
ok('집계 기준을 기록한다(제목만 썼다는 사실)', out.basedOn === 'title', `→ ${out.basedOn}`);

console.log('\n── 2. 표본이 적으면 비율을 보여주지 않는다 ──');
/* marketFor 는 캐시(load)를 보므로, 여기서는 aggregate 결과로 직접 확인한다 */
ok('표본 기준선이 정의돼 있다', T.MIN_SAMPLE >= 30, `→ ${T.MIN_SAMPLE}`);
ok('표본 부족 직무도 집계는 하되 sample 을 남긴다',
   out.trends['보건·의료'].sample === 1 && out.trends['보건·의료'].sample < out.minSample);

console.log('\n── 3. 캐시가 없을 때 (인증키 승인 전 = 지금) ──');
ok('캐시가 없으면 조용히 null — 화면이 깨지지 않는다',
   T.load() === false ? T.marketFor('기획사무', 'data-analysis') === null : true);
ok('버킷을 못 고르면 null', T.pickBucket('아무 상관 없는 글') === null);
ok('meta 도 null 로 떨어진다', T.load() === false ? T.meta() === null : true);

console.log('\n── 4. 화면 카드와 같은 추출기를 쓰는가 ──');
/* 집계와 카드가 다른 파서를 쓰면 "68%가 요구"와 카드 목록이 어긋난다 */
const JD = require('../backend/src/jd-competency');
const fromCard = JD.ruleExtract('마케팅 성과 데이터 분석 담당자 모집').found.map(f => f.id);
ok('집계에 잡힌 역량이 카드 추출 결과와 일치',
   fromCard.includes('data-analysis') && 기획.competencies.some(c => c.id === 'data-analysis'),
   `→ ${fromCard.join(', ')}`);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
