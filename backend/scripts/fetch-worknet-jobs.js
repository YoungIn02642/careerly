/* 워크넷 채용공고 수집 → data/worknet-jobs.json
   "이 직무는 요즘 무엇을 요구하나"(직무 트렌드)의 원천 데이터.

   출처: 고용24 채용정보 (구 워크넷). data.go.kr 3038225 에도 올라와 있지만 실제 호출은
        고용24 게이트웨이로 간다.

   ── 게이트웨이가 두 개다 (2026-07-28 실측) ──
   · 구: http://openapi.work.go.kr/opi/opi/opia/wantedApi.do
        → 2026 년에 발급된 인증키를 **모른다** ("유효하지 않은 인증키"). 쓸 수 없다.
   · 신: https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do  ← 이걸 쓴다
        → 같은 키로 공채기업정보(210L31)는 정상 동작하므로 키 문제가 아니다.

   · 필수 : authKey, callTp=L(목록), returnType=XML, startPage, display
   · 선택 : keyword, occupation, region, education, career, empTp, coTp …

   ── 응답 스키마는 아직 확인하지 못했다 (중요) ──
   210L01 은 **기업·기관 회원만** 호출할 수 있어("개인회원은 사용할 수 없는 OPEN-API입니다")
   실제 응답을 한 번도 못 봤다. 구 게이트웨이 문서의 <wantedRoot>/<wanted> 스키마를 그대로
   믿고 박아두면, 신 게이트웨이가 210L31 처럼 <dhsOpen…> 계열 태그를 쓸 경우 통째로 빗나간다
   (공정위 API 에서 명세를 추정했다가 전부 틀렸던 전례 — fetch-ftc-groups.js 머리주석).
   → 그래서 **반복되는 항목 태그를 자동으로 찾아내고**, 제목 필드도 후보 중에서 고른다.
     권한이 열리면 `--probe` 로 원본 응답을 먼저 눈으로 확인할 것.

   ── 직종 대신 '키워드'로 훑는 이유 ──
   워크넷 직종코드(KECO)를 NCS 중분류에 대응시키려면 매핑표를 또 만들어야 한다.
   그런데 keyword 파라미터가 있고 careerly 의 분류 단위는 이미 NCS 중분류다.
   그래서 NCS 중분류 이름을 그대로 키워드로 넣어 훑는다 — 매핑표 없이 careerly 의
   화면 단위와 수집 단위가 처음부터 일치한다.

   ── 목록 응답에는 '자격요건 본문'이 없다 (중요) ──
   <wanted> 에 오는 텍스트는 채용제목(title)과 학력·경력 코드뿐이다. 역량 키워드는
   제목에서만 뽑히므로 지금 집계는 '제목 기준'이다. 상세 API(callTp=D 또는
   wantedDtlApi.do)에 직무내용·자격요건이 있을 것으로 보이지만 **응답 필드명을
   확인하지 못했다**. 공정위 API 때 명세를 추정해 넣었다가 통째로 틀렸던 적이 있으므로
   (fetch-ftc-groups.js 머리주석) 추정해서 코드에 박지 않는다.
   → 인증키가 승인되면 `--probe-detail <구인인증번호>` 로 실제 응답을 덤프해서
     필드명을 눈으로 확인한 뒤 확정할 것.

     node scripts/fetch-worknet-jobs.js                     # NCS 중분류 이름으로 전부 훑기
     node scripts/fetch-worknet-jobs.js --keyword=마케팅     # 키워드 하나만
     node scripts/fetch-worknet-jobs.js --limit=5           # 앞의 5개 키워드만(할당량 절약)
     node scripts/fetch-worknet-jobs.js --probe        # ★ 권한 열리면 이것부터 — 응답 스키마 확인
     node scripts/fetch-worknet-jobs.js --probe-detail=KA123  # 상세 응답 규격 확인용 덤프
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const KEY  = (process.env.WORK24_API_KEY || '').trim();
const W24  = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo';
const API        = `${W24}210L01.do`;   // 채용정보 목록
const DETAIL_API = `${W24}210D01.do`;   // 채용정보 상세

const PER_PAGE  = 100;      // display 상한이 명세에 따라 다를 수 있어 보수적으로 잡는다
const MAX_PAGES = 10;       // 키워드당 최대 1,000건. 트렌드 집계에는 충분하다
const PAUSE_MS  = 300;      // 연속 호출 간격 — 게이트웨이 차단을 피한다

const arg = name => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

/* 항목 태그를 자동으로 찾는다.
   구 게이트웨이는 <wanted>, 210L31 은 <dhsOpenEmpHireInfo> 를 쓴다. 210L01 이 무엇을
   쓰는지는 아직 못 봤으므로 이름을 박지 않고, **여러 번 반복되면서 자식 태그를 가진
   블록** 중 가장 많이 나오는 것을 항목으로 본다. 목록 응답의 공통 구조라 이 판별로 충분하다. */
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

function parseItems(xml, itemTag) {
  const tagName = itemTag || detectItemTag(xml);
  if (!tagName) return { items: [], itemTag: null };

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
  return { items, itemTag: tagName };
}

/* 역량 추출에 쓸 '채용제목' 필드도 게이트웨이마다 이름이 다를 수 있다.
   구 스키마는 title. 후보를 훑어 실제로 값이 있는 것을 고르고, 하나도 없으면
   조용히 빈 집계를 만들지 말고 필드 목록을 보여주며 멈춘다. */
const TITLE_FIELDS = ['title', 'wantedTitle', 'empWantedTitle', 'recrtTitle', 'jobsNm'];
const COMPANY_FIELDS = ['company', 'coNm', 'empBusiNm'];

const pick = (row, fields) => fields.map(f => row[f]).find(v => v && String(v).trim()) || '';

const tag = (xml, name) =>
  xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(params) {
  const qs = new URLSearchParams({
    authKey: KEY, callTp: 'L', returnType: 'XML', ...params,
  });
  const res = await fetch(`${API}?${qs}`);
  const xml = await res.text();

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${xml.slice(0, 200)}`);

  /* 권한·인증 실패는 <error>/<message> 로 온다. 문구를 그대로 올려야
     "개인회원은 사용할 수 없는 OPEN-API입니다" 같은 원인이 그대로 보인다. */
  const err = tag(xml, 'error') || tag(xml, 'message');
  if (err) throw new Error(err);

  const { items, itemTag } = parseItems(xml);
  if (!items.length && !/<total>\s*0\s*</.test(xml)) {
    throw new Error(`응답에서 항목을 찾지 못했습니다(스키마 확인 필요): ${xml.slice(0, 300)}`);
  }
  return { items, itemTag, total: Number(tag(xml, 'total') || 0) };
}

/* NCS 중분류 이름 = 수집 키워드. careerly 의 분류 단위를 그대로 쓴다. */
function ncsKeywords() {
  const taxo = require(path.join(__dirname, '..', 'data', 'ncs-taxonomy.json'));
  const names = [];
  for (const major of taxo) {
    for (const mid of major.middles || []) {
      if (mid.name && !names.includes(mid.name)) names.push(mid.name);
    }
  }
  return names;
}

async function collect(keyword) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await call({ startPage: String(page), display: String(PER_PAGE), keyword });
    rows.push(...r.items);
    if (!r.items.length || (r.total && rows.length >= r.total)) break;
    await sleep(PAUSE_MS);
  }
  return rows;
}

/* 권한이 열린 첫날 반드시 이걸 먼저 돌릴 것 — 응답 스키마를 눈으로 확인하는 용도다.
   추측한 필드명으로 수집하면 조용히 빈 집계가 만들어진다. */
async function probe() {
  const qs = new URLSearchParams({
    authKey: KEY, callTp: 'L', returnType: 'XML', startPage: '1', display: '3', keyword: '마케팅',
  });
  const res = await fetch(`${API}?${qs}`);
  const xml = await res.text();
  console.log(`HTTP ${res.status}
${xml.slice(0, 2500)}
`);

  const { items, itemTag } = parseItems(xml);
  console.log('자동 인식한 항목 태그:', itemTag || '(못 찾음)');
  if (items[0]) {
    console.log('필드 목록:', Object.keys(items[0]).join(', '));
    console.log('제목 후보 매칭:', pick(items[0], TITLE_FIELDS) || '(없음 — TITLE_FIELDS 에 추가 필요)');
  }
}

/* 상세 응답의 필드명을 '확인'하기 위한 덤프. 추정으로 코드에 박지 않기 위한 장치다. */
async function probeDetail(wantedAuthNo) {
  const qs = new URLSearchParams({
    authKey: KEY, callTp: 'D', returnType: 'XML', wantedAuthNo,
  });
  for (const url of [`${DETAIL_API}?${qs}`, `${API}?${qs}`]) {
    console.log('\n요청:', url.replace(KEY, '***'));
    try {
      const res = await fetch(url);
      const xml = await res.text();
      console.log(`HTTP ${res.status}\n${xml.slice(0, 3000)}`);
      if (/<wanted/.test(xml)) {
        console.log('\n→ 위 응답에서 직무내용·자격요건에 해당하는 태그명을 찾아,');
        console.log('  src/job-trends.js 의 TEXT_FIELDS 에 추가하면 제목 대신 본문으로 집계됩니다.');
        return;
      }
    } catch (e) {
      console.log('실패:', e.message);
    }
  }
}

(async () => {
  if (!KEY) {
    throw new Error('WORK24_API_KEY 가 .env 에 없습니다. openapi.work.go.kr 에서 발급받아 채워주세요.');
  }

  if (process.argv.includes('--probe')) return probe();

  const detail = arg('probe-detail');
  if (detail) return probeDetail(detail);

  const one   = arg('keyword');
  const limit = Number(arg('limit') || 0);
  let keywords = one ? [one] : ncsKeywords();
  if (limit > 0) keywords = keywords.slice(0, limit);

  console.log(`키워드 ${keywords.length}개로 수집합니다.`);
  const jobs = [];
  for (const kw of keywords) {
    try {
      const rows = await collect(kw);
      /* 어떤 키워드로 걸린 공고인지 남긴다 — 집계 단위가 여기서 정해진다. */
      for (const r of rows) jobs.push({ keyword: kw, ...r });
      console.log(`  ${kw}: ${rows.length}건 (누적 ${jobs.length})`);
    } catch (e) {
      console.warn(`  ${kw}: 실패 — ${e.message}`);
      if (/인증|승인/.test(e.message)) break;      // 키 문제면 나머지도 전부 실패한다
    }
    await sleep(PAUSE_MS);
  }

  if (!jobs.length) {
    console.error('\n수집된 공고가 없습니다. 인증키 승인 상태를 먼저 확인해 주세요.');
    process.exit(1);
  }

  const out = {
    source: '한국고용정보원 워크넷 채용정보 (openapi.work.go.kr wantedApi.do)',
    fetchedAt: new Date().toISOString(),
    keywords,
    count: jobs.length,
    /* 원본을 통째로 두지 않고 집계에 쓰는 필드만 남긴다(개인정보·용량 모두 이유). */
    jobs: jobs.map(j => ({
      keyword: j.keyword,
      /* 게이트웨이마다 필드명이 달라 후보 중에서 고른다(TITLE_FIELDS/COMPANY_FIELDS). */
      title: pick(j, TITLE_FIELDS),
      company: pick(j, COMPANY_FIELDS),
      minEdubg: j.minEdubg || null,
      maxEdubg: j.maxEdubg || null,
      career: j.career || null,
      region: j.region || null,
      regDt: j.regDt || null,
    })),
  };

  const dest = path.join(__dirname, '..', 'data', 'worknet-jobs.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));

  console.log('\n저장:', dest);
  console.log('공고:', jobs.length, '건');
  console.log('\n다음: node scripts/build-job-trends.js  (직무별 역량 빈도 집계)');
})().catch(e => {
  console.error('실패:', e.message);
  process.exit(1);
});
