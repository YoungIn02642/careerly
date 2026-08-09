/* ════════════════════════════════════════════════════════════
   회사별 채용공고 (사람인 오픈API)

   ── 워크넷 대신 여기를 쓰는 이유 ──────────────────────────────
   워크넷(고용24)도 붙여 뒀지만 발급받은 키가 개인회원이라 목록 API 가 막혀 있고
   ("개인회원은 사용할 수 없는 OPEN-API입니다"), 열리더라도 중소·중견 공고가 대부분이라
   대기업 공채는 거의 안 잡힌다. 자소서 코치가 필요한 건 **지원자가 실제로 쓰는 공고**라
   사람인을 주 경로로 둔다. 워크넷은 키 권한이 열리면 보조로 살아난다.

   ── 회사명 대조는 여기서도 우리가 한다 ──────────────────────
   사람인 keywords 는 회사명·공고제목·직무내용을 **전부** 뒤진다. 그래서 '토스' 로
   찾으면 "토스 연동 개발자를 뽑는 다른 회사" 공고가 섞인다. 받아온 뒤 회사명이
   실제로 같은 것만 남긴다 — 남의 회사 공고를 자기 지원 회사 것으로 알고 붙여넣는
   사고를 막는 유일한 방어선이다(worknet-jobs.js 와 같은 규칙을 공유한다).

   env: SARAMIN_ACCESS_KEY (https://oapi.saramin.co.kr/join 에서 신청·승인 후 발급)
   ════════════════════════════════════════════════════════════ */
const { sameCompany, dday } = require('./company-name');

const KEY = (process.env.SARAMIN_ACCESS_KEY || '').trim();
const API = 'https://oapi.saramin.co.kr/job-search';
const TIMEOUT_MS = Number(process.env.SARAMIN_TIMEOUT_MS || 7000);

const isConfigured = () => Boolean(KEY);

const MAX_ITEMS = 8;
/* 회사명 대조로 상당수가 떨어져 나가므로 넉넉히 받아 온다.
   count 상한은 110 이고, 하루 호출 수에 제한이 있어 한 번에 크게 받는 편이 낫다. */
const FETCH_COUNT = 100;

/* 사람인 응답은 값이 { name: '...' } 로 감싸여 오는 자리가 많다. */
const val = v => (v && typeof v === 'object' ? v.name ?? v.code ?? null : v ?? null);

function normalizeJob(j) {
  const pos = j.position || {};
  return {
    id: String(j.id || ''),
    title: String(val(pos.title) || '').trim(),
    company: String(val(j.company?.detail) || '').trim(),
    url: j.url || null,
    closeDate: j['expiration-date'] || null,
    dday: dday(j['expiration-date']),
    career: val(pos['experience-level']),
    edu: val(pos['required-education-level']),
    region: val(pos.location),
    jobType: val(pos['job-type']),
  };
}

async function companyJobs(companyName) {
  const company = String(companyName || '').trim();
  if (company.length < 2) return { items: [], configured: isConfigured(), reason: null, source: 'saramin' };
  if (!isConfigured()) {
    return {
      items: [], configured: false, source: 'saramin',
      reason: 'SARAMIN_ACCESS_KEY 가 설정되지 않았습니다.',
    };
  }

  const qs = new URLSearchParams({
    'access-key': KEY,
    keywords: company,
    count: String(FETCH_COUNT),
    start: '0',
    fields: 'expiration-date',
  });

  let data;
  try {
    const res = await fetch(`${API}?${qs}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
    data = JSON.parse(body);
  } catch (e) {
    return { items: [], configured: true, source: 'saramin', reason: `사람인 조회에 실패했습니다 (${e.message}).` };
  }

  /* 오류는 200 으로 오면서 본문에 code 로 실린다(4 = 일일 호출 초과). */
  if (data?.error || data?.code) {
    const msg = data.error?.message || data.message || `사람인 오류 코드 ${data.code}`;
    return { items: [], configured: true, source: 'saramin', reason: String(msg) };
  }

  const raw = data?.jobs?.job;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const all = list.map(normalizeJob).filter(j => j.title && j.company);
  const mine = all.filter(j => sameCompany(j.company, company));

  return {
    items: mine.slice(0, MAX_ITEMS),
    matched: mine.length,
    scanned: all.length,
    configured: true,
    source: 'saramin',
    reason: null,
  };
}

module.exports = { companyJobs, isConfigured, normalizeJob, MAX_ITEMS };
