// ════════════════════════════════════════════════════════════
//  CAREERLY  —  Data layer (백엔드 API)
//
//  이전에는 localStorage 를 저장소로 썼다. 그 구조에서는 회원마다 자기
//  브라우저의 데이터만 볼 수 있어 "선배 데이터 n명" 집계가 성립하지 않았고,
//  비밀번호가 평문으로 저장됐다. 지금은 모든 데이터가 서버에 있다.
//
//  ── 동기 읽기 / 비동기 쓰기 ──
//  currentUser(), getAllSpecs() 는 렌더 도중 동기적으로 호출된다
//  (career.js, aggregation.js, home.js …). 그래서 부팅 시 hydrate() 로
//  서버 상태를 메모리에 한 번 받아두고, 읽기는 캐시에서 동기로 준다.
//  데이터를 바꾸는 함수는 async 이며, 성공 후 캐시를 갱신한다.
// ════════════════════════════════════════════════════════════
window.DB = (() => {
  // ── 캐시 ───────────────────────────────────────────────────
  let _me     = null;   // 로그인한 회원 (publicUser) | null
  let _specs  = [];     // 전체 스펙 (익명 — 집계용)
  let _mySpec = null;   // 내 스펙 (detail 포함)
  let _users  = [];     // 백오피스 전용. refreshUsers() 로 채운다
  let _counts = { mentor: 0, mentee: 0, unknown: 0 };
  let _stats  = { userCount: 0, specCount: 0 };   // 홈 KPI. 회원 목록 없이도 총계를 안다

  // ── HTTP ───────────────────────────────────────────────────
  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      credentials: 'include',                 // 세션 쿠키 동봉
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* 본문 없음 */ }
    if (!res.ok) throw new Error(data?.error || `요청에 실패했습니다. (${res.status})`);
    return data;
  }

  /* 로그인하지 않았을 때의 401 은 오류가 아니라 정상 상태다. */
  async function apiOrNull(path) {
    try { return await api('GET', path); }
    catch { return null; }
  }

  // ── 부팅 시 서버 상태를 캐시로 ─────────────────────────────
  async function hydrate() {
    const [me, specs, stats] = await Promise.all([
      apiOrNull('/api/auth/me'),
      apiOrNull('/api/specs'),
      apiOrNull('/api/stats'),
    ]);
    _me     = me?.user ?? null;
    _specs  = specs?.specs ?? [];
    if (stats) { _counts = stats.counts; _stats = { userCount: stats.userCount, specCount: stats.specCount }; }
    _mySpec = _me ? (await apiOrNull('/api/specs/me'))?.spec ?? null : null;
  }

  /* 스펙이 바뀐 뒤 집계 화면이 최신값을 보도록 다시 받는다. */
  async function refreshSpecs() {
    const [specs, stats] = await Promise.all([apiOrNull('/api/specs'), apiOrNull('/api/stats')]);
    _specs = specs?.specs ?? [];
    if (stats) { _counts = stats.counts; _stats = { userCount: stats.userCount, specCount: stats.specCount }; }
    _mySpec = _me ? (await apiOrNull('/api/specs/me'))?.spec ?? null : null;
  }

  async function refreshUsers() {
    _users = (await apiOrNull('/api/admin/users'))?.users ?? [];
    return _users;
  }

  // ── 읽기 (동기 · 캐시) ─────────────────────────────────────
  const currentUser = () => _me;
  const getAllSpecs = () => _specs;
  const getUsers    = () => _users;
  const countByRole = () => _counts;
  const stats       = () => _stats;

  /* 예전 시그니처 유지. 서버는 남의 스펙 상세를 주지 않으므로 본인 것만 반환한다. */
  function getSpec(username) {
    return _me && _me.username === username ? _mySpec : null;
  }

  /* 회사명 → 기업 규모 자동 판정. 서버가 로컬 캐시만 보므로 입력 중 호출해도 빠르다.
     실패해도 화면이 멈추면 안 되므로 null 을 돌려주고, 호출부는 회원이 직접
     고르는 흐름으로 넘어간다. */
  async function classifyCompany(name) {
    if (!name || !name.trim()) return null;
    try {
      return await api('GET', `/api/company/classify?name=${encodeURIComponent(name.trim())}`);
    } catch {
      return null;
    }
  }

  // ── 쓰기 (비동기) ──────────────────────────────────────────
  async function createUser({ username, password, name, email, role }) {
    const { user } = await api('POST', '/api/auth/signup', { username, password, name, email, role });
    return user;
  }

  /* 예전에는 authenticate() 로 검증하고 login() 으로 세션을 만들었다.
     서버에서는 한 번의 요청이다. */
  async function login(username, password) {
    const { user } = await api('POST', '/api/auth/login', { username, password });
    _me = user;
    await refreshSpecs();
    return user;
  }

  async function logout() {
    await api('POST', '/api/auth/logout');
    _me = null;
    _mySpec = null;
  }

  async function updateUser(patch) {
    const { user } = await api('PUT', '/api/users/me', patch);
    _me = user;
    return user;
  }

  async function upsertSpec(spec) {
    await api('PUT', '/api/specs/me', spec);
    await refreshSpecs();
  }

  // ── 백오피스 (개발 전용 — 운영에서는 서버가 404 로 막는다) ──
  async function seedDemo() { await api('POST', '/api/admin/seed');  await refreshSpecs(); await refreshUsers(); }
  async function seedRandom(count = 50) {
    const r = await api('POST', '/api/admin/seed-random', { count });
    await refreshSpecs(); await refreshUsers();
    return r;
  }
  async function clearAll() { await api('POST', '/api/admin/clear'); _me = null; _mySpec = null; await refreshSpecs(); await refreshUsers(); }
  async function deleteUser(username) {
    await api('DELETE', `/api/admin/users/${encodeURIComponent(username)}`);
    if (_me?.username === username) { _me = null; _mySpec = null; }
    await refreshSpecs(); await refreshUsers();
  }

  return {
    hydrate, refreshSpecs, refreshUsers,
    currentUser, getAllSpecs, getSpec, getUsers, countByRole, stats,
    createUser, login, logout, updateUser, upsertSpec, classifyCompany,
    seedDemo, seedRandom, clearAll, deleteUser,
  };
})();
