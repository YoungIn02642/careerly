/* 고용24 공채기업정보 수집 → data/work24-companies.json
   기업규모 분류(src/company-classify.js)의 **중견기업 판별** 캐시.

   ── 이게 왜 중요한가 ──
   중견기업은 법적으로 "중소기업도 대기업도 아닌 기업"이라 뺄셈으로만 정의돼
   공개 명단이 없다. data.go.kr 에도, OpenDART 에도 없다(조사 완료 — 재조사 금지).
   이 API 의 coClcd=40 이 **'중견기업' 라벨을 직접 주는 거의 유일한 공개 소스**다.

   ── 확인된 규격 (2026-07-28 실호출로 확인) ──
   · 요청 URL : https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L31.do
   · 필수     : authKey, callTp=L(목록), returnType=XML, startPage(≤1000), display(≤100)
   · coClcd   : 10 대기업 · 20 공기업 · 30 공공기관 · 40 중견기업 · 50 외국계기업
                (다중검색은 `10|40` 처럼 파이프로 잇는다)
   · 응답     : <dhsOpenEmpHireInfoList> > total / <dhsOpenEmpHireInfo> 반복

   ── 명세서 표의 오타에 주의 ──
   공식 명세서는 출력항목에 <coClcdNm> 을 두 번 적어놓고 하나를 '회사명'이라 설명한다.
   **실제 응답에서 회사명은 <coNm>, 기업구분명이 <coClcdNm> 이다.** 명세서를 그대로
   믿고 coClcdNm 을 회사명으로 읽으면 기업구분명이 회사명 자리에 들어간다.
   (공정위 API 때도 명세를 잘못 읽어 한참 헤맸다 — fetch-ftc-groups.js 머리주석)

   ── 이 명단은 '전수'가 아니다 (중요) ──
   고용24에 **공채를 등록한 기업**만 담긴다. 실측 총건수: 중견 1,444 · 공공기관 504 ·
   대기업 78 · 공기업 78 · 외국계 0. 대기업은 공정위 명단(3,539건)이 훨씬 정확하므로
   company-classify.js 는 공정위·공공기관 캐시를 먼저 보고 여기서 덮어쓰지 않는다.
   중견기업도 1,444건이 전부일 리 없으니 **여전히 '중소기업'으로 잘못 떨어지는 회사가
   남는다** → 자동판정 실패를 화면에 알려주는 일(B1)이 이 수집보다 중요하다.

     node scripts/fetch-work24-companies.js          # 전체 구분 수집
     node scripts/fetch-work24-companies.js 40       # 중견기업만
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const KEY = (process.env.WORK24_API_KEY || '').trim();
const API = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L31.do';

const PER_PAGE  = 100;      // 명세상 최대
const MAX_PAGES = 1000;     // 명세상 startPage 최대
const PAUSE_MS  = 250;

const CODES = {
  10: '대기업', 20: '공기업', 30: '공공기관', 40: '중견기업', 50: '외국계기업',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 의존성을 늘리지 않으려고 XML 파서를 붙이지 않았다. <dhsOpenEmpHireInfo> 는
   중첩이 없는 평평한 목록이라 태그 추출로 충분하다(다른 fetch-* 와 같은 방식). */
function parseItems(xml) {
  const items = [];
  const re = /<dhsOpenEmpHireInfo>([\s\S]*?)<\/dhsOpenEmpHireInfo>/g;
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

async function call(coClcd, startPage) {
  const qs = new URLSearchParams({
    authKey: KEY, callTp: 'L', returnType: 'XML',
    startPage: String(startPage), display: String(PER_PAGE), coClcd: String(coClcd),
  });
  const res = await fetch(`${API}?${qs}`, { signal: AbortSignal.timeout(30000) });
  const xml = await res.text();

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${xml.slice(0, 200)}`);
  /* 인증·권한 실패는 XML 이지만 <error> 나 <message> 로 온다. 그대로 보여준다 —
     "개인회원은 사용할 수 없는 OPEN-API입니다" 같은 문구가 원인을 그대로 알려준다. */
  if (!/<dhsOpenEmpHireInfoList/.test(xml)) {
    const msg = tag(xml, 'error') || tag(xml, 'message') || xml.slice(0, 200);
    throw new Error(msg);
  }
  return { items: parseItems(xml), total: Number(tag(xml, 'total') || 0) };
}

async function collect(coClcd) {
  const rows = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await call(coClcd, page);
    total = r.total || total;
    rows.push(...r.items);
    if (!r.items.length || rows.length >= total) break;
    await sleep(PAUSE_MS);
  }
  return { rows, total };
}

(async () => {
  if (!KEY) {
    throw new Error('WORK24_API_KEY 가 .env 에 없습니다. https://www.work24.go.kr 오픈API 신청 후 채워주세요.');
  }

  const only = process.argv[2];
  const codes = only ? [only] : Object.keys(CODES);

  const companies = [];
  const stats = {};
  for (const code of codes) {
    const label = CODES[code] || code;
    try {
      const { rows, total } = await collect(code);
      for (const r of rows) {
        /* 회사명은 coNm — 명세서 표의 coClcdNm 이 아니다(머리주석 참고). */
        const name = (r.coNm || '').trim();
        if (!name) continue;
        companies.push({
          name,
          typeName: (r.coClcdNm || label).trim(),
          bizNo: r.busino || null,
          empCoNo: r.empCoNo || null,
        });
      }
      stats[label] = rows.length;
      console.log(`  ${label.padEnd(6)} ${String(rows.length).padStart(5)}건 수집 (총 ${total}건)`);
    } catch (e) {
      console.warn(`  ${label}: 실패 — ${e.message}`);
      if (/개인회원|인증키/.test(e.message)) break;   // 권한 문제면 나머지도 전부 실패한다
    }
    await sleep(PAUSE_MS);
  }

  if (!companies.length) {
    console.error('\n수집된 기업이 없습니다. node scripts/check-api-access.js 로 인증 상태를 확인하세요.');
    process.exit(1);
  }

  /* 같은 회사가 여러 구분으로 들어오는 일은 없지만, 중복 등록은 있을 수 있다. */
  const seen = new Set();
  const unique = companies.filter(c => {
    const k = c.name.replace(/\s+/g, '').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const out = {
    source: '고용24 공채기업정보 (work24.go.kr callOpenApiSvcInfo210L31)',
    caveat: '고용24에 공채를 등록한 기업만 담긴다 — 각 기업구분의 전수 명단이 아니다.',
    fetchedAt: new Date().toISOString(),
    byType: stats,
    count: unique.length,
    companies: unique,
  };

  const dest = path.join(__dirname, '..', 'data', 'work24-companies.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));

  console.log('\n저장:', dest);
  console.log('기업:', unique.length, '건 (중복 제거 전', companies.length, '건)');
  console.log('\n확인: node -e "const c=require(\'./src/company-classify\');console.log(c.classify(\'아주산업\'))"');
})().catch(e => {
  console.error('실패:', e.message);
  if (/개인회원/.test(e.message)) {
    console.error('\n→ 이 오퍼레이션은 기업·기관 회원만 호출할 수 있습니다.');
  }
  process.exit(1);
});
