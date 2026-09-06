/* 자사 채용페이지 찾기 → data/career-pages.json 의 pages 를 채운다
   회사 리포트의 '자사 채용페이지' 버튼이 쓰는 표(src/career-pages.js).

   ── 왜 필요한가 (사용자 결정 2026-09-07) ──
   고용24 를 넓혀도(49장) 삼성전자·카카오·네이버 같은 회사는 여전히 0건이다.
   **자사 채용 사이트로만** 공고를 내기 때문이다. 그 회사들에 대해 우리가 줄 수 있는
   답은 "여기서 지원하세요" 하나이고, 그게 이 표다. 지금 대기업 545곳 중 26곳뿐이다.

   ── 25-3 의 규칙을 어기지 않는다 ──
   그 장은 "표는 손으로 채운다 — `/recruit`·`/careers` 를 찍어서 만들지 않는다"고
   적었다. 틀린 주소는 학생을 404 로 보내고, 그건 사람인 링크만도 못하기 때문이다.
   **이 스크립트도 주소를 찍지 않는다.** 대신:

     ① 회사 홈페이지를 DART 기업개황(hm_url)에서 얻는다 — 우리가 지어낸 값이 아니다
     ② 그 홈페이지에 **실제로 걸려 있는 링크** 중 채용으로 보이는 것을 고른다
     ③ 그 주소를 열어 **채용 페이지가 맞는지 확인**하고, 맞을 때만 표에 넣는다

   ②가 없는 회사는 건너뛴다. 링크가 없으면 없는 것이다 — 만들어 내지 않는다.

   ── 확인을 통과하지 못한 것은 남기지 않는다 ──
   200 이어도 홈으로 리다이렉트되거나 '준비 중' 인 곳이 있다. 제목·본문에 채용 관련
   말이 없으면 버린다. 버린 이유는 화면에 찍어서, 사람이 손으로 채울 목록이 된다.

     node scripts/find-career-pages.js --limit=20      # 20곳만 (시험)
     node scripts/find-career-pages.js                 # 남은 회사 전부
     node scripts/find-career-pages.js --dry           # 표를 고치지 않고 결과만 본다
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const DART = require('../src/dart');
const { urlProblem, normalizeUrl } = require('../src/posting-fetch');
const { normalize } = require('../src/company-name');

const FILE = path.join(__dirname, '..', 'data', 'career-pages.json');
const TIMEOUT_MS = Number(process.env.CAREER_FIND_TIMEOUT_MS || 12000);
const GAP_MS = Number(process.env.CAREER_FIND_GAP_MS || 700);
const UA = 'Mozilla/5.0 (compatible; croad/1.0; +https://github.com/YoungIn02642/croad)';

const arg = n => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1];
const has = n => process.argv.includes(`--${n}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── 채용 링크로 보이는가 ────────────────────────────────────
   **링크 글자**로 고른다. 주소만 보면 `/careers` 가 없는 회사를 놓치고, 반대로
   `/recruit-notice`(공지 게시판)를 채용페이지로 잘못 집는다.
   'IR'·'투자'·'보도' 처럼 자주 붙어 오는 남의 메뉴는 이름으로 뺀다. */
const WANT = /채\s*용|인재\s*영입|인재\s*채용|인재상|리크루|커리어|recruit|career|job\s*s?\b|talent|hiring|with\s*us|people/i;
const NOT_WANT = /보도|뉴스|공지|IR|투자|주주|사회공헌|고객|문의|로그인|장학|교육생|협력사|입찰/i;

/* 확인 단계 — 열어 본 페이지가 채용 페이지가 맞는가. 제목과 본문 앞부분을 본다. */
const LOOKS_CAREER = /채\s*용|인재\s*영입|모집|지원하기|입사|recruit|career|job|apply|hiring|talent/i;

function textOf(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function get(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, url: res.url, body };
}

/* 홈페이지 HTML → 채용 링크 후보. **글자가 있는 <a> 만** 본다. */
function candidates(html, base) {
  const out = [];
  const seen = new Set();
  for (const m of String(html).matchAll(/<a\b([^>]*)>([\s\S]{0,600}?)<\/a>/gi)) {
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1];
    if (!href) continue;
    /* 글자가 <span> 여러 겹 안에 있거나 **이미지뿐**인 메뉴가 많다. 링크 글자에 더해
       `title`·`aria-label` 과 안쪽 `<img alt>` 까지 본다 — 안 보면 '채용' 이라고
       분명히 적혀 있는 메뉴를 이미지라는 이유로 놓친다. */
    const attrText = [/title\s*=\s*["']([^"']+)["']/i, /aria-label\s*=\s*["']([^"']+)["']/i]
      .map(re => re.exec(m[1])?.[1] || '').join(' ');
    const altText = [...m[2].matchAll(/alt\s*=\s*["']([^"']+)["']/gi)].map(x => x[1]).join(' ');
    const label = textOf(m[2]) || textOf(attrText) || textOf(altText);
    /* 글자와 주소를 함께 본다 — 로고 이미지 링크처럼 글자가 없는 것은 주소로 본다. */
    const hay = `${label} ${attrText} ${altText} ${href}`;
    if (!WANT.test(hay) || NOT_WANT.test(label)) continue;
    if (/^(javascript:|mailto:|tel:|#)/i.test(href)) continue;
    let abs;
    try { abs = new URL(href.replace(/&amp;/g, '&'), base).href; } catch { continue; }
    if (!/^https?:/i.test(abs)) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);
    /* 글자에 '채용'·'인재영입' 이 든 것이 가장 확실하다. 주소만 맞는 것은 뒤로. */
    out.push({ url: abs, label, score: WANT.test(label) ? 2 : 1 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 6);
}

(async () => {
  const table = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const pages = table.pages || {};
  /* 이미 표에 있는 회사는 건드리지 않는다. `groupPortals` 는 **회사 이름이 아니라
     URL 목록**이라 여기서 볼 것이 없다 — 그룹 포털을 쓰는 계열사도 `pages` 에
     제 이름으로 들어 있다. (처음에 `{URL: [계열사]}` 인 줄 알고 값을 훑었는데,
     문자열을 한 글자씩 돌면서 엉뚱한 이름을 제외 목록에 넣고 있었다.) */
  const have = new Set(Object.keys(pages).map(normalize));

  /* 대상은 **대기업**이다. 지원이 몰리는 곳부터 채우는 게 값이 크고, 중견·공공까지
     한 번에 하려 들면 안 끝난다(25-6). 목록은 check-career-pages.js 의 --skeleton 과
     **같은 방식**으로 만든다 — 기준이 두 개면 두 스크립트가 다른 회사를 센다. */
  const S = require('../src/company-sectors');
  const tree = S.industryTree();
  if (!tree.total) { console.error(`회사 목록이 비어 있습니다 — ${tree.reason}`); process.exit(1); }
  const big = [];
  (function walk(node) {
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(c => { if (c.s === 'large') big.push(c.n); });
      else walk(v);
    }
  })(tree.tree);

  const targets = big.filter(n => !have.has(normalize(n))).sort((a, b) => a.localeCompare(b, 'ko'));
  const limit = Number(arg('limit') || targets.length);

  console.log(`대기업 ${big.length}곳 중 ${big.length - targets.length}곳 채워져 있음 · 이번에 ${Math.min(limit, targets.length)}곳 시도\n`);

  const found = {};
  const skipped = [];
  let tried = 0;

  for (const name of targets.slice(0, limit)) {
    tried++;
    process.stdout.write(`\r  ${tried}/${Math.min(limit, targets.length)} · 찾음 ${Object.keys(found).length}   `);

    /* ① 홈페이지는 DART 가 준다. 우리가 지어낸 주소가 아니다. */
    let home = null;
    try {
      const corp = DART.findCorp(name);
      if (corp) home = (await DART.profile(corp.code))?.homepage || null;
    } catch { /* DART 가 막히면 그 회사는 건너뛴다 */ }
    if (!home) { skipped.push([name, '홈페이지를 모름']); await sleep(GAP_MS); continue; }

    const base = normalizeUrl(home);
    if (await urlProblem(base)) { skipped.push([name, `주소가 이상함 (${home})`]); await sleep(GAP_MS); continue; }

    /* ② 홈페이지에 실제로 걸린 링크에서 고른다. */
    let list = [];
    try {
      const r = await get(base);
      if (r.ok) list = candidates(r.body, r.url);
    } catch { /* 아래에서 '홈페이지가 안 열림' 으로 남는다 */ }
    if (!list.length) { skipped.push([name, '채용 링크를 못 찾음']); await sleep(GAP_MS); continue; }

    /* ③ 열어 보고 채용 페이지가 맞을 때만 넣는다. */
    let hit = null;
    for (const c of list) {
      if (await urlProblem(c.url)) continue;
      try {
        const r = await get(c.url);
        if (!r.ok) continue;
        const body = textOf(r.body).slice(0, 3000);
        const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(r.body)?.[1] || '';
        if (!LOOKS_CAREER.test(`${textOf(title)} ${body}`)) continue;
        /* https 로만 넣는다 — career-pages.js 가 http 를 무시한다. */
        const finalUrl = r.url.replace(/^http:/, 'https:');
        if (!/^https:\/\//.test(finalUrl)) continue;
        hit = { url: finalUrl, label: c.label };
        break;
      } catch { /* 다음 후보 */ }
      await sleep(GAP_MS);
    }

    if (hit) found[name] = hit.url;
    else skipped.push([name, '열어 봤지만 채용 페이지가 아님']);
    await sleep(GAP_MS);
  }
  console.log('');

  console.log(`\n찾음 ${Object.keys(found).length}곳 / 시도 ${tried}곳`);
  for (const [n, u] of Object.entries(found).slice(0, 15)) console.log(`  ${n.padEnd(16)} ${u}`);
  if (Object.keys(found).length > 15) console.log(`  … 외 ${Object.keys(found).length - 15}곳`);

  const why = {};
  for (const [, r] of skipped) why[r] = (why[r] || 0) + 1;
  console.log('\n못 찾은 이유:');
  for (const [r, n] of Object.entries(why).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${r}`);

  if (has('dry')) { console.log('\n--dry 라 표를 고치지 않았습니다.'); return; }
  if (!Object.keys(found).length && !has('regroup')) { console.log('\n넣을 것이 없습니다.'); return; }

  /* 기존 값을 덮지 않는다 — 사람이 확인해 넣은 것이 우선이다. */
  const merged = { ...found, ...pages };
  table.pages = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b, 'ko')));

  /* ── 같은 주소를 쓰는 회사는 그룹 통합 포털로 묶는다 ────────
     25-3 의 규칙이다: 같은 URL 을 여러 회사가 쓰는 것은 **그룹 통합일 때만 맞고,
     아니면 복사·붙여넣기 실수다.** 둘은 눈으로 구분이 안 되므로 통합 포털을
     `groupPortals` 에 적게 하고, **거기 없는 중복만** 테스트가 잡는다.

     여기서 묶는 근거는 25-3 과 **다르다** — 그때는 포털 페이지를 받아 그 계열사
     이름이 실려 있는지 봤고, 여기서는 **각 회사 자기 홈페이지에 그 주소가 걸려
     있었다**는 것이다. 회사가 스스로 가리킨 주소라 근거로 충분하지만, 확인의
     성격이 다르다는 것을 적어 둔다. */
  const byUrl = new Map();
  for (const [n, u] of Object.entries(table.pages)) {
    if (!byUrl.has(u)) byUrl.set(u, []);
    byUrl.get(u).push(n);
  }
  /* `groupPortals` 는 **URL 배열**이다(그 주소가 통합 포털이라는 표시). 처음에
     `{URL: [계열사]}` 로 적었다가 저장 때 통째로 사라졌다 — 배열에 문자열 키를 달면
     JSON 이 버린다. 있는 규약을 확인하지 않고 모양을 지어낸 탓이다. */
  const portals = new Set(table.groupPortals || []);
  let grouped = 0;
  for (const [u, names] of byUrl) {
    if (names.length < 2 || portals.has(u)) continue;
    portals.add(u);
    grouped++;
    console.log(`  그룹 포털로 등록: ${u}  (${names.join(', ')})`);
  }
  table.groupPortals = [...portals].sort();
  if (grouped) console.log(`
그룹 통합 포털 ${grouped}건을 groupPortals 에 등록했습니다.`);

  table.checkedAt = new Date().toISOString().slice(0, 10);
  table.autoNote = '일부 항목은 scripts/find-career-pages.js 가 홈페이지의 실제 링크를 따라가 '
                 + '열리는 것을 확인해 넣었다. 주소를 찍어서 만든 값은 없다.';
  fs.writeFileSync(FILE, JSON.stringify(table, null, 2), 'utf8');
  console.log(`\n저장: ${FILE} — 이제 ${Object.keys(table.pages).length}곳`);
  console.log('  확인: node scripts/check-career-pages.js');
})();
