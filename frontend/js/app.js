// ════════════════════════════════════════════════════════════
//  CAREERLY — App Bootstrap (라우터 + 인증)
// ════════════════════════════════════════════════════════════
const PAGES = [
  'main', 'login', 'signup', 'onboarding', 'mypage', 'career', 'backoffice',
  'dashboard', 'search', 'profile', 'mentoring',   // ← 구 mentoring.html
  'jd',                                            // 자소서 코치 (js/jd-coach.js)
];

/* navbar 에서 밑줄로 강조할 페이지 (data-nav 값과 일치) */
const NAV_HIGHLIGHT = ['career', 'dashboard', 'jd', 'search', 'mentoring'];

/* 멘토링 계열 화면 — mentoring.js 가 렌더를 담당 */
const MENTORING_PAGES = ['dashboard', 'search', 'profile', 'mentoring'];

function showPage(page) {
  PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (!el) return;
    if (p === page) {
      el.classList.add('active');
      if (p === 'career') el.style.display = 'flex';
    } else {
      el.classList.remove('active');
      if (p === 'career') el.style.display = 'none';
    }
  });
  document.getElementById('global-navbar').style.display = 'flex';
  // 멘토 프로필은 "멘토 찾기"의 하위 화면이므로 같은 메뉴를 강조한다.
  const navKey = page === 'profile' ? 'search' : page;
  updateNavActive(NAV_HIGHLIGHT.includes(navKey) ? navKey : '');

  if (page === 'mypage')     initMypage();
  /* 회원 유형 선택은 DOM 에 그대로 남는다. 멘토를 골라 두고 나갔다 돌아오면
     라디오는 멘토인데 안내 문구만 멘티로 남으므로 들어올 때 맞춰 준다. */
  if (page === 'signup')     syncNicknamePlaceholder();
  if (page === 'onboarding') enterOnboarding();
  if (page === 'login')      showLoginError();
  if (page === 'career')     { CareerPage.refreshUser(); CareerPage.render(); }
  if (page === 'backoffice') Backoffice.render(document.querySelector('#page-backoffice .bo-wrap'));
  if (page === 'main')       { if (window.renderHome) renderHome(); }
  if (page === 'jd')         JdCoach.onEnter();
  if (MENTORING_PAGES.includes(page)) Mentoring.onEnter(page);

  if (page !== 'main') window.scrollTo({ top: 0 });
  updateNavAuth();
}

function navigate(page) {
  closeNavDrawer();
  history.pushState({ page }, '', '#' + page);
  showPage(page);
}
window.navigate = navigate;

// ── 더보기 드로어 (좁은 화면에서 nav-links 를 대체) ───────────
function setNavDrawer(open) {
  const drawer  = document.getElementById('nav-drawer');
  const overlay = document.getElementById('nav-drawer-overlay');
  const burger  = document.getElementById('nav-burger');
  if (!drawer) return;
  drawer.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
  document.body.classList.toggle('nav-drawer-open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
}
function openNavDrawer()   { setNavDrawer(true); }
function closeNavDrawer()  { setNavDrawer(false); }
function toggleNavDrawer() {
  setNavDrawer(!document.getElementById('nav-drawer').classList.contains('open'));
}
window.openNavDrawer   = openNavDrawer;
window.closeNavDrawer  = closeNavDrawer;
window.toggleNavDrawer = toggleNavDrawer;

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeNavDrawer();
});
// 데스크톱 폭으로 넓히면 드로어가 숨겨지므로 상태도 함께 초기화한다.
window.addEventListener('resize', () => {
  if (window.innerWidth > 900) closeNavDrawer();
});

window.addEventListener('popstate', e => {
  const page = (e.state && PAGES.includes(e.state.page))
    ? e.state.page
    : (window.location.hash.replace('#', '') || 'main');
  showPage(PAGES.includes(page) ? page : 'main');
});

// ── Nav auth state ───────────────────────────────────────────
function updateNavAuth() {
  const user = DB.currentUser();
  const navAuth = document.getElementById('nav-auth');
  const navUser = document.getElementById('nav-user');
  const navName = document.getElementById('nav-user-name');
  // 드로어 헤더도 같은 상태를 따라간다.
  const drawerAuth = document.getElementById('drawer-auth');
  const drawerUser = document.getElementById('drawer-user');
  const drawerName = document.getElementById('drawer-user-name');
  if (user) {
    const label = (user.nickname || user.name || user.username) + '님';
    navAuth.style.display = 'none';
    navUser.style.display = 'flex';
    navName.textContent = label;
    drawerAuth.style.display = 'none';
    drawerUser.style.display = 'flex';
    drawerName.textContent = label;
  } else {
    navAuth.style.display = 'flex';
    navUser.style.display = 'none';
    drawerAuth.style.display = 'flex';
    drawerUser.style.display = 'none';
  }
}
window.updateNavAuth = updateNavAuth;

// ── Nav active state (highlight current section) ──────────────
function updateNavActive(key) {
  document.querySelectorAll('#global-navbar .nav-link').forEach(l => {
    l.classList.toggle('on', !!key && l.dataset.nav === key);
  });
}
window.updateNavActive = updateNavActive;

// ════════════════════════════════════════════════════════════
//   SOCIAL LOGIN
// ════════════════════════════════════════════════════════════
/* 버튼은 서버에 키가 설정된 제공자만 그린다. 키 없이 버튼만 있으면 눌렀을 때
   에러 화면으로 떨어져서, 사용자는 서비스가 고장 난 줄 안다. */
const SOCIAL_STYLE = {
  naver: { label: '네이버로 시작하기', cls: 'naver', mark: 'N' },
  kakao: { label: '카카오로 시작하기', cls: 'kakao', mark: 'K' },
};

async function paintSocialButtons() {
  let providers = [];
  try {
    providers = (await (await fetch('/api/auth/providers')).json()).providers || [];
  } catch { return; }             // 서버가 안 뜬 상태 — 일반 로그인은 그대로 쓴다
  if (!providers.length) return;

  const html = providers.map(p => {
    const s = SOCIAL_STYLE[p.id] || { label: `${p.label}로 시작하기`, cls: '', mark: '' };
    /* 링크로 둔다. OAuth 는 브라우저가 제공자 사이트로 실제 이동해야 해서
       fetch 로는 안 된다(리다이렉트를 따라갈 수 없다). */
    return `<a class="social-btn ${s.cls}" href="/api/auth/${p.id}">
        <span class="social-mark">${s.mark}</span>${s.label}
      </a>`;
  }).join('');

  ['login', 'signup'].forEach(page => {
    const wrap = document.getElementById(`${page}-social`);
    const box  = document.getElementById(`${page}-social-btns`);
    if (!wrap || !box) return;
    box.innerHTML = html;
    wrap.hidden = false;
  });
}

/* 소셜 로그인 실패는 서버가 #login?error=... 로 알려준다(콜백은 SPA 밖에서 돌아온다). */
function showLoginError() {
  const m = window.location.hash.match(/[?&]error=([^&]+)/);
  if (!m) return;
  const box = document.getElementById('login-error');
  if (box) {
    box.textContent = decodeURIComponent(m[1]);
    box.style.display = 'block';
  }
  // 한 번 보여준 에러가 주소에 남아 새로고침 때마다 다시 뜨지 않게 지운다
  history.replaceState({ page: 'login' }, '', '#login');
}

function enterOnboarding() {
  const user = DB.currentUser();
  const greet = document.getElementById('ob-greeting');
  if (user && greet) {
    greet.textContent = `${user.name}님, 회원 유형만 골라주시면 시작할 수 있어요.`;
  }
  const err = document.getElementById('ob-error');
  if (err) err.style.display = 'none';
}

/* 온보딩의 닉네임 안내도 회원가입과 같은 규칙으로 뒤집는다(멘티↔멘토). */
document.addEventListener('change', e => {
  if (e.target.name !== 'ob-role') return;
  const el = document.getElementById('ob-nickname');
  if (el) el.placeholder = NICKNAME_PLACEHOLDER[e.target.value] || NICKNAME_PLACEHOLDER.mentee;
});

async function handleOnboarding() {
  const err  = document.getElementById('ob-error');
  const btn  = document.getElementById('ob-btn');
  const role = document.querySelector('input[name="ob-role"]:checked')?.value;
  const nickname = document.getElementById('ob-nickname').value.trim();
  err.style.display = 'none';

  btn.disabled = true;
  try {
    await DB.completeOnboarding({ role, nickname: nickname || null });
    navigate('main');
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}
window.handleOnboarding = handleOnboarding;

// ════════════════════════════════════════════════════════════
//   PAYMENT RETURN
// ════════════════════════════════════════════════════════════
/* 결제창이 성공하면 토스가 successUrl 로 돌아오면서 paymentKey·orderId·amount 를
   쿼리에 붙여 준다. **그 시점은 아직 결제가 아니다** — 서버가 승인 API 를 불러야
   돈이 움직인다. 그래서 돌아오자마자 서버 승인을 요청한다.

   승인 결과를 기다리는 동안 사용자가 새로고침하면 같은 승인이 두 번 갈 수 있다.
   서버가 이미 결제된 주문을 성공으로 돌려주므로(payments.js) 중복은 안전하다. */
async function handlePaymentReturn() {
  const q = new URLSearchParams(location.search);
  const paymentKey = q.get('paymentKey');
  const orderId = q.get('orderId');
  const amount = q.get('amount');

  // 실패로 돌아온 경우 토스는 code·message 를 준다
  const failCode = q.get('code');
  if (failCode) {
    cleanPaymentQuery();
    alert(q.get('message') || '결제에 실패했어요.');
    return;
  }
  if (!paymentKey || !orderId || !amount) return;

  cleanPaymentQuery();
  try {
    await DB.confirmPayment({ paymentKey, orderId, amount: Number(amount) });
    alert('결제가 완료되었습니다. 멘토의 응답을 기다려 주세요.');
  } catch (e) {
    alert(e.message || '결제 승인에 실패했어요.');
  }
  navigate('mentoring');
}

/* 결제 정보가 주소창에 남으면 새로고침할 때마다 승인을 다시 시도한다. */
function cleanPaymentQuery() {
  history.replaceState(history.state, '', location.pathname + location.hash);
}

async function handleLogout() {
  try { await DB.logout(); }
  catch (e) { console.error('로그아웃 실패', e); }
  updateNavAuth();
  navigate('main');
}
window.handleLogout = handleLogout;

// ── Boot ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  CareerPage.init();
  Mentoring.init();
  JdCoach.init();
  const hash = window.location.hash.replace('#', '') || 'main';
  const target = PAGES.includes(hash) ? hash : 'main';
  document.getElementById('page-career').style.display = 'none';
  history.replaceState({ page: target }, '', '#' + target);

  // 서버 상태(로그인 여부·스펙)를 먼저 받아야 첫 화면이 올바르게 그려진다.
  // 실패해도 게스트 상태로 화면은 띄운다.
  try { await DB.hydrate(); }
  catch (e) { console.error('서버 상태를 불러오지 못했습니다.', e); }

  /* 소셜 가입 직후 새로고침하면 역할이 없는 채로 다른 화면에 들어갈 수 있다.
     그 상태로는 스펙 폼도 통계도 성립하지 않으므로 추가입력으로 돌려보낸다. */
  const me = DB.currentUser();
  showPage(me?.needsOnboarding ? 'onboarding' : target);
  updateNavAuth();
  paintSocialButtons();
  handlePaymentReturn();   // 결제창에서 돌아왔으면 승인까지 이어서 한다
});

// ════════════════════════════════════════════════════════════
//   LOGIN
// ════════════════════════════════════════════════════════════
async function handleLogin() {
  const errorBox = document.getElementById('login-error');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  errorBox.style.display = 'none';

  if (!username || !password) {
    errorBox.textContent = '아이디와 비밀번호를 입력해주세요.';
    errorBox.style.display = 'block';
    return;
  }
  try {
    await DB.login(username, password);
    navigate('main');
  } catch (e) {
    errorBox.textContent = e.message;
    errorBox.style.display = 'block';
    document.getElementById('login-password').value = '';
  }
}
window.handleLogin = handleLogin;

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('page-login').classList.contains('active'))
    handleLogin();
});

// ════════════════════════════════════════════════════════════
//   SIGNUP
// ════════════════════════════════════════════════════════════
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]).{8,20}$/;

function showFieldErr(id, msg) {
  const input = document.getElementById('su-' + id);
  const err = document.getElementById('err-su-' + id);
  if (input) input.classList.add('input-error');
  if (err) { err.textContent = msg; err.style.display = 'block'; }
}
function clearFieldErr(id) {
  const input = document.getElementById('su-' + id);
  const err = document.getElementById('err-su-' + id);
  if (input) input.classList.remove('input-error');
  if (err) err.style.display = 'none';
}
['username','password','password-confirm','name','nickname','email'].forEach(id => {
  document.addEventListener('input', e => {
    if (e.target.id === 'su-' + id) clearFieldErr(id);
  });
});

/* 닉네임이 '누구에게' 보이는지는 회원 유형에 따라 반대다.
   멘티가 쓰는 닉네임은 선배(멘토)가 보고, 멘토가 쓰는 닉네임은 후배(멘티)가 본다.
   유형을 고를 때마다 안내 문구를 뒤집어 준다. */
const NICKNAME_PLACEHOLDER = {
  mentee: '선배들에게 표시될 이름',
  mentor: '후배들에게 표시될 이름',
};

function syncNicknamePlaceholder() {
  const role = document.querySelector('input[name="role"]:checked')?.value;
  const el = document.getElementById('su-nickname');
  if (el) el.placeholder = NICKNAME_PLACEHOLDER[role] || NICKNAME_PLACEHOLDER.mentee;
}

/* 회원 유형은 라디오라 change 로 잡는다. 문서 전체에 위임해 두면 회원가입 화면이
   보이기 전에 바인딩해도 안전하다. */
document.addEventListener('change', e => {
  if (e.target.name === 'role') syncNicknamePlaceholder();
});

function validateSignup() {
  let valid = true;
  const u  = document.getElementById('su-username').value.trim();
  const p  = document.getElementById('su-password').value;
  const pc = document.getElementById('su-password-confirm').value;
  const n  = document.getElementById('su-name').value.trim();
  const em = document.getElementById('su-email').value.trim();

  if (!u) { showFieldErr('username', '아이디를 입력해주세요.'); valid = false; }
  else if (u.length < 4 || u.length > 20) { showFieldErr('username', '아이디는 4~20자로 입력해주세요.'); valid = false; }
  else if (!/^[a-zA-Z0-9_]+$/.test(u)) { showFieldErr('username', '아이디는 영문, 숫자, 밑줄(_)만 사용 가능합니다.'); valid = false; }

  if (!p) { showFieldErr('password', '비밀번호를 입력해주세요.'); valid = false; }
  else if (!PASSWORD_REGEX.test(p)) { showFieldErr('password', '비밀번호는 8~20자이며, 영문·숫자·특수문자를 모두 포함해야 합니다.'); valid = false; }

  if (!pc) { showFieldErr('password-confirm', '비밀번호를 다시 입력해주세요.'); valid = false; }
  else if (p !== pc) { showFieldErr('password-confirm', '비밀번호가 일치하지 않습니다.'); valid = false; }

  if (!n) { showFieldErr('name', '이름을 입력해주세요.'); valid = false; }

  /* 닉네임은 선택 — 비워두면 이름을 가려서 쓴다(maskName). 적었다면 길이만 본다.
     화면 곳곳에 이름 대신 들어가는 값이라 너무 길면 레이아웃이 깨진다. */
  const nick = document.getElementById('su-nickname').value.trim();
  if (nick && (nick.length < 2 || nick.length > 12)) {
    showFieldErr('nickname', '닉네임은 2~12자로 입력해주세요.'); valid = false;
  }

  if (!em) { showFieldErr('email', '이메일을 입력해주세요.'); valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { showFieldErr('email', '올바른 이메일 형식을 입력해주세요.'); valid = false; }
  return valid;
}

async function handleSignup() {
  const serverError = document.getElementById('signup-server-error');
  serverError.style.display = 'none';
  if (!validateSignup()) return;
  const role = document.querySelector('input[name="role"]:checked')?.value;
  try {
    await DB.createUser({
      username: document.getElementById('su-username').value.trim(),
      password: document.getElementById('su-password').value,
      name:     document.getElementById('su-name').value.trim(),
      nickname: document.getElementById('su-nickname').value.trim() || null,
      email:    document.getElementById('su-email').value.trim(),
      role,
    });
    alert(`${role === 'mentor' ? '멘토' : '멘티'}로 회원가입이 완료되었습니다. 로그인해 주세요.`);
    navigate('login');
  } catch (e) {
    serverError.textContent = e.message;
    serverError.style.display = 'block';
  }
}
window.handleSignup = handleSignup;

// ════════════════════════════════════════════════════════════
//   MYPAGE
// ════════════════════════════════════════════════════════════
function initMypage() {
  const user = DB.currentUser();
  document.getElementById('mypage-not-logged-in').style.display = user ? 'none' : 'block';
  const container = document.getElementById('mypage-form-container');
  if (!user) { container.innerHTML = ''; return; }
  SpecForm.render(container, user);
}

// ════════════════════════════════════════════════════════════
//   MAIN — KPI counters
// ════════════════════════════════════════════════════════════
function updateMainStats() {
  // 회원 목록은 관리자 전용이므로 총계는 /api/stats 에서 받은 값을 쓴다.
  const { userCount } = DB.stats();
  const specs = DB.getAllSpecs();
  const depts = new Set(specs.map(s => s.dept).filter(Boolean));
  const fields = new Set(specs.map(s => s.dept + '/' + s.field).filter(s => !s.endsWith('/null')));
  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-item"><div class="stat-num">${userCount}</div><div class="stat-label">전체 회원</div></div>
    <div class="stat-item"><div class="stat-num">${specs.length}</div><div class="stat-label">스펙 입력 데이터</div></div>
    <div class="stat-item"><div class="stat-num">${depts.size}</div><div class="stat-label">커버 학과 수</div></div>
    <div class="stat-item"><div class="stat-num">${fields.size}</div><div class="stat-label">진출 분야 데이터</div></div>
  `;

  // 멘토·멘티 카운트 스트립
  const rc = DB.countByRole();
  const total = rc.mentor + rc.mentee;
  const mentorPct = total ? Math.round(rc.mentor / total * 100) : 0;
  const menteePct = total ? Math.round(rc.mentee / total * 100) : 0;
  document.getElementById('mm-cards').innerHTML = `
    <div class="mm-card mm-card--mentor">
      <div class="mm-card-top">
        <div class="mm-card-emoji">👔</div>
        <div class="mm-card-title">
          <div class="mm-card-name">멘토</div>
          <div class="mm-card-sub">스펙·경험 공유</div>
        </div>
        <div class="mm-card-share">${mentorPct}%</div>
      </div>
      <div class="mm-card-num">${rc.mentor}<span class="mm-card-unit">명</span></div>
      <div class="mm-card-meta">
        <i class="ti ti-database"></i>
        <span>스펙 입력 완료 <b>${specs.length}건</b></span>
      </div>
      <div class="mm-card-cta" onclick="navigate('signup')">멘토로 가입하기 →</div>
    </div>

    <div class="mm-card mm-card--mentee">
      <div class="mm-card-top">
        <div class="mm-card-emoji">🎓</div>
        <div class="mm-card-title">
          <div class="mm-card-name">멘티</div>
          <div class="mm-card-sub">데이터로 커리어 설계</div>
        </div>
        <div class="mm-card-share">${menteePct}%</div>
      </div>
      <div class="mm-card-num">${rc.mentee}<span class="mm-card-unit">명</span></div>
      <div class="mm-card-meta">
        <i class="ti ti-map-2"></i>
        <span>탐색 가능한 학과 <b>${depts.size || 8}개</b></span>
      </div>
      <div class="mm-card-cta" onclick="navigate('signup')">멘티로 가입하기 →</div>
    </div>
  `;
}

// ── 사이드바 NCS 직업 분류 검색 (career page) ───────────────
function filterMajors(q) {
  const query = q.trim();
  let shown = 0;
  document.querySelectorAll('#job-major-list .job-major-item').forEach(el => {
    // 분류명("금융·보험")과 번호("03") 어느 쪽으로도 찾을 수 있게 한다.
    const name = el.querySelector('.dept-label').textContent;
    const num  = el.querySelector('.jm-code').textContent;
    const hit  = !query || name.includes(query) || num.includes(query);
    el.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
  document.getElementById('job-major-list-empty').style.display = shown ? 'none' : 'block';
}
window.filterMajors = filterMajors;
