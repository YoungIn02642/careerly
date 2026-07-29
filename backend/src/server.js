require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('./store');
const { DEMO_SEED, generateRandom } = require('./demo-seed');
const { classify: classifyCompany, suggest: suggestCompany, stats: classifyStats, CORP_TYPE_ID } = require('./company-classify');
const { catalog: certCatalog, searchCerts } = require('./cert-catalog');
const { catalog: jobCatalog } = require('./wage-jobs');
const { catalog: majorCatalog, deptOf, searchMajors } = require('./major-catalog');
const OAuth = require('./oauth');
const recommendationsRouter = require("./routes/recommendations");
const careerDataRouter = require("./routes/careerData");
const casAnalyzeRouter = require("./routes/casAnalyze");
const jdCoachRouter = require("./routes/jdCoach");
const newsRouter = require("./routes/news");
const { router: mentoringRouter } = require("./routes/mentoring");
const { router: paymentsRouter } = require("./routes/payments");

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
app.use("/api/jd", jdCoachRouter);
app.use("/api/news", newsRouter);
/* 멘토링·결제는 로그인한 사람의 행동이다. 라우터 안에서 req.user 를 보므로
   세션을 먼저 붙여 준다(전역 requireAuth 는 아니다 — 가격표는 비로그인도 본다). */
app.use(["/api/mentoring", "/api/payments"], (req, res, next) => {
  req.user = getCurrentUser(req);
  next();
});
app.use("/api/mentoring", mentoringRouter);
app.use("/api/payments", paymentsRouter);

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role || null,        // 'mentor' (졸업 선배) | 'mentee' (재학 후배)
    nickname: user.nickname ?? null,
    provider: user.provider || null,          // 'naver' | 'kakao' | null(일반 가입)
    /* 소셜 가입 직후엔 역할이 없다. 화면이 추가입력으로 보낼지 판단하는 값이라
       명시적으로 내려준다 — role 이 null 인 것을 화면마다 따로 해석하면 어긋난다. */
    needsOnboarding: !user.role,
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
  const { username, password, name, email, role, nickname } = req.body || {};

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
  /* 닉네임은 선택. 안 보내면 null 로 두고 화면이 이름을 가려서 쓴다.
     화면 곳곳에 이름 대신 들어가는 값이라 길이만 막아둔다. */
  const trimmedNickname = typeof nickname === 'string' ? nickname.trim() : '';
  if (trimmedNickname && (trimmedNickname.length < 2 || trimmedNickname.length > 12)) {
    return res.status(400).json({ error: '닉네임은 2~12자여야 합니다.' });
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
    nickname: trimmedNickname || null,
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  db.profiles.push({ userId: user.id, nickname: user.nickname });
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
  /* 소셜 계정은 passwordHash 가 없다. 그대로 bcrypt.compare 에 넘기면 예외가 나
     500 이 떨어진다. 어느 방식으로 가입했는지 알려주는 편이 사용자에게도 낫다. */
  if (!user.passwordHash) {
    const label = OAuth.PROVIDERS[user.provider]?.label || '소셜';
    return res.status(401).json({ error: `${label} 로그인으로 가입한 계정이에요. ${label} 버튼으로 로그인해 주세요.` });
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

/* ── 소셜 로그인 ─────────────────────────────────────────────
   흐름과 보안 판단은 src/oauth.js 머리주석에 있다.

   콜백은 화면을 직접 그리지 않고 프론트로 리다이렉트한다. SPA 라서 서버가 HTML 을
   따로 만들면 화면이 두 벌이 된다. 결과는 해시로만 알린다.
     #onboarding  — 가입은 됐고 멘토/멘티·닉네임을 아직 안 받음
     #main        — 기존 계정으로 로그인 완료
     #login?error= — 실패 (사유를 화면이 보여준다) */
function startSession(res, db, user) {
  const token = nanoid(48);
  db.sessions = db.sessions.filter(s => s.expiresAt > Date.now() && s.userId !== user.id);
  db.sessions.push({ token, userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + ONE_DAY });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_DAY,
  });
}

// 화면이 어떤 소셜 버튼을 보여줄지 — 키가 없는 제공자는 버튼도 띄우지 않는다
app.get('/api/auth/providers', (req, res) => res.json({ providers: OAuth.enabledProviders() }));

/* :provider 는 /api/auth/me · /api/auth/providers 까지 삼킨다.
   **모르는 이름이면 반드시 next() 로 흘려보내야** 로그인 상태 조회가 살아남는다.
   (여기서 404 를 돌려주면 GET /api/auth/me 가 죽어 로그인이 통째로 깨진다.) */
app.get('/api/auth/:provider', (req, res, next) => {
  const name = req.params.provider;
  if (!OAuth.PROVIDERS[name]) return next();
  if (!OAuth.isEnabled(name)) {
    return res.redirect('/#login?error=' + encodeURIComponent(
      `${OAuth.PROVIDERS[name].label} 로그인이 아직 설정되지 않았어요.`));
  }
  const state = OAuth.issueState(res);
  res.redirect(OAuth.buildAuthUrl(name, req, state));
});

app.get('/api/auth/:provider/callback', async (req, res, next) => {
  const name = req.params.provider;
  if (!OAuth.PROVIDERS[name]) return next();
  const fail = msg => res.redirect('/#login?error=' + encodeURIComponent(msg));

  if (!OAuth.isEnabled(name)) return fail('지원하지 않는 로그인 방식입니다.');
  if (req.query.error) return fail('로그인이 취소되었습니다.');
  if (!OAuth.verifyState(req, res)) return fail('로그인 요청이 만료되었어요. 다시 시도해 주세요.');
  if (!req.query.code) return fail('인증 코드를 받지 못했습니다.');

  try {
    const token = await OAuth.exchangeCode(name, req, req.query.code, req.query.state);
    const profile = await OAuth.fetchProfile(name, token);

    const db = readDb();
    let user = db.users.find(u => u.provider === name && u.providerId === profile.id);

    if (!user) {
      /* 같은 이메일의 일반 계정이 있으면 자동으로 잇지 않는다 — 이유는 oauth.js 주석.
         연결 기능을 만들기 전까지는 안내로 막는다. */
      const email = (profile.email || '').toLowerCase();
      if (email && db.users.some(u => u.email === email)) {
        return fail('이미 같은 이메일로 가입된 계정이 있어요. 아이디로 로그인해 주세요.');
      }

      user = {
        id: nanoid(),
        /* 소셜 계정은 아이디·비밀번호가 없다. username 은 화면·조회에서 키로 쓰이므로
           겹치지 않게 만들어 둔다. passwordHash 가 없으므로 일반 로그인은 통과하지 못한다. */
        username: `${name}_${profile.id}`,
        passwordHash: null,
        provider: name,
        providerId: profile.id,
        name: profile.name || `${OAuth.PROVIDERS[name].label} 사용자`,
        email: email || null,
        role: null,              // 멘토/멘티는 다음 화면에서 받는다
        nickname: null,
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      db.profiles.push({ userId: user.id, nickname: null });
    }

    startSession(res, db, user);
    writeDb(db);

    // 역할이 없으면 추가입력 화면으로 — 역할 없이는 스펙 폼도 통계도 성립하지 않는다
    res.redirect(user.role ? '/#main' : '/#onboarding');
  } catch (e) {
    console.warn('소셜 로그인 실패:', e.message);
    fail(e.message || '로그인에 실패했습니다.');
  }
});

/* 소셜 가입 직후 받는 값. 이미 역할이 정해진 계정은 여기서 바꾸지 못하게 한다 —
   역할이 바뀌면 그동안 쌓인 스펙이 어느 통계에 속하는지 흔들린다. */
app.post('/api/auth/onboarding', requireAuth, (req, res) => {
  const { role, nickname } = req.body || {};
  if (!['mentor', 'mentee'].includes(role)) {
    return res.status(400).json({ error: '회원 유형(멘토/멘티)을 선택해주세요.' });
  }
  const nick = typeof nickname === 'string' ? nickname.trim() : '';
  if (nick && (nick.length < 2 || nick.length > 12)) {
    return res.status(400).json({ error: '닉네임은 2~12자여야 합니다.' });
  }

  const db = readDb();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
  if (user.role) return res.status(409).json({ error: '이미 회원 유형이 정해진 계정입니다.' });

  user.role = role;
  if (nick) user.nickname = nick;
  const profile = db.profiles.find(p => p.userId === user.id);
  if (profile) profile.nickname = user.nickname;
  writeDb(db);

  res.json({ message: '가입이 완료되었습니다.', user: publicUser(user) });
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
  /* 허용 목록 방식이라 **새 필드를 여기 추가하지 않으면 조용히 버려진다.**
     화면에서는 저장한 것처럼 보이는데 다시 열면 비어 있어 원인을 찾기 어렵다.
     스펙 입력 폼에 칸을 늘렸다면 반드시 여기도 같이 늘릴 것.
       major             — 학생이 적은 학과명(자유). dept 는 그걸 묶는 통계 분류다
       careers           — 멘토의 경력 [{company,start,end,current,position,job,desc}]
       interestCompanies — 멘티의 관심 기업 (이름 배열)
       certMeta          — 직접 입력한 자격증의 발급기관·취득일 { 이름: {issuer,date} } */
  const allowed = [
    'dept', 'major', 'field', 'job', 'company', 'corpType', 'gpa', 'gpaMax',
    'certs', 'certMeta', 'scores', 'qual', 'detail', 'activities',
    'careers', 'interestCompanies',
  ];
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
  /* 판정에 실패했으면 corpType 을 주지 않는다.
     예전에는 matched:false 여도 'small' 을 내려보냈다. 지금 호출하는 화면은
     matched 를 보고 걸러내지만, 그걸 잊은 다음 호출자가 생기면 **회사를 못 찾은 것**과
     **중소기업으로 확인된 것**이 구분되지 않은 채 저장된다. 값 자체를 비워
     실수할 수 없게 만든다. */
  res.json({
    company: name,
    corpType: r.matched ? (CORP_TYPE_ID[r.type] || null) : null,
    label: r.matched ? r.type : null,
    source: r.source,
    matched: r.matched,        // false = 명단에 없다. 회원이 직접 골라야 한다.
    /* 못 찾았을 때 점수 계산에 실제로 쓰이는 값 — 화면에서 "×1.0 으로 계산됩니다" 를
       설명하려면 이게 필요하다. corpType 과 분리해 두어야 저장으로 새지 않는다. */
    fallbackCorpType: r.matched ? null : 'small',
  });
});

/* 회사명 자동완성 — '삼성' → 삼성전자 · 삼성물산 …
   분류와 같은 로컬 캐시를 보므로 입력 중 타이핑마다 불러도 외부 API 를 타지 않는다. */
app.get('/api/company/suggest', (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  res.json({ query: q, items: q ? suggestCompany(q, limit) : [] });
});

// 분류 캐시 상태 — 배치를 돌렸는지 확인용
app.get('/api/company/stats', (req, res) => res.json(classifyStats()));

/* ── 자격증 카탈로그 ────────────────────────────────────────────
   스펙 입력 화면의 자격증 선택 목록. 국가자격(큐넷 API 캐시) + 민간자격(수기).
   650종 남짓 · 60KB 정도라 페이징 없이 통째로 준다 — 프론트가 한 번 받아
   메모리에서 검색하면 입력 중 서버를 다시 부를 일이 없다.
   내용이 하루에도 바뀌는 데이터가 아니므로 캐시를 길게 잡는다. */
app.get('/api/certs', (req, res) => {
  res.set('Cache-Control', 'no-cache');   // ETag 로 재검증 — 아래 /api/jobs 주석 참고
  res.json(certCatalog());
});

/* 자격증 검색 — /api/company/suggest · /api/majors/suggest 와 같은 규약(q · limit → items). */
app.get('/api/certs/suggest', (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  res.json({ query: q, items: q ? searchCerts(q, limit) : [] });
});

/* ── 직업 분류 (커리어 로드맵) ──────────────────────────────────
   한국고용직업분류 대분류 10 → 중분류 35 → 직업 461 (임금·전망 포함).
   200KB 남짓이라 초기 로딩에 얹지 않고, 로드맵 화면을 처음 열 때만 받아 간다.

   ── max-age 를 길게 주면 안 된다 (실측으로 데였다) ──
   처음엔 'public, max-age=86400' 을 줬다. 분류와 임금이 하루에 바뀌는 값이 아니라서
   맞다고 봤는데, **응답에 필드를 하나 추가했더니 화면에 undefined 가 떴다.**
   max-age 가 살아 있는 동안 브라우저는 서버에 묻지도 않고 옛 본문을 쓴다 —
   서버를 재시작해도, 코드를 고쳐도 하루 동안 반영되지 않는다.

   그래서 'no-cache' 로 둔다. 이름과 달리 '캐시 금지'가 아니라 **쓰기 전에 물어보라**는
   뜻이다. express 가 붙여 주는 ETag 로 재검증해서, 안 바뀌었으면 304(본문 없음)로
   끝나고 바뀌었을 때만 200KB 를 다시 받는다. 대역폭은 거의 그대로면서 갱신은 즉시 된다. */
app.get('/api/jobs', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(jobCatalog());
});

/* ── 학과 카탈로그 ────────────────────────────────────────────
   스펙 입력의 '학과' 검색 목록. 지금은 손으로 추린 임시 목록이고,
   커리어넷 학과정보 키가 나오면 수집 스크립트로 교체한다(major-catalog.js 주석).

   dept 는 careerly 통계를 묶는 키다. 학과명만 저장하면 스펙이 수천 갈래로 흩어져
   합격자 평균이 무의미해지므로, 학과명과 함께 어느 분류로 묶이는지도 같이 준다. */
app.get('/api/majors', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(majorCatalog());
});

/* 학과 검색 — 입력할 때마다 부른다(프론트가 debounce 로 묶는다).
   회사명 자동완성(/api/company/suggest)과 같은 규약이다: q · limit 을 받고
   { items: [...] } 를 돌려준다. 세 검색이 같은 모양이라야 프론트 부품 하나로 끝난다.

   지금 카탈로그는 193개라 목록을 통째로 내려도 되지만, 커리어넷 학과정보 키가 나오면
   수천 개가 된다. 그때 구조를 다시 바꾸지 않도록 처음부터 서버 검색으로 둔다. */
app.get('/api/majors/suggest', (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  res.json({ query: q, items: q ? searchMajors(q, limit) : [] });
});

/* 목록에 없는 학과명을 직접 적었을 때 어느 분류로 묶일지 알려준다.
   못 맞추면 dept:null — 화면이 '직접 골라주세요'로 빠진다. */
app.get('/api/majors/classify', (req, res) => {
  const name = String(req.query.name || '').trim();
  res.json({ major: name, dept: deptOf(name) });
});

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
