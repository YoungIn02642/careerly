/* 채용공고 주소 → 본문. 네트워크를 부르지 않는다.

   ── 이 테스트가 지키는 것 둘 ──
   1) **SSRF** — 사용자가 준 주소를 서버가 그대로 여는 기능이다. 내부망 차단이 뚫리면
      우리 서버가 자기 내부를 대신 읽어 준다. 여기 실패는 기능 고장이 아니라 사고다.
   2) **본문 추출** — 스크립트 안의 문자열이 본문으로 딸려 오거나 문단이 한 줄로 붙으면,
      역량 추출이 엉뚱한 문장을 근거로 든다(18-7 에서 겪은 실패 모드).

   IP 를 그대로 쓴 주소는 dns.lookup 이 네트워크 없이 그대로 돌려주므로 여기서 검사된다. */
const P = require('../backend/src/posting-fetch.js');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

(async () => {
  console.log('── 1. 내부망·이상한 주소를 막는다 (SSRF) ──');
  const blocked = [
    ['루프백', 'http://127.0.0.1/admin'],
    ['루프백 이름', 'http://localhost:3000/'],
    ['사설망 10/8', 'http://10.0.0.5/'],
    ['사설망 192.168', 'http://192.168.0.1/'],
    ['사설망 172.16', 'http://172.16.0.1/'],
    ['클라우드 메타데이터', 'http://169.254.169.254/latest/meta-data/'],
    ['IPv6 루프백', 'http://[::1]/'],
    ['v4 를 품은 v6', 'http://[::ffff:127.0.0.1]/'],
    ['0.0.0.0', 'http://0.0.0.0/'],
    ['file 스킴', 'file:///etc/passwd'],
    ['ftp 스킴', 'ftp://example.com/x'],
    ['주소가 아님', '그냥 글자'],
  ];
  for (const [label, url] of blocked) {
    const why = await P.urlProblem(url);
    ok(`막는다 — ${label}`, typeof why === 'string' && why.length > 0, why ? '' : '→ 통과돼 버림!');
  }
  /* 공인 IP 는 통과해야 한다 — 다 막아 놓고 "안전하다" 고 하면 기능이 없는 것이다. */
  ok('공인 IP 는 통과한다', (await P.urlProblem('https://8.8.8.8/notice')) === null);

  console.log('\n── 2. 본문 추출 ──');
  const html = `<html><head><title>  프론트엔드 개발자 채용 </title>
    <script>var x = "지원자격: 자바스크립트 10년"; </script>
    <style>.a{color:red}</style></head>
    <body><nav>회사소개 채용 문의</nav>
    <h1>프론트엔드 개발자</h1>
    <p>담당업무<br>웹 서비스 화면 개발</p>
    <ul><li>자격요건: 자바스크립트 경험</li><li>우대사항: React 경험</li></ul>
    <div>마감일&nbsp;2026-09-01 &amp; 상시</div>
    <footer>© 회사</footer></body></html>`;
  const text = P.extractText(html);

  ok('스크립트 안의 글이 본문에 안 섞인다', !text.includes('자바스크립트 10년'), text.includes('자바스크립트 10년') ? '→ 섞임!' : '');
  ok('스타일이 안 섞인다', !text.includes('color:red'));
  ok('메뉴(nav)가 빠진다', !text.includes('회사소개'));
  ok('꼬리(footer)가 빠진다', !text.includes('© 회사'));
  ok('본문은 남는다', text.includes('담당업무') && text.includes('자격요건: 자바스크립트 경험'));
  ok('br 이 줄바꿈이 된다', /담당업무\n\s*웹 서비스 화면 개발/.test(text), `→ ${JSON.stringify(text.slice(0, 40))}`);
  ok('목록이 줄로 갈린다', /자격요건[^\n]*\n[^\n]*우대사항/.test(text));
  ok('엔티티가 풀린다', text.includes('마감일 2026-09-01 & 상시'));
  ok('제목을 뽑는다', P.titleOf(html) === '프론트엔드 개발자 채용', `→ ${P.titleOf(html)}`);

  console.log('\n── 3. 빈 것과 없는 것을 가른다 ──');
  ok('빈 입력은 빈 문자열', P.extractText('') === '' && P.extractText(null) === '');
  /* JS 로 그리는 페이지는 껍데기만 온다. 그걸 본문이라고 넘기면 사용자는 "분석이
     이상하다" 로만 알게 된다 — 라우트가 MIN_CHARS 로 걸러 사유를 따로 알려준다. */
  const shell = P.extractText('<html><body><div id="root"></div></body></html>');
  ok('SPA 껍데기는 본문 길이에 못 미친다', shell.length < P._MIN_CHARS, `→ ${shell.length}자`);
  ok('태그가 글자로 새지 않는다', !P.extractText('<p>가<b>나</b>다</p>').includes('<'));


  console.log('\n── 4. 공고다운가 (가져왔는데 내용이 메뉴뿐인 경우) ──');
  /* 실측: 사람인 relay 주소는 1,280자를 돌려주는데 전부 메뉴와 개인정보 안내문이었다.
     상세가 iframe 안에 있어서다. 길이만 보면 성공이라 그대로 넘어갔을 것이고,
     "구직자의 개인정보는 채용 활동 외의 목적으로 사용하지 않습니다" 가 역량의 근거로
     붙었을 것이다(18-7 과 같은 실패 모드 — 에러가 안 나서 더 나쁘다). */
  const junk = `홈
채용정보
로그인
구직자의 개인정보 보호
채용 과정에서 불필요한 개인정보를 요청하지 않습니다.
투명하고 안전한 채용 절차`;
  const real = `[주요업무]
- 웹 서비스 화면 개발
[자격요건]
- 자바스크립트 경험 3년
[우대사항]
- React 경험`;

  ok('메뉴·안내문은 공고 낱말이 없다', P.postingHits(junk) === 0, `→ ${P.postingHits(junk)}`);
  ok('진짜 공고는 공고 낱말이 여럿', P.postingHits(real) >= 2, `→ ${P.postingHits(real)}`);
  ok('띄어쓴 표기도 센다', P.postingHits('자격 요건\n우대 사항') >= 2);

  console.log('\n── 5. 머리쪽 메뉴 걷어내기 ──');
  const lead = `${'홈 채용정보 로그인 회원가입 '.repeat(8)}
[주요업무]
- 화면 개발`;
  const trimmed = P.trimLead(lead);
  ok('공고 낱말 앞의 메뉴가 잘린다', trimmed.startsWith('[주요업무]'), `→ ${JSON.stringify(trimmed.slice(0, 20))}`);
  ok('줄 중간에서 자르지 않는다', !trimmed.includes('회원가입'));
  /* 앞이 짧으면 제목일 수 있다 — 굳이 자르지 않는다. */
  ok('머리가 짧으면 그대로 둔다', P.trimLead('프론트엔드 개발자\n[주요업무]\n- 개발').startsWith('프론트엔드'));
  ok('공고 낱말이 없으면 그대로 둔다', P.trimLead(junk) === junk);


  console.log('\n── 6. https:// 가 빠진 주소 (사용자 지적) ──');
  /* 크롬은 주소창에서 https:// 를 숨긴다. 그대로 복사하면 스킴이 없는 주소가 되는데,
     예전에는 '주소 형식이 아닙니다' 로 거절했다 — 사용자에게는 멀쩡한 주소다. */
  ok('스킴이 없으면 https 를 붙인다',
     P.normalizeUrl('saramin.co.kr/zf_user/jobs/view?rec_idx=1') === 'https://saramin.co.kr/zf_user/jobs/view?rec_idx=1');
  ok('www 도 붙인다', P.normalizeUrl('www.jobkorea.co.kr/x') === 'https://www.jobkorea.co.kr/x');
  ok('스킴이 있으면 손대지 않는다', P.normalizeUrl('http://a.com/x') === 'http://a.com/x');
  /* 점이 없으면 주소가 아니다. https 를 붙이면 '주소를 찾을 수 없습니다' 로 엉뚱하게
     흘러간다 — 형식 오류로 잡히는 편이 맞다. */
  ok('점이 없는 글자에는 안 붙인다', P.normalizeUrl('그냥 글자') === '그냥 글자');
  ok('빈 값은 빈 값', P.normalizeUrl('') === '' && P.normalizeUrl(null) === '');
  ok('스킴 없는 주소도 통과한다', (await P.urlProblem('saramin.co.kr/x')) === null);
  /* 보정이 SSRF 를 무르지 않는다 — 여기가 뚫리면 위 1번이 무의미해진다. */
  ok('보정해도 내부망은 막힌다', typeof (await P.urlProblem('127.0.0.1/admin')) === 'string');
  ok('file 은 스킴이 있으니 그대로 막힌다', typeof (await P.urlProblem('file:///etc/passwd')) === 'string');

  console.log('\n── 7. 진짜 공고 주소를 따라간다 (canonical) ──');
  /* 실측: 사람인 relay 주소는 메뉴만 1,280자를 준다(본문이 iframe 안). 그런데 그
     페이지가 스스로 진짜 주소를 알려 준다 — canonical 은 웹 표준이라 사이트별
     파서와 다르다. 따라가니 7,507자 본문이 나왔다. */
  const relay = 'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=1';
  const realUrl = 'https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=1';
  ok('link rel=canonical 을 읽는다',
     P.canonicalOf(`<link href="${realUrl}" rel="canonical" >`, relay) === realUrl);
  ok('속성 순서가 반대여도 읽는다',
     P.canonicalOf(`<link rel="canonical" href="${realUrl}">`, relay) === realUrl);
  ok('og:url 도 읽는다',
     P.canonicalOf(`<meta property="og:url" content="${realUrl}">`, relay) === realUrl);
  ok('상대 주소를 절대 주소로 편다',
     P.canonicalOf('<link rel="canonical" href="/zf_user/jobs/view?rec_idx=1">', relay) === realUrl);
  /* 자기 자신을 가리키면 따라갈 이유가 없다 — 안 그러면 같은 페이지를 두 번 받는다. */
  ok('자기 자신이면 null', P.canonicalOf(`<link rel="canonical" href="${relay}">`, relay) === null);
  ok('끝의 슬래시 차이는 같은 것으로 본다',
     P.canonicalOf('<link rel="canonical" href="https://a.com/x/">', 'https://a.com/x') === null);
  ok('없으면 null', P.canonicalOf('<html><body>없다</body></html>', relay) === null);

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
