/* ════════════════════════════════════════════════════════════
   고용24 채용정보 목록 HTML → 공고 배열 (파서)

   ── 왜 API 가 아니라 화면을 읽나 ────────────────────────────
   고용24 채용정보 OPEN-API(210L01)는 **기업·기관 회원만** 호출할 수 있다. 개인회원
   계정으로는 '승인' 이 떠도 막힌다 — 2026-07 부터 세 번 확인했고 응답이 그대로다
   (작업정리 10-7 · 34-2). 코드로 풀 수 있는 문제가 아니다.

   그래서 **같은 데이터를 공개 화면에서 읽는다.** 사용자 지시(2026-09-06):
   "API 승인을 계속 못 받으니 그냥 하루 1회 크롤링해서 업데이트."

   ── 25-2 에서 "긁지 않는다" 고 했던 것과 무엇이 다른가 ──────
   25-2 가 접은 것은 **회사 2,442곳의 자사 채용페이지**를 각각 긁는 일이었다. 파서가
   회사 수만큼 필요하고 개편 한 번에 조용히 깨진다는 것이 이유였다. 여기는 **한 곳,
   한 화면**이다. 파서가 하나뿐이라 깨지면 전량이 0건이 되고, 그건 수집기가 즉시
   잡아낸다(조용히 깨지지 않는다 — 아래 SANITY).

   ── 지키는 선 ──────────────────────────────────────────────
   · robots.txt : `/wk/` 를 막지 않는다 (2026-09-06 확인). 막힌 경로는 안 건드린다
   · 신분을 밝힌다 : UA 에 croad 와 저장소 주소를 적는다. 브라우저인 척하지 않는다
   · 하루 한 번, 순차로 : 사용자 트래픽마다 부르지 않는다. 페이지 사이에 쉰다
   · 로그인 안 한 상태에서 보이는 것만 : 우회하지 않는다

   ── 왜 대졸만 받나 (수집기의 필터) ──────────────────────────
   전체는 **132,313건**이다(2026-09-06 실측). 한 페이지(100건)가 1.1MB 라 전량이면
   하루 1.5GB 를 받아야 한다. 학력 대졸(04,05)로 좁히면 **22,507건 · 226페이지 ·
   250MB** 다. C:road 는 대학생 서비스라 이 선이 맞다.
   좁힌 사실은 화면에 적는다 — 0건이 "이 회사가 안 뽑는다" 로 읽히면 안 된다.

   ── 이 파일은 네트워크를 모른다 ─────────────────────────────
   받아오는 일은 scripts/fetch-work24-jobs.js 가 한다. 여기는 **문자열 → 객체**뿐이라
   저장해 둔 HTML 로 테스트가 된다. 화면이 개편되면 여기만 고친다.
   ════════════════════════════════════════════════════════════ */

const ORIGIN = 'https://www.work24.go.kr';
const LIST_PATH = '/wk/a/b/1200/retriveDtlEmpSrchList.do';

/* 목록 화면의 검색 조건. 이름은 화면의 form(mForm) 에서 확인한 것을 쓴다(추정 아님).
     resultCnt  : 한 페이지 건수. 100 까지 받는 것을 확인했다
     pageIndex  : 페이지 번호
     academicGbn: 학력. 04=대졸(2~3년) · 05=대졸(4년)
     sortField/sortOrderBy : 최근등록일순

   ── `careerTypes=N`(신입)을 뺐다 (2026-09-07, 사용자 지적) ──
   사용자가 회사 리포트를 열어 보고 **"채용공고 있는 게 없는데?"** 라고 했다. 실제로
   주요 회사 20곳을 넣어 보니 **1곳**만 잡혔다. 원인은 커버리지가 아니라 이 필터였다:

     LG전자    필터 없음 47건 → 대졸 13건 → **신입 2건**
     CJ제일제당 필터 없음 82건 → 대졸 17건 → **신입 0건**

   회사 리포트가 답해야 할 질문은 "이 회사가 지금 뽑나" 다. 신입 공고만 남기면
   대부분의 회사가 **에러 없이 빈 칸**이 되고, 그건 "안 뽑는다" 로 읽힌다(18-4 에서
   0건의 이유를 셋으로 가른 것과 같은 문제다). 경력 조건은 카드에 그대로 적히니
   학생이 보고 거를 수 있다 — 우리가 미리 지울 값이 아니다.

   대신 받는 양이 는다: 3,851건 → **22,507건**(39페이지 → 226페이지). 하루 한 번이라
   감당된다. 학력 필터까지 풀면 132,313건이라 그건 안 푼다(용량 계산은 아래). */
const QUERY = {
  resultCnt: 100,
  academicGbn: '04,05',
  sortField: 'DATE',
  sortOrderBy: 'DESC',
};

function listUrl(page, query = {}) {
  const q = new URLSearchParams({ ...QUERY, ...query, pageIndex: String(page) });
  return `${ORIGIN}${LIST_PATH}?${q}`;
}

/* ── HTML 조각 → 사람이 읽는 문자열 ──────────────────────────
   태그를 지우고 엔티티를 푼다. 화면에서 온 값이라 &amp; 와 &nbsp; 가 섞여 있고,
   그대로 두면 회사명 대조(company-name.sameCompany)가 조용히 빗나간다. */
/* ── 엔티티만 푸는 것 (태그는 안 건드린다) ──────────────────
   체크박스 `value` 처럼 **속성 안에 든 값**은 태그가 없고 엔티티만 있다. 거기에
   태그 제거까지 하는 text() 를 쓰면 값 안의 `<` 가 태그로 오해된다. 반대로 엔티티를
   안 풀면 제목이 `&#039;26년 …` 으로 화면에 그대로 나간다 — 실제로 그랬다
   (2026-09-07 사용자 화면에서 발견). 그래서 둘을 나눈다. */
function unescapeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#0*(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    /* `&amp;` 는 **맨 마지막**에 푼다. 먼저 풀면 `&amp;lt;` 가 `<` 가 되어
       원문에 있던 글자가 태그처럼 보인다. */
    .replace(/&amp;/g, '&');
}

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

/* ── 제목·회사명을 읽는 두 가지 길 ──────────────────────────
   행이 두 종류다. **처음에는 한 종류만 읽어서 100건 중 14건을 버렸다** — 그런데
   버려진 쪽이 하필 `대기업`·`중견` 딱지가 붙은 **공채**였다(에이치디현대오일뱅크
   '2026년 하반기 신입사원 채용', 에이치엘만도 그룹 공채…). C:road 사용자가 가장
   보고 싶어 하는 공고가 통째로 빠지는 셈이었다.

   ① 비교검색 체크박스가 있는 행 — value 에 `인증번호|정보구분|회사명|공고제목` 이
      **온전히** 실려 온다. 본문 링크의 제목은 잘려 있어서("…모집합니...") 이쪽이 낫다
   ② 체크박스가 없는 행(공채·제휴 공고) — 회사명은 `a.cp_name`, 제목은 상세 링크의
      글자에서 읽는다. 이 제목은 **잘려 있을 수 있다**

   잘린 제목을 온전한 것처럼 넘기면 자소서 코치가 중간에서 끊긴 문장을 재료로 받는다.
   그래서 `titleTruncated` 로 표시해서 넘긴다 — 숨기지 않고 말한다. */
const CHK = /id="chkboxWantedAuthNo\d+"\s+value="([^"]*)"/;
const CP_NAME = /class="cp_name[^"]*"[^>]*>([\s\S]*?)<\/a>/;
const TITLE_A = /class="t3_sb underline_hover"[\s\S]*?>([\s\S]*?)<\/a>/;
const AUTH_NO = /wantedAuthNo=([^&"]+)/;
const INFO_TYPE = /infoTypeCd=([^&"]+)/;

/* 기업규모 딱지(`대기업`·`중견`·`코스피`·`가족`). 고용24 가 붙여 주는 값이고,
   학생이 공고를 고를 때 실제로 본다. 우리가 추정한 값이 아니라 그대로 옮긴다. */
const LABELS = /class="tbl_label[^"]*">([^<]*)</g;

/* 상세 주소. 목록에 상대경로로 있어서 절대주소로 바꾼다 — 화면이 그대로 <a> 에 쓴다. */
const HREF = /href="(\/wk\/a\/b\/1500\/empDetailAuthView\.do\?[^"]*)"/;

/* 마감일·등록일은 같은 칸에 `마감일 : 2026-11-04` 꼴로 온다. */
const CLOSE = /마감일\s*:\s*(\d{4})-(\d{2})-(\d{2})/;
const REG = /등록일\s*:\s*(\d{4})-(\d{2})-(\d{2})/;

/* '채용시까지' 는 마감일 칸이 아니라 옆의 스크립트가 판단한다(wantedYn='Y' 또는
   날짜가 2099). 마감일만 읽으면 상시채용이 D-30000 으로 나온다. */
const ALWAYS = /wantedYn\s*=\s*'Y'|var\s+date\s*=\s*'2099/;

/* 학력 쪽 값인가. '학력무관'·'대졸(4년)'·'고졸' 처럼 오고, 경력 쪽은 '신입'·'경력1년' 이다.
   '무관' 은 양쪽에 다 붙으므로(경력무관·학력무관) 앞 글자까지 봐야 갈린다. */
const EDU_WORD = /학력|졸|대학|석사|박사/;

/* 근무조건 칸(li.member) — `경력1년` · `학력무관` 처럼 두 개가 나란히 온다. */
const MEMBER = /<li class="member">([\s\S]*?)<\/li>/;
const REGION = /<li class="site">([\s\S]*?)<\/li>/;
const PAY = /<li class="dollar">([\s\S]*?)<\/li>/;

/* 정보제공처(고용24·사람인·잡코리아·인크루트). 고용24 는 제휴 사이트 공고를 함께
   싣는다 — 어디서 온 공고인지 화면에서 밝히려고 남긴다. */
const PROVIDER = /alt="정보제공처\s*([^"]+)"/;

/* 한 행(<tr id="listN">) → 공고 하나.
   **읽어야 할 것을 못 읽으면 null 을 준다.** 반쪽짜리 레코드를 통과시키면
   "수집은 됐는데 회사명이 빈" 공고가 캐시에 쌓이고, 화면에서야 발견된다. */
function parseRow(block) {
  const href = HREF.exec(block);
  const chk = CHK.exec(block);

  let id = null, infoTypeCd = null, company = null, title = null, truncated = false;

  if (chk) {
    const [authNo, info, co, ...rest] = chk[1].split('|');
    id = (authNo || '').trim();
    infoTypeCd = (info || '').trim() || null;
    /* 속성 값이라 엔티티가 그대로 들어 있다. 안 풀면 제목이 `&#039;26년 …` 으로
       화면까지 간다(2026-09-07 사용자 화면에서 발견). */
    company = unescapeEntities(co).trim();
    title = unescapeEntities(rest.join('|')).trim();   // 제목에 '|' 가 있어도 살린다
  } else {
    /* 공채·제휴 행. 인증번호는 상세 링크에서 꺼낸다. */
    id = href ? (AUTH_NO.exec(href[1])?.[1] || '').trim() : null;
    infoTypeCd = href ? (INFO_TYPE.exec(href[1])?.[1] || '').trim() || null : null;
    company = text(CP_NAME.exec(block)?.[1] || '');
    title = text(TITLE_A.exec(block)?.[1] || '');
    truncated = /\.\.\.$|…$/.test(title);
    title = title.replace(/\s*(\.\.\.|…)$/, '').trim();
  }

  /* **읽어야 할 것을 못 읽으면 null 을 준다.** 반쪽짜리 레코드를 통과시키면
     "수집은 됐는데 회사명이 빈" 공고가 캐시에 쌓이고, 화면에서야 발견된다. */
  if (!id || !company || !title) return null;

  const close = CLOSE.exec(block);
  const reg = REG.exec(block);
  const member = MEMBER.exec(block);
  const parts = member ? text(member[1]).split(' ').filter(Boolean) : [];

  return {
    id,
    infoTypeCd,
    company,
    title,
    titleTruncated: truncated,
    url: href ? ORIGIN + href[1].replace(/&amp;/g, '&') : null,
    /* 다른 소스(잡알리오)와 같은 YYYYMMDD 로 맞춘다. company-name.dday 가 둘 다 읽는다.
       **상시채용이어도 마감일은 버리지 않는다.** 화면은 '상시' 로 그리지만, 값을
       지워 두면 나중에 정렬이나 정리에 쓸 수 없다 — 판단은 읽는 쪽이 한다. */
    closeDate: close ? close[1] + close[2] + close[3] : null,
    always: ALWAYS.test(block),
    postedDate: reg ? reg[1] + reg[2] + reg[3] : null,
    /* 경력·학력이 한 칸에 붙어 온다. **자리로 가르지 않는다** — 한쪽이 비면 학력이
       경력 자리로 밀려 '학력무관 경력' 같은 값이 조용히 들어온다. 글자로 가른다. */
    career: parts.find(p => !EDU_WORD.test(p)) || null,
    edu: parts.find(p => EDU_WORD.test(p)) || null,
    region: REGION.test(block) ? text(REGION.exec(block)[1]) : null,
    pay: PAY.test(block) ? text(PAY.exec(block)[1]) : null,
    provider: PROVIDER.test(block) ? PROVIDER.exec(block)[1].trim() : null,
    labels: [...block.matchAll(LABELS)].map(m => m[1].trim()).filter(Boolean),
  };
}

/* 목록 HTML → { total, items }.
   total 은 화면의 '검색건수' 다. 우리가 센 건수와 다르면 수집기가 그걸로 판단한다. */
function parseList(html) {
  const s = String(html || '');
  const totalM = /검색건수\s*<span class="txt_total">([\d,]+)<\/span>/.exec(s);
  const total = totalM ? Number(totalM[1].replace(/,/g, '')) : null;

  const items = [];
  const rows = s.split(/<tr id="list\d+"/).slice(1);
  let dropped = 0;
  for (const r of rows) {
    const row = parseRow(r);
    if (row) items.push(row); else dropped++;
  }
  return { total, items, rows: rows.length, dropped };
}

/* ── 파서가 조용히 깨졌는지 본다 ────────────────────────────
   화면이 개편되면 정규식이 안 맞아 **행은 세는데 필드가 빈다.** 그 상태로 저장하면
   에러 없이 캐시가 망가지고, 며칠 뒤 학생 화면에서 발견된다(6-3 부류).
   그래서 수집기가 저장 전에 이걸 부른다 — 무엇이 몇 % 비었는지 말한다. */
function sanity(items) {
  const n = items.length;
  const rate = f => (n ? items.filter(f).length / n : 0);
  return {
    count: n,
    withUrl: rate(j => j.url),
    withClose: rate(j => j.closeDate || j.always),
    withRegion: rate(j => j.region),
    /* 링크와 마감(또는 상시)은 화면의 전제다 — 눌러서 공고로 가고, D-day 를 띄운다.
       9할 밑으로 떨어지면 파서가 화면 개편을 못 따라간 것으로 본다. */
    ok: n > 0 && rate(j => j.url) >= 0.9 && rate(j => j.closeDate || j.always) >= 0.9,
  };
}

module.exports = { parseList, parseRow, sanity, listUrl, text, unescapeEntities, ORIGIN, LIST_PATH, QUERY };
