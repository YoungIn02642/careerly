/* 공공기관 채용공고 (잡알리오) — src/alio-jobs.js

   네트워크를 부르지 않는다. 캐시 파일을 읽어 회사명으로 고르고 마감·신입 조건으로
   거르는 순수 로직이라 여기서 전부 검증된다(company-sectors.test.js 와 같은 방식).

   필드 이름은 **실제 응답에서 확인한 것**을 쓴다(2026-08-15 실호출).
   추정한 이름으로 테스트를 짜면 테스트만 통과하고 실제로는 안 된다 — 공정위 API
   때 명세를 추정했다가 통째로 틀렸다(작업정리 3-1). */
const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '..', 'backend', 'data', 'alio-jobs.json');
const BACKUP = CACHE + '.testbak';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

/* 진짜 캐시가 있으면 잠시 치워 둔다 — 테스트가 남의 데이터를 건드리지 않는다. */
const hadReal = fs.existsSync(CACHE);
if (hadReal) fs.renameSync(CACHE, BACKUP);

const ymd = offsetDays => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

/* 실제 응답에서 본 필드만 쓴다 */
const rec = (o) => ({
  recrutPblntSn: o.id, instNm: o.inst, recrutPbancTtl: o.title,
  pbancBgngYmd: ymd(-10), pbancEndYmd: o.end,
  srcUrl: 'https://example.go.kr/notice', recrutSeNm: o.se ?? '신입',
  acbgCondNmLst: '학력무관', workRgnNmLst: '대전', hireTypeNmLst: '정규직',
  ncsCdNmLst: '보건.의료', aplyQlfcCn: '결격사유 없는 자', prefCn: '장애인 우대',
});

fs.writeFileSync(CACHE, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  count: 5,
  items: [
    rec({ id: 1, inst: '한국보훈복지의료공단', title: '전문의 공개채용', end: ymd(7) }),
    rec({ id: 2, inst: '한국보훈복지의료공단', title: '행정직 채용',    end: ymd(2) }),
    rec({ id: 3, inst: '한국보훈복지의료공단', title: '경력직 채용',    end: ymd(5), se: '경력' }),
    rec({ id: 4, inst: '(주)한국보훈복지의료공단', title: '법인격 표기 다름', end: ymd(3) }),
    rec({ id: 5, inst: '한국철도공사',        title: '마감된 공고',    end: ymd(-3) }),
  ],
}), 'utf8');

delete require.cache[require.resolve('../backend/src/alio-jobs.js')];
const ALIO = require('../backend/src/alio-jobs.js');

(async () => {
  console.log('── 1. 캐시가 곧 설정이다 ──');
  ok('캐시가 있으면 configured', ALIO.isConfigured() === true);

  console.log('\n── 2. 회사명으로 고른다 ──');
  const r = await ALIO.companyJobs('한국보훈복지의료공단');
  ok('그 기관 공고만 나온다', r.items.every(j => j.company.includes('한국보훈복지의료공단')));
  /* '(주)' 표기 차이로 같은 기관을 놓치면 안 된다 — company-name.js 와 규칙을 공유한다. */
  ok('법인격 표기가 달라도 같은 기관으로 본다', r.items.some(j => j.id === '4'),
     `→ ${r.items.map(j => j.id).join(',')}`);
  ok('다른 기관은 섞이지 않는다', !r.items.some(j => j.company.includes('철도')));

  console.log('\n── 3. 마감된 공고는 보여주지 않는다 ──');
  const rail = await ALIO.companyJobs('한국철도공사');
  ok('마감 공고는 목록에서 빠진다', rail.items.length === 0);
  /* 0건의 이유를 갈라 말해야 학생이 할 일을 안다. */
  ok('"있었지만 마감됐다"고 말한다', /마감/.test(rail.reason || ''), `→ ${rail.reason}`);
  ok('찾은 건수는 그대로 알려준다', rail.matched === 1);

  console.log('\n── 4. 없는 회사와 마감된 회사를 구분한다 ──');
  const priv = await ALIO.companyJobs('삼성전자');
  ok('민간 기업은 0건', priv.items.length === 0);
  /* 이 화면이 제일 조심해야 할 오해 — "삼성이 채용을 안 한다"로 읽히면 안 된다. */
  ok('민간이 없는 자료임을 밝힌다', /공공기관 공고만/.test(priv.reason || ''), `→ ${priv.reason}`);

  console.log('\n── 5. 신입 필터 ──');
  const all = await ALIO.companyJobs('한국보훈복지의료공단');
  const newbie = await ALIO.companyJobs('한국보훈복지의료공단', { newcomerOnly: true });
  ok('필터 없으면 경력 공고도 포함', all.items.some(j => j.career === '경력'));
  ok('필터를 켜면 경력 전용은 빠진다', !newbie.items.some(j => j.career === '경력'));
  /* 값이 비어 있는 것을 '경력직'으로 단정하면 실제 기회를 지운다. */
  ok('구분이 비어 있으면 거르지 않는다', ALIO.newcomerOk({ career: null }) === true);
  ok("'신입+경력'은 통과", ALIO.newcomerOk({ career: '신입+경력' }) === true);

  console.log('\n── 6. 마감 임박 순 ──');
  ok('D-day 오름차순', all.items.every((j, i) => i === 0 || all.items[i - 1].dday <= j.dday),
     `→ ${all.items.map(j => j.dday).join(',')}`);

  console.log('\n── 7. 다른 소스와 같은 모양 ──');
  /* 화면(company-cover.js)이 사람인·워크넷·잡알리오를 구분하지 않고 그린다.
     한 필드라도 이름이 다르면 그 칸만 조용히 빈다. */
  const j = all.items[0];
  for (const k of ['id', 'title', 'company', 'url', 'closeDate', 'dday', 'career', 'edu', 'region', 'jobType']) {
    ok(`공통 필드 ${k}`, k in j);
  }
  ok('source 를 밝힌다', all.source === 'alio');
  /* 자소서 코치가 쓸 재료 — 공고 본문을 복사하지 않아도 역량을 뽑을 수 있다. */
  ok('지원자격·우대사항도 실어 보낸다', Boolean(j.qualification && j.preference));

  console.log('\n── 8. 캐시가 없을 때 ──');
  fs.unlinkSync(CACHE);
  delete require.cache[require.resolve('../backend/src/alio-jobs.js')];
  const FRESH = require('../backend/src/alio-jobs.js');
  const none = await FRESH.companyJobs('한국보훈복지의료공단');
  ok('죽지 않는다', Array.isArray(none.items) && none.items.length === 0);
  ok('configured=false', none.configured === false);
  ok('무엇을 하면 되는지 알려준다', /fetch-alio-jobs/.test(none.reason || ''), `→ ${none.reason}`);

  // 정리 — 진짜 캐시를 되돌린다
  try { if (fs.existsSync(CACHE)) fs.unlinkSync(CACHE); } catch {}
  if (hadReal) fs.renameSync(BACKUP, CACHE);

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
