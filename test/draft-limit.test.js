/* 문항별 분량 상한 (사용자 지시 2026-09-03)

   자소서 문항은 회사마다 상한이 다르다 — "1,000자 이내"·"2,000 byte" 처럼 공고에
   적혀 있다. 예전에는 초안 요청이 `limit: 600` 으로 고정이라, 1,000자짜리 문항에
   600자 초안이 나오고 사용자가 다시 늘려 써야 했다.

   여기서 지키는 것은 셋이다.
     1) byte 를 **한글 2byte**(EUC-KR 관행)로 센다. UTF-8(3byte)로 세면 같은 글이
        1.5배로 잡혀 쓸 수 있는 분량을 깎아먹는다.
     2) 안 정하면 1,000자. 부르는 쪽마다 기본값을 따로 적으면 화면과 초안이 갈린다.
     3) byte 상한은 초안 요청에서 **글자 수로 환산**된다(서버 프롬프트는 글자로 센다). */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
};
globalThis.document = { querySelector: () => null };

const JD = require('../frontend/js/jd-coach.js');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

console.log('── 1. byte 는 한글 2byte 로 센다 ──');
ok('한글 1자 = 2byte', JD.byteLen('가') === 2);
ok('영문 1자 = 1byte', JD.byteLen('a') === 1);
ok('숫자·공백 = 1byte', JD.byteLen('1 ') === 2);
ok('섞이면 합친다', JD.byteLen('가a1') === 4, '2+1+1');
/* UTF-8 로 셌으면 '가' 가 3 이 됐을 것이다 — 국내 자소서 관행은 2 다. */
ok('UTF-8(3byte)로 세지 않는다', JD.byteLen('가나다') === 6, 'UTF-8 이면 9');
ok('빈 값은 0', JD.byteLen('') === 0 && JD.byteLen(null) === 0);

console.log('\n── 2. 안 정하면 1,000자 ──');
const d = JD.limitOf('문항1');
ok('기본 1,000', d.n === JD.LIMIT_DEFAULT && d.n === 1000, `→ ${d.n}`);
ok('기본 단위는 자', d.unit === 'char');
/* custom 이 false 여야 화면이 입력칸을 비우고 placeholder 로 기본값을 보여준다. */
ok('사용자가 정한 값이 아니라고 표시', d.custom === false);

console.log('\n── 3. 정하고 꺼낸다 ──');
JD.setLimit('문항1', 1500, 'char');
ok('글자 상한이 저장된다', JD.limitOf('문항1').n === 1500);
ok('custom 으로 바뀐다', JD.limitOf('문항1').custom === true);
JD.setLimit('문항2', 2000, 'byte');
ok('byte 상한이 저장된다', JD.limitOf('문항2').n === 2000 && JD.limitOf('문항2').unit === 'byte');
ok('문항마다 따로 남는다', JD.limitOf('문항1').n === 1500 && JD.limitOf('문항2').n === 2000);
ok('안 정한 문항은 기본값', JD.limitOf('문항9').n === 1000);

console.log('\n── 4. 비우면 기본값으로 돌아간다 ──');
/* 0 을 저장해 두면 다음에 못 고친다 — 지워야 한다. */
JD.setLimit('문항1', '', 'char');
ok('비우면 기본 1,000', JD.limitOf('문항1').n === 1000 && JD.limitOf('문항1').custom === false);
JD.setLimit('문항2', 0, 'byte');
ok('0 도 기본값으로', JD.limitOf('문항2').custom === false);

console.log('\n── 5. 터무니없는 값은 자른다 ──');
JD.setLimit('문항3', 999999, 'char');
ok('글자 상한 최대 3,000', JD.limitOf('문항3').n === 3000, `→ ${JD.limitOf('문항3').n}`);
JD.setLimit('문항4', 999999, 'byte');
ok('byte 상한 최대 6,000', JD.limitOf('문항4').n === 6000, `→ ${JD.limitOf('문항4').n}`);
JD.setLimit('문항5', 10, 'char');
ok('최소 200 아래로는 안 내려간다', JD.limitOf('문항5').n === 200, `→ ${JD.limitOf('문항5').n}`);

console.log('\n── 6. 카운터가 상한 대비로 센다 ──');
JD.setLimit('문항6', 10, 'char');
let u = JD.usageOf('가나다', JD.limitOf('문항6'));
ok('자 단위로 센다', u.used === 3 && u.unitLabel === '자');
ok('상한 안이면 over 아님', u.over === false);
u = JD.usageOf('가'.repeat(300), JD.limitOf('문항6'));
ok('넘으면 over', u.over === true, '200자 상한에 300자');
JD.setLimit('문항7', 200, 'byte');
u = JD.usageOf('가나다', JD.limitOf('문항7'));
ok('byte 단위로 센다', u.used === 6 && u.unitLabel === 'byte', `→ ${u.used}`);

console.log('\n── 7. 초안 요청은 글자 수로 환산해 보낸다 ──');
/* 서버 프롬프트(question-prompts.js frameBlock)는 글자로 센다. byte 상한을 그대로
   보내면 2,000자짜리 초안을 요구하게 된다. */
ok('자 상한은 그대로', JD.charTarget({ n: 1200, unit: 'char' }) === 1200);
ok('byte 상한은 절반', JD.charTarget({ n: 2000, unit: 'byte' }) === 1000, '한글 2byte 기준');
ok('기본값도 환산된다', JD.charTarget(JD.limitOf('문항404')) === 1000);

console.log('\n── 8. 서버 clamp 가 프론트와 같은 범위인가 ──');
/* 갈리면 화면이 말한 분량과 실제 초안이 어긋난다. */
const SRC = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'backend', 'src', 'routes', 'jdCoach.js'), 'utf8');
ok('서버 기본값도 1000', SRC.includes('Number(req.body?.limit) || 1000'));
ok('서버 상한도 3000', SRC.includes('), 3000)'));
ok('서버 하한도 200', SRC.includes('|| 1000, 200)'));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail) process.exit(1);
