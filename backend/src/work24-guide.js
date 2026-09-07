/* ════════════════════════════════════════════════════════════
   고용24 '직무별 자소서 작성가이드' → 직무기술서

   ── 왜 필요한가 (사용자 지시 2026-09-05) ──
   자소서 코치 3번 칸(직무기술서)은 지금까지 **사용자가 어디선가 구해 와야** 하는
   칸이었다. 그런데 공고에는 "모집분야: 경영지원" 한 줄만 있고 직무 설명은 없는 일이
   대부분이라, 이 칸은 거의 늘 비어 있었다.

   고용24 가 공채 기업의 **직무별 자소서 작성가이드**를 1,853건 공개해 두었다
   (https://www.work24.go.kr/wk/r/d/1150/retrieveSelfintroWriteGuideViewList.do).
   한 건에 들어 있는 것:
     · 직무 소개 · 조직 소개 · 주요 업무
     · 필요 역량 (키워드 + 설명 문장)
     · 전공 분야 · 필수 사항 · 우대 사항
     · 그 회사의 실제 자소서 문항 (+ 문항별 작성 가이드)
   앞의 여섯은 정확히 직무기술서 칸이 원하는 것이고, 문항은 4번 칸이 원하는 것이다.

   ── 이건 크롤링이 아니다 ──
   posting-fetch.js 와 같은 원칙이다. 사용자가 검색해서 **고른 한 건**을 그 사람 대신
   열어 준다. 목록을 훑어 쌓아 두지 않고(그건 25-2 에서 안 하기로 했다), 결과도
   저장하지 않는다 — 화면의 입력칸을 채우고 끝이다.

   ── 원문을 요약하지 않는다 ──
   가져온 문장을 줄이거나 고쳐 쓰지 않는다. 요약은 없는 사실을 만들고, 학생은 그걸
   자소서에 쓴다(11-2 와 같은 원칙). 여기서 하는 일은 HTML 을 걷어내고 구역 이름을
   붙여 한 장의 글로 잇는 것뿐이다.

   ── 주소는 우리가 만든다 (SSRF 가 아니다) ──
   사용자가 주는 것은 검색어와 가이드 번호(숫자)뿐이다. 호스트·경로는 이 파일에
   박혀 있고 번호는 정수만 통과시킨다 — posting-fetch.js 가 하는 DNS 검사가
   여기서는 필요 없는 이유다.
   ════════════════════════════════════════════════════════════ */

const ORIGIN = 'https://www.work24.go.kr';
const LIST_PATH = '/wk/r/d/1150/retrieveSelfintroWriteGuideViewList.do';
const VIEW_PATH = '/wk/r/d/1150/plcmtSrchList.do';
const TIMEOUT_MS = Number(process.env.WORK24_GUIDE_TIMEOUT_MS || 12000);
/* posting-fetch.js 와 같은 UA — 브라우저인 척하지 않는다. */
const UA = 'Mozilla/5.0 (compatible; croad/1.0; +https://github.com/YoungIn02642/croad)';

/* ── HTML 조각 → 글자 ──────────────────────────────────────
   고용24 가이드 본문은 &nbsp; 로 띄어쓰기를 하고 <br> 로 줄을 바꾼다. 그래서
   nbsp 를 공백으로 되돌리고 br 을 개행으로 바꾸는 순서가 곧 본문의 모양이다. */
function textOf(html) {
  let s = String(html || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
       .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
       .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
       .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
       .replace(/&amp;/gi, '&');          // amp 는 마지막에 — 먼저 풀면 &amp;lt; 가 <가 된다
  return s.split('\n')
    .map(l => l.replace(/[\s ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* 한 줄짜리 값(제목·회사명)은 개행까지 공백으로 눕힌다. */
const lineOf = html => textOf(html).replace(/\s*\n\s*/g, ' ').trim();

/* ── 목록 한 장 ─────────────────────────────────────────── */

/* 결과 표를 caption 으로 찾는다. 같은 class 의 표가 검색조건에도 있어서
   class 만으로 고르면 엉뚱한 표를 읽는다. */
const LIST_CAPTION = /<caption>\s*공채년도[\s\S]*?<\/caption>/;

function parseList(html) {
  const s = String(html || '');
  const total = Number((s.match(/txt_total[^>]*>\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || 0);

  const at = s.search(LIST_CAPTION);
  if (at < 0) return { total, rows: [] };
  const body = s.slice(at, s.indexOf('</table>', at));

  const rows = [];
  for (const m of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const tr = m[1];
    const key = tr.match(/otpbEpaNo\s*:\s*'(\d+)'[\s\S]*?otpbEmpnRcitNo\s*:\s*'(\d+)'[\s\S]*?sfidGuidNo\s*:\s*'(\d+)'/);
    if (!key) continue;                       // thead 와 빈 줄

    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(t => t[1]);
    /* 회사명·직무명은 f_infoView 를 단 링크 두 개다. 로고 칸(img alt)에도 회사명이
       있지만 로고가 없는 회사는 alt 도 없다 — 링크 쪽이 언제나 있다. */
    const links = [...tr.matchAll(/<a[^>]*f_infoView[\s\S]*?>([\s\S]*?)<\/a>/g)].map(a => lineOf(a[1]));
    /* 첫 칸은 "2026 / 하반기 / 공채 진행중" 이 줄로도 칸으로도 붙는다 — 줄 번호로
       세지 않고 생김새로 고른다(라벨이 하나 늘면 반기가 밀린다). */
    const head = textOf(tds[0] || '');

    rows.push({
      epa: key[1], rcit: key[2], guid: key[3],
      year: (head.match(/\b(20\d{2})\b/) || [])[1] || '',
      half: (head.match(/(상반기|하반기)/) || [])[1] || '',
      /* '공채 진행중' 라벨 — 마감된 공고의 가이드도 그대로 남아 있어서 구분이 필요하다. */
      open: /진행중/.test(tds[0] || ''),
      company: links[0] || '',
      job: links[1] || '',
      views: Number(lineOf(tds[tds.length - 1] || '').replace(/[^\d]/g, '') || 0),
    });
  }
  return { total, rows };
}

/* ── 가이드 한 건 ───────────────────────────────────────── */

/* 상세 페이지 아래쪽에는 '같은 분야 다른 가이드' 목록이 같은 표로 또 붙는다.
   거기까지 읽으면 남의 회사 직무명이 이 직무기술서에 섞인다.

   스크립트를 **먼저** 걷어낸다. 잘라 낼 표시("관련 직무별 …")와 같은 말이 페이지
   위쪽 스크립트 주석에 들어 있어서, 그대로 찾으면 본문이 시작하기도 전에 잘린다
   (실측 — 이 함수가 빈 가이드를 돌려주던 원인). */
function guideBody(html) {
  const s = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  const from = Math.max(s.indexOf('hpwkrd1150l02'), 0);
  const cut = s.indexOf('관련 직무별 자기소개서 작성 가이드', from);
  return s.slice(from, cut < 0 ? s.length : cut);
}

/* `<h3 …>제목</h3> … <ul class="box_list_area"> … </ul>` 를 제목 → 항목들로. */
function sections(body) {
  const out = new Map();
  for (const m of body.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|<div class="box_table_wrap|$)/g)) {
    const title = lineOf(m[1]);
    const ul = m[2].match(/<ul class="box_list_area">([\s\S]*?)<\/ul>/);
    if (!ul) continue;
    const items = [...ul[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
      .map(li => textOf(li[1]).replace(/^[-·•]\s*/, '').replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean);
    /* 제목이 빈 h3 도 버리지 않는다 — 필요 역량 설명이 **제목 없는 묶음**으로
       붙어 있다(고용24 가 키워드 칩과 설명을 따로 그리면서 h3 를 비워 뒀다). */
    if (items.length && !out.has(title)) out.set(title, items);
  }
  return out;
}

function parseGuide(html) {
  const body = guideBody(html);

  const headline = lineOf((body.match(/<strong class="point_color02">([\s\S]*?)<\/strong>/) || [])[1] || '');
  const head = headline.split(/\s+/);
  const posting = lineOf((body.match(/f_empInfoDetailPopup\([^)]*\)[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '');
  const period = lineOf((body.match(/<p class="b1_r mt16">([\s\S]*?)<\/p>/) || [])[1] || '')
    .replace(/^접수기간\s*:\s*/, '');
  const job = lineOf((body.match(/<span class="pop_subtl[^"]*">([\s\S]*?)<\/span>/) || [])[1] || '');
  const link = ((body.match(/window\.open\('(https?:\/\/[^']+)'\)/) || [])[1] || '') || null;

  /* 직무 소개·조직 소개·주요 업무가 한 덩이로 들어 있는 칸. 회사가 적어 넣은 그대로라
     안쪽 소제목이 있을 때도 없을 때도 있다 — 쪼개지 않고 통째로 옮긴다. */
  const about = textOf((body.match(/<div class="box_txt_list">([\s\S]*?)<\/div>/) || [])[1] || '');

  const keywords = [...body.matchAll(/<span class="tbl_label round">([\s\S]*?)<\/span>/g)]
    .map(m => lineOf(m[1])).filter(Boolean);

  const sec = sections(body);
  /* 필요 역량 설명은 h3 가 비어 있는 채로(<h3 …></h3>) 붙어 있다 — 제목 없는 첫
     묶음이 그것이다. 제목이 붙는 날이 와도 '역량' 이 들어간 제목으로 다시 찾는다. */
  const byTitle = name => {
    const key = [...sec.keys()].find(k => k.replace(/\s/g, '').includes(name));
    return key === undefined ? [] : (sec.get(key) || []);
  };

  const tips = [...body.matchAll(/<caption>\s*주요 Tip[\s\S]*?<\/caption>([\s\S]*?)<\/table>/g)]
    .flatMap(m => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(td => lineOf(td[1])))
    .filter(Boolean);

  /* 문항 = '무엇을 묻는지(type)' + 문항 원문(strong) + 문항별 가이드(speaker 칸). */
  const questions = [];
  for (const m of body.matchAll(/<div class="ico_txt memo_edit[^"]*">([\s\S]*?)<\/div>([\s\S]*?)(?=<div class="ico_txt memo_edit|$)/g)) {
    const p = m[1].match(/<p[^>]*>([\s\S]*?)<\/p>/);
    if (!p) continue;
    const strong = p[1].match(/<strong>([\s\S]*?)<\/strong>/);
    const text = lineOf(strong ? strong[1] : '');
    if (!text) continue;
    const type = lineOf(p[1].replace(/<strong>[\s\S]*?<\/strong>/, ''));
    const g = m[2].match(/<div class="ico_txt speaker[^"]*">([\s\S]*?)<\/div>/);
    questions.push({ type, text, guide: g ? textOf(g[1]) : '' });
  }

  return {
    company: head[head.length - 1] || '',
    year: head[0] || '',
    half: head[1] || '',
    posting, period, job, link, about, keywords, tips, questions,
    /* 역량 설명은 제목이 비어 있다 — 제목으로 못 찾으면 그 빈 묶음을 쓴다.
       제목이 붙는 날이 오면 위쪽(byTitle)이 먼저 잡는다. */
    competencies: byTitle('역량').length ? byTitle('역량') : (sec.get('') || []),
    majors: byTitle('전공'),
    required: byTitle('필수'),
    preferred: byTitle('우대'),
  };
}

/* ── 가이드 → 직무기술서 칸에 넣을 글 ────────────────────────
   구역 머리말은 **jd-competency.js 의 SECTION_HEAD 가 아는 말**로 적는다. 모르는
   머리말은 근거 문장으로 뽑혀 "[필요 역량]" 이 역량의 근거가 된다(18-7 실패 모드).
   문항별 작성 가이드는 넣지 않는다 — 저건 '어떻게 쓸지' 이지 '직무가 무엇인지' 가
   아니라서, 여기 섞으면 고용24 의 작성 요령이 이 회사의 요구 역량으로 잡힌다. */
function toJdText(g) {
  const block = (head, lines) => (lines && lines.length)
    ? `[${head}]\n${lines.map(l => `- ${l}`).join('\n')}`
    : null;

  return [
    `[모집분야] ${[g.company, g.job].filter(Boolean).join(' · ')}`,
    g.about ? `[주요업무]\n${g.about}` : null,
    /* 키워드 칩과 설명 문장은 **한 덩이**로 붙인다. 머리말을 두 번 적으면 같은
       구역이 둘로 보인다. */
    (g.keywords?.length || g.competencies?.length)
      ? [`[필요역량]${g.keywords?.length ? ` ${g.keywords.join(' · ')}` : ''}`,
         ...(g.competencies || []).map(l => `- ${l}`)].join('\n')
      : null,
    block('전공분야', g.majors),
    block('필수사항', g.required),
    block('우대사항', g.preferred),
    `[출처] 고용24 직무별 자소서 작성가이드${g.year ? ` (${[g.year, g.half].filter(Boolean).join(' ')} 공채)` : ''}`,
  ].filter(Boolean).join('\n\n');
}

/* ── 부르기 ─────────────────────────────────────────────── */

async function get(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'ko-KR,ko' },
    });
    if (!res.ok) throw new Error(`고용24 응답 ${res.status}`);
    return await res.text();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('고용24 응답이 너무 느려요. 잠시 후 다시 시도해 주세요.');
    throw new Error('고용24에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  } finally {
    clearTimeout(timer);
  }
}

const digits = v => (/^\d{1,12}$/.test(String(v ?? '')) ? String(v) : null);

function listUrl({ q = '', year = '', size = 30, page = 1 } = {}) {
  const p = new URLSearchParams({
    currentPageNo: String(Math.max(1, Number(page) || 1)),
    pageIndex: String(Math.max(1, Number(page) || 1)),
    recordCountPerPage: String([10, 30, 50].includes(Number(size)) ? Number(size) : 30),
  });
  /* 검색어는 기업명 또는 직무명 하나로 받는다 — 고용24 검색칸이 그렇게 생겼다. */
  if (String(q).trim()) p.set('searchEmpCoNm', String(q).trim().slice(0, 60));
  if (/^\d{4}$/.test(String(year))) p.set('searchOtpbEmpnYear', String(year));
  return `${ORIGIN}${LIST_PATH}?${p}`;
}

function guideUrl({ epa, rcit = '1', guid = '1' }) {
  const [a, b, c] = [digits(epa), digits(rcit), digits(guid)];
  if (!a || !b || !c) return null;
  return `${ORIGIN}${VIEW_PATH}?currentPageNo=1&pageIndex=1&pageUnit=0`
    + `&otpbEpaNo=${a}&otpbEmpnRcitNo=${b}&sfidGuidNo=${c}`;
}

async function search(opts) {
  return parseList(await get(listUrl(opts)));
}

async function guide(keys) {
  const url = guideUrl(keys);
  if (!url) throw new Error('가이드 번호가 올바르지 않아요.');
  const g = parseGuide(await get(url));
  /* 번호는 맞는데 내용이 안 잡히면 페이지 구조가 바뀐 것이다. 빈 껍데기를 성공으로
     돌려주면 화면이 빈 칸을 채우고 "가져왔다" 고 말한다 — 그게 제일 나쁘다. */
  if (!g.about && !g.competencies.length && !g.required.length) {
    throw new Error('그 가이드에서 직무 내용을 찾지 못했어요. 고용24에서 직접 확인해 주세요.');
  }
  return { ...g, url, jdText: toJdText(g) };
}

module.exports = {
  parseList, parseGuide, toJdText, listUrl, guideUrl, search, guide,
  ORIGIN, LIST_PATH, VIEW_PATH,
};
