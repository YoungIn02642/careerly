/* 네이버·카카오 소셜 로그인.

   ── 흐름 ──
   1) 브라우저가 /api/auth/<provider> 로 온다
   2) state 를 만들어 쿠키에 심고, 제공자 인증 페이지로 리다이렉트
   3) 제공자가 /api/auth/<provider>/callback?code=..&state=.. 로 돌려보낸다
   4) state 를 대조하고, code 를 토큰으로, 토큰을 프로필로 바꾼다
   5) 계정을 찾거나 만들고 세션 쿠키를 심은 뒤 프론트로 돌려보낸다

   ── state 는 장식이 아니다 ──
   없으면 공격자가 자기 code 로 콜백을 호출해 피해자 브라우저를 자기 계정에 로그인
   시킬 수 있다(로그인 CSRF). 그래서 임의값을 쿠키와 URL 양쪽에 넣고 대조한다.

   ── 이메일이 겹치면 자동으로 잇지 않는다 ──
   careerly 는 가입 이메일을 검증하지 않는다. 그래서 공격자가 피해자 이메일로 미리
   계정을 만들어 두면, 피해자가 소셜 로그인할 때 그 계정으로 들어가 버린다
   (pre-account hijacking). 이메일이 같으면 연결하지 말고 안내만 한다.

   ── 키는 뉴스 검색용과 다른 것이다 ──
   .env 의 NAVER_CLIENT_ID 는 **검색 API(뉴스)** 용이다. 로그인은 별도 애플리케이션이라
   NAVER_LOGIN_CLIENT_ID 로 따로 받는다. 같은 값을 넣으면 인증이 실패한다.
*/
const crypto = require('crypto');

const STATE_COOKIE = 'careerly_oauth_state';

/* 제공자별 차이는 여기에만 둔다. 흐름은 아래 공통 함수가 처리한다. */
const PROVIDERS = {
  naver: {
    label: '네이버',
    authUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    profileUrl: 'https://openapi.naver.com/v1/nid/me',
    clientId: () => (process.env.NAVER_LOGIN_CLIENT_ID || '').trim(),
    clientSecret: () => (process.env.NAVER_LOGIN_CLIENT_SECRET || '').trim(),
    /* 네이버는 프로필을 { resultcode, message, response: {...} } 로 감싼다 */
    parseProfile: j => {
      const p = j.response || {};
      return { id: String(p.id || ''), email: p.email || null, name: p.name || p.nickname || null };
    },
  },
  kakao: {
    label: '카카오',
    authUrl: 'https://kauth.kakao.com/oauth/authorize',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    profileUrl: 'https://kapi.kakao.com/v2/user/me',
    clientId: () => (process.env.KAKAO_REST_API_KEY || '').trim(),
    /* 카카오의 client_secret 은 '조건부 필수' 다. 콘솔에서 그 기능이 ON 이면 토큰
       요청에 **반드시** 넣어야 하고, 요즘 새로 추가되는 REST API 키는 **켜진 채로
       생성된다**. 즉 사실상 필수라고 보고 설정해야 한다.
       빠뜨리면 토큰 발급에서 실패하는데, 메시지가 불친절해서 원인을 찾기 어렵다.
       (네이버는 항상 필수라 이 구분이 없다.) */
    clientSecret: () => (process.env.KAKAO_CLIENT_SECRET || '').trim(),
    parseProfile: j => {
      const acc = j.kakao_account || {};
      return {
        id: String(j.id || ''),
        /* 이메일은 카카오 콘솔에서 '선택 동의' 로 두면 안 올 수 있다.
           없으면 없는 대로 간다 — 이메일을 필수로 만들면 로그인이 막힌다. */
        email: acc.email || null,
        name: acc.profile?.nickname || null,
      };
    },
  },
};

const isEnabled = name => {
  const p = PROVIDERS[name];
  return !!(p && p.clientId());
};

/* 어떤 제공자를 쓸 수 있는지 — 화면이 버튼을 보여줄지 정하는 데 쓴다.
   키가 없는데 버튼만 있으면 눌렀을 때 에러 페이지로 떨어진다. */
const enabledProviders = () =>
  Object.keys(PROVIDERS).filter(isEnabled).map(id => ({ id, label: PROVIDERS[id].label }));

/* 콜백 주소. 제공자 콘솔에 **똑같이** 등록해야 한다(한 글자만 달라도 실패).
   배포하면 도메인이 바뀌므로 OAUTH_REDIRECT_BASE 로 뺐다. */
function redirectUri(providerName, req) {
  const base = (process.env.OAUTH_REDIRECT_BASE || '').trim()
    || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/auth/${providerName}/callback`;
}

function buildAuthUrl(providerName, req, state) {
  const p = PROVIDERS[providerName];
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: p.clientId(),
    redirect_uri: redirectUri(providerName, req),
    state,
  });
  return `${p.authUrl}?${params}`;
}

async function exchangeCode(providerName, req, code, state) {
  const p = PROVIDERS[providerName];
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: p.clientId(),
    redirect_uri: redirectUri(providerName, req),
    code,
    state,
  });
  const secret = p.clientSecret();
  if (secret) body.set('client_secret', secret);

  const res = await fetch(p.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    /* 네이버는 200 으로 { error, error_description } 을 주기도 한다 — status 만 보면 놓친다. */
    throw new Error(`${p.label} 토큰 발급 실패: ${json.error_description || json.error || res.status}`);
  }
  return json.access_token;
}

async function fetchProfile(providerName, accessToken) {
  const p = PROVIDERS[providerName];
  const res = await fetch(p.profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${p.label} 프로필 조회 실패 (${res.status})`);

  const profile = p.parseProfile(json);
  if (!profile.id) throw new Error(`${p.label} 계정 식별자를 받지 못했습니다.`);
  return profile;
}

/* state 생성·검증. 쿠키는 콜백 한 번만 쓰고 지운다. */
function issueState(res) {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',            // 제공자에서 돌아오는 리다이렉트에 쿠키가 실려야 한다
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,     // 10분이면 충분하다 — 오래 두면 재사용 위험만 커진다
  });
  return state;
}

function verifyState(req, res) {
  const sent = req.query.state;
  const saved = req.cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE);
  return !!sent && !!saved && sent === saved;
}

module.exports = {
  PROVIDERS, STATE_COOKIE,
  isEnabled, enabledProviders, redirectUri,
  buildAuthUrl, exchangeCode, fetchProfile, issueState, verifyState,
};
