/* ════════════════════════════════════════════════════════════
   공모전·대외활동 목록 HTML → 항목 배열 (파서)

   ── 왜 여기까지 왔나 (사용자 지시 2026-09-06) ───────────────
   채용공고를 고용24 에서 하루 1회 받게 한 뒤, **"공모전 대외활동도 해줘"** 를 받았다.
   그런데 같은 수법이 통하지 않았다:

   · 공모전을 전국 단위로 모아 주는 **공공 API 도 공공 사이트도 없다.** 부처·기관이
     각자 자기 공고만 낸다(42-1 에서 콘텐츠진흥원·KIPRIS 까지 실호출로 확인했다)
   · 지금 쓰는 온통청년은 **청년정책** 목록이라 지자체·공공 것뿐이고, 기업 공모전이
     한 건도 없다(22-6). 실측 38건
   · korea.kr 사이트맵의 `recruit` 를 받아 봤더니 8,247건 전부 **공무직 채용공고**였다

   기업 공모전과 포스터를 실제로 들고 있는 곳은 민간 집계 사이트뿐이라,
   **사용자가 위험을 알고 고른 뒤**(아래) 위비티를 하루 1회 받기로 했다.

   ── 무엇을 알고 시작하는가 ──────────────────────────────────
   `robots.txt` 는 `Allow: /` 다(2026-09-06 확인). 그러나 **robots 가 약관은 아니다.**
   공고를 모아 편집한 것 자체가 그 회사 영업의 핵심이라, 이용약관과 저작권법상
   **데이터베이스제작자의 권리**가 따로 걸린다. 고용24 는 정부 사이트라 없던 문제다.
   사용자에게 이 차이를 알리고 확인을 받았다. 그래서 스스로 선을 긋는다:

   · **하루 한 번, 목록만.** 상세는 **처음 보는 항목만** 연다(steady state 수십 건)
   · robots 의 `Crawl-delay: 3`(GPTBot 대상)을 **우리에게도 적용**한다 — 우리는
     GPTBot 이 아니지만 그 사이트가 밝힌 속도를 지키는 것이 맞다
   · 원문을 통째로 옮기지 않는다. **제목·주최·마감·분야와 원문 링크**만 담는다.
     본문은 가져오지 않는다 — 읽으러는 **그 사이트로 보낸다**
   · (2026-09-07 사용자 지시로 바뀐 것) **표지 한 장은 받는다.** 카드에 모집 포스터를
     넣기로 했다. 그래도 본문은 그대로 안 가져오고, 카드는 원문으로 가는 링크다
   · 화면에 **출처를 밝히고 링크를 건다.** 우리가 모은 것처럼 보이게 하지 않는다
   · 신분을 밝힌다(UA). 브라우저인 척하지 않는다

   ── 이 파일은 네트워크를 모른다 ─────────────────────────────
   받아오는 일은 scripts/fetch-wevity.js 가 한다. 여기는 **문자열 → 객체**뿐이라
   저장해 둔 HTML 로 테스트가 된다(work24-crawl.js 와 같은 규약).
   ════════════════════════════════════════════════════════════ */

const ORIGIN = 'https://www.wevity.com';

/* 목록 주소. 파라미터 이름·값은 화면의 필터 링크에서 확인한 것을 쓴다(추정 아님).
     gbn=list      목록
     gp=N          페이지
     gub=2&cidx=5  응모대상 = **대학생** (전체 39행 → 29행으로 줄어드는 것을 확인)
   대학생으로 좁히는 이유는 C:road 가 대학생 서비스라서다. 어린이·청소년 공모전을
   섞으면 학생이 목록을 훑는 비용만 늘어난다. */
const LIST = { c: 'find', s: '1', gbn: 'list', gub: '2', cidx: '5' };

const listUrl = page => `${ORIGIN}/?${new URLSearchParams({ ...LIST, gp: String(page) })}`;
const detailUrl = ix => `${ORIGIN}/?${new URLSearchParams({ c: 'find', s: '1', gbn: 'view', gp: '1', ix: String(ix) })}`;

/* ── HTML 조각 → 사람이 읽는 문자열 ────────────────────────── */
function text(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

const IX = /gbn=view&(?:amp;)?gp=\d+&(?:amp;)?ix=(\d+)/;
/* 제목은 상세로 가는 <a> 안에 있다. **`div.tit` 를 통째로 집지 않는다** — 분야줄
   (`div.sub-tit`)이 그 안에 **중첩**돼 있어서, 비탐욕 `</div>` 가 안쪽에서 먼저
   닫힌다. 처음에 그렇게 짰다가 목록 전체를 못 읽었다(에러 없이 0건이었다). */
const TITLE_A = /<a[^>]*gbn=view[^>]*>([\s\S]*?)<\/a>/;
const SUBTIT = /<div class="sub-tit">([\s\S]*?)<\/div>/;
const ORGAN = /<div class="organ">([\s\S]*?)<\/div>/;
const DAY = /<div class="day">([\s\S]*?)<\/div>/;

/* 목록 한 줄(<li>) → 항목 하나.
   제목 뒤에 `<span class='stat spec'>SPECIAL</span>` 같은 광고 딱지가 붙어 온다.
   그건 그 사이트의 노출 상품이지 공모전 이름이 아니므로 떼어낸다 — 안 떼면
   카드 제목이 '…공모전 SPECIAL' 이 된다. */
function parseRow(li) {
  const ixm = IX.exec(li);
  if (!ixm) return null;

  const anchor = TITLE_A.exec(li);
  if (!anchor) return null;

  /* 딱지 <span> 을 먼저 지우고 태그를 턴다. */
  const name = text(anchor[1].replace(/<span[^>]*class=['"]stat[^>]*>[\s\S]*?<\/span>/gi, ''));
  if (!name) return null;

  /* `분야 : 광고/마케팅, 영상/UCC/사진, …` — 앞의 라벨을 떼고 쉼표로 가른다. */
  const sub = SUBTIT.exec(li);
  const fields = (sub ? text(sub[1]) : '').replace(/^분야\s*[:：]\s*/, '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const day = DAY.test(li) ? text(DAY.exec(li)[1]) : '';
  const ddm = /D-(\d+)/.exec(day);

  return {
    id: ixm[1],
    name,
    org: ORGAN.test(li) ? text(ORGAN.exec(li)[1]) : '',
    fields,
    url: detailUrl(ixm[1]),
    /* 마감까지 며칠인지는 **그 사이트가 계산해 준 값**을 그대로 읽는다. 우리가
       접수기간에서 다시 세면 하루 차이가 나는 날이 생기는데, 학생이 두 화면을
       나란히 놓고 볼 수 있어서 그 어긋남이 곧 신뢰 문제가 된다. */
    dday: ddm ? Number(ddm[1]) : null,
    /* 상태는 셋이다 — 접수중 · 마감임박 · 마감. '마감임박' 도 접수중이다. */
    open: /접수중|마감임박|D-DAY/.test(day),
    imminent: /마감임박/.test(day),
  };
}

function parseList(html) {
  const s = String(html || '');
  /* **`<ul class="list">` 안으로 범위를 좁히지 않는다.** 한 페이지의 목록이 두 덩이로
     나뉘어(광고 노출분과 일반분) 첫 `</ul>` 에서 끊기면 39건 중 16건만 잡힌다.
     실제로 그렇게 짰다가 절반 넘게 잃었다.

     대신 **목록 행의 모양을 가진 <li> 만** 후보로 센다: 상세 링크(`gbn=view`)와
     주최사 칸(`div.organ`)이 둘 다 있는 것.

     `div.organ` 까지 보는 이유는 페이지 맨 위의 **배너 슬롯** 때문이다. 그것도
     `<li>` 에 상세 링크가 들어 있지만 `hide-tit`·`hide-cat` 이라는 다른 모양이고,
     같은 공고가 아래 목록에 또 나온다. 링크만 보고 후보로 세면 `dropped` 가 늘
     12쯤 되어 **'못 읽은 공고 수'로 쓸 수 없게 된다** — 그러면 파서가 진짜 깨진
     날에도 숫자가 안 움직인다. */
  const blocks = [...s.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(m => m[0]);
  const rows = blocks.filter(b => IX.test(b) && /class="organ"/.test(b));

  const items = [];
  let dropped = 0;
  for (const li of rows) {
    const r = parseRow(li);
    if (r) items.push(r); else dropped++;
  }
  return { items, rows: rows.length, dropped };
}

/* ── 상세에서 더 읽는 것 ─────────────────────────────────────
   목록에는 접수기간과 주최사 홈페이지가 없다. 둘 다 학생이 실제로 쓰는 값이라
   **처음 보는 항목에 한해** 상세를 한 번 연다.

   상세는 `<li><span class="tit">이름</span> 값 </li>` 꼴이라 라벨로 찾는다.
   자리(순서)로 읽으면 항목마다 있는 칸이 달라서 값이 한 칸씩 밀린다. */
function field(html, label) {
  const re = new RegExp(`<span class="tit">\\s*${label}\\s*</span>([\\s\\S]*?)</li>`, 'i');
  const m = re.exec(String(html));
  return m ? text(m[1]) : null;
}

/* ── 모집 포스터 (2026-09-07, 사용자 지시) ──────────────────
   "사이트 안에 모집 사진을 넣어줘." 상세 페이지에 **그 공고의 포스터**가 있다.
   `og:image` 가 그것을 가리키고, 없으면 본문 첫 업로드 이미지를 쓴다.

   ── 48-7 에서 안 쓰기로 했던 것을 쓰게 됐다 ──
   그때는 "목록 정보를 인용하는 것과 이미지를 옮겨 오는 것은 무게가 다르다"며 접었다.
   사용자가 알고 지시했으므로 넣되, **그림을 우리 것처럼 쓰지 않는다**:
   카드는 원문으로 가는 링크이고, 화면에 출처가 적혀 있으며, 받아 두는 것은
   목록에 걸린 공고의 표지 한 장뿐이다.

   ── 주소를 그대로 쓰지 않고 서버가 받아 둔다 ──
   화면이 남의 서버 주소를 직접 부르면 ① 누가 무엇을 보는지 그쪽 로그에 남고
   ② 그쪽 대역폭을 쓰며 ③ 리퍼러 검사로 막히면 카드가 통째로 깨진다.
   로고와 같은 규약이다(company-logo.js 머리주석). */
const OG_IMAGE = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i;
const OG_IMAGE_REV = /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i;
const UPLOAD_IMG = /<img[^>]*src=["'](\/upload\/[^"']+\.(?:jpg|jpeg|png|gif|webp))["']/i;
/* 상세에는 같은 포스터가 **두 장** 실린다 — 목록용 썸네일과 눌러서 크게 보는 원본.
   원본 쪽에만 `cursor: zoom-in` 이 붙어 있다(두 페이지에서 같은 모양을 확인했다). */
const ZOOM_IMG = /<img[^>]*zoom-in[^>]*src=["'](\/upload\/[^"']+)["']/i;
const ZOOM_IMG_REV = /<img[^>]*src=["'](\/upload\/[^"']+)["'][^>]*zoom-in/i;

/* ── 썸네일이 아니라 원본을 쓴다 (2026-09-07 실측) ──────────
   처음에는 `og:image` 를 썼는데, 그건 **265×338 고정 썸네일**이다(받아 본 25장이
   전부 같은 치수였다). 카드 표지가 269px 폭이라 1배 화면에서 딱 맞고 그 이상에서는
   뭉갠다. 본문의 원본은 같은 공고에서 34KB → **177KB** 로 훨씬 크다.

   순서: 본문 원본(zoom-in) → og:image(썸네일) → 본문 첫 이미지 */
function posterOf(html) {
  const s = String(html || '');
  const zoom = ZOOM_IMG.exec(s) || ZOOM_IMG_REV.exec(s);
  const og = OG_IMAGE.exec(s) || OG_IMAGE_REV.exec(s);
  let raw = zoom ? zoom[1] : (og ? og[1] : (UPLOAD_IMG.exec(s) || [])[1]);
  if (!raw) return null;
  raw = raw.replace(/&amp;/g, '&').trim();
  /* 상대경로로 오는 경우가 있다(본문 이미지). 절대주소로 바꾼다. */
  try { return new URL(raw, ORIGIN).href; } catch { return null; }
}

/* 홈페이지 칸의 **주소**를 원형 그대로 꺼낸다(글자만 읽으면 잘려 온다). */
function homepageOf(html) {
  const m = /<span class="tit">\s*홈페이지\s*<\/span>([\s\S]*?)<\/li>/i.exec(String(html));
  if (!m) return null;
  const a = /href=["']([^"']+)["']/i.exec(m[1]);
  const raw = a ? a[1] : text(m[1]);
  return /^https?:\/\//i.test(raw) ? raw.replace(/&amp;/g, '&') : null;
}

const YMD = /(\d{4})[-.](\d{2})[-.](\d{2})/g;

function parseDetail(html) {
  const period = field(html, '접수기간') || '';
  const dates = [...period.matchAll(YMD)].map(m => `${m[1]}-${m[2]}-${m[3]}`);
  return {
    target: field(html, '응모대상'),
    org: field(html, '주최/주관'),
    sponsor: field(html, '후원/협찬') || null,
    prize: field(html, '총 상금') || null,
    firstPrize: field(html, '1등 상금') || null,
    startDate: dates[0] || null,
    endDate: dates[1] || dates[0] || null,
    /* 주최사 홈페이지 — 로고를 여기서 가져온다(사용자 결정 2026-09-06). */
    homepage: homepageOf(html),
    /* 모집 포스터 — 카드 표지를 이걸로 채운다(사용자 지시 2026-09-07). */
    poster: posterOf(html),
  };
}

/* ── 파서가 조용히 깨졌는지 본다 ────────────────────────────
   화면이 개편되면 행은 세는데 필드가 빈다. 그 상태로 저장하면 에러 없이 캐시가
   망가진다(work24-crawl.js 와 같은 이유). */
function sanity(items) {
  const n = items.length;
  const rate = f => (n ? items.filter(f).length / n : 0);
  return {
    count: n,
    withOrg: rate(x => x.org),
    withField: rate(x => x.fields?.length),
    withUrl: rate(x => x.url),
    ok: n > 0 && rate(x => x.org) >= 0.9 && rate(x => x.fields?.length) >= 0.8,
  };
}

/* 분야 이름으로 탭을 가른다. `대외활동/서포터즈`·`봉사활동` 이 붙어 있으면
   대외활동, 아니면 공모전이다.

   **이름으로 추측하지 않는다.** specup.js 의 `topicOf` 는 정책 이름에서 '서포터즈'
   같은 말을 찾아야 했지만(온통청년에는 분류가 없다), 여기는 그 사이트가 붙여 준
   분야가 이미 있다. 있는 분류를 두고 이름을 뒤지면 42-3 에서 두 번 틀린 길을
   그대로 다시 걷는 것이다. */
const ACTIVITY_FIELDS = /대외활동|서포터즈|봉사활동/;
const topicOf = fields => (fields || []).some(f => ACTIVITY_FIELDS.test(f)) ? 'activity' : 'contest';

module.exports = {
  parseList, parseRow, parseDetail, sanity, topicOf, text, field, homepageOf, posterOf,
  listUrl, detailUrl, ORIGIN, LIST, ACTIVITY_FIELDS,
  /* 상세 규격이 바뀌면 올린다. 수집기가 이 값이 다른 항목을 **다시 연다** —
     안 그러면 새 필드(poster)가 이미 받아 둔 항목에는 영영 안 생긴다. */
  DETAIL_VERSION: 3,
};
