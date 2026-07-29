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

/* 한 번에 받아오는 기사 수. 주간 대표 기사를 뽑으려면 5주치가 표본에 들어와야 하고,
   같은 사건을 여러 언론사가 쓴 것도 세야 해서 넉넉히 받는다.
   네이버 검색 API 의 display 상한이 100 이라 그 값을 그대로 쓴다.
   (예전엔 15건만 받아서 이번 주 기사로 다 차면 지난주가 아예 안 보였다.) */
const FETCH_COUNT = 100;

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
    params: q => ({ query: q, display: String(FETCH_COUNT), sort: 'sim', format: 'json' }),
  },
  {
    id: 'naver',
    url: 'https://openapi.naver.com/v1/search/news.json',
    label: '네이버 개발자센터 검색 API',
    headers: (id, secret) => ({ 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }),
    params: q => ({ query: q, display: String(FETCH_COUNT), sort: 'sim' }),
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
    /* 네이버는 사유를 본문에 적어 준다(errorCode/errorMessage). 상태 코드만으론
       '키가 틀림'과 '권한 없음'이 구분되지 않는 경우가 있어 같이 남긴다. */
    err.detail = body.replace(/\s+/g, ' ').slice(0, 120);
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
  const tried = [];        // 어느 발급처가 어떤 응답을 줬는지 모아 둔다(진단용)
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
      tried.push(`${ep.label}: ${e.status || '연결실패'} ${e.detail || ''}`.trim());
      console.warn(`[news] ${ep.label} 실패 — ${e.message}`);
      if (!e.authFailed) break;          // 인증 문제가 아니면 다른 발급처를 시도해도 소용없다
    }
  }

  /* 양쪽 다 거절당했을 때 '인증 실패'만 알려주면 다음에 뭘 고쳐야 할지 알 수 없다.
     실제로 배포에서 이 메시지만 보고 키를 세 번 갈아 끼웠다. 상태 코드가 사유를
     가른다 — 401 은 키가 틀린 것, 403 은 그 키에 검색 권한이 없는 것,
     404 는 주소가 맞지 않는 것이다. 응답 본문 앞부분까지 그대로 보여준다. */
  const err = new Error(lastErr?.authFailed
    ? '네이버 뉴스 검색 인증에 실패했습니다.\n' + tried.map(t => '  · ' + t).join('\n')
      + '\n  401=키가 틀림 · 403=그 키에 검색 권한 없음 · 404=주소 불일치'
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
const titleKey = t => String(t || '').replace(/[\s\[\]()·…"'’“”]/g, '').slice(0, 25);

function dedupe(items) {
  const seen = new Set();
  return items.filter(it => {
    const k = titleKey(it.title);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ── 같은 사건을 다룬 기사 묶기 ─────────────────────────────
   dedupe() 는 중복을 **버린다**. 그런데 여러 언론사가 같은 날 같은 사건을 쓴다는 것
   자체가 "이 회사에서 그 주에 가장 큰 일" 이라는 신호다. 그래서 버리는 대신 **센다**.

   ── 제목 앞부분 비교로는 안 묶인다 ──
   dedupe() 처럼 '앞 25자가 같으면 동일' 로 보면 언론사가 붙이는 말머리 때문에 갈라진다.
   실측: '삼성전자, HBM4 양산 시작' / '[단독] 삼성전자, HBM4 양산 시작한다' /
   '삼성전자 HBM4 양산 시작 — 종합' 이 전부 다른 묶음이 됐다. 말머리(단독·종합)와
   꼬리(한다)가 앞뒤로 붙어서 접두사가 어긋난다.

   그래서 **단어 집합이 얼마나 겹치는지**로 본다(자카드 0.6 이상이면 같은 사건).
   어순과 말머리에 흔들리지 않는다. 후보가 100건이라 전부 비교해도 부담이 없다.

   대표 기사는 묶음에서 제목이 가장 짧은 것을 쓴다. 긴 쪽은 대개 언론사가 덧붙인
   수식(부제·말머리)이 붙은 것이라 원 사건에서 멀어진다. */
const TITLE_MARKERS = /\[[^\]]*\]|【[^】]*】|<[^>]*>|\((단독|종합|속보|영상|사진|인터뷰)\)|(단독|종합|속보)\s*[:·-]/g;

function titleTokens(title) {
  return new Set(
    String(title || '')
      .replace(TITLE_MARKERS, ' ')
      .replace(/[^0-9A-Za-z가-힣]+/g, ' ')
      .split(' ')
      .map(w => w.replace(JOSA, ''))          // 조사를 떼야 '삼성전자가' == '삼성전자'
      .filter(w => w.length >= 2)
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

const SAME_EVENT = 0.6;

function cluster(items) {
  const groups = [];
  for (const it of items) {
    const toks = titleTokens(it.title);
    if (!toks.size) continue;

    const hit = groups.find(g => jaccard(g.tokens, toks) >= SAME_EVENT);
    if (!hit) {
      groups.push({ tokens: toks, item: { ...it, count: 1 } });
      continue;
    }
    hit.item.count += 1;
    // 날짜가 비어 있는 항목(웹 폴백)에는 다른 기사에서 얻은 날짜를 채워 준다
    if (!hit.item.date && it.date) hit.item.date = it.date;
    /* 대표를 짧은 제목으로 바꿀 때 요약·링크도 같이 옮긴다.
       따로 두면 A 기사 제목에 B 기사 링크가 붙어 엉뚱한 기사로 이동한다. */
    if (it.title.length < hit.item.title.length) {
      hit.item.title = it.title;
      hit.item.url = it.url;
      hit.item.summary = it.summary;
    }
  }
  return groups.map(g => g.item);
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

/* ── 주간 대표 기사 ─────────────────────────────────────────
   최근 5주를 한 주씩 끊어, 주마다 기사 한 건씩 최대 5건을 고른다.

   왜 '많이 나온 기사' 인가 — 지원동기에 쓸 소재는 '최신 기사' 가 아니라 '그 회사에
   실제로 일어난 큰 일' 이다. 여러 언론사가 같이 다뤘다는 게 그 대리 지표다.
   한 주에 한 건으로 묶으면 큰 사건 하나에 기사가 몰려도 다른 주가 밀리지 않아서,
   한 달치 흐름(무엇을 하다가 무엇으로 옮겨갔는지)이 보인다.

   직무트렌드 가산 — 같은 주에 후보가 여럿이면 채용·조직·기술처럼 취업 준비와
   맞닿은 기사를 올린다. 회사 홍보성 기사(신제품 출시, 사회공헌)보다 자소서에
   쓸 거리가 많다. 단어를 지어내지 않고 제목·요약에 실제로 있는 말만 본다. */
const WEEKS = 5;
const DAY = 24 * 60 * 60 * 1000;

/* ── 5주치를 실제로 받아오는 방법 ───────────────────────────
   회사명만으로 검색하면 5주를 못 채운다. 실측(삼성전자): display=100 을 date 순으로
   start=701 까지 넘겨도 전부 **같은 날** 기사였다. 큰 회사는 하루 기사량이 수백 건이라
   최신순으로는 어제조차 닿지 않고, start 상한(1000)을 다 써도 마찬가지다.

   대신 **검색어를 좁힌다**. '삼성전자 조직 인사' 처럼 주제를 붙이면 모집단이 줄어
   같은 100건이 5주에 걸쳐 퍼진다. 실측으로 삼성전자 기준:
     '삼성전자'          → 0주차만          (7/26~7/28)
     '삼성전자 채용'      → 0·1·2주차        (7/13~7/28)
     '삼성전자 조직 인사'  → 0~4주차 전부     (6/28~7/27)
     '삼성전자 투자 신사업' → 0~4주차 전부     (3/19~7/28)

   주제를 아무거나 고르지 않고 **취업 준비와 맞닿은 것**으로 골랐다. 신제품 출시나
   사회공헌보다 채용·조직·투자 기사가 자소서에 쓸 거리가 많다. 즉 이 방식은
   5주를 채우는 수단이면서 '직무트렌드 기사 모으기' 그 자체다. */
const TREND_QUERIES = ['채용', '조직 인사', '투자 신사업', '실적'];

const TREND_TERMS = [
  '채용', '공채', '신입', '인재', '조직', '개편', '인사', '연봉', '복지', '근무',
  '직무', '역량', '교육', '연수', '인턴', '워라밸', '재택', '사옥', '문화',
  '투자', '인수', '합병', '진출', '신사업', '전략', '조직문화', '리더십',
  'AI', 'DX', '디지털전환', '전환', '연구개발', 'R&D', '특허', '수주', '계약',
];

function trendScore(item) {
  const text = `${item.title} ${item.summary || ''}`;
  return TREND_TERMS.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0);
}

/* 기사 날짜 → 몇 주 전인가(0 = 이번 주). 범위 밖이면 null. */
function weekIndex(dateStr, now) {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  const diff = now - t;
  if (diff < 0) return 0;                       // 발행일이 미래로 찍힌 기사 — 이번 주로 본다
  const w = Math.floor(diff / (7 * DAY));
  return w < WEEKS ? w : null;
}

/* 주별 대표 기사 목록. 날짜가 없는 항목(웹 폴백)은 주에 넣을 수 없으므로 제외한다.

   ── 제목에 회사가 있는 기사를 우선한다 ──
   relevant() 는 제목·요약 어디든 회사명이 있으면 통과시킨다. 목록으로 보여줄 때는
   그래도 괜찮았는데, 주간 대표로 한 건만 뽑으니 **스쳐 지나간 언급**이 헤드라인 자리를
   차지했다. 실측: '아주산업' 이번 주 대표가 "박춘원 전북은행장 무거운 발걸음 '왜'" 였다
   (본문에 회사명이 한 번 나온 남의 기사).
   제목에 회사명이 있으면 그 기사는 그 회사를 **다룬** 기사다. 그런 후보가 한 건이라도
   있으면 그 안에서만 고르고, 하나도 없을 때만 나머지로 내려간다. */
function weeklyPicks(clustered, now = Date.now(), company = '') {
  const key = String(company).replace(/\s+/g, '');
  const inTitle = it => !!key && String(it.title).replace(/\s+/g, '').includes(key);

  const buckets = new Map();
  for (const it of clustered) {
    const w = weekIndex(it.date, now);
    if (w == null) continue;
    if (!buckets.has(w)) buckets.set(w, []);
    buckets.get(w).push(it);
  }

  const picks = [];
  for (let w = 0; w < WEEKS; w++) {
    const all = buckets.get(w);
    if (!all || !all.length) continue;

    const titled = all.filter(inTitle);
    const cands = titled.length ? titled : all;

    /* 언론사 중복 수 → 직무트렌드 관련도 → 최신순.
       중복 수가 1로 같은 주가 많은데, 그때 트렌드 점수가 실제 순위를 가른다. */
    cands.sort((a, b) =>
      b.count - a.count ||
      trendScore(b) - trendScore(a) ||
      String(b.date).localeCompare(String(a.date))
    );
    const top = cands[0];
    picks.push({
      ...top,
      week: w,
      weekLabel: w === 0 ? '이번 주' : `${w}주 전`,
      outlets: top.count,          // 같은 사건을 다룬 기사 수 = 그 주의 화제성
      trendHit: TREND_TERMS.filter(t => `${top.title} ${top.summary || ''}`.includes(t)).slice(0, 4),
      alsoInWeek: all.length - 1,
      /* 제목에 회사가 없으면 '스쳐 지나간 언급'일 수 있다. 화면에서 조심하라고 알린다. */
      looseMatch: !inTitle(top),
    });
  }
  return picks;
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
  let pool = relevant(raw, company);
  let items = dedupe(pool).slice(0, MAX_ITEMS);

  /* 주간 정리를 만들려면 5주치 표본이 필요하다. 회사명 단독 검색으로는 안 되므로
     주제를 붙인 검색을 함께 돌려 표본을 넓힌다(TREND_QUERIES 주석 참고).
     이 검색들은 **표본을 넓히는 용도**라, 실패해도 위 items 는 그대로 간다. */
  if (p !== 'web') {
    const extra = await Promise.all(TREND_QUERIES.map(async topic => {
      try {
        return relevant(await fromNaver(`${company} ${topic}`, p), company);
      } catch {
        return [];                 // 한 주제가 실패해도 나머지로 계속한다
      }
    }));
    pool = pool.concat(...extra);
  }

  /* 네이버가 회사와 무관한 기사만 준 경우 웹 검색으로 한 번 더 시도한다.
     실측: '아주산업' 처럼 기사가 적은 회사는 네이버가 검색어를 '아주'+'산업' 으로 쪼개
     우리銀·산업부 기사를 돌려준다(total 39만 건). relevant() 가 전부 걸러내 0건이 되는데,
     같은 회사를 웹에서 찾으면 '특수콘크리트 기술협력' 같은 진짜 기사가 나온다.
     중견·중소기업 지원자에게는 이 경로가 사실상 유일한 소재원이라 그냥 비워두지 않는다. */
  if (p !== 'web' && !items.length) {
    try {
      const webRaw = await fromWeb(company);
      const webPool = relevant(webRaw, company);
      const webItems = dedupe(webPool).slice(0, MAX_ITEMS);
      if (webItems.length) { items = webItems; pool = webPool; used = 'web-fallback'; }
    } catch { /* 폴백까지 실패하면 그냥 0건으로 둔다 — 화면에 안내가 나간다 */ }
  }

  /* 주간 대표 기사 — 날짜가 있는 경로(네이버)에서만 만들어진다.
     웹 폴백은 날짜를 못 주므로 빈 배열이 되고, 화면은 기존 목록만 보여준다. */
  const weekly = weeklyPicks(cluster(pool), Date.now(), company);
  const keywords = newsKeywords(items, company);
  /* 실제로 어느 경로로 가져왔는지 — 시도 끝에 정해지므로 호출 뒤에 읽는다. */
  const finalProvider = used === 'web-fallback' ? 'web-fallback'
    : (used === 'web' ? 'web' : (_resolvedEndpoint || used));

  return {
    company,
    provider: finalProvider,
    items,
    weekly,
    weeklyNote: weekly.length
      ? '최근 5주를 한 주씩 끊어, 그 주에 여러 언론사가 함께 다룬 기사를 한 건씩 골랐어요. '
        + '기사가 몰린 주 = 그 회사에 큰 일이 있었던 주입니다. 흐름을 보고 **한 건만** 골라 쓰세요.'
      : (finalProvider.startsWith('web')
          ? '웹 검색 결과에는 발행일이 없어 주간 정리를 만들지 못했어요. 아래 목록에서 직접 골라 주세요.'
          : '최근 5주 안에 발행된 기사를 찾지 못했어요.'),
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

module.exports = {
  companyNews, provider, newsKeywords, tokenize, MOTIVE_GUIDE, MAX_ITEMS,
  // 테스트용 — 주간 묶기는 외부 호출 없이 검증할 수 있어야 한다
  cluster, weeklyPicks, weekIndex, trendScore, WEEKS,
};
