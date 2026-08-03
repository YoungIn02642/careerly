/* 본인확인(NICE 아이핀/PASS) 한 겹 — 한 사람이 계정을 하나만 갖게 하는 장치.

   ── 왜 필요한가 ──
   지금 중복 가입을 막는 것은 아이디·이메일 UNIQUE 뿐이다. 같은 사람이 일반가입 +
   네이버 + 카카오로 계정을 세 개 만들 수 있고, 카카오는 이메일이 선택 동의라
   users.email 이 NULL 일 수도 있어서 더 샌다. 멘토링은 '이 선배가 실제로 한 명'이라는
   전제 위에 서 있으므로 여기가 무너지면 후기·평점이 전부 의미를 잃는다.

   ── CI 가 무엇인가 ──
   본인확인기관이 주민번호를 단방향 변환해 주는 88자 문자열이다. 같은 사람이면
   어느 사이트에서든 같은 값이 나오지만 되돌려 주민번호를 알아낼 수는 없다.
   그래서 '한 사람 = 한 계정'의 키로 쓰기에 알맞다. 휴대폰 번호와 달리 번호를
   바꿔도 따라오고, 남의 번호를 빌려도 뚫리지 않는다.

   ── 지금은 상용 키가 없다 ──
   NICE 는 계약·사이트 심사를 거쳐야 키가 나온다. 그래서 이 파일은 **어댑터**로 만들었다.
   키가 없으면 개발 모드로 동작해 모의 CI 를 발급한다 — 스키마·중복 차단·화면 흐름은
   전부 진짜로 돌고, 키가 나오면 sign()/verify() 두 함수만 실제 규격으로 바꾸면 된다.

   **운영에서는 개발 모드를 막는다.** 안 막으면 아무나 아무 번호로 '인증 완료'가 된다.
*/
const crypto = require('crypto');

const SITE_CODE = (process.env.NICE_SITE_CODE || '').trim();
const SITE_PASSWORD = (process.env.NICE_SITE_PASSWORD || '').trim();
const RETURN_URL = (process.env.NICE_RETURN_URL || '').trim();

const isProduction = () => process.env.NODE_ENV === 'production';

/* 키가 다 있어야 실제 연동이다. 하나만 빠져도 개발 모드로 두면 안 된다 —
   운영에 키를 반만 넣고 '되는 줄 알았다'가 가장 위험하다. */
const isConfigured = () => !!(SITE_CODE && SITE_PASSWORD && RETURN_URL);

/* 개발 모드로 돌아도 되는 상황인가. 운영이면 절대 안 된다. */
function devModeAllowed() {
  return !isConfigured() && !isProduction();
}

/* ── 인증 요청 ──────────────────────────────────────────────
   실제 NICE 는 사이트코드/비밀번호로 요청문을 암호화해 팝업 URL 을 만든다.
   개발 모드에서는 우리 서버 안의 가짜 팝업으로 보낸다. */
function buildRequest({ returnUrl } = {}) {
  if (isConfigured()) {
    /* 상용 키가 생기면 여기서 NICE 표준 모듈로 요청문을 암호화한다.
       (형태만 잡아 둔다 — 지어낸 규격으로 채우면 실제 연동 때 전부 걷어내야 한다.) */
    throw Object.assign(
      new Error('NICE 상용 연동이 아직 구현되지 않았습니다. 키를 넣기 전에 연동 코드를 채워주세요.'),
      { status: 501 });
  }
  if (!devModeAllowed()) {
    throw Object.assign(
      new Error('본인인증이 설정되지 않았습니다. 관리자에게 문의해 주세요.'),
      { status: 503 });
  }
  const token = crypto.randomBytes(16).toString('hex');
  return {
    mode: 'dev',
    token,
    popupUrl: `/dev-verify.html?token=${token}&return=${encodeURIComponent(returnUrl || '/')}`,
  };
}

/* ── 결과 해석 ──────────────────────────────────────────────
   실제로는 NICE 가 돌려준 암호문을 복호화해 이름·생년월일·휴대폰·CI 를 꺼낸다.
   개발 모드에서는 입력한 휴대폰 번호를 해시해 CI 를 만든다. */
function parseResult(payload) {
  if (isConfigured()) {
    throw Object.assign(new Error('NICE 상용 연동이 아직 구현되지 않았습니다.'), { status: 501 });
  }
  if (!devModeAllowed()) {
    throw Object.assign(new Error('본인인증이 설정되지 않았습니다.'), { status: 503 });
  }

  const phone = normalizePhone(payload?.phone);
  if (!phone) {
    throw Object.assign(new Error('휴대폰 번호를 올바르게 입력해 주세요.'), { status: 400 });
  }
  const name = String(payload?.name || '').trim();
  if (!name) {
    throw Object.assign(new Error('이름을 입력해 주세요.'), { status: 400 });
  }

  return { ci: devCi(phone), phone, name };
}

/* 개발용 CI. **번호가 같으면 같은 값**이라야 중복 차단을 실제로 검증할 수 있다.
   앞에 'DEV:' 를 붙여 운영 데이터에 섞여 들어가도 한눈에 구분되게 한다. */
function devCi(phone) {
  return 'DEV:' + crypto.createHash('sha256').update(`careerly-dev-ci:${phone}`).digest('base64').slice(0, 83);
}

/* 010-1234-5678 · 01012345678 · +82 10-1234-5678 을 모두 같은 값으로 만든다.
   표기가 다르면 같은 번호가 다른 CI 가 되어 중복 차단이 뚫린다. */
function normalizePhone(raw) {
  let s = String(raw || '').replace(/[^0-9]/g, '');
  if (s.startsWith('82')) s = '0' + s.slice(2);
  return /^01[016789][0-9]{7,8}$/.test(s) ? s : null;
}

/* 화면에 보여줄 때만 쓴다. 서버 로그·응답에 번호를 그대로 흘리지 않기 위해서다. */
function maskPhone(phone) {
  const s = normalizePhone(phone);
  if (!s) return '';
  return `${s.slice(0, 3)}-****-${s.slice(-4)}`;
}

module.exports = {
  isConfigured, devModeAllowed, isProduction,
  buildRequest, parseResult,
  normalizePhone, maskPhone, devCi,
};
