/* 소셜 로그인·결제 키가 실제로 통하는지 확인한다.

     node scripts/check-auth-pay.js

   .env 에 값을 넣었는데 화면에서 안 되면 원인이 여러 곳이다 — 키 오타, 콘솔 설정
   누락, 리다이렉트 URI 불일치. 어디서 막혔는지 이 스크립트가 좁혀 준다.

   ── 어디까지 확인할 수 있나 ──
   OAuth 는 사람이 브라우저에서 로그인해야 끝나므로 전 과정을 자동으로 볼 수 없다.
   대신 **키가 유효한지**까지는 확인된다: 인증 페이지에 잘못된 client_id 로 가면
   각 사가 오류 화면을 주기 때문이다.

   토스는 더 확실하다. 가짜 paymentKey 로 승인을 시도했을 때
     · 키가 틀리면 → 401 UNAUTHORIZED_KEY
     · 키가 맞으면 → 그 주문이 없다는 다른 오류
   로 갈리므로 시크릿 키의 유효성을 정확히 가려낼 수 있다. (돈은 움직이지 않는다.)

   키 값은 절대 출력하지 않는다 — 로그·스크린샷으로 새는 사고가 흔하다.
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const CALLBACK_BASE = process.env.OAUTH_REDIRECT_BASE || 'http://localhost:3000';
const mask = v => (v ? `설정됨 (${v.length}자, ${v.slice(0, 4)}…)` : '비어 있음');
const line = (icon, label, detail) => console.log(`  ${icon} ${label}${detail ? ' — ' + detail : ''}`);

async function get(url) {
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; careerly/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  return { status: res.status, body: await res.text().catch(() => ''), location: res.headers.get('location') || '' };
}

async function checkNaver() {
  console.log('\n── 네이버 로그인 ──');
  const id = (process.env.NAVER_LOGIN_CLIENT_ID || '').trim();
  const secret = (process.env.NAVER_LOGIN_CLIENT_SECRET || '').trim();
  line('·', 'NAVER_LOGIN_CLIENT_ID', mask(id));
  line('·', 'NAVER_LOGIN_CLIENT_SECRET', mask(secret));
  if (!id || !secret) return line('✗', '키가 없어 버튼이 뜨지 않습니다');

  /* 뉴스 검색용 키를 잘못 넣는 실수가 잦다. 값이 같으면 바로 알려준다. */
  if (id && id === (process.env.NAVER_CLIENT_ID || '').trim()) {
    line('✗', '검색 API 키와 값이 같습니다', '로그인은 별도 애플리케이션입니다');
    return;
  }

  const url = 'https://nid.naver.com/oauth2.0/authorize?'
    + new URLSearchParams({
      response_type: 'code', client_id: id,
      redirect_uri: `${CALLBACK_BASE}/api/auth/naver/callback`, state: 'check',
    });
  const r = await get(url);
  const text = r.body + r.location;

  if (/error|invalid|없는 애플리케이션|등록되지/i.test(text) && !/nidlogin/i.test(text)) {
    line('✗', '네이버가 요청을 거부했습니다', text.replace(/\s+/g, ' ').slice(0, 120));
  } else {
    line('✓', 'client_id 가 인정되어 로그인 화면으로 연결됩니다');
    line(' ', '콘솔에 등록해야 할 Callback URL', `${CALLBACK_BASE}/api/auth/naver/callback`);
  }
}

async function checkKakao() {
  console.log('\n── 카카오 로그인 ──');
  const key = (process.env.KAKAO_REST_API_KEY || '').trim();
  const secret = (process.env.KAKAO_CLIENT_SECRET || '').trim();
  line('·', 'KAKAO_REST_API_KEY', mask(key));
  line('·', 'KAKAO_CLIENT_SECRET', mask(secret) + (secret ? '' : ' — 켜져 있으면 필수입니다'));
  if (!key) return line('✗', '키가 없어 버튼이 뜨지 않습니다');

  const url = 'https://kauth.kakao.com/oauth/authorize?'
    + new URLSearchParams({
      response_type: 'code', client_id: key,
      redirect_uri: `${CALLBACK_BASE}/api/auth/kakao/callback`, state: 'check',
    });
  const r = await get(url);
  const text = r.body + r.location;

  /* 카카오는 오류를 코드로 준다: KOE101(앱 없음) · KOE006(리다이렉트 URI 불일치)
     · KOE004(로그인 사용 설정 OFF). 원인마다 고칠 곳이 다르므로 그대로 보여준다. */
  const koe = text.match(/KOE\d+/);
  if (koe) {
    const why = {
      KOE004: '카카오 로그인 > 사용 설정을 ON 으로',
      KOE006: `리다이렉트 URI 를 콘솔에 등록: ${CALLBACK_BASE}/api/auth/kakao/callback`,
      KOE101: 'REST API 키가 잘못되었습니다 (JavaScript 키를 넣지 않았는지 확인)',
    }[koe[0]] || '콘솔 설정을 확인하세요';
    line('✗', `${koe[0]} — ${why}`);
  } else {
    line('✓', 'REST API 키와 리다이렉트 URI 가 인정됩니다');
  }
}

async function checkToss() {
  console.log('\n── 토스페이먼츠 ──');
  const ck = (process.env.TOSS_CLIENT_KEY || '').trim();
  const sk = (process.env.TOSS_SECRET_KEY || '').trim();
  line('·', 'TOSS_CLIENT_KEY', mask(ck));
  line('·', 'TOSS_SECRET_KEY', mask(sk));
  if (!ck || !sk) return line('✗', '키가 없어 결제 없이 신청만 저장됩니다');

  if (!ck.includes('_ck_')) line('✗', 'CLIENT_KEY 형태가 이상합니다', 'test_ck_ 로 시작해야 합니다');
  if (!sk.includes('_sk_')) line('✗', 'SECRET_KEY 형태가 이상합니다', 'test_sk_ 로 시작해야 합니다');
  if (sk.includes('_ck_')) return line('✗', 'SECRET_KEY 자리에 클라이언트 키가 들어 있습니다');
  if (ck.startsWith('live_') || sk.startsWith('live_')) {
    line('!', '실서비스(live) 키입니다', '테스트 중에는 test_ 키를 쓰세요 — 실제 결제가 일어납니다');
  }

  /* 없는 주문으로 승인을 시도한다. 인증이 통과해야만 '주문 없음' 오류가 나온다. */
  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sk}:`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey: 'careerly_keycheck', orderId: 'careerly_keycheck', amount: 1000 }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 || data.code === 'UNAUTHORIZED_KEY') {
    line('✗', '시크릿 키가 인증되지 않습니다', data.message || '키를 다시 확인하세요');
  } else {
    line('✓', '시크릿 키가 인증됩니다', `(응답: ${data.code || res.status} — 없는 주문이라 정상)`);
  }
}

(async () => {
  console.log('careerly 인증·결제 키 점검');
  console.log(`콜백 기준 주소: ${CALLBACK_BASE}`);
  for (const fn of [checkNaver, checkKakao, checkToss]) {
    try { await fn(); }
    catch (e) { line('✗', '점검 중 오류', e.message); }
  }
  console.log('\n키를 바꿨으면 서버를 재시작해야 반영됩니다.');
})();
