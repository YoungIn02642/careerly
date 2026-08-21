/* ════════════════════════════════════════════════════════════
   채용공고 URL → 본문 텍스트

   ── 왜 필요한가 (사용자 지적 2026-08-21) ──
   자소서 코치는 공고 원문을 붙여넣어야 역량을 뽑는다. 그런데 요즘 공고는
   **복사를 막아 둔 곳이 많다.** 우클릭·드래그·선택 차단은 거의 전부 **클라이언트
   JS** 라, 서버가 그 페이지를 가져오면 애초에 존재하지 않는다. 주소만 받으면 된다.

   ── 크롤링이 아니다 ──
   사용자가 준 주소 **한 건**을 그 사람 대신 열어 주는 것이다. 목록을 훑거나 쌓아
   두지 않는다(그건 25-2 에서 안 하기로 한 것이다). 결과도 저장하지 않는다 —
   화면의 입력칸을 채우고 끝이다.

   ── 못 하는 것을 분명히 한다 ──
   로그인 벽 안의 공고, JS 로 그리는 페이지, 이미지로 된 공고는 못 가져온다.
   같은 '실패' 라도 사용자가 할 일이 달라서 **사유를 갈라서** 돌려준다(18-4 와 같은 원칙).

   ── 남의 서버로 우리 서버를 조종하지 못하게 한다 ──
   사용자가 준 주소를 서버가 그대로 여는 기능은 **SSRF** 의 정석이다. `127.0.0.1`,
   사설망, 클라우드 메타데이터(169.254.169.254) 를 넣으면 우리 내부를 대신 읽어 준다.
   그래서 주소를 **DNS 로 풀어 실제 IP 를 보고** 막고, 리다이렉트도 매 홉마다 다시 본다
   (한 번만 검사하면 첫 응답이 내부 주소로 넘겨 버린다).
   ════════════════════════════════════════════════════════════ */
const dns = require('dns').promises;

const TIMEOUT_MS = Number(process.env.POSTING_FETCH_TIMEOUT_MS || 12000);
const MAX_BYTES = Number(process.env.POSTING_FETCH_MAX_BYTES || 3 * 1024 * 1024);
const MAX_HOPS = 3;
/* 브라우저인 척하지 않는다. 우리가 누구인지 밝히고, 막을 곳은 막게 둔다 —
   막힌 것을 뚫는 기능이 아니라 복사 차단을 우회할 필요를 없애는 기능이다. */
const UA = 'Mozilla/5.0 (compatible; croad/1.0; +https://github.com/YoungIn02642/croad)';

/* ── 내부망 주소인가 ─────────────────────────────────────── */
function isPrivateV4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127
    || (a === 100 && b >= 64 && b <= 127)          // CGNAT
    || (a === 169 && b === 254)                    // 링크로컬 · 클라우드 메타데이터
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;                                   // 멀티캐스트 · 예약
}

function isPrivateIp(ip, family) {
  if (family === 4) return isPrivateV4(ip);
  const s = String(ip).toLowerCase();
  if (s === '::' || s === '::1') return true;
  /* ::ffff:10.0.0.1 처럼 v4 를 품은 v6 는 안쪽을 봐야 한다. */
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  return /^(fc|fd)/.test(s)        // ULA
    || /^fe[89ab]/.test(s);        // 링크로컬
}

/* 주소가 열어도 되는 것인지. 통과하면 null, 아니면 사유 문자열. */
async function urlProblem(raw) {
  let u;
  try { u = new URL(raw); } catch { return '주소 형식이 아닙니다.'; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'http · https 주소만 열 수 있습니다.';
  if (!u.hostname) return '주소에 호스트가 없습니다.';

  let addrs;
  try { addrs = await dns.lookup(u.hostname, { all: true }); }
  catch { return '주소를 찾을 수 없습니다. 오타가 없는지 확인해 주세요.'; }
  /* 하나라도 내부 주소면 막는다 — 여러 개 중 골라 붙는 것이라 하나만 안전해도 소용없다. */
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address, a.family))) {
    return '내부망 주소는 열 수 없습니다.';
  }
  return null;
}

/* ── HTML → 사람이 읽는 글 ───────────────────────────────
   DOM 파서를 넣지 않았다(프론트에 빌드가 없고 서버도 의존성을 늘리지 않는다는
   기존 판단과 같은 결). 대신 **덜어내는 순서**를 지킨다 — 스크립트를 먼저 지우지
   않으면 그 안의 문자열이 본문으로 딸려 온다. */
function extractText(html) {
  let s = String(html || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style|noscript|svg|head|iframe|template)\b[\s\S]*?<\/\1>/gi, ' ');
  /* 머리·꼬리·메뉴는 회사마다 같은 말이 들어 있어 역량 추출을 어지럽힌다. */
  s = s.replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');
  /* 줄바꿈이 사라지면 문단이 한 줄로 붙어 근거 문장을 못 가른다. */
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|li|tr|h[1-6]|section|article|table)>/gi, '\n');
  s = s.replace(/<\/t[dh]>/gi, '\t');
  s = s.replace(/<[^>]+>/g, ' ');

  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
       .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
       .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
       .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

  return s.split('\n')
    .map(line => line.replace(/[ \t ]+/g, ' ').trim())
    .filter((line, i, arr) => line || (arr[i - 1] || '').length)   // 빈 줄 연속은 하나로
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function titleOf(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  return m ? extractText(m[1]).slice(0, 120) : null;
}

/* 본문이라 부를 만한 분량인가. 공고는 아무리 짧아도 자격요건 몇 줄은 된다.
   이보다 적으면 JS 로 그리는 페이지이거나 이미지 공고다. */
const MIN_CHARS = 200;

/* ── 공고다운가 (실측 2026-08-21) ──────────────────────────
   사람인 공고 주소를 넣었더니 **1,280자를 가져왔는데 전부 메뉴와 개인정보 안내문**
   이었다. 상세 내용이 iframe 안에 있어서다. 길이만 보면 성공이라 그대로 넘겼을 텐데,
   그러면 "구직자의 개인정보는 채용 활동 외의 목적으로 사용하지 않습니다" 가 역량의
   근거로 붙는다 — 18-7 에서 겪은 그대로다. 에러가 안 나서 더 나쁘다.

   그래서 **공고에만 나오는 말**이 있는지 본다. 사이트별 파서를 만들지는 않는다
   (25-2 에서 안 하기로 한 것이다). 없다고 버리지도 않는다 — 가져온 것은 주되
   화면이 '확인하라' 고 다르게 말하게 flag 만 세운다. 지우는 것보다 의심하게 하는 게 낫다. */
const POSTING_WORDS = /담당업무|주요업무|자격\s?요건|지원\s?자격|우대\s?사항|모집\s?분야|모집\s?부문|근무\s?조건|전형\s?절차|접수\s?기간|지원\s?방법/g;

function postingHits(text) {
  return new Set(String(text).match(POSTING_WORDS) || []).size;
}

/* 머리쪽 메뉴를 걷어낸다. 공고 낱말이 처음 나오는 자리부터가 본문일 확률이 높다 —
   그 앞이 짧으면 굳이 손대지 않는다(제목까지 날릴 수 있다). */
function trimLead(text) {
  const m = text.match(POSTING_WORDS);
  if (!m) return text;
  const at = text.indexOf(m[0]);
  if (at < 120) return text;
  /* 낱말이 든 줄부터 살린다 — 줄 중간에서 자르면 첫 줄이 반토막 난다. */
  const lineStart = text.lastIndexOf('\n', at) + 1;
  return text.slice(lineStart).trim();
}

/* ── 가져오기 ────────────────────────────────────────────
   실패를 kind 로 가른다. 같은 '안 됨' 이라도 사용자가 할 일이 다르다. */
async function fetchPosting(raw) {
  const bad = await urlProblem(raw);
  if (bad) return { ok: false, kind: 'bad-url', message: bad };

  let url = raw;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',          // 홉마다 다시 검사한다 — 리다이렉트로 내부망에 들어갈 수 있다
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const timeout = /timeout|aborted/i.test(e.message);
      return {
        ok: false, kind: 'error',
        message: timeout ? '공고 페이지가 제때 응답하지 않았습니다.' : '공고 페이지를 열지 못했습니다.',
      };
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const next = new URL(res.headers.get('location'), url).toString();
      const problem = await urlProblem(next);
      if (problem) return { ok: false, kind: 'bad-url', message: problem };
      url = next;
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false, kind: 'blocked',
        message: '이 사이트는 로그인해야 보이거나 외부에서 여는 것을 막아 두었어요.',
      };
    }
    if (res.status === 404 || res.status === 410) {
      return { ok: false, kind: 'gone', message: '공고를 찾을 수 없습니다 — 마감돼 내려갔을 수 있어요.' };
    }
    if (!res.ok) {
      return { ok: false, kind: 'error', message: `공고 페이지가 오류를 돌려줬어요 (HTTP ${res.status}).` };
    }

    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (/^image\//.test(type)) {
      return {
        ok: false, kind: 'image',
        message: '이미지로 된 공고예요. 지금은 이미지에서 글자를 읽지 못합니다.',
      };
    }
    if (type && !/text\/html|application\/xhtml|text\/plain/.test(type)) {
      return { ok: false, kind: 'error', message: '이 주소는 웹페이지가 아니에요.' };
    }

    const size = Number(res.headers.get('content-length') || 0);
    if (size && size > MAX_BYTES) {
      return { ok: false, kind: 'error', message: '공고 페이지가 너무 큽니다.' };
    }

    const html = (await res.text()).slice(0, MAX_BYTES);
    const text = trimLead(extractText(html));
    if (text.length < MIN_CHARS) {
      return {
        ok: false, kind: 'empty',
        title: titleOf(html),
        message: '페이지는 열렸는데 본문 글을 찾지 못했어요 — 공고가 이미지이거나, 화면에서 그려지는 방식일 수 있어요.',
      };
    }
    /* weak = 가져오긴 했는데 공고 같지 않다. 화면이 다른 색으로 경고한다. */
    return { ok: true, text, title: titleOf(html), url, weak: postingHits(text) < 2 };
  }

  return { ok: false, kind: 'error', message: '주소가 계속 다른 곳으로 넘겨서 멈췄어요.' };
}

module.exports = {
  fetchPosting, extractText, titleOf, urlProblem,
  postingHits, trimLead, _MIN_CHARS: MIN_CHARS,
};
