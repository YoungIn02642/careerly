/* ══════════════════════════════════════════════════════════════
   회사 뉴스 — 자소서 '지원동기' 문항의 소재

   ── 왜 만들었나 ──
   자소서에서 학생이 가장 못 쓰는 문항이 "왜 우리 회사인가"다. 역량 사전
   (jd-competency.js)으로는 채울 수 없다 — 회사마다 답이 다르기 때문이다.
   그 빈칸을 "이 회사가 지금 무엇을 하고 있는지"로 채운다.

   ── AI 를 쓰지 않는다 ──
   기사를 요약시키지 않는다. 로컬 8B 는 요약에서 없는 사실을 지어내고(할루시네이션),
   자소서에 지어낸 사실을 쓰면 면접에서 그대로 무너진다. 그래서 **실제 기사 제목과
   링크를 그대로** 보여주고, 학생이 원문을 읽고 직접 판단하게 한다.
   "이렇게 쓰라"는 작성 지침만 코드가 조립한다(자소서 코치와 같은 원칙).

   ── 프로바이더 ──
   · ncp   : NCP NAVER API Hub 검색 (헤더 X-NCP-APIGW-API-KEY-ID)
   · naver : 개발자센터 검색 API   (헤더 X-Naver-Client-Id)
             ↑ 응답 형식이 같아 키 하나로 양쪽을 시도하고 통한 쪽을 기억한다
   · web   : 키 없이 동작하는 폴백. casAnalyze 가 이미 쓰던 방식과 같은 경로다.
             정확도는 낮지만 **키 발급 전에도 기능이 죽지 않는다**.
   env: NEWS_PROVIDER(ncp|naver|web) · NAVER_CLIENT_ID · NAVER_CLIENT_SECRET
   ══════════════════════════════════════════════════════════════ */
const TIMEOUT_MS = Number(process.env.NEWS_TIMEOUT_MS || 8000);
const MAX_ITEMS  = 5;

const NAVER_ID     = (process.env.NAVER_CLIENT_ID || '').trim();
const NAVER_SECRET = (process.env.NAVER_CLIENT_SECRET || '').trim();

/* ── 네이버 뉴스 검색은 발급처가 둘이고, 응답 형식은 같다 ───────
   콘솔에 적힌 헤더 이름으로 어느 쪽인지 알 수 있다.
     · NCP NAVER API Hub : X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY
                           GET https://naverapihub.apigw.ntruss.com/search/v1/news
     · 개발자센터         : X-Naver-Client-Id / X-Naver-Client-Secret
                           GET https://openapi.naver.com/v1/search/news.json
   응답 스키마(items[].title/originallink/description/pubDate)는 동일해서 파싱은 하나면 된다.
   그래서 **키 하나로 양쪽을 차례로 시도**하고, 통한 쪽을 기억한다(모델 자동 선택과 같은 방식).
   사용자가 어느 콘솔에서 발급받았는지 몰라도 그냥 동작하는 게 목적이다. */
/* sort 는 sim(관련도)을 쓴다. date(최신순)로 하면 회사가 스치듯 언급된 기사가 앞에 온다 —
   실측으로 '현대오토에버' 검색 1위가 LG이노텍 MSCI 편입 기사였다. 지원동기 소재로는
   '이 회사를 다룬 기사'가 필요하지 '이 회사를 언급한 최신 기사'가 아니다. */
const ENDPOINTS = [
  {
    id: 'ncp',
    url: 'https://naverapihub.apigw.ntruss.com/search/v1/news',
    label: 'NCP NAVER API Hub',
    headers: (id, secret) => ({ 'X-NCP-APIGW-API-KEY-ID': id, 'X-NCP-APIGW-API-KEY': secret }),
    params: q => ({ query: q, display: String(MAX_ITEMS * 3), sort: 'sim', format: 'json' }),
  },
  {
    id: 'naver',
    url: 'https://openapi.naver.com/v1/search/news.json',
    label: '네이버 개발자센터 검색 API',
    headers: (id, secret) => ({ 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }),
    params: q => ({ query: q, display: String(MAX_ITEMS * 3), sort: 'sim' }),
  },
];

let _resolvedEndpoint = null;      // 한 번 통한 쪽을 기억해 매번 두 번 부르지 않는다

/* 키가 있으면 네이버 계열, 없으면 웹 폴백. 명시적으로 고를 수도 있다. */
function provider() {
  const forced = (process.env.NEWS_PROVIDER || '').toLowerCase();
  if (['ncp', 'naver', 'web'].includes(forced)) return forced;
  if (!NAVER_ID || !NAVER_SECRET) return 'web';
  return _resolvedEndpoint || 'naver-auto';   // 아직 어느 쪽인지 모름 → 시도해서 정한다
}

/* 실체참조를 풀어준다. &#x27; 를 안 풀면 'x27' 이 자소서 키워드로 튀어나온다(실측).
   stripTags 뿐 아니라 tokenize 에서도 한 번 더 부른다 — 키워드 추출은 어떤 경로로
   불려도 이런 찌꺼기를 내보내면 안 되기 때문이다. */
const decodeEntities = s => String(s || '')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

const stripTags = s => decodeEntities(String(s || '').replace(/<[^>]+>/g, ''))
  .replace(/\s+/g, ' ')
  .trim();

/* 웹 폴백은 제목 끝에 표시용 주소를 붙여 보낸다
   ("보도자료 | 현대오토에버 www.hyundai-autoever.com/kor…").
   그대로 두면 www·com·view 같은 조각이 '이 회사의 화두'로 집계돼 키워드를 통째로 망친다.
   → 주소를 문장에서 걷어낸 뒤에 키워드를 센다. */
const stripUrls = s => String(s || '')
  .replace(/https?:\/\/\S+/g, ' ')
  .replace(/\b[\w-]+(\.[\w-]+)+(\/\S*)?/g, ' ')      // 맨몸 도메인 + 경로
  .replace(/\s+/g, ' ')
  .trim();

/* ── 네이버 뉴스 검색 (NCP / 개발자센터 공통) ───────────────── */
async function callEndpoint(ep, company) {
  const res = await fetch(`${ep.url}?${new URLSearchParams(ep.params(company))}`, {
    headers: ep.headers(NAVER_ID, NAVER_SECRET),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`${ep.label} 오류 ${res.status}: ${body.slice(0, 150)}`);
    err.status = res.status;
    err.authFailed = res.status === 401 || res.status === 403;
    throw err;
  }
  const data = JSON.parse(body);
  return (data.items || []).map(it => ({
    title: stripTags(it.title),
    summary: stripTags(it.description),
    url: it.originallink || it.link,
    date: it.pubDate ? new Date(it.pubDate).toISOString().slice(0, 10) : null,
  }));
}

async function fromNaver(company, mode) {
  /* 어느 콘솔의 키인지 이미 알면 그것만, 모르면 둘 다 시도한다.
     인증 실패(401/403)일 때만 다음 후보로 넘어간다 — 쿼터 초과나 네트워크 오류에
     엉뚱한 엔드포인트를 또 때리지 않기 위해서다. */
  /* NEWS_PROVIDER 로 한쪽을 지정했더라도, 인증이 막히면 나머지도 시도한다.
     지정값이 실제 키와 안 맞는 일이 실제로 있었다(.env 에 naver 를 적어두고 NCP 키를
     넣은 경우). 설정을 존중하되 그것 때문에 기능이 죽지는 않게 하고, 대신 경고를 남긴다. */
  const preferred = (mode === 'ncp' || mode === 'naver')
    ? ENDPOINTS.filter(e => e.id === mode)
    : [];
  const candidates = [...preferred, ...ENDPOINTS.filter(e => !preferred.includes(e))];

  let lastErr = null;
  for (const ep of candidates) {
    if (preferred.length && ep.id !== mode && !lastErr?.authFailed) break;
    try {
      const items = await callEndpoint(ep, company);
      if (_resolvedEndpoint !== ep.id) {
        console.log(`[news] ${ep.label} 로 뉴스를 가져옵니다.`);
        if (preferred.length && ep.id !== mode) {
          console.warn(`[news] .env 의 NEWS_PROVIDER=${mode} 는 이 키와 맞지 않습니다. `
            + `NEWS_PROVIDER=${ep.id} 로 바꾸거나 줄을 지우세요(자동 판별).`);
        }
        _resolvedEndpoint = ep.id;
      }
      return items;
    } catch (e) {
      lastErr = e;
      if (!e.authFailed) break;          // 인증 문제가 아니면 다른 발급처를 시도해도 소용없다
    }
  }

  const err = new Error(lastErr?.authFailed
    ? '네이버 뉴스 검색 인증에 실패했습니다. Client ID 와 Secret 을 같은 콘솔 화면에서 함께 복사했는지 확인해 주세요. '
      + '(NCP NAVER API Hub · 개발자센터 검색 API 양쪽 모두 시도했습니다)'
    : (lastErr?.message || '네이버 뉴스 검색에 실패했습니다.'));
  err.status = lastErr?.authFailed ? 503 : 502;
  throw err;
}

/* ── 키 없는 폴백 ───────────────────────────────────────────
   DuckDuckGo HTML 결과를 긁는다. casAnalyze.js 가 활동 기간 추정에 쓰는 것과 같은
   경로다. 링크가 리다이렉트(/l/?uddg=…)로 감싸여 오므로 풀어서 원문 주소를 준다. */
async function fromWeb(company) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(`${company} 뉴스`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; careerly/1.0)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`웹 검색 실패 (${res.status})`);
    err.status = 502;
    throw err;
  }
  const html = await res.text();

  const blocks = [...html.matchAll(
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,1200}?)(?=<a[^>]*class="result__a"|$)/g
  )];

  return blocks.map(b => {
    let link = b[1];
    const uddg = link.match(/[?&]uddg=([^&]+)/);
    if (uddg) { try { link = decodeURIComponent(uddg[1]); } catch { /* 원본 유지 */ } }
    const snippet = (b[3].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '';
    return {
      title: stripUrls(stripTags(b[2])),
      summary: stripUrls(stripTags(snippet)),
      url: link,
      date: null,
    };
  });
}

/* 같은 기사가 언론사별로 여러 번 걸린다. 제목이 거의 같으면 한 건으로 본다. */
function dedupe(items) {
  const seen = new Set();
  return items.filter(it => {
    const k = it.title.replace(/[\s\[\]()·…"']/g, '').slice(0, 25);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* 회사명이 제목·요약 어디에도 없으면 다른 회사 기사다. 지원동기 근거로 쓰면
   면접에서 그대로 들통나므로 걸러낸다. */
function relevant(items, company) {
  const key = company.replace(/\s+/g, '');
  return items.filter(it => (it.title + it.summary).replace(/\s+/g, '').includes(key));
}

/* ── 기사에서 자소서에 쓸 키워드 뽑기 ───────────────────────
   AI 로 뽑지 않는다. 8B 에게 키워드를 시키면 기사에 없는 말을 만들어내는데,
   자소서에 지어낸 표현을 쓰면 면접에서 그대로 무너진다. 그래서 **기사 원문에 실제로
   있는 단어만** 세고, 각 키워드가 몇 번째 기사에서 나왔는지 추적 가능하게 남긴다
   (공고 근거 문장을 그대로 인용하는 것과 같은 원칙).

   형태소 분석기를 붙이지 않고 어절 단위로 센다. 대신 조사를 떼고, 뉴스 관용어와
   너무 흔한 말을 걸러낸다. 정밀하진 않지만 **틀린 걸 지어내지는 않는다**. */
const NEWS_STOP = new Set([
  '기자', '뉴스', '속보', '단독', '종합', '사진', '영상', '오늘', '내일', '올해', '작년',
  '이번', '지난', '관련', '위해', '대한', '통해', '따라', '밝혔다', '전했다', '말했다',
  '예정', '계획', '추진', '발표', '진행', '개최', '실시', '경우', '가운데', '대해',
  '기업', '회사', '그룹', '주식회사', '대표', '사장', '회장', '직원', '고객', '시장',
  '사업', '서비스', '제품', '기술', '투자', '매출', '실적', '전년', '동기', '억원', '조원',
  /* 웹 폴백에서 주소·페이지 이름이 새어 들어온다. AI·ESG·IT 같은 값어치 있는 약어는
     남겨야 하므로 영문을 통째로 버리지 않고 이 목록으로만 걸러낸다. */
  'www', 'http', 'https', 'com', 'net', 'org', 'kr', 'view', 'list', 'index', 'html',
  'about', 'home', 'page', 'detail', 'board', 'news', 'search', 'stock', 'code',
  '보도자료', '목표가', '기존', '위한', '전개', '기준', '이상', '이하', '최근', '현재',
]);

/* 조사를 떼어낸다. 3글자 이상일 때만 — "우리" 같은 짧은 말이 "우"가 되는 걸 막는다. */
const JOSA = /(으로써|으로서|이라고|라고|에서의|에게서|으로|에서|에게|와의|과의|보다|처럼|까지|부터|마다|이나|이란|라는|이며|하며|하고|한다|했다|의|를|을|는|은|이|가|와|과|도|만|에|로)$/;

function tokenize(text) {
  return decodeEntities(String(text))
    .split(/[^가-힣A-Za-z0-9]+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => (t.length >= 3 && /[가-힣]$/.test(t) ? t.replace(JOSA, '') : t))
    .filter(t => t.length >= 2)
    /* 숫자로 시작하는 말(77만원·2분기·21일)은 그 기사의 수치일 뿐 회사의 화두가 아니다. */
    .filter(t => !/^\d/.test(t))
    /* '낮췄다·밝혔다·있다' 같은 서술어. 명사가 '다'로 끝나는 경우는 드물어 이 정도로 충분하다. */
    .filter(t => !/다$/.test(t));
}

function newsKeywords(items, company) {
  const companyKey = company.replace(/\s+/g, '');

  /* 기사 주소(호스트)에 등장하는 말은 그 회사·언론사 이름이다.
     한글 회사명만 걸러내면 'Aju'·'autoever' 같은 영문 사명이 키워드로 남는다(실측). */
  const hostWords = new Set();
  for (const it of items) {
    const host = (String(it.url || '').match(/^https?:\/\/([^/]+)/) || [])[1] || '';
    for (const w of host.split(/[^A-Za-z0-9]+/)) {
      if (w.length >= 2) hostWords.add(w.toLowerCase());
    }
  }

  const hits = new Map();                   // term → Set(기사 index)

  items.forEach((it, i) => {
    const seen = new Set();                 // 한 기사에서 여러 번 나와도 1건
    for (const raw of tokenize(stripUrls(`${it.title} ${it.summary}`))) {
      const t = raw.trim();
      if (t.length < 2 || seen.has(t)) continue;
      if (NEWS_STOP.has(t)) continue;
      if (companyKey.includes(t) || t.includes(companyKey)) continue;   // 회사명 자체는 키워드가 아니다
      if (hostWords.has(t.toLowerCase())) continue;                     // 사이트·사명 영문 표기
      seen.add(t);
      if (!hits.has(t)) hits.set(t, new Set());
      hits.get(t).add(i);
    }
  });

  return [...hits.entries()]
    /* 기사 2건 이상에서 나온 말만 남긴다. 한 기사에만 나온 단어는 그 회사의
       '요즘 화두'라고 보기 어렵고, 대부분 그냥 그 기사의 문장 부스러기다. */
    .filter(([, arts]) => arts.size >= 2)
    .map(([term, arts]) => ({ term, count: arts.size, articles: [...arts] }))
    .sort((a, b) => b.count - a.count || b.term.length - a.term.length)
    .slice(0, 12);
}

async function companyNews(companyName) {
  const company = String(companyName || '').trim();
  if (company.length < 2) {
    const err = new Error('회사명을 2글자 이상 입력해 주세요.');
    err.status = 400;
    throw err;
  }

  const p = provider();
  let used = p;
  let raw = p === 'web' ? await fromWeb(company) : await fromNaver(company, p);
  let items = dedupe(relevant(raw, company)).slice(0, MAX_ITEMS);

  /* 네이버가 회사와 무관한 기사만 준 경우 웹 검색으로 한 번 더 시도한다.
     실측: '아주산업' 처럼 기사가 적은 회사는 네이버가 검색어를 '아주'+'산업' 으로 쪼개
     우리銀·산업부 기사를 돌려준다(total 39만 건). relevant() 가 전부 걸러내 0건이 되는데,
     같은 회사를 웹에서 찾으면 '특수콘크리트 기술협력' 같은 진짜 기사가 나온다.
     중견·중소기업 지원자에게는 이 경로가 사실상 유일한 소재원이라 그냥 비워두지 않는다. */
  if (p !== 'web' && !items.length) {
    try {
      const webRaw = await fromWeb(company);
      const webItems = dedupe(relevant(webRaw, company)).slice(0, MAX_ITEMS);
      if (webItems.length) { items = webItems; used = 'web-fallback'; }
    } catch { /* 폴백까지 실패하면 그냥 0건으로 둔다 — 화면에 안내가 나간다 */ }
  }

  const keywords = newsKeywords(items, company);
  /* 실제로 어느 경로로 가져왔는지 — 시도 끝에 정해지므로 호출 뒤에 읽는다. */
  const finalProvider = used === 'web-fallback' ? 'web-fallback'
    : (used === 'web' ? 'web' : (_resolvedEndpoint || used));

  return {
    company,
    provider: finalProvider,
    items,
    keywords,
    /* 키워드를 왜 쓰라는지까지 말해줘야 한다. 단어만 던지면 학생이 자소서에
       그냥 박아 넣고, 맥락 없는 단어는 오히려 감점이 된다. */
    keywordNote: keywords.length
      ? '기사 2건 이상에서 반복된 표현이에요. 이 회사가 요즘 무엇을 말하고 있는지를 보여줍니다. '
        + '단어만 옮겨 적지 말고, 그 표현이 나온 기사를 읽고 **내 경험과 연결되는 것 하나만** 골라 쓰세요.'
      : '',
    /* 화면에 그대로 띄우는 안내. 뉴스는 '읽고 판단할 재료'이지 '자소서 문장'이 아니다. */
    disclaimer: finalProvider === 'web'
      ? '네이버 뉴스 API 키가 없어 웹 검색 결과로 대신했어요. 날짜·언론사가 정확하지 않을 수 있으니 반드시 원문을 확인하세요.'
      : finalProvider === 'web-fallback'
        ? '네이버 뉴스에서는 이 회사 기사를 찾지 못해 웹 검색 결과로 대신했어요. '
          + '날짜가 없고 회사 홈페이지가 섞일 수 있으니 반드시 원문을 확인하세요.'
        : '기사 내용을 요약하거나 각색하지 않았습니다. 반드시 원문을 읽고 사실을 확인한 뒤 쓰세요.',
  };
}

/* ── 지원동기 작성 지침 ─────────────────────────────────────
   기사마다 다른 조언을 AI 로 만들지 않는다. 지원동기 문항의 구조는 회사가 달라도
   같기 때문에, 검증된 골격을 그대로 준다(jd-competency.js 의 frame 과 같은 방식). */
const MOTIVE_GUIDE = {
  frame: '① 기사에서 확인한 이 회사의 최근 움직임(사업·기술·시장) 한 가지 → '
       + '② 그것이 왜 어려운 일인지 또는 무엇이 걸려 있는지 → '
       + '③ 내 경험 중 그 일과 맞닿는 지점 → '
       + '④ 입사 후 그 일의 어느 부분을 맡고 싶은지 → '
       + '⑤ 그렇게 판단한 근거(원문에서 읽은 사실)',
  tips: [
    '기사 한 건만 고르세요. 여러 건을 나열하면 "찾아봤다"는 인상만 남습니다.',
    '회사 홈페이지에 있는 이야기(연혁·비전)는 쓰지 마세요. 누구나 쓸 수 있어 변별력이 없습니다.',
    '기사에 없는 내용을 추측해서 덧붙이지 마세요. 면접에서 그대로 물어봅니다.',
  ],
  avoid: [
    '"성장하는 기업이라 지원했습니다" — 어느 회사에나 붙는 문장입니다.',
    '"비전에 깊이 공감했습니다" — 무엇에 어떻게 공감했는지가 없으면 빈 문장입니다.',
    '기사 제목을 그대로 옮겨 적고 "인상 깊었습니다"로 잇는 구성.',
  ],
  followup: '그 사업이 지금 겪고 있는 어려움은 뭐라고 생각하나요?',
};

module.exports = { companyNews, provider, newsKeywords, tokenize, MOTIVE_GUIDE, MAX_ITEMS };
