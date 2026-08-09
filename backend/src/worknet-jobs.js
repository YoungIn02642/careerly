/* ════════════════════════════════════════════════════════════
   회사별 채용공고 (워크넷 / 고용24 오픈API)

   ── 왜 이 파일이 따로 있나 ────────────────────────────────────
   scripts/fetch-worknet-jobs.js 는 **직무 트렌드 집계용**이다. NCS 중분류 키워드로
   수만 건을 긁어 '이 직군 공고 중 몇 %가 이 역량을 요구하는가'를 만든다(하루 한 번,
   결과는 파일). 여기는 반대다 — **회사 하나의 지금 열린 공고**를 그때그때 물어본다.
   주기도, 질의도, 실패했을 때 할 일도 달라서 한 파일에 넣으면 둘 다 망가진다.

   ── 회사명 검색의 한계 ────────────────────────────────────────
   워크넷 API 에는 '회사명으로 찾기' 파라미터가 없다. keyword 로 넘기면 제목·직무에서도
   찾으므로 엉뚱한 공고가 섞인다(실측: '토스' 로 검색하면 '토스트기 제조' 가 나온다).
   그래서 **받아온 뒤 회사명이 실제로 일치하는 것만 남긴다.** 이 걸러내기가 없으면
   학생이 남의 회사 공고를 자기 지원 회사 것으로 알고 붙여넣는다.

   ── 대기업 공채는 대개 여기 없다 ──────────────────────────────
   워크넷은 중소·중견 공고가 대부분이고 대기업 공채는 자사 사이트로만 올라오는 일이
   많다. 0건이 정상인 경우가 있어서, 화면에는 '없음'이 아니라 **왜 없을 수 있는지**를
   같이 내려보낸다(hint). 그래야 학생이 '이 회사는 채용을 안 하는구나' 로 오해하지 않는다.
   ════════════════════════════════════════════════════════════ */
const { sameCompany, dday, normalize } = require('./company-name');

const KEY = (process.env.WORK24_API_KEY || '').trim();
const API = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';
const TIMEOUT_MS = Number(process.env.WORK24_TIMEOUT_MS || 7000);

const isConfigured = () => Boolean(KEY);

/* 응답 파서는 수집 스크립트와 같은 방식이다 — 게이트웨이마다 항목 태그 이름이
   달라서(<wanted> / <dhsOpenEmpHireInfo> …) 이름을 박지 않고 구조로 찾는다. */
function detectItemTag(xml) {
  const counts = new Map();
  const re = /<([a-zA-Z_][\w]*)>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (!/<[a-zA-Z_]/.test(m[2])) continue;         // 자식이 없으면 값 필드다
    counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  let best = null;
  for (const [tag, n] of counts) {
    if (n > 1 && (!best || n > best.n)) best = { tag, n };
  }
  return best?.tag || null;
}

function parseItems(xml) {
  const tagName = detectItemTag(xml);
  if (!tagName) return [];
  const items = [];
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'g');
  let m;
  while ((m = re.exec(xml))) {
    const row = {};
    const fre = /<([a-zA-Z_][\w]*)>([\s\S]*?)<\/\1>/g;
    let f;
    while ((f = fre.exec(m[1]))) row[f[1]] = f[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    items.push(row);
  }
  return items;
}

const tag = (xml, name) =>
  xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? null;

/* 게이트웨이마다 필드 이름이 다르다. 후보를 훑어 값이 있는 것을 쓴다
   (명세 오타 주의: coNm 이 회사명이고 coClcdNm 은 기업구분명이다 — 작업정리 3-3). */
const F = {
  title:   ['title', 'wantedTitle', 'empWantedTitle', 'recrtTitle'],
  company: ['company', 'coNm', 'empBusiNm'],
  url:     ['wantedInfoUrl', 'empWantedHomepgDetail', 'wantedMobileInfoUrl', 'empWantedMobileUrl'],
  close:   ['closeDt', 'empWantedEndDt', 'wantedEndDt'],
  start:   ['regDt', 'empWantedStdt', 'wantedStdt'],
  career:  ['career', 'empWantedCareerNm'],
  edu:     ['minEdubg', 'empWantedEduNm'],
  salary:  ['sal', 'salTpNm', 'empWantedPayNm'],
  region:  ['region', 'empWantedRegionNm', 'workRegion'],
  id:      ['wantedAuthNo', 'empWantedNo'],
};
const pick = (row, fields) => fields.map(f => row[f]).find(v => v && String(v).trim()) || '';

/* 회사명 대조·마감일 계산은 사람인 경로와 규칙을 공유한다(company-name.js).
   두 곳에 같은 규칙을 두면 한쪽만 고쳐져 어긋난다. */
function matchesCompany(row, company) {
  return sameCompany(pick(row, F.company), company);
}

const MAX_ITEMS = 8;

async function companyJobs(companyName) {
  const company = String(companyName || '').trim();
  if (company.length < 2) return { items: [], configured: isConfigured(), reason: null };
  if (!isConfigured()) {
    return { items: [], configured: false, reason: 'WORK24_API_KEY 가 설정되지 않았습니다.' };
  }

  const qs = new URLSearchParams({
    authKey: KEY, callTp: 'L', returnType: 'XML',
    startPage: '1', display: '100', keyword: company,
  });

  let xml;
  try {
    const res = await fetch(`${API}?${qs}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    xml = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    return { items: [], configured: true, reason: `워크넷 조회에 실패했습니다 (${e.message}).` };
  }

  /* 권한·인증 실패는 <error>/<message> 로 온다. 문구를 그대로 올려야
     "개인회원은 사용할 수 없는 OPEN-API입니다" 같은 원인이 화면에 보인다. */
  const err = tag(xml, 'error') || tag(xml, 'message');
  if (err) return { items: [], configured: true, reason: err };

  const rows = parseItems(xml).filter(r => matchesCompany(r, company));

  const items = rows.slice(0, MAX_ITEMS).map(r => ({
    id: pick(r, F.id) || pick(r, F.title),
    title: pick(r, F.title),
    company: pick(r, F.company),
    url: pick(r, F.url) || null,
    closeDate: pick(r, F.close) || null,
    dday: dday(pick(r, F.close)),
    career: pick(r, F.career) || null,
    edu: pick(r, F.edu) || null,
    region: pick(r, F.region) || null,
  })).filter(it => it.title);

  return { items, configured: true, reason: null, matched: rows.length };
}

module.exports = { companyJobs, isConfigured, matchesCompany, dday, normalize, MAX_ITEMS };
