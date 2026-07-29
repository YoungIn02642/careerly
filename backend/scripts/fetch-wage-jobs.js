/* 임금직업정보(워크피디아) 직업 분류 + 임금 수집 → data/wage-jobs.json
   커리어 로드맵의 직업 분류 원천. NCS 분류를 대체한다.

   출처: 고용노동부·한국고용정보원 임금직업정보시스템 (https://www.wagework.go.kr)
         분류 체계는 **한국고용직업분류(KECO) 2018** — 대분류 10개 → 중분류 35개 → 직업.

   ── 왜 data.go.kr 이 아니라 이 사이트인가 ──
   찾아봤지만 쓸 수 있는 공개 API 가 없었다.
     · data.go.kr 15122500 '직업별 임금정보' → **10행짜리 1회성 CSV**. 쓸 수 없다.
     · data.go.kr 3071087 '워크넷 직업정보'  → API 유형이 LINK 라 고용24 로 넘어가는데,
       채용정보(210L01)는 기업회원 전용이라 careerly 키로는 응답을 못 본다
       (fetch-worknet-jobs.js 머리주석 참고).
   이 포털은 화면이 쓰는 JSON 엔드포인트를 인증 없이 열어 두고 있고, 분류·임금·전망이
   **한 응답에 같이** 온다. 그래서 그걸 그대로 받아 캐시한다.

   ── 엔드포인트 (실호출로 확인) ──
   POST /pt/b/a/retrievePrmClListData.do   (파라미터 없음)      → 1차분류 10개
   POST /pt/b/a/retrieveScdClListData.do   upprCdId=<1차코드>   → 2차분류
   POST /pt/b/a/retrieveCatgSrchListData.do occpClCd=<2차코드>  → 직업 목록(임금 포함)
        · currentPageNo · recordCountPerPage · orderType
        · X-Requested-With: XMLHttpRequest 헤더가 없으면 HTML 이 온다
   응답 공통 껍데기: { success, data:{ list, paginationInfo }, message }

   ── 직업 항목의 필드 ──
   konetOccpCd 직업코드 · konetOcnm 직업명 · dtyOtlnCn 하는 일
   avwgCnvAmt  평균임금(만원, 숫자)  · avwgAmtNm 표기용 문자열('3천만원')
   psctCdNm    일자리 전망('다소 증가'/'유지'/'감소' 등)

   ── 화면에서 매번 부르지 않는다 ──
   분류와 임금은 하루에 바뀌는 값이 아니고, 남의 정부 사이트를 사용자 클릭마다 때리는 건
   예의도 아니다. 이 스크립트로 한 번 받아 두고 서버는 캐시만 읽는다
   (ftc-large-groups·public-orgs 와 같은 방식).

     node scripts/fetch-wage-jobs.js
*/
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.wagework.go.kr';
const OUT  = path.join(__dirname, '..', 'data', 'wage-jobs.json');
const PAUSE_MS = 250;          // 연속 호출 간격 — 상대 서버를 몰아치지 않는다
const PER_PAGE = 100;

const HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'User-Agent': 'Mozilla/5.0 (compatible; careerly/1.0)',
  Referer: `${BASE}/pt/b/a/retrieveCtgrSrch.do`,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(pathname, params = {}) {
  const res = await fetch(BASE + pathname, {
    method: 'POST',
    headers: HEADERS,
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname} HTTP ${res.status}: ${text.slice(0, 120)}`);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML 이 왔다는 건 대개 세션·헤더 문제다. 조용히 0건으로 넘어가면
       "분류가 비었다"로 잘못 읽히므로 여기서 끊는다. */
    throw new Error(`${pathname} 응답이 JSON 이 아닙니다(HTML?). 엔드포인트나 헤더가 바뀌었을 수 있습니다.`);
  }
  if (!json.success) throw new Error(`${pathname} 실패: ${json.message || '알 수 없음'}`);
  return json.data || {};
}

/* 한 중분류의 직업을 전부 받는다. 페이지가 여러 장인 중분류가 있다. */
async function jobsOf(midCode) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const data = await post('/pt/b/a/retrieveCatgSrchListData.do', {
      occpClCd: midCode, currentPageNo: page, recordCountPerPage: PER_PAGE, orderType: '',
    });
    const list = data.list || [];
    out.push(...list);

    const total = data.paginationInfo?.totalPageCount ?? 1;
    if (page >= total || !list.length) break;
    await sleep(PAUSE_MS);
  }

  return out.map(j => ({
    code: j.konetOccpCd,
    name: j.konetOcnm,
    /* 임금은 두 형태를 다 들고 간다. 숫자(avgWage)는 정렬·비교에, 문자열은 표기에 쓴다.
       0 이나 null 은 '자료 없음'이라 그대로 null 로 남긴다 — 0원으로 보이면 안 된다. */
    avgWage: Number(j.avwgCnvAmt) > 0 ? Number(j.avwgCnvAmt) : null,
    avgWageLabel: j.avwgAmtNm || null,
    outlook: j.psctCdNm || null,
    summary: (j.dtyOtlnCn || '').trim() || null,
  }));
}

(async () => {
  console.log('임금직업정보 분류 수집 중…');

  const majors = (await post('/pt/b/a/retrievePrmClListData.do')).list || [];
  if (!majors.length) throw new Error('1차분류가 0건입니다 — 엔드포인트가 바뀌었을 수 있습니다.');
  console.log(`  1차분류 ${majors.length}개`);

  const tree = [];
  let jobCount = 0;

  for (const M of majors) {
    await sleep(PAUSE_MS);
    const mids = (await post('/pt/b/a/retrieveScdClListData.do', { upprCdId: M.occpClCd })).list || [];

    const middles = [];
    for (const S of mids) {
      await sleep(PAUSE_MS);
      const jobs = await jobsOf(S.occpClCd);
      jobCount += jobs.length;
      middles.push({ code: S.occpClCd, name: S.occpCfnm, jobs });
      process.stdout.write(`  ${M.occpCfnm} › ${S.occpCfnm} — ${jobs.length}개 직업\r`);
    }

    tree.push({ code: M.occpClCd, name: M.occpCfnm, middles });
    console.log(`  [${M.occpClCd}] ${M.occpCfnm} — 중분류 ${middles.length} · 직업 ${middles.reduce((n, m) => n + m.jobs.length, 0)}`.padEnd(70));
  }

  const out = {
    fetchedAt: new Date().toISOString(),
    source: '임금직업정보시스템(워크피디아) · 한국고용직업분류(KECO) 2018',
    sourceUrl: `${BASE}/pt/b/a/retrieveCtgrSrch.do`,
    wageUnit: '만원',
    counts: { majors: tree.length, middles: tree.reduce((n, m) => n + m.middles.length, 0), jobs: jobCount },
    majors: tree,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

  console.log(`\n저장 완료 → ${path.relative(process.cwd(), OUT)}`);
  console.log(`  대분류 ${out.counts.majors} · 중분류 ${out.counts.middles} · 직업 ${out.counts.jobs}`);
})().catch(e => {
  console.error('실패:', e.message);
  process.exit(1);
});
