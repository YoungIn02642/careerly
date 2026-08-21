/* 자사 채용페이지 표 점검 — data/career-pages.json 의 링크가 실제로 열리는지 본다.

     node scripts/check-career-pages.js              # 표에 있는 것 전부 확인
     node scripts/check-career-pages.js --skeleton   # 아직 안 채운 대기업 목록을 뽑는다

   ── 왜 스크립트로 확인하나 ──
   이 표는 손으로 채운다. 손으로 채운 값은 조용히 썩는다 — 회사가 채용 도메인을
   바꾸면 우리는 학생을 404 로 보내게 되고, 그건 사람인 링크만도 못하다.
   커밋 전에 한 번, 그리고 가끔 돌려서 죽은 링크를 걷어낸다.

   ── '열린다'의 기준 ──
   최종 응답이 2xx 면 통과로 본다. 내용까지 보지는 않는다 — 채용페이지는 대부분
   JS 로 그려서 정적 HTML 에 '채용' 이라는 글자가 없는 경우가 흔하다. 여기서 잡으려는
   것은 **도메인이 죽었거나 주소가 바뀐 것**이지 페이지 내용이 아니다.

   접속이 아예 안 되면(000/타임아웃) 이 실행 환경의 네트워크일 수도 있으므로
   **자동으로 지우지 않는다.** 사람이 보고 판단한다. */
const path = require('path');
const CAREER = require('../src/career-pages');
const pagesFile = require(CAREER._file);

const UA = 'Mozilla/5.0 (compatible; croad-linkcheck/1.0)';
const TIMEOUT_MS = Number(process.env.LINK_CHECK_TIMEOUT_MS || 20000);

async function check(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { ok: res.ok, status: res.status, final: res.url };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

/* 아직 안 채운 대기업을 뽑는다. 지원이 몰리는 곳부터 채우는 게 값이 크다 —
   중견·공공까지 한 번에 채우려 들면 아무것도 안 끝난다. */
function skeleton() {
  const S = require('../src/company-sectors');
  const tree = S.industryTree();
  if (!tree.total) {
    console.log(`회사 목록이 비어 있습니다 — ${tree.reason}`);
    return;
  }
  const big = [];
  (function walk(node) {
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(c => { if (c.s === 'large') big.push(c.n); });
      else walk(v);
    }
  })(tree.tree);

  const missing = big.filter(n => !CAREER.urlOf(n)).sort((a, b) => a.localeCompare(b, 'ko'));
  console.log(`대기업 ${big.length}곳 중 ${big.length - missing.length}곳 채움 · ${missing.length}곳 남음\n`);
  console.log('아래를 data/career-pages.json 의 pages 에 붙여넣고 URL 을 채우세요.');
  console.log('(모르는 회사는 지우세요 — 빈 값이 있으면 무시되지만 표만 지저분해집니다)\n');
  console.log(missing.map(n => `    ${JSON.stringify(n)}: "",`).join('\n'));
}

(async () => {
  if (process.argv.includes('--skeleton')) return skeleton();

  const pages = Object.entries(pagesFile.pages || {});
  if (!pages.length) {
    console.log('표가 비어 있습니다. --skeleton 으로 채울 목록을 먼저 뽑으세요.');
    return;
  }

  console.log(`자사 채용페이지 ${pages.length}건 확인 (제한 ${TIMEOUT_MS / 1000}초)\n`);
  let ok = 0; const bad = [];
  for (const [name, url] of pages) {
    const r = await check(url);
    if (r.ok) {
      ok++;
      /* 최종 주소가 다르면 알려준다 — 리다이렉트가 계속 걸리면 표를 갱신하는 게 낫다. */
      const moved = r.final && r.final.replace(/\/$/, '') !== url.replace(/\/$/, '');
      console.log(`  OK    ${name.padEnd(12)} ${url}${moved ? `  → ${r.final}` : ''}`);
    } else {
      bad.push([name, url, r.error || `HTTP ${r.status}`]);
      console.log(`  실패  ${name.padEnd(12)} ${url}  (${r.error || `HTTP ${r.status}`})`);
    }
  }

  console.log(`\n${ok}건 정상 / ${bad.length}건 실패`);
  if (bad.length) {
    console.log('\n실패한 것은 셋 중 하나입니다 — 눈으로 열어 보고 판단하세요:');
    console.log('  · 주소가 바뀌었다        → 표를 고친다');
    console.log('  · 회사가 채용페이지를 닫았다 → 표에서 뺀다(검색 링크로 물러난다)');
    console.log('  · 이 환경에서만 막힌다     → 그대로 둔다 (WAF·지역 차단)');
  }
  /* 실패해도 0 으로 끝낸다. 세 번째 경우가 있어서 이걸로 빌드를 막으면 안 된다. */
})();
