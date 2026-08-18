/* 마크다운 → HTML — frontend/js/markdown.js

   이 파일의 절반은 XSS 테스트다. 본문은 **사용자가 쓴 글**이고, 마크다운을 HTML 로
   바꾸는 일은 곧 "글을 HTML 로 실행한다" 는 뜻이라 한 군데만 새도 남의 글에
   스크립트를 심을 수 있다. 나머지 절반이 문법 지원이다. */
const MD = require('../frontend/js/markdown.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};
const r = MD.render;

console.log('── 1. XSS — 글이 실행되면 안 된다 ──');
ok('태그를 태그로 만들지 않는다',
   !r('<script>alert(1)</script>').includes('<script'),
   `→ ${r('<script>alert(1)</script>')}`);
ok('이미지 onerror 도 막는다', !r('<img src=x onerror=alert(1)>').includes('<img'));
ok('속성 탈출을 막는다', !r('" onmouseover="alert(1)').includes('onmouseover="alert'));
/* 굵게 안쪽으로 태그를 밀어 넣는 수법 — escape 를 나중에 하면 여기서 샌다. */
ok('굵게 안쪽에 태그를 못 넣는다',
   !r('**<img src=x onerror=alert(1)>**').includes('<img'),
   `→ ${r('**<img src=x onerror=alert(1)>**')}`);
ok('코드 안쪽에 태그를 못 넣는다', !r('`<script>a</script>`').includes('<script'));

console.log('\n── 1-2. 링크 주소 ──');
ok('http 링크는 만든다', r('[네이버](https://naver.com)').includes('href="https://naver.com"'));
ok('새 탭으로 열고 opener 를 끊는다',
   r('[a](https://a.com)').includes('rel="noopener noreferrer"'));
/* 클릭 한 번으로 실행되는 주소들. 링크를 못 만들면 **글자만 남긴다** —
   통째로 지우면 사용자가 쓴 말이 사라진다. */
for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>a</script>', '/etc/passwd']) {
  const html = r(`[누르지마](${bad})`);
  ok(`${bad.slice(0, 22)} 는 링크가 안 된다`, !html.includes('<a '), `→ ${html}`);
}
ok('링크가 안 돼도 글자는 남는다', r('[누르지마](javascript:alert(1))').includes('누르지마'));
ok('쿼리스트링이 있는 주소도 통과한다',
   r('[a](https://a.com/x?y=1&z=2)').includes('href="https://a.com/x?y=1&z=2"'),
   'escape 된 &amp; 를 되돌리지 않으면 멀쩡한 주소가 막힌다');
ok('safeUrl 이 직접 불려도 같은 판정',
   MD._safeUrl('https://a.com') === 'https://a.com' && MD._safeUrl('javascript:a') === null);

console.log('\n── 2. 문단 ──');
ok('한 줄은 문단', r('안녕하세요') === '<p>안녕하세요</p>');
ok('빈 줄로 문단이 나뉜다', r('가\n\n나') === '<p>가</p><p>나</p>');
ok('붙은 줄은 한 문단 안에서 줄바꿈', r('가\n나') === '<p>가<br>나</p>');
ok('빈 입력은 빈 문자열', r('') === '' && r(null) === '' && r(undefined) === '');
ok('공백만 있어도 빈 문자열', r('   \n\n  ') === '');

console.log('\n── 3. 제목 ──');
ok('## 는 h3', r('## 제목') === '<h3>제목</h3>', '글 제목이 h1 이라 본문은 h3 부터');
ok('### 는 h4', r('### 소제목') === '<h4>소제목</h4>');
ok('# 하나는 제목이 아니다', r('# 제목') === '<p># 제목</p>',
   'h2 는 페이지 제목 자리라 본문에 내주지 않는다');
ok('#만 있고 글자가 없으면 그냥 글', r('##') === '<p>##</p>');
ok('제목 앞뒤 문단이 섞이지 않는다',
   r('앞\n## 제목\n뒤') === '<p>앞</p><h3>제목</h3><p>뒤</p>');

console.log('\n── 4. 목록 ──');
ok('- 목록', r('- 하나\n- 둘') === '<ul><li>하나</li><li>둘</li></ul>');
ok('1. 목록', r('1. 하나\n2. 둘') === '<ol><li>하나</li><li>둘</li></ol>');
ok('* 도 글머리표', r('* 하나') === '<ul><li>하나</li></ul>');
/* 종류가 바뀌면 목록을 새로 연다 — 안 그러면 번호 목록이 글머리표 안에 들어간다. */
ok('종류가 바뀌면 목록을 새로 연다',
   r('- 가\n1. 나') === '<ul><li>가</li></ul><ol><li>나</li></ol>');
ok('목록 뒤 문단이 목록에 안 들어간다',
   r('- 가\n\n문단') === '<ul><li>가</li></ul><p>문단</p>');
ok('목록 항목 안에서도 굵게가 된다', r('- **굵게**').includes('<b>굵게</b>'));

console.log('\n── 5. 인용·구분선 ──');
/* escape 때문에 본문에서는 '>' 가 '&gt;' 다. 원문 기호로 찾으면 인용이 통째로 안 걸린다. */
ok('> 인용', r('> 인용문') === '<blockquote>인용문</blockquote>',
   'escape 뒤에는 &gt; 로 찾아야 한다');
ok('여러 줄 인용이 한 덩어리', r('> 가\n> 나') === '<blockquote>가<br>나</blockquote>');
ok('--- 는 구분선', r('---') === '<hr>');
ok('-- 는 구분선이 아니다', r('--') === '<p>--</p>');

console.log('\n── 6. 줄 안쪽 ──');
ok('**굵게**', r('가 **굵게** 나') === '<p>가 <b>굵게</b> 나</p>');
ok('`코드`', r('`npm run dev`') === '<p><code>npm run dev</code></p>');
/* 코드 안의 별표는 굵게가 아니라 글자다 — 코드를 먼저 빼내는 이유. */
ok('코드 안의 별표는 그대로', r('`**별표**`') === '<p><code>**별표**</code></p>');
ok('빈 별표는 건드리지 않는다', r('****') === '<p>****</p>');
/* 한 문단 안의 줄바꿈을 넘는 굵게는 **정상이다**(마크다운 규격이 그렇다).
   막아야 하는 것은 문단 경계를 넘는 경우다 — 거기서 새면 별표 하나가 글 끝까지 삼킨다. */
ok('한 문단 안에서는 줄바꿈을 넘어도 굵게', r('**가\n나**') === '<p><b>가<br>나</b></p>',
   `→ ${r('**가\n나**')}`);
ok('빈 줄(문단 경계)은 못 넘는다', !r('**가\n\n나**').includes('<b>'),
   `→ ${r('**가\n\n나**')}`);
ok('별표 하나는 그대로 둔다', r('2 * 3 = 6') === '<p>2 * 3 = 6</p>',
   '곱셈 기호를 기울임으로 먹으면 안 된다');

console.log('\n── 7. 섞여 있어도 순서가 유지된다 ──');
const mixed = r(['## 제목', '', '문단입니다.', '', '- 가', '- 나', '', '> 인용', '', '---', '', '끝'].join('\n'));
ok('블록 순서가 그대로',
   mixed === '<h3>제목</h3><p>문단입니다.</p><ul><li>가</li><li>나</li></ul><blockquote>인용</blockquote><hr><p>끝</p>',
   `→ ${mixed}`);

console.log('\n── 8. 실제 편집 글이 깨지지 않는다 ──');
const ARTICLES = require('../backend/src/insight-featured.js').ARTICLES;
ok('편집 글이 다섯 편', ARTICLES.length === 5);
for (const a of ARTICLES) {
  const html = r(a.body);
  ok(`${a.key} — 빈 결과가 아니다`, html.length > 200);
  ok(`${a.key} — 실행되는 태그가 없다`,
     !/<script|onerror=|onload=|javascript:/i.test(html));
}
/* 마크다운으로 고쳐 적었으니 실제로 마크다운 문법이 쓰이고 있어야 한다 —
   안 그러면 '고쳤다' 고 적어 놓고 평문 그대로인 상태가 된다. */
ok('제목 문법을 실제로 쓴다', ARTICLES.every(a => r(a.body).includes('<h3>')));
ok('적어도 한 편은 목록을 쓴다', ARTICLES.some(a => r(a.body).includes('<li>')));
ok('적어도 한 편은 굵게를 쓴다', ARTICLES.some(a => r(a.body).includes('<b>')));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
