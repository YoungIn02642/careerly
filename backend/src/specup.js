/* ══════════════════════════════════════════════════════════════
   스펙업 — "무엇을 채울까" 에 **지금 실제로 신청할 수 있는 것**을 붙인다

   ── 이 모듈이 하지 않는 일 ──
   무엇이 부족한지는 여기서 정하지 않는다. 그건 선배 스펙 집계와 CAS GAP 이
   이미 하고 있고(프론트 mentoring.js `window.Gap`), 기준이 두 벌이 되면
   "CAS 는 3개라는데 스펙업은 5개" 처럼 갈린다. 여기는 **부족 목록을 받아
   일정·모집공고를 붙이는 일만** 한다.

   ── 두 갈래의 외부 데이터 ──
   | 무엇 | 소스 | 키 |
   |---|---|---|
   | 국가자격 시험일정 | data.go.kr 15074408 `B490007/qualExamSchd` | `DATA_GO_KR_SERVICE_KEY` (**해당 API 활용신청 필요**) |
   | 공모전·대외활동   | 온통청년 청년정책 `youthcenter.go.kr/go/ythip/getPlcy` | `YOUTH_API_KEY` (**별도 발급**) |

   둘 다 **없어도 서버는 뜨고 화면도 동작한다.** 없으면 그 칸만 "무엇을 하면
   열리는지" 를 적어 내려보낸다 — 다른 라우트가 키 없을 때 503 + 안내를 주는 것과
   같은 규약이다(ai-provider.js·news.js).

   ── 실호출로 확인하지 못한 것 (정직하게 적어 둔다) ──
   시험일정 API 는 이 계정 키가 **아직 활용신청 전**이라 실제 응답을 못 봤다
   (`SERVICE_KEY_IS_NOT_REGISTERED_ERROR`). 그래서 응답 필드 이름은 공공데이터포털
   명세서 기준이고, 명세서 오타 사고가 이 저장소에서만 두 번 있었다
   (공정위 `entrprsNm`·고용24 `coNm` — 작업정리 3-1·3-3).
   그래서 두 가지 장치를 뒀다.
     1) 파서가 필드 이름 후보를 여러 개 받는다(`pick`).
     2) `scripts/check-specup-api.js` 가 **원본 item 을 그대로 출력**한다.
        승인되면 그것부터 보고 이름을 확정할 것.
   ══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const QNET_PATH = path.join(__dirname, '..', 'data', 'qnet-certs.json');

const EXAM_API = 'https://apis.data.go.kr/B490007/qualExamSchd/getQualExamSchdList';
const EXAM_APPLY_URL = 'https://www.data.go.kr/data/15074408/openapi.do';

const YOUTH_API = 'https://www.youthcenter.go.kr/go/ythip/getPlcy';
const YOUTH_APPLY_URL = 'https://www.youthcenter.go.kr/myPage/openapi';

const TIMEOUT_MS = Number(process.env.SPECUP_TIMEOUT_MS || 8000);

/* 시험일정은 하루에 한 번이면 충분하다 — 원서접수 기간은 몇 주 단위라 분 단위로
   다시 부를 이유가 없고, 개발계정 트래픽이 1,000건/일 이다. */
const EXAM_TTL_MS  = Number(process.env.SPECUP_EXAM_TTL_MS  || 12 * 60 * 60 * 1000);
const YOUTH_TTL_MS = Number(process.env.SPECUP_YOUTH_TTL_MS || 60 * 60 * 1000);

const key = name => (process.env[name] || '').trim();

// ── 공통 ──────────────────────────────────────────────────────
async function getText(url, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

/* data.go.kr 게이트웨이는 인증 실패를 **HTTP 200 으로도** 내려보낸다. status 만
   보면 "성공했는데 데이터가 없다" 로 읽혀서, 활용신청을 안 한 것이 '표본 없음'
   으로 둔갑한다 — 이 저장소가 제일 경계하는 '조용히 틀리는 값' 이다.
   그래서 본문의 오류 코드까지 읽고 사용자가 **무엇을 하면 되는지**로 갈라 준다. */
function gatewayError(status, body) {
  const b = String(body || '').replace(/\s+/g, ' ');
  if (/SERVICE_KEY_IS_NOT_REGISTERED|등록되지 않은 서비스키|<returnReasonCode>30/.test(b)) {
    return { code: 503, reason: 'not-approved',
      error: '이 API 는 아직 활용신청이 안 돼 있어요.',
      how: `공공데이터포털에서 활용신청하면 바로 열립니다 — ${EXAM_APPLY_URL}` };
  }
  if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS|일일 트래픽|<returnReasonCode>22/.test(b)) {
    return { code: 429, reason: 'quota',
      error: '오늘 호출 한도를 다 썼어요. 내일 다시 시도하거나 운영계정으로 전환해 주세요.' };
  }
  if (/SERVICE_ACCESS_DENIED|<returnReasonCode>2[0-9]/.test(b)) {
    return { code: 503, reason: 'denied',
      error: '서비스 접근이 거부됐어요. 키와 활용신청 상태를 확인해 주세요.', how: EXAM_APPLY_URL };
  }
  if (status >= 400) {
    return { code: 502, reason: 'upstream', error: `시험일정 서버가 ${status} 를 돌려줬어요.` };
  }
  return null;
}

// ── XML → item 배열 (중첩 없는 평평한 목록. 다른 fetch-*.js 와 같은 방식) ──
function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
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

/* 명세서 이름이 틀릴 수 있으므로 후보를 차례로 본다(머리주석 참고). */
function pick(row, names) {
  for (const n of names) {
    if (row[n] != null && row[n] !== '') return row[n];
  }
  return null;
}

// ── 날짜 ──────────────────────────────────────────────────────
/* 'YYYYMMDD' 와 'YYYY-MM-DD' 둘 다 온다고 보고 하나로 맞춘다. 못 읽으면 null 을
   주고, 호출부는 그 회차를 **판정 대상에서 뺀다** — 0000-00-00 같은 값을 그대로
   비교하면 '접수중' 으로 잘못 뜬다. */
function ymd(v) {
  const s = String(v ?? '').replace(/[^0-9]/g, '');
  if (s.length !== 8) return null;
  const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

/* 회차 하나가 지금 어느 상태인가. 필기 기준이다 — 학생이 먼저 해야 하는 일이
   필기 원서접수이고, 실기는 필기에 붙은 뒤의 이야기다. */
function phaseOf(round, today = todayStr()) {
  const { regStart, regEnd, examStart, examEnd } = round;
  if (regStart && regEnd) {
    if (today < regStart) return 'upcoming';        // 접수 예정
    if (today <= regEnd)  return 'open';            // 접수중 ← 가장 중요한 상태
  }
  const last = examEnd || examStart || regEnd;
  if (last && today <= last) return 'exam';         // 접수는 끝났고 시험을 기다리는 중
  return 'closed';
}

const PHASE_ORDER = { open: 0, upcoming: 1, exam: 2, closed: 3 };

/* 며칠 남았나. 접수 마감 임박을 화면에서 강조하는 데 쓴다. */
function daysUntil(dateStr, today = todayStr()) {
  if (!dateStr) return null;
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

// ── 자격 종목 코드 ─────────────────────────────────────────────
/* 시험일정은 **종목코드(jmCd)** 단위로 온다. 학생이 입력한 자격증 이름
   ('정보처리기사')을 코드로 바꿔야 이어붙일 수 있다. 이 표는 이미 받아 둔
   data/qnet-certs.json (613종) 이 단일 출처다. */
let certIndex = null;
function certCodes() {
  if (certIndex) return certIndex;
  certIndex = new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(QNET_PATH, 'utf8'));
    (raw.certs || []).forEach(c => {
      if (c.code) certIndex.set(normName(c.id), { code: String(c.code), name: c.id, kind: c.kind });
    });
  } catch {
    console.warn('[specup] data/qnet-certs.json 이 없습니다. '
      + '`node scripts/fetch-qnet-certs.js` 로 받아주세요. (자격증 시험일정만 빠집니다)');
  }
  return certIndex;
}

/* 이름 대조는 공백·괄호를 무시한다. 학생은 '정보처리 기사' 로도 적고
   'CPA (공인회계사)' 처럼 설명을 붙이기도 한다. */
function normName(s) {
  return String(s ?? '').replace(/[\s()（）·・]/g, '').toLowerCase();
}

function codeOf(certName) {
  return certCodes().get(normName(certName)) || null;
}

// ── 국가자격 시험일정 ──────────────────────────────────────────
const examCache = new Map();   // year → { at, rounds }

/* 한 해치를 통째로 받아 종목코드로 묶어 둔다.
   종목마다 따로 부르면(부족 자격증이 6개면 6번) 개발계정 하루 1,000건이 금방 닳고,
   응답도 그만큼 느려진다. */
async function fetchYear(year) {
  const hit = examCache.get(year);
  if (hit && Date.now() - hit.at < EXAM_TTL_MS) return hit;

  const serviceKey = key('DATA_GO_KR_SERVICE_KEY');
  if (!serviceKey) {
    const e = new Error('DATA_GO_KR_SERVICE_KEY 가 없습니다.');
    e.payload = { code: 503, reason: 'no-key',
      error: '자격증 시험일정 키가 설정되지 않았어요.',
      how: `backend/.env 의 DATA_GO_KR_SERVICE_KEY 를 채우고 ${EXAM_APPLY_URL} 에서 활용신청하세요.` };
    throw e;
  }

  /* 페이징 — 한 해 전 종목의 회차라 1,000행을 넘는다. 상한을 두고 끊는다.
     끊긴 것을 조용히 숨기지 않고 truncated 로 알린다. */
  const PER = 500, MAX_PAGES = 8;
  const rows = [];
  let truncated = false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${EXAM_API}?serviceKey=${encodeURIComponent(serviceKey)}`
      + `&implYy=${encodeURIComponent(year)}&numOfRows=${PER}&pageNo=${page}&dataFormat=xml`;
    const { status, body } = await getText(url);

    const err = gatewayError(status, body);
    if (err) { const e = new Error(err.error); e.payload = err; throw e; }

    const items = parseItems(body);
    rows.push(...items);
    if (items.length < PER) break;
    if (page === MAX_PAGES) truncated = true;
  }

  const rounds = rows.map(toRound).filter(Boolean);
  const entry = { at: Date.now(), year, rounds, truncated };
  examCache.set(year, entry);
  return entry;
}

/* 응답 한 줄 → 회차 하나. 필드 이름은 명세서 기준이며 후보를 여러 개 둔다
   (머리주석 '실호출로 확인하지 못한 것'). */
function toRound(row) {
  const code = pick(row, ['jmCd', 'jmcd', 'jmfldCd']);
  const regStart  = ymd(pick(row, ['docRegStartDt', 'docRegStartdt', 'docRegStrtDt']));
  const regEnd    = ymd(pick(row, ['docRegEndDt', 'docRegEnddt']));
  const examStart = ymd(pick(row, ['docExamStartDt', 'docExamStartdt', 'docExamStrtDt']));
  const examEnd   = ymd(pick(row, ['docExamEndDt', 'docExamEnddt']));
  const passDt    = ymd(pick(row, ['docPassDt', 'docPassdt']));

  /* 날짜가 하나도 없는 줄은 버린다 — 화면에 '일정 미정' 카드를 만들어 봐야
     학생이 할 수 있는 일이 없다. */
  if (!regStart && !regEnd && !examStart) return null;

  return {
    code: code ? String(code) : null,
    name: pick(row, ['jmNm', 'jmfldnm', 'jmfldNm']),
    seq: pick(row, ['implSeq', 'implseq']),
    qualKind: pick(row, ['qualgbNm', 'qualgbnm']),
    label: pick(row, ['description', 'descrip', 'implYy']),
    regStart, regEnd, examStart, examEnd, passDt,
  };
}

/* 자격증 이름 목록 → 각 자격의 **가장 먼저 할 수 있는 회차**.
   접수중 > 접수예정 > 시험대기 순으로 하나만 고른다. 회차를 다 늘어놓으면
   화면이 표가 되고, 학생이 지금 눌러야 할 것이 무엇인지 흐려진다. */
async function certSchedules(certNames, { year, today = todayStr() } = {}) {
  const names = [...new Set((certNames || []).filter(Boolean))];
  if (!names.length) return { year: year || Number(today.slice(0, 4)), items: [], source: null };

  const yr = year || Number(today.slice(0, 4));
  const { rounds, truncated } = await fetchYear(yr);

  const byCode = new Map();
  rounds.forEach(r => {
    if (!r.code) return;
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code).push(r);
  });

  const items = names.map(name => {
    const meta = codeOf(name);
    if (!meta) {
      /* 민간·해외자격(SQLD·AWS·CFA…)은 국가자격 시험일정에 없다. 없는 것을
         '일정 없음' 으로 적으면 시험이 안 열리는 것처럼 읽히므로 이유를 밝힌다. */
      return { name, code: null, matched: false,
        note: '국가자격이 아니라 이 일정표에는 없어요. 시행기관 공지를 확인하세요.' };
    }
    const list = (byCode.get(meta.code) || [])
      .map(r => ({ ...r, phase: phaseOf(r, today) }))
      .filter(r => r.phase !== 'closed')
      .sort((a, b) => (PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase])
        || String(a.regStart || '').localeCompare(String(b.regStart || '')));

    const next = list[0] || null;
    return {
      name, code: meta.code, matched: true,
      round: next && {
        ...next,
        daysToRegEnd:   daysUntil(next.regEnd, today),
        daysToRegStart: daysUntil(next.regStart, today),
      },
      note: next ? null : `${yr}년 남은 회차가 없어요. 다음 해 일정이 열리면 표시됩니다.`,
    };
  });

  return { year: yr, items, truncated: Boolean(truncated), source: '한국산업인력공단 국가자격 시험일정(data.go.kr)' };
}

// ── 공모전 · 대외활동 ──────────────────────────────────────────
/* ── 왜 '청년정책' 을 쓰는가 ──
   공모전·대외활동만 모아 주는 전국 단위 공개 API 는 없다(조사 결과는
   docs/외부API-연동구조.md 에 남겼다 — 다시 조사하지 말 것). 씽굿·위비티·링커리어는
   API 를 열지 않고, data.go.kr 에는 '해외인턴 공모전' 처럼 범위가 좁은 것만 있다.

   대신 온통청년(한국고용정보원)의 청년정책 목록에는 **대학생이 지원할 수 있는
   공모전·서포터즈·해외탐방·교육과정**이 지자체·부처 단위로 올라온다. 정책 데이터라
   잡음이 섞이므로 키워드로 거른다. 거른 결과를 '공모전 전체' 라고 부르지 않고
   화면에도 출처를 그대로 적는다. */
const ACTIVITY_TOPICS = {
  contest: {
    label: '공모전·대회',
    keywords: ['공모전', '경진대회', '해커톤', '아이디어', '창업경진', '경연'],
  },
  activity: {
    label: '대외활동·서포터즈',
    keywords: ['서포터즈', '대외활동', '기자단', '홍보단', '봉사단', '탐방', '멘토링단'],
  },
};

const youthCache = new Map();   // `${topic}:${page}` → { at, data }

async function youthActivities({ topic = 'contest', page = 1, size = 30 } = {}) {
  const t = ACTIVITY_TOPICS[topic] ? topic : 'contest';
  const cacheKey = `${t}:${page}`;
  const hit = youthCache.get(cacheKey);
  if (hit && Date.now() - hit.at < YOUTH_TTL_MS) return hit.data;

  const apiKey = key('YOUTH_API_KEY');
  if (!apiKey) {
    const e = new Error('YOUTH_API_KEY 가 없습니다.');
    e.payload = { code: 503, reason: 'no-key',
      error: '공모전·대외활동 키가 설정되지 않았어요.',
      how: `온통청년에서 인증키를 발급받아 backend/.env 의 YOUTH_API_KEY 에 넣어주세요 — ${YOUTH_APPLY_URL}` };
    throw e;
  }

  /* 키워드를 하나씩 걸어 합친다. 이 API 는 OR 검색을 지원하지 않아서, 한 번에
     부르면 '공모전' 만 잡히고 '서포터즈' 가 통째로 빠진다. */
  const seen = new Map();
  for (const kw of ACTIVITY_TOPICS[t].keywords) {
    const url = `${YOUTH_API}?apiKeyNm=${encodeURIComponent(apiKey)}`
      + `&rtnType=json&pageNum=${page}&pageSize=${size}&plcyKywdNm=${encodeURIComponent(kw)}`;
    let parsed;
    try {
      const { status, body } = await getText(url);
      if (status === 403 || /invalid api key/i.test(body)) {
        const e = new Error('온통청년 인증키가 거부됐습니다.');
        e.payload = { code: 503, reason: 'bad-key',
          error: '온통청년 인증키가 거부됐어요.', how: YOUTH_APPLY_URL };
        throw e;
      }
      parsed = JSON.parse(body);
    } catch (err) {
      if (err.payload) throw err;
      continue;                       // 키워드 하나가 실패해도 나머지는 살린다
    }
    (parsed?.result?.youthPolicyList || []).forEach(p => {
      const row = toActivity(p, t);
      if (row && !seen.has(row.id)) seen.set(row.id, row);
    });
  }

  const items = [...seen.values()].sort((a, b) =>
    String(a.endDate || '9999').localeCompare(String(b.endDate || '9999')));
  const data = { topic: t, label: ACTIVITY_TOPICS[t].label, items,
    source: '온통청년 청년정책(한국고용정보원)' };
  youthCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

function toActivity(p, topic) {
  const id = p.plcyNo || p.bizId;
  if (!id) return null;
  const name = p.plcyNm || '';
  /* 키워드가 정책 설명 어딘가에만 걸린 것들이 섞인다. 제목이나 키워드에
     주제어가 들어간 것만 남긴다 — 지원금 정책이 '공모전' 칸에 있으면 안 된다. */
  const hay = `${name} ${p.plcyKywdNm || ''}`;
  if (!ACTIVITY_TOPICS[topic].keywords.some(k => hay.includes(k))) return null;

  const [start, end] = String(p.aplyYmd || '').split('~').map(s => ymd(s));
  return {
    id: String(id),
    name,
    org: p.sprvsnInstCdNm || p.operInstCdNm || '',
    summary: (p.plcyExplnCn || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    keywords: String(p.plcyKywdNm || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 4),
    startDate: start, endDate: end,
    period: p.aplyPrdSeCd === '0057001' ? '상시' : null,
    url: p.aplyUrlAddr || p.refUrlAddr1 || null,
  };
}

module.exports = {
  certSchedules, youthActivities,
  // 테스트·점검 스크립트가 쓰는 조각들
  phaseOf, daysUntil, ymd, toRound, toActivity, codeOf, parseItems, gatewayError,
  ACTIVITY_TOPICS, EXAM_API, EXAM_APPLY_URL, YOUTH_APPLY_URL,
};
