// ════════════════════════════════════════════════════════════
//  CAREERLY — App Bootstrap (라우터 + 인증)
// ════════════════════════════════════════════════════════════
const PAGES = ['main', 'login', 'signup', 'mypage', 'career', 'backoffice', 'mentoring'];

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
  if (page !== 'mentoring') updateNavActive(page === 'career' ? 'career' : '');

  if (page === 'mypage')     initMypage();
  if (page === 'career')     { CareerPage.refreshUser(); CareerPage.render(); }
  if (page === 'backoffice') Backoffice.render(document.querySelector('#page-backoffice .bo-wrap'));
  if (page === 'main')       { if (window.renderHome) renderHome(); }
  if (page === 'mentoring')  loadMentoringFrame();

  updateNavAuth();
}

function navigate(page) {
  history.pushState({ page }, '', '#' + page);
  showPage(page);
}
window.navigate = navigate;

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
  if (user) {
    navAuth.style.display = 'none';
    navUser.style.display = 'flex';
    navName.textContent = (user.nickname || user.name || user.username) + '님';
  } else {
    navAuth.style.display = 'flex';
    navUser.style.display = 'none';
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

function handleLogout() {
  DB.logout();
  updateNavAuth();
  navigate('main');
}
window.handleLogout = handleLogout;

// ── Boot ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  CareerPage.init();
  const hash = window.location.hash.replace('#', '') || 'main';
  const target = PAGES.includes(hash) ? hash : 'main';
  document.getElementById('page-career').style.display = 'none';
  history.replaceState({ page: target }, '', '#' + target);
  showPage(target);
  updateNavAuth();
});

// ════════════════════════════════════════════════════════════
//   LOGIN
// ════════════════════════════════════════════════════════════
function handleLogin() {
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
    const user = DB.authenticate(username, password);
    DB.login(user);
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
['username','password','password-confirm','name','email'].forEach(id => {
  document.addEventListener('input', e => {
    if (e.target.id === 'su-' + id) clearFieldErr(id);
  });
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
  if (!em) { showFieldErr('email', '이메일을 입력해주세요.'); valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { showFieldErr('email', '올바른 이메일 형식을 입력해주세요.'); valid = false; }
  return valid;
}

function handleSignup() {
  const serverError = document.getElementById('signup-server-error');
  serverError.style.display = 'none';
  if (!validateSignup()) return;
  const role = document.querySelector('input[name="role"]:checked')?.value;
  try {
    DB.createUser({
      username: document.getElementById('su-username').value.trim(),
      password: document.getElementById('su-password').value,
      name:     document.getElementById('su-name').value.trim(),
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
  const users = DB.getUsers();
  const specs = DB.getAllSpecs();
  const depts = new Set(specs.map(s => s.dept).filter(Boolean));
  const fields = new Set(specs.map(s => s.dept + '/' + s.field).filter(s => !s.endsWith('/null')));
  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-item"><div class="stat-num">${users.length}</div><div class="stat-label">전체 회원</div></div>
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

// ════════════════════════════════════════════════════════════
//   MENTORING (격리 프레임 — 최초 진입 시 1회 로드)
// ════════════════════════════════════════════════════════════
function loadMentoringFrame() {
  const frame = document.getElementById('mentoring-frame');
  if (frame && !frame.getAttribute('src')) {
    frame.setAttribute('src', 'mentoring.html');
  }
}

// ── 사이드바 학과 검색 (career page) ────────────────────────
function filterDepts(q) {
  document.querySelectorAll('.dept-item').forEach(el => {
    el.style.display = el.querySelector('.dept-label').textContent.includes(q) ? '' : 'none';
  });
}
window.filterDepts = filterDepts;
