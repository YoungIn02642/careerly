/* ════════════════════════════════════════════════════════════
   공공기관 채용공고 (잡알리오 · 공공데이터포털 15125273)

   ── 왜 이 소스가 들어왔나 ────────────────────────────────────
   사람인은 승인이 나지 않았고(심사), 워크넷 채용정보(고용24 210L01)는 **개인회원이
   호출할 수 없다**(10-7, 2026-08 재확인). 그래서 회사 리포트의 '채용공고' 칸이
   대부분 빈 채로 나갔다. 잡알리오는 공공데이터포털 **자동승인**이라 이미 가진
   `DATA_GO_KR_SERVICE_KEY` 로 열린다.

   ── 다른 두 소스와 다른 점: 미리 받아 둔다 ──────────────────
   사람인·워크넷은 회사명을 넣어 **그때그때 검색**한다. 잡알리오 목록 API 에는
   회사명 검색이 없거나 있어도 기관명 표기가 제각각이라, **하루 한 번 전량을 받아
   캐시**하고 대조는 우리가 한다(`fetch-alio-jobs.js`). 공공기관 공고는 전량이라야
   수천 건이라 이 방식이 감당된다. 다른 `fetch-*` 수집기와 같은 규약이다.

   ── 커버리지를 숨기지 않는다 ────────────────────────────────
   **공공기관 공고만 들어 있다.** 삼성전자를 넣으면 0건이 나오는데 그건 "삼성이
   채용을 안 한다"가 아니라 **이 자료에 민간이 없다**는 뜻이다. 그래서 0건일 때
   `reason` 에 그 사실을 적어 내려보낸다 — 화면이 그대로 보여준다.

   같은 이유로 **'채용 중' 배지를 회사 목록에 붙이지 않는다.** 공공기관에만 배지가
   뜨면 민간 기업이 "지금 안 뽑는다"로 읽힌다. 에러도 안 나는 오해라 6-3 부류다.
   ════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { sameCompany, dday } = require('./company-name');

const CACHE = path.join(__dirname, '..', 'data', 'alio-jobs.json');
const MAX_ITEMS = 8;

let _cache = null;
let _mtime = 0;

/* 파일이 바뀌면 다시 읽는다 — 수집 스크립트를 돌린 뒤 서버를 재시작하지 않아도
   새 공고가 보여야 한다(수집은 하루 한 번이고 서버는 계속 떠 있다). */
function load() {
  let stat;
  try { stat = fs.statSync(CACHE); } catch { return null; }
  if (_cache && stat.mtimeMs === _mtime) return _cache;
  try {
    _cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    _mtime = stat.mtimeMs;
    return _cache;
  } catch {
    return null;                       // 손상된 캐시는 없는 것으로 본다(서버를 죽이지 않는다)
  }
}

const isConfigured = () => Boolean(load());

/* 잡알리오 레코드 → 사람인·워크넷과 **같은 모양**. 화면(company-cover.js)이 세
   소스를 구분하지 않고 그리므로 여기서 모양을 맞춰야 한다.

   원본 필드는 실제 응답에서 확인한 것만 쓴다(추정해서 박지 않는다 — 3-1). */
function normalizeJob(r) {
  return {
    id: String(r.recrutPblntSn ?? ''),
    title: String(r.recrutPbancTtl || '').trim(),
    company: String(r.instNm || '').trim(),
    url: r.srcUrl || null,
    closeDate: r.pbancEndYmd || null,
    dday: dday(r.pbancEndYmd),
    career: r.recrutSeNm || null,          // '신입' · '경력' · '신입+경력'
    edu: r.acbgCondNmLst || null,          // '학력무관' 등
    region: r.workRgnNmLst || null,
    jobType: r.hireTypeNmLst || null,      // '정규직' · '비정규직' 등
    /* 아래 둘은 이 소스에만 있다. 자소서 코치가 공고 본문 없이도 역량을 뽑을 수
       있게 하는 재료다(학생이 복사·붙여넣기를 건너뛴다). 화면 공통 모양에는
       없는 값이라 쓰는 쪽에서만 꺼내 쓴다. */
    qualification: r.aplyQlfcCn || null,
    preference: r.prefCn || null,
    ncs: r.ncsCdNmLst || null,
  };
}

/* 아직 지원할 수 있는 공고만. 마감일이 지난 것을 섞으면 학생이 그걸 보고 준비한다. */
const isOpen = j => j.dday != null;

/* 신입이 지원할 수 있는가. 값이 '신입' · '신입+경력' 이면 통과, 비어 있으면
   **거르지 않는다** — 모르는 것을 '경력직'으로 단정하면 실제 기회를 지운다. */
function newcomerOk(j) {
  const s = String(j.career || '');
  if (!s) return true;
  return s.includes('신입');
}

/* 회사(기관) 하나의 공고. 사람인·워크넷과 시그니처가 같다 —
   companyAnalysis.js 의 fetchJobs() 가 셋을 같은 방식으로 부른다. */
async function companyJobs(companyName, { newcomerOnly = false } = {}) {
  const company = String(companyName || '').trim();
  const base = { items: [], source: 'alio', configured: isConfigured(), reason: null };
  if (company.length < 2) return base;

  const data = load();
  if (!data) {
    return { ...base, configured: false,
      reason: '공공기관 채용공고 캐시가 없습니다. backend 에서 node scripts/fetch-alio-jobs.js 를 실행하세요.' };
  }

  const all = (data.items || []).map(normalizeJob).filter(j => j.title && j.company);
  const mine = all.filter(j => sameCompany(j.company, company));
  const open = mine.filter(isOpen);
  const shown = (newcomerOnly ? open.filter(newcomerOk) : open)
    .sort((a, b) => a.dday - b.dday);                 // 마감 임박 순

  /* 0건의 이유를 갈라서 말한다. 셋 다 "0건" 이지만 학생이 할 일이 다르다.
       · 이 기관 공고가 아예 없다  → 민간이거나 지금 공고가 없다
       · 있었는데 전부 마감됐다    → 다음 공고를 기다리면 된다
       · 신입 조건으로 걸러졌다    → 필터를 풀면 보인다 */
  let reason = null;
  if (!shown.length) {
    if (!mine.length) {
      reason = `공공기관 채용정보(잡알리오)에 '${company}' 공고가 없습니다. `
             + '이 자료에는 공공기관 공고만 들어 있어, 민간 기업은 조회되지 않습니다.';
    } else if (!open.length) {
      reason = `'${company}' 공고 ${mine.length}건이 있지만 모두 접수가 마감됐습니다.`;
    } else {
      reason = `'${company}' 진행 중 공고 ${open.length}건이 있지만 신입 지원 가능 공고는 없습니다.`;
    }
  }

  return {
    ...base,
    items: shown.slice(0, MAX_ITEMS),
    matched: mine.length,
    open: open.length,
    scanned: all.length,
    fetchedAt: data.fetchedAt || null,
    reason,
  };
}

module.exports = {
  companyJobs, isConfigured, normalizeJob, isOpen, newcomerOk,
  MAX_ITEMS, CACHE_PATH: CACHE,
  _load: load,
};
