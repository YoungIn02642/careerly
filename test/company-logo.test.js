/* 회사 로고 — src/company-logo.js

   네트워크를 부르지 않는다(로고를 실제로 내려받는 부분만 빼고 전부 여기서 검증된다).

   ── 이 테스트가 지키는 것 둘 ──
   1) **정규식을 문자열로 조립하지 않는다.** 처음에 `new RegExp('...\\s...')` 로 짰다가
      이스케이프가 풀려 삼성 페이지의 `<link rel="shortcut icon">` 을 통째로 놓쳤다.
      **에러가 안 났다** — 후보가 0개일 뿐이라 "로고 없는 회사"로 조용히 넘어갔다.
   2) **화면이 주소를 고르지 못한다.** 로고 라우트는 회사명만 받고, 주소는 서버가
      DART 에서 받아 적어 둔 것만 쓴다. 여기가 뚫리면 우리 서버가 남의 주소를
      대신 여는 통로가 된다(posting-fetch 의 SSRF 와 같은 이야기).
*/
const fs = require('fs');
const path = require('path');
const L = require('../backend/src/company-logo.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

/* 실제 회사 페이지의 <head> 에서 옮긴 모양들. 삼성은 `shortcut icon` 만 있고
   apple-touch-icon 의 href 가 비어 있다 — 실제로 그렇다(2026-09-06 확인). */
const SAMSUNG = `<head>
  <meta property="og:image" content="">
  <link rel="shortcut icon" href="/sec/static/_images/favicon.ico">
  <link rel="apple-touch-icon" href="" sizes="">
</head>`;

const RICH = `<head>
  <link rel="apple-touch-icon" sizes="180x180" href="/static/touch-icon.png">
  <meta property="og:image" content="https://cdn.example.com/og.png">
  <link rel="icon" type="image/png" href="/favicon-32.png">
</head>`;

(async () => {
  console.log('── 1. 로고 후보를 골라낸다 ──');
  const sam = L.candidates(SAMSUNG, 'https://www.samsung.com/sec/');
  ok('shortcut icon 을 놓치지 않는다',
    sam.includes('https://www.samsung.com/sec/static/_images/favicon.ico'), `→ ${sam.length}개`);
  ok('href 가 빈 태그는 담지 않는다', !sam.some(u => u.endsWith('/sec/')), `→ ${sam.join(' ')}`);
  ok('마지막 보루로 /favicon.ico 를 둔다', sam[sam.length - 1] === 'https://www.samsung.com/favicon.ico');

  const rich = L.candidates(RICH, 'https://example.co.kr/');
  ok('큰 것부터 본다 — apple-touch-icon 이 첫째',
    rich[0] === 'https://example.co.kr/static/touch-icon.png', `→ ${rich[0]}`);
  ok('  og:image 가 둘째', rich[1] === 'https://cdn.example.com/og.png', `→ ${rich[1]}`);
  ok('  파비콘은 그다음', rich[2] === 'https://example.co.kr/favicon-32.png', `→ ${rich[2]}`);
  ok('같은 주소를 두 번 담지 않는다', new Set(rich).size === rich.length);

  console.log('\n── 2. 아이콘이 하나도 없는 페이지 ──');
  const bare = L.candidates('<head><title>회사</title></head>', 'https://bare.co.kr/');
  ok('그래도 /favicon.ico 는 시도한다', bare.length === 1 && bare[0] === 'https://bare.co.kr/favicon.ico');

  console.log('\n── 3. 호스트를 뽑는다 ──');
  ok('www 를 뗀다', L.hostOf('https://www.kakaocorp.com/page/') === 'kakaocorp.com');
  ok('스킴이 없어도 읽는다', L.hostOf('lg.co.kr') === 'lg.co.kr');
  ok('대문자를 낮춘다', L.hostOf('HTTPS://WWW.LG.CO.KR') === 'lg.co.kr');
  ok('주소가 아니면 null', L.hostOf('회사 홈페이지 없음') === null);
  ok('빈 값도 null', L.hostOf('') === null && L.hostOf(null) === null);

  console.log('\n── 4. 회사명 ↔ 홈페이지는 서버만 적는다 ──');
  /* 진짜 표가 있으면 잠시 치워 둔다 — 테스트가 남의 데이터를 건드리지 않는다. */
  const HOSTS = L.HOSTS_PATH;
  const BAK = HOSTS + '.testbak';
  const had = fs.existsSync(HOSTS);
  if (had) fs.renameSync(HOSTS, BAK);
  try {
    L._resetHosts();
    ok('모르는 회사는 null', L.hostFor('없는회사') === null);
    ok('적어 두면 찾는다', L.remember('카카오', 'https://www.kakaocorp.com/') === 'kakaocorp.com');
    ok('  다시 찾아진다', L.hostFor('카카오') === 'kakaocorp.com');
    ok('홈페이지가 없으면 적지 않는다', L.remember('무명회사', '') === null && L.hostFor('무명회사') === null);
    ok('  주소가 아닌 값도 적지 않는다', L.remember('무명회사', '홈페이지 없음') === null);

    ok('파일에 남는다', fs.existsSync(HOSTS));
    L._resetHosts();
    ok('  재시작해도 살아 있다', L.hostFor('카카오') === 'kakaocorp.com');
  } finally {
    try { if (fs.existsSync(HOSTS)) fs.unlinkSync(HOSTS); } catch {}
    if (had) fs.renameSync(BAK, HOSTS);
    L._resetHosts();
  }

  console.log('\n── 5. 내부망 주소로는 로고를 받지 않는다 (SSRF) ──');
  for (const [label, addr] of [
    ['루프백', 'http://127.0.0.1/'],
    ['사설망', 'http://192.168.0.1/'],
    ['클라우드 메타데이터', 'http://169.254.169.254/'],
  ]) {
    ok(`${label} 을 막는다`, (await L.fetchLogo(addr)) === null);
  }
  ok('주소가 아니면 그냥 없음', (await L.fetchLogo('회사명만 있음')) === null);

  console.log('\n── 6. 캐시 파일 이름이 경로를 벗어나지 않는다 ──');
  /* 호스트는 DNS 가 검증하지만, 파일 이름으로 쓰기 전에 한 번 더 막는다.
     `../` 가 섞인 값이 들어오면 data/ 밖에 파일을 쓰게 된다. */
  ok('cached() 가 디렉터리를 벗어나지 않는다',
    L.cached('../../etc/passwd') === null || !String(L.cached('../../etc/passwd')?.path).includes('..'));

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
