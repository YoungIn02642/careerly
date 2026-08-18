/* ════════════════════════════════════════════════════════════
   기업 규모 자동 분류 — 회사명 → 대기업 / 중견기업 / 중소기업 / 공공기관

   ── 설계 ──
   외부 API 를 매 요청마다 부르지 않는다. 공식 데이터(공정위 대규모기업집단,
   ALIO 공공기관 지정현황)를 배치 스크립트로 한 번 받아 data/*.json 으로
   캐싱해 두고, 조회는 메모리 맵에서 즉시 끝낸다.
   이 저장소가 NCS 분류를 다루는 방식(scripts/fetch-ncs-taxonomy.js →
   data/ncs-taxonomy.json)과 같은 패턴이다.

   조회 순서:
     1. 대규모기업집단 캐시    → 대기업
     2. 공공기관 캐시          → 공공기관
     3. 지방공공기관 캐시      → 공공기관
     4. 워크넷 기업구분 캐시   → 해당 구분
     5. 기본값                 → 중소기업

   회사명은 표기가 제각각이라(코스맥스(주) / 한국콜마 주식회사 / SK쉴더스)
   정확 매칭 전에 normalize() 로 표기 차이를 걷어낸다. 유사도 매칭은 쓰지
   않는다 — MVP 는 정규화 + 정확 매칭으로 시작한다.
   ════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const CORP_TYPE = {
  LARGE:  '대기업',
  MID:    '중견기업',
  SMALL:  '중소기업',
  PUBLIC: '공공기관',
};
const DEFAULT_TYPE = CORP_TYPE.SMALL;   // 스타트업·일반 중소기업이 압도적 다수

/* 라벨 → 스펙의 corpType 값. 프론트 드롭다운(Aggregator.CORP_TYPES)과 같은 id 를 쓴다.
   화면은 '공공기관' 을 '공기업' 으로 부르지만 저장 값은 'public' 로 같다. */
const CORP_TYPE_ID = {
  [CORP_TYPE.LARGE]:  'large',
  [CORP_TYPE.MID]:    'mid',
  [CORP_TYPE.SMALL]:  'small',
  [CORP_TYPE.PUBLIC]: 'public',
};

/* ── 정규화 ────────────────────────────────────────────────
   실제 alumni 216건에서 관찰된 표기 흔들림을 기준으로 만들었다:
     (주)/㈜ 17건 · 주식회사 3건 · 공백 46건 · 영문 51건 · 괄호 부연 32건

   순서가 중요하다. 법인격 표기를 먼저 없애야 그 다음의 괄호 제거가
   '(주)' 를 지운 자리와 엉키지 않는다. */
const LEGAL_TOKENS = [
  '주식회사', '유한회사', '유한책임회사', '합자회사', '합명회사',
  '재단법인', '사단법인', '학교법인', '의료법인', '사회복지법인',
];

function normalize(name) {
  if (!name || typeof name !== 'string') return '';
  let s = name;

  s = s.replace(/㈜|\(주\)|\(유\)|\(재\)|\(사\)|\(학\)|\(의\)/g, ' ');   // 법인격 기호
  LEGAL_TOKENS.forEach(t => { s = s.split(t).join(' '); });             // 법인격 단어
  s = s.replace(/\([^)]*\)/g, ' ');    // 남은 괄호 부연 — '네슬레 코리아 (네스프레소)'
  s = s.replace(/[·․‧・.,'"’”\-_/\\]/g, '');  // 구분기호
  s = s.replace(/\s+/g, '');           // 공백 전부 제거 — '한국 콜마' == '한국콜마'
  return s.toUpperCase();              // 영문 대소문자 차이 흡수 — 'agoda' == 'Agoda'
}

/* ── 캐시 ──────────────────────────────────────────────────
   배치 스크립트가 만든 JSON 을 읽어 { 정규화명 → 분류 } 맵으로 세운다.
   파일이 아직 없으면(=배치 미실행) 빈 맵으로 두고 서비스는 계속 돈다. */
let _cache = null;

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return null;   // 아직 안 받아왔거나 깨진 파일 — 분류는 기본값으로 흘러간다
  }
}

function buildCache() {
  const map = new Map();
  const sources = [];

  /* 공정위 대규모기업집단 소속회사 → 대기업 */
  const groups = loadJson('ftc-large-groups.json');
  if (groups?.companies?.length) {
    groups.companies.forEach(c => {
      const k = normalize(c.name);
      if (k) map.set(k, { type: CORP_TYPE.LARGE, source: `공정위:${c.group || ''}`, name: c.name });
    });
    sources.push(`공정위 ${groups.companies.length}건`);
  }

  /* 공공기관 지정현황 → 공공기관 (대기업 계열과 겹치면 공공기관이 우선)
     scripts/fetch-public-orgs.js 가 만든다. 출처는 ALIO 가 아니라 data.go.kr
     재정경제부 데이터셋 — 같은 고시 내용을 기존 서비스키 하나로 받을 수 있다. */
  const publics = loadJson('public-orgs.json');
  if (publics?.organizations?.length) {
    publics.organizations.forEach(o => {
      const k = normalize(o.name);
      if (k) map.set(k, { type: CORP_TYPE.PUBLIC, source: `공공기관:${o.raw || ''}`, name: o.name });
    });
    sources.push(`공공기관 ${publics.organizations.length}건`);
  }

  /* 지방공기업·지방출자출연기관 → 공공기관
     위 지정현황은 공공기관운영법 대상(=중앙정부 산하)만 담아서, 지방공기업법·
     지방출연기관법 대상인 지자체 산하 기관이 통째로 빠져 있다. 그래서
     서울교통공사·서울시설공단·용인문화재단 같은 곳이 기본값 중소기업으로
     떨어졌다. scripts/fetch-local-public-orgs.js 가 만든다. */
  const localPublics = loadJson('local-public-orgs.json');
  if (localPublics?.organizations?.length) {
    localPublics.organizations.forEach(o => {
      const k = normalize(o.name);
      if (k && !map.has(k)) map.set(k, { type: CORP_TYPE.PUBLIC, source: `${o.kind}:${o.raw || ''}`, name: o.name });
    });
    sources.push(`지방공공기관 ${localPublics.organizations.length}건`);
  }

  /* 고용24(워크넷) 기업구분 → 구분명 그대로.
     '중견기업' 라벨을 직접 주는 거의 유일한 공개 소스다. 중견기업은 법적으로
     '중소기업도 대기업도 아닌 기업' 이라 뺄셈으로만 정의돼 명단이 없다.
     공정위·공공기관 캐시가 이미 잡은 회사는 덮어쓰지 않는다(그쪽이 더 공식적). */
  const work24 = loadJson('work24-companies.json');
  if (work24?.companies?.length) {
    work24.companies.forEach(c => {
      const k = normalize(c.name);
      const t = mapWork24Type(c.typeName);
      if (k && t && !map.has(k)) map.set(k, { type: t, source: `고용24:${c.typeName}`, name: c.name });
    });
    sources.push(`고용24 ${work24.companies.length}건`);
  }

  _cache = { map, sources };
  return _cache;
}

function cache() { return _cache || buildCache(); }
function reloadCache() { _cache = null; return cache(); }

/* 고용24 기업구분명 → 우리 4분류.
   고용24 에는 '외국계기업' 같은 우리 분류에 없는 구분도 있다(alumni 의 agoda,
   한국머크, 텍사스 인스트루먼트 코리아가 여기 해당). 규모를 알 수 없으므로
   억지로 밀어 넣지 않고 null 을 돌려 기본값으로 흘려보낸다. */
function mapWork24Type(typeName) {
  if (!typeName) return null;
  const t = String(typeName);
  if (t.includes('대기업')) return CORP_TYPE.LARGE;
  if (t.includes('중견')) return CORP_TYPE.MID;
  if (t.includes('중소')) return CORP_TYPE.SMALL;
  if (t.includes('공기업') || t.includes('공공')) return CORP_TYPE.PUBLIC;
  return null;
}

/* ── 분류 ──────────────────────────────────────────────────
   반환: { type, source, matched }
     matched=false 면 아무 데도 안 걸려 기본값으로 떨어졌다는 뜻.
   어떤 입력에도 예외를 던지지 않는다 — 분류 실패가 스펙 저장을 막으면 안 된다. */
function classify(companyName) {
  try {
    const key = normalize(companyName);
    if (!key) return { type: DEFAULT_TYPE, source: '기본값(빈 회사명)', matched: false };

    /* 음차까지 같이 본다. 예전에는 suggest 만 이 규칙을 갖고 있어서, 자동완성으로는
       'SK하이닉스' 가 대기업으로 나오는데 그걸 골라 저장하면 **중소기업으로 분류**됐다
       (실측: SK하이닉스·LG전자·KT·CJ제일제당·NAVER 전부 '기본값(미등록)').
       같은 명단을 두 함수가 다르게 읽고 있던 것이라 규칙을 하나로 합쳤다. */
    for (const k of queryKeys(key)) {
      const hit = cache().map.get(k);
      if (hit) return { type: hit.type, source: hit.source, matched: true };
    }

    return { type: DEFAULT_TYPE, source: '기본값(미등록)', matched: false };
  } catch (e) {
    console.error('기업분류 실패:', companyName, e.message);
    return { type: DEFAULT_TYPE, source: '기본값(오류)', matched: false };
  }
}

/* ── 자동완성 ──────────────────────────────────────────────
   '삼성' → 삼성전자 · 삼성물산 … 처럼 입력 중인 회사명 후보를 돌려준다.

   캐시가 이미 { 정규화명 → 분류 } 맵이라 그 키를 그대로 훑는다. 별도 색인을
   두지 않는 이유는 규모 때문이다 — 항목이 3만 건 남짓이고 전부 메모리에 있어서
   선형 스캔이 수 ms 로 끝난다. 색인을 만들면 캐시 재적재 경로가 하나 더 늘 뿐이다.

   질의도 normalize 를 거치므로 'sk 하이닉스' / 'SK하이닉스' 가 같은 걸 찾는다.
   앞에서 걸린 것(접두사)을 중간에 걸린 것보다 위로 올린다 — '삼성' 을 쳤을 때
   '삼성전자' 가 '제일모직삼성' 보다 먼저 나와야 한다. */
/* 공정위 명단은 법인 등기명이라 대기업집단이 **한글 음차로만** 올라와 있다.
   'SK하이닉스' 가 아니라 '에스케이하이닉스', 'LG전자' 가 아니라 '엘지전자' 다.
   학생은 알파벳으로 치므로 그대로 두면 SK·LG·KT 를 쳤을 때 결과가 0건이 된다.
   질의를 음차로도 한 번 더 찾아본다(명단 자체를 고치는 건 배치의 일이 아니다). */
const QUERY_ALIASES = {
  SK: '에스케이', LG: '엘지', KT: '케이티', GS: '지에스', CJ: '씨제이',
  KB: '케이비', LS: '엘에스', HD: '에이치디', BGF: '비지에프', DL: '디엘',
  DB: '디비', OCI: '오씨아이', HMM: '에이치엠엠', KCC: '케이씨씨', NH: '엔에이치',
  NAVER: '네이버', POSCO: '포스코', SPC: '에스피씨', HL: '에이치엘', AK: '에이케이',
};

/* 정규화된 질의 하나 → 실제로 찾아볼 키들. 원문이 먼저다(명단에 알파벳으로 올라온
   회사도 있다). classify 와 suggest 가 **같은 함수**를 쓴다 — 갈리면 자동완성에서
   본 분류와 저장된 분류가 달라진다. */
function queryKeys(normalized) {
  const out = [normalized];
  for (const [abbr, kor] of Object.entries(QUERY_ALIASES)) {
    if (normalized.startsWith(abbr)) out.push(kor + normalized.slice(abbr.length));
  }
  return out;
}

function suggest(query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];

  /* 알파벳으로 시작하면 음차로 바꾼 질의도 같이 본다. 'SK하이닉스' → '에스케이하이닉스' */
  const queries = queryKeys(q);

  const starts = [];
  const contains = [];
  const seen = new Set();
  for (const [key, v] of cache().map) {
    if (!v.name || seen.has(key)) continue;      // 원본 이름을 안 들고 있는 옛 캐시 항목
    const at = queries.reduce((best, qq) => {
      const i = key.indexOf(qq);
      return i < 0 ? best : (best < 0 ? i : Math.min(best, i));
    }, -1);
    if (at < 0) continue;
    seen.add(key);
    if (at === 0) starts.push(v);
    else contains.push(v);
  }

  /* 짧은 이름을 위로 올린다. 명단에는 모회사와 온갖 계열사·특수목적법인이 같이
     들어 있어서(한국전력공사 옆에 '한국전력우리스프랏글로벌사모투자전문회사'),
     삽입 순서대로 자르면 학생이 찾는 회사가 잘려 나간다. 검색어에 가장 가까운
     이름 = 군더더기가 가장 적은 이름이라고 보고 길이순으로 세운다. */
  const byLength = (a, b) => displayName(a.name).length - displayName(b.name).length;
  starts.sort(byLength);
  contains.sort(byLength);

  return [...starts, ...contains].slice(0, limit).map(v => ({
    name: displayName(v.name),
    corpType: CORP_TYPE_ID[v.type] || null,
    source: v.source,
  }));
}

/* 화면에 보여줄 이름. 명단은 법인 등기명이라 '(주)카카오' 처럼 법인격이 붙어 있는데,
   학생이 이력서에 적는 이름은 '카카오' 다. 고른 값이 그대로 스펙에 저장되므로
   여기서 다듬어 둔다 — 분류는 어차피 normalize 를 거쳐서 어느 쪽이든 똑같이 걸린다. */
function displayName(name) {
  return String(name || '')
    .replace(/㈜|\(주\)|\(유\)|\(재\)|\(사\)|\(학\)|\(의\)/g, ' ')
    .replace(/주식회사|유한회사|재단법인|사단법인|학교법인/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stats() {
  const c = cache();
  return { cached: c.map.size, sources: c.sources };
}

module.exports = { classify, suggest, normalize, displayName, stats, reloadCache, CORP_TYPE, CORP_TYPE_ID, DEFAULT_TYPE };
