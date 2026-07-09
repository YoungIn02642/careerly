// ════════════════════════════════════════════════════════════
//  CAREERLY  —  Local DB (localStorage backend)
//  Tables:
//   • careerly_users    : 회원 정보 (회원가입 데이터)
//   • careerly_specs    : 스펙 입력 데이터 (회원당 1건, username = PK)
//   • careerly_session  : 현재 로그인 세션
// ════════════════════════════════════════════════════════════
window.DB = (() => {
  const K_USERS    = 'careerly_users';
  const K_SPECS    = 'careerly_specs';
  const K_SESSION  = 'careerly_session';

  function read(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
    catch { return fallback; }
  }
  function write(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  // ── Users ──────────────────────────────────────────────────
  function getUsers() { return read(K_USERS, []); }
  function findUser(username) {
    return getUsers().find(u => u.username === username) || null;
  }
  function createUser({ username, password, name, email, role }) {
    const users = getUsers();
    if (users.some(u => u.username === username))
      throw new Error('이미 사용 중인 아이디입니다.');
    if (users.some(u => u.email === email))
      throw new Error('이미 가입된 이메일입니다.');
    if (!['mentor', 'mentee'].includes(role))
      throw new Error('회원 유형(멘토/멘티)을 선택해주세요.');
    const newUser = {
      username, password, name, email,
      role,                       // 'mentor' (졸업 선배) | 'mentee' (재학 후배)
      nickname: null,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    write(K_USERS, users);
    return newUser;
  }
  function authenticate(username, password) {
    const u = findUser(username);
    if (!u || u.password !== password)
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    return u;
  }
  function updateUser(username, patch) {
    const users = getUsers();
    const idx = users.findIndex(u => u.username === username);
    if (idx < 0) return null;
    users[idx] = { ...users[idx], ...patch };
    write(K_USERS, users);
    return users[idx];
  }

  // ── Session ────────────────────────────────────────────────
  function login(user) { write(K_SESSION, { username: user.username }); }
  function logout()    { localStorage.removeItem(K_SESSION); }
  function currentUser() {
    const s = read(K_SESSION, null);
    if (!s) return null;
    return findUser(s.username);
  }

  // ── Specs ──────────────────────────────────────────────────
  function getAllSpecs() { return read(K_SPECS, []); }
  function getSpec(username) {
    return getAllSpecs().find(s => s.username === username) || null;
  }
  function upsertSpec(username, spec) {
    const all = getAllSpecs();
    const idx = all.findIndex(s => s.username === username);
    const record = {
      ...spec,
      username,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) all[idx] = { ...all[idx], ...record };
    else          all.push({ ...record, createdAt: new Date().toISOString() });
    write(K_SPECS, all);
    return record;
  }
  function deleteSpec(username) {
    write(K_SPECS, getAllSpecs().filter(s => s.username !== username));
  }
  function deleteUser(username) {
    write(K_USERS, getUsers().filter(u => u.username !== username));
    deleteSpec(username);
    const s = read(K_SESSION, null);
    if (s && s.username === username) logout();
  }

  // ── Utility / admin ────────────────────────────────────────
  function clearAll() {
    localStorage.removeItem(K_USERS);
    localStorage.removeItem(K_SPECS);
    localStorage.removeItem(K_SESSION);
  }
  // ── Counts ─────────────────────────────────────────────────
  function countByRole() {
    const users = getUsers();
    return {
      mentor: users.filter(u => u.role === 'mentor').length,
      mentee: users.filter(u => u.role === 'mentee').length,
      unknown: users.filter(u => !u.role).length,
    };
  }

  function seedDemo() {
    // 데모용 시드 데이터 - 회원 5명 + 스펙
    const demo = [
      { u: { username: 'demo_kim', password: 'demo1234!', name: '김민준', email: 'kim@careerly.demo', role: 'mentor' },
        s: { dept: 'cs', field: 'service', job: 'backend',
             gpa: 3.85, gpaMax: 4.5,
             certs: ['정보처리기사', 'SQLD', 'AWS SAA'],
             scores: { toeic: 920, opic: 'IH', toeicSpeaking: 'IH' },
             qual: { extracurricular: true, projects: true, internship: true, oncampus: true,
                     coreCourses: true, langStudy: false, exchange: false, gradSchool: false },
             detail: { projectsText: '캡스톤 — 분산 채팅 백엔드 (3인, 팀장)',
                       internshipText: '카카오 백엔드 인턴 (2개월)',
                       activitiesText: '교내 알고리즘 학회 운영진 2년' } } },
      { u: { username: 'demo_lee', password: 'demo1234!', name: '이서연', email: 'lee@careerly.demo', role: 'mentor' },
        s: { dept: 'cs', field: 'service', job: 'frontend',
             gpa: 3.95, gpaMax: 4.5,
             certs: ['정보처리기사', 'GTQ 1급'],
             scores: { toeic: 880, opic: 'AL' },
             qual: { extracurricular: true, projects: true, internship: false, oncampus: true,
                     coreCourses: true, langStudy: false, exchange: true, gradSchool: false },
             detail: { exchangeText: '핀란드 알토대 1학기' } } },
      { u: { username: 'demo_park', password: 'demo1234!', name: '박지훈', email: 'park@careerly.demo', role: 'mentor' },
        s: { dept: 'business', field: 'finance', job: 'ib',
             gpa: 3.7, gpaMax: 4.5,
             certs: ['금융투자분석사', '투자자산운용사', 'CFA Level 1'],
             scores: { toeic: 950, toefl: 105, opic: 'AL' },
             qual: { extracurricular: true, projects: true, internship: true, oncampus: true,
                     coreCourses: true, langStudy: true, exchange: false, gradSchool: false },
             detail: { internshipText: '미래에셋증권 IB본부 인턴 (3개월)',
                       activitiesText: 'CFA 한국지부 학회 총무' } } },
      { u: { username: 'demo_choi', password: 'demo1234!', name: '최수아', email: 'choi@careerly.demo', role: 'mentor' },
        s: { dept: 'business', field: 'consulting', job: 'strategy',
             gpa: 4.1, gpaMax: 4.5,
             certs: [],
             scores: { toeic: 980, opic: 'AL', toeicSpeaking: 'AL' },
             qual: { extracurricular: true, projects: true, internship: true, oncampus: false,
                     coreCourses: true, langStudy: true, exchange: true, gradSchool: true },
             detail: { gradSchoolText: '서울대 경영전문대학원 (예정)' } } },
      { u: { username: 'demo_jung', password: 'demo1234!', name: '정도윤', email: 'jung@careerly.demo', role: 'mentor' },
        s: { dept: 'business', field: 'finance', job: 'ib',
             gpa: 3.5, gpaMax: 4.5,
             certs: ['금융투자분석사'],
             scores: { toeic: 905 },
             qual: { extracurricular: true, projects: false, internship: true, oncampus: true,
                     coreCourses: true, langStudy: false, exchange: false, gradSchool: false },
             detail: {} } },
    ];
    demo.forEach(({ u, s }) => {
      if (!findUser(u.username)) createUser(u);
      upsertSpec(u.username, s);
    });
    // 멘티 데모 (스펙 없이)
    const mentees = [
      { username: 'mentee_a', password: 'demo1234!', name: '강하늘', email: 'a@careerly.demo', role: 'mentee' },
      { username: 'mentee_b', password: 'demo1234!', name: '윤서윤', email: 'b@careerly.demo', role: 'mentee' },
      { username: 'mentee_c', password: 'demo1234!', name: '임시우', email: 'c@careerly.demo', role: 'mentee' },
    ];
    mentees.forEach(m => { if (!findUser(m.username)) createUser(m); });
  }

  return {
    getUsers, findUser, createUser, authenticate, updateUser,
    login, logout, currentUser,
    getAllSpecs, getSpec, upsertSpec, deleteSpec, deleteUser,
    clearAll, seedDemo, countByRole,
  };
})();
