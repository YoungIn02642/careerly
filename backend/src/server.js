require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('./store');
const { DEMO_SEED, generateRandom } = require('./demo-seed');
const { classify: classifyCompany, stats: classifyStats, CORP_TYPE_ID } = require('./company-classify');
const recommendationsRouter = require("./routes/recommendations");
const careerDataRouter = require("./routes/careerData");
const casAnalyzeRouter = require("./routes/casAnalyze");

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_COOKIE = 'careerly_session';
const ONE_DAY = 24 * 60 * 60 * 1000;

/* origin:true 는 모든 출처에 쿠키 실은 요청을 허용해 CSRF 에 노출된다.
   운영에서는 ALLOWED_ORIGINS 로 배포 도메인만 허용한다.
   프론트를 같은 서버가 서빙하므로(same-origin) 평소엔 CORS 자체가 필요 없다. */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.set('trust proxy', 1);   // Render/Railway 등 프록시 뒤에서 secure 쿠키가 동작하려면 필요
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : false)
    : true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');

// 프론트엔드는 careerly.html 단일 문서 SPA (해시 라우팅). / 로 들어오면 그걸 준다.
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'careerly.html')));

app.use(express.static(FRONTEND_DIR));
app.use("/api/career-data", careerDataRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/cas", casAnalyzeRouter);

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role || null,        // 'mentor' (졸업 선배) | 'mentee' (재학 후배)
    nickname: user.nickname ?? null,
  };
}

function getCurrentUser(req) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;

  const db = readDb();
  const session = db.sessions.find(s => s.token === token && s.expiresAt > Date.now());
  if (!session) return null;

  return db.users.find(u => u.id === session.userId) || null;
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  req.user = user;
  next();
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{4,20}$/.test(username);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]).{8,20}$/.test(password);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'careerly-backend' });
});

app.post('/api/auth/signup', async (req, res) => {
  const { username, password, name, email, role } = req.body || {};

  if (!username || !password || !name || !email) {
    return res.status(400).json({ error: '필수 입력값이 누락되었습니다.' });
  }
  if (!['mentor', 'mentee'].includes(role)) {
    return res.status(400).json({ error: '회원 유형(멘토/멘티)을 선택해주세요.' });
  }
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: '아이디는 영문, 숫자, 밑줄 포함 4~20자여야 합니다.' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: '비밀번호는 8~20자이며 영문·숫자·특수문자를 모두 포함해야 합니다.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
  }

  const db = readDb();
  const normalizedUsername = username.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (db.users.some(u => u.username === normalizedUsername)) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  }
  if (db.users.some(u => u.email === normalizedEmail)) {
    return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(),
    username: normalizedUsername,
    passwordHash,
    name: name.trim(),
    email: normalizedEmail,
    role,
    nickname: null,
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  db.profiles.push({ userId: user.id, nickname: null });
  writeDb(db);

  res.status(201).json({ message: '회원가입이 완료되었습니다.', user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }

  const db = readDb();
  const user = db.users.find(u => u.username === username.trim());
  if (!user) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  const token = nanoid(48);
  db.sessions = db.sessions.filter(s => s.expiresAt > Date.now() && s.userId !== user.id);
  db.sessions.push({ token, userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + ONE_DAY });
  writeDb(db);

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',   // HTTPS 에서만 전송
    maxAge: ONE_DAY,
  });
  res.json({ message: '로그인 성공', user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  const db = readDb();
  db.sessions = db.sessions.filter(s => s.token !== token);
  writeDb(db);
  res.clearCookie(SESSION_COOKIE);
  res.json({ message: '로그아웃되었습니다.' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get('/api/profile', requireAuth, (req, res) => {
  const db = readDb();
  const profile = db.profiles.find(p => p.userId === req.user.id) || { userId: req.user.id };
  res.json({ profile });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const allowed = ['nickname', 'university', 'gpa', 'currentJob', 'pastExperience', 'certifications', 'projects', 'internship', 'tips'];
  const db = readDb();
  let profile = db.profiles.find(p => p.userId === req.user.id);

  if (!profile) {
    profile = { userId: req.user.id };
    db.profiles.push(profile);
  }

  allowed.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      profile[key] = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
    }
  });
  profile.updatedAt = new Date().toISOString();
  writeDb(db);

  res.json({ message: '프로필이 저장되었습니다.', profile });
});

/* ── 회원 스펙 (커리어 로드맵 집계의 원천) ─────────────────────
   userSpecs: [{ userId, dept, field, job, company, corpType, gpa, gpaMax, certs, scores, qual, detail, activities }]
   activities: [{ type, name, duration, role, stage, outcome }] — 설문(구글폼) 대표활동 구조.
               CAS 정성 점수(computeQual)의 입력이다. 옛 스펙의 boolean qual 도 함께 호환.
   corpType: 'large' | 'mid' | 'small' | 'public' — 커리어 로드맵의 기업유형 4분류.
             옛 스펙에는 없다(undefined). 그런 스펙은 유형별 집계에서 빠지고
             중분류 전체 집계에만 잡힌다.
   company : 회사명. corpType 자동판정의 입력이다. 판정은 어디까지나 추천이고
             최종 corpType 은 회원이 고른 값을 그대로 저장한다(자동판정을
             덮어쓰지 않는다) — 명단에 없는 회사가 훨씬 많기 때문.
   회원당 1건. userId 가 PK. */

// 집계용 전체 조회. 누가 입력했는지는 내보내지 않는다 —
// 학점·자격증은 개인정보이고, 화면은 분포만 필요로 한다.
app.get('/api/specs', (req, res) => {
  const db = readDb();
  const specs = (db.userSpecs || []).map(({ userId, detail, ...rest }) => rest);
  res.json({ specs });
});

// 내 스펙 조회 / 저장
app.get('/api/specs/me', requireAuth, (req, res) => {
  const db = readDb();
  const spec = (db.userSpecs || []).find(s => s.userId === req.user.id) || null;
  res.json({ spec });
});

app.put('/api/specs/me', requireAuth, (req, res) => {
  const allowed = ['dept', 'field', 'job', 'company', 'corpType', 'gpa', 'gpaMax', 'certs', 'scores', 'qual', 'detail', 'activities'];
  const db = readDb();
  if (!db.userSpecs) db.userSpecs = [];

  const idx = db.userSpecs.findIndex(s => s.userId === req.user.id);
  const incoming = {};
  allowed.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) incoming[k] = req.body[k];
  });

  const now = new Date().toISOString();
  if (idx >= 0) {
    db.userSpecs[idx] = { ...db.userSpecs[idx], ...incoming, updatedAt: now };
  } else {
    db.userSpecs.push({ userId: req.user.id, ...incoming, createdAt: now, updatedAt: now });
  }
  writeDb(db);
  res.json({ message: '스펙이 저장되었습니다.', spec: db.userSpecs[idx >= 0 ? idx : db.userSpecs.length - 1] });
});

// 닉네임 등 회원 정보 수정
app.put('/api/users/me', requireAuth, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });

  if (Object.prototype.hasOwnProperty.call(req.body, 'nickname')) {
    const n = req.body.nickname;
    user.nickname = typeof n === 'string' ? n.trim() || null : null;
  }
  writeDb(db);
  res.json({ message: '저장되었습니다.', user: publicUser(user) });
});

// 멘토/멘티 회원 수 — 홈·백오피스의 통계 카드용. 개인정보는 내보내지 않는다.
app.get('/api/stats', (req, res) => {
  const db = readDb();
  const users = db.users || [];
  res.json({
    counts: {
      mentor:  users.filter(u => u.role === 'mentor').length,
      mentee:  users.filter(u => u.role === 'mentee').length,
      unknown: users.filter(u => !u.role).length,
    },
    userCount: users.length,
    specCount: (db.userSpecs || []).length,
  });
});

/* ── 회사명 → 기업 규모 자동 분류 ──────────────────────────────
   공식 명단(공정위 대규모기업집단 / 공공기관 지정현황) 기반 조회.
   로컬 캐시만 보므로 외부 API 를 부르지 않는다 — 입력할 때마다 호출돼도 즉시 답한다.
   판정은 추천일 뿐이라 회원이 화면에서 고쳐 저장할 수 있다. */
app.get('/api/company/classify', (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: '회사명이 필요합니다.' });

  const r = classifyCompany(name);
  res.json({
    company: name,
    corpType: CORP_TYPE_ID[r.type] || 'small',   // 프론트 드롭다운 값과 맞춘다
    label: r.type,
    source: r.source,
    matched: r.matched,        // false = 명단에 없어 기본값. 회원이 직접 골라야 한다.
  });
});

// 분류 캐시 상태 — 배치를 돌렸는지 확인용
app.get('/api/company/stats', (req, res) => res.json(classifyStats()));

/* ── 백오피스 (개발 전용) ──────────────────────────────────────
   회원 목록 조회·삭제, 데모 시드, 전체 초기화. 인증·권한 체계가 아직 없으므로
   운영 환경에서는 전부 404 로 막는다. 관리자 역할을 도입하기 전까지의 임시 조치. */
const IS_PROD = process.env.NODE_ENV === 'production';

function devOnly(req, res, next) {
  if (IS_PROD) return res.status(404).json({ error: '요청한 경로를 찾을 수 없습니다.' });
  next();
}

app.get('/api/admin/users', devOnly, (req, res) => {
  const db = readDb();
  res.json({ users: (db.users || []).map(publicUser) });
});

app.delete('/api/admin/users/:username', devOnly, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });

  db.users    = db.users.filter(u => u.id !== user.id);
  db.profiles = (db.profiles || []).filter(p => p.userId !== user.id);
  db.sessions = (db.sessions || []).filter(s => s.userId !== user.id);
  db.userSpecs = (db.userSpecs || []).filter(s => s.userId !== user.id);
  writeDb(db);
  res.json({ message: '삭제되었습니다.' });
});

app.post('/api/admin/clear', devOnly, (req, res) => {
  const db = readDb();
  db.users = []; db.profiles = []; db.sessions = []; db.userSpecs = [];
  writeDb(db);
  res.clearCookie(SESSION_COOKIE);
  res.json({ message: '초기화되었습니다.' });
});

app.post('/api/admin/seed', devOnly, async (req, res) => {
  const db = readDb();
  if (!db.userSpecs) db.userSpecs = [];

  // 고정 데모는 계정마다 비밀번호가 다를 수 있어 개별 해싱한다
  for (const { u, s } of DEMO_SEED) {
    if (db.users.some(x => x.username === u.username)) continue;
    await insertSeedUser(db, u, s, await bcrypt.hash(u.password, 10));
  }
  writeDb(db);
  res.json({ message: '데모 데이터가 추가되었습니다.' });
});

// 무작위 N명 추가 — 커리어 로드맵·CAS 집계를 채우기 위한 대량 시드
app.post('/api/admin/seed-random', devOnly, async (req, res) => {
  const count = Math.min(Math.max(parseInt(req.body?.count, 10) || 50, 1), 200);
  const db = readDb();
  if (!db.userSpecs) db.userSpecs = [];

  // 무작위 계정은 비밀번호가 모두 같으므로 해시를 한 번만 계산해 재사용한다
  const sharedHash = await bcrypt.hash('demo1234!', 10);
  let added = 0;
  for (const { u, s } of generateRandom(count)) {
    if (db.users.some(x => x.username === u.username || x.email === u.email)) continue;
    insertSeedUser(db, u, s, sharedHash);
    added++;
  }
  writeDb(db);
  res.json({ message: `무작위 회원 ${added}명이 추가되었습니다.`, added });
});

function insertSeedUser(db, u, s, passwordHash) {
  const user = {
    id: nanoid(),
    username: u.username, passwordHash,
    name: u.name, email: u.email, role: u.role,
    nickname: null, createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  db.profiles.push({ userId: user.id, nickname: null });
  if (s) db.userSpecs.push({ userId: user.id, ...s, createdAt: new Date().toISOString() });
}

app.get('/api/departments', (req, res) => {
  const db = readDb();
  res.json({ departments: db.departments });
});

app.get('/api/career-specs', (req, res) => {
  const { departmentId, jobId } = req.query;
  const db = readDb();
  let specs = db.careerSpecs;
  if (departmentId) specs = specs.filter(s => s.departmentId === departmentId);
  if (jobId) specs = specs.filter(s => s.jobId === jobId);
  res.json({ specs });
});

app.get('/api/jobs/:jobId/specs', (req, res) => {
  const db = readDb();
  const spec = db.careerSpecs.find(s => s.jobId === req.params.jobId);
  if (!spec) return res.status(404).json({ error: '해당 직무 데이터를 찾을 수 없습니다.' });
  res.json({ spec });
});

app.use((req, res) => {
  res.status(404).json({ error: '요청한 경로를 찾을 수 없습니다.' });
});

app.listen(PORT, () => {
  console.log(`Careerly backend running on http://localhost:${PORT}`);
});
