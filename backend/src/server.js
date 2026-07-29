require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const repo = require('./repo');
const { query, assertConnection } = require('./mysql');
const { DEMO_SEED, generateRandom } = require('./demo-seed');
const { CORP_TYPE_ID } = require('./company-classify');
/* 카탈로그 조회는 DB 에서 한다. 파일 기반 모듈(cert-catalog·major-catalog·
   company-classify·wage-jobs)은 수집·이관 전용으로 남는다 — catalog-db.js 머리주석 참고. */
const catalog = require('./catalog-db');
const OAuth = require('./oauth');
const recommendationsRouter = require("./routes/recommendations");
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
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/cas", casAnalyzeRouter);
app.use("/api/jd", jdCoachRouter);
app.use("/api/news", newsRouter);
/* 멘토링·결제는 로그인한 사람의 행동이다. 라우터 안에서 req.user 를 보므로
   세션을 먼저 붙여 준다(전역 requireAuth 는 아니다 — 가격표는 비로그인도 본다). */
app.use(["/api/mentoring", "/api/payments"], async (req, res, next) => {
  try { req.user = await getCurrentUser(req); next(); }
  catch (e) { next(e); }
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

/* 세션 조회는 DB 왕복이라 비동기다. 예전에는 파일을 통째로 읽어 동기였다.
   호출부가 await 를 빠뜨리면 Promise 가 그대로 user 로 들어가 "로그인된 것처럼"
   보이므로(빈 객체는 truthy), 여기서만 쓰고 라우트는 requireAuth 를 통과시킨다. */
async function getCurrentUser(req) {
  return repo.sessions.userByToken(req.cookies[SESSION_COOKIE]);
}

async function requireAuth(req, res, next) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    req.user = user;
    next();
  } catch (e) { next(e); }
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

  const normalizedUsername = username.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (await repo.users.usernameTaken(normalizedUsername)) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  }
  if (await repo.users.emailTaken(normalizedEmail)) {
    return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await repo.users.create({
    id: nanoid(),
    username: normalizedUsername,
    passwordHash,
    name: name.trim(),
    email: normalizedEmail,
    role,
    nickname: trimmedNickname || null,
  });

  res.status(201).json({ message: '회원가입이 완료되었습니다.', user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }

  const user = await repo.users.byUsername(username.trim());
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

  await startSession(res, user);
  res.json({ message: '로그인 성공', user: publicUser(user) });
});

/* ── 소셜 로그인 ─────────────────────────────────────────────
   흐름과 보안 판단은 src/oauth.js 머리주석에 있다.

   콜백은 화면을 직접 그리지 않고 프론트로 리다이렉트한다. SPA 라서 서버가 HTML 을
   따로 만들면 화면이 두 벌이 된다. 결과는 해시로만 알린다.
     #onboarding  — 가입은 됐고 멘토/멘티·닉네임을 아직 안 받음
     #main        — 기존 계정으로 로그인 완료
     #login?error= — 실패 (사유를 화면이 보여준다) */
async function startSession(res, user) {
  const token = nanoid(48);
  await repo.sessions.create(token, user.id, Date.now() + ONE_DAY);
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

    let user = await repo.users.byProvider(name, profile.id);

    if (!user) {
      /* 같은 이메일의 일반 계정이 있으면 자동으로 잇지 않는다 — 이유는 oauth.js 주석.
         연결 기능을 만들기 전까지는 안내로 막는다. */
      const email = (profile.email || '').toLowerCase();
      if (await repo.users.emailTaken(email)) {
        return fail('이미 같은 이메일로 가입된 계정이 있어요. 아이디로 로그인해 주세요.');
      }

      user = await repo.users.create({
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
      });
    }

    await startSession(res, user);

    // 역할이 없으면 추가입력 화면으로 — 역할 없이는 스펙 폼도 통계도 성립하지 않는다
    res.redirect(user.role ? '/#main' : '/#onboarding');
  } catch (e) {
    console.warn('소셜 로그인 실패:', e.message);
    fail(e.message || '로그인에 실패했습니다.');
  }
});

/* 소셜 가입 직후 받는 값. 이미 역할이 정해진 계정은 여기서 바꾸지 못하게 한다 —
   역할이 바뀌면 그동안 쌓인 스펙이 어느 통계에 속하는지 흔들린다. */
app.post('/api/auth/onboarding', requireAuth, async (req, res) => {
  const { role, nickname } = req.body || {};
  if (!['mentor', 'mentee'].includes(role)) {
    return res.status(400).json({ error: '회원 유형(멘토/멘티)을 선택해주세요.' });
  }
  const nick = typeof nickname === 'string' ? nickname.trim() : '';
  if (nick && (nick.length < 2 || nick.length > 12)) {
    return res.status(400).json({ error: '닉네임은 2~12자여야 합니다.' });
  }

  /* 역할이 이미 있으면 바꾸지 못하게 한다 — 바뀌면 그동안 쌓인 스펙이 어느 통계에
     속하는지 흔들린다. */
  if (req.user.role) return res.status(409).json({ error: '이미 회원 유형이 정해진 계정입니다.' });

  const patch = { role };
  if (nick) patch.nickname = nick;
  const user = await repo.users.update(req.user.id, patch);
  res.json({ message: '가입이 완료되었습니다.', user: publicUser(user) });
});

app.post('/api/auth/logout', async (req, res) => {
  await repo.sessions.deleteByToken(req.cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ message: '로그아웃되었습니다.' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get('/api/profile', requireAuth, async (req, res) => {
  res.json({ profile: await repo.profiles.get(req.user.id) });
});

app.put('/api/profile', requireAuth, async (req, res) => {
  /* 예전에는 아무 키나 받아 파일에 그대로 넣었다. 테이블에는 컬럼이 있는 것만 넣는다
     — 없는 컬럼을 보내면 조용히 버려지는 대신 여기서 걸러진 것이 보인다. */
  const allowed = ['nickname', 'university', 'currentJob', 'tips'];
  const patch = {};
  allowed.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) {
      patch[k] = typeof req.body[k] === 'string' ? req.body[k].trim() : req.body[k];
    }
  });
  const profile = await repo.profiles.update(req.user.id, patch);
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
/* 집계용 전체 목록. userId·detail 은 남의 것이므로 빼고 준다(예전과 같은 규칙). */
app.get('/api/specs', async (req, res) => {
  const all = await repo.specs.listAll();
  res.json({ specs: all.map(({ userId, detail, ...rest }) => rest) });
});

// 내 스펙 조회 / 저장
app.get('/api/specs/me', requireAuth, async (req, res) => {
  res.json({ spec: await repo.specs.byUser(req.user.id) });
});

app.put('/api/specs/me', requireAuth, async (req, res) => {
  /* 허용 목록 방식이라 **새 필드를 여기 추가하지 않으면 조용히 버려진다.**
     화면에서는 저장한 것처럼 보이는데 다시 열면 비어 있어 원인을 찾기 어렵다.
     스펙 입력 폼에 칸을 늘렸다면 여기와 repo.specs.upsert 의 컬럼 표를 함께 늘릴 것.
       major             — 학생이 적은 학과명(자유). dept 는 그걸 묶는 통계 분류다
       careers           — 멘토의 경력 [{company,start,end,current,position,job,desc}]
       interestCompanies — 멘티의 관심 기업 (이름 배열)
       certMeta          — 직접 입력한 자격증의 발급기관·취득일 { 이름: {issuer,date} } */
  const allowed = [
    'dept', 'major', 'field', 'job', 'company', 'corpType', 'gpa', 'gpaMax',
    'certs', 'certMeta', 'scores', 'qual', 'detail', 'activities',
    'careers', 'interestCompanies',
  ];
  const patch = {};
  allowed.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
  });

  const spec = await repo.specs.upsert(req.user.id, patch);
  res.json({ message: '스펙이 저장되었습니다.', spec });
});

// 닉네임 등 회원 정보 수정
app.put('/api/users/me', requireAuth, async (req, res) => {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'nickname')) {
    const n = req.body.nickname;
    patch.nickname = typeof n === 'string' ? n.trim() || null : null;
  }
  const user = await repo.users.update(req.user.id, patch);
  res.json({ message: '저장되었습니다.', user: publicUser(user) });
});

// 멘토/멘티 회원 수 — 홈·백오피스의 통계 카드용. 개인정보는 내보내지 않는다.
app.get('/api/stats', async (req, res) => {
  /* 예전에는 회원 배열을 전부 읽어 세었다. 이제 COUNT 로 센다 —
     회원이 늘어도 응답 크기와 시간이 그대로다. */
  const [counts, userCount, specCount] = await Promise.all([
    repo.users.countByRole(), repo.users.count(), repo.specs.count(),
  ]);
  res.json({
    counts,
    userCount,
    specCount,
  });
});

/* ── 회사명 → 기업 규모 자동 분류 ──────────────────────────────
   공식 명단(공정위 대규모기업집단 / 공공기관 지정현황) 기반 조회.
   로컬 캐시만 보므로 외부 API 를 부르지 않는다 — 입력할 때마다 호출돼도 즉시 답한다.
   판정은 추천일 뿐이라 회원이 화면에서 고쳐 저장할 수 있다. */
app.get('/api/company/classify', async (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: '회사명이 필요합니다.' });

  const r = await catalog.classifyCompany(name);
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
app.get('/api/company/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  res.json({ query: q, items: q ? await catalog.suggestCompanies(q, limit) : [] });
});

// 분류 캐시 상태 — 배치를 돌렸는지 확인용
app.get('/api/company/stats', async (req, res) => res.json(await catalog.companyStats()));

/* ── 자격증 카탈로그 ────────────────────────────────────────────
   스펙 입력 화면의 자격증 선택 목록. 국가자격(큐넷 API 캐시) + 민간자격(수기).
   650종 남짓 · 60KB 정도라 페이징 없이 통째로 준다 — 프론트가 한 번 받아
   메모리에서 검색하면 입력 중 서버를 다시 부를 일이 없다.
   내용이 하루에도 바뀌는 데이터가 아니므로 캐시를 길게 잡는다. */
app.get('/api/certs', async (req, res) => {
  res.set('Cache-Control', 'no-cache');   // ETag 로 재검증 — 아래 /api/jobs 주석 참고
  res.json(await catalog.certCatalog());
});

/* 자격증 검색 — /api/company/suggest · /api/majors/suggest 와 같은 규약(q · limit → items). */
app.get('/api/certs/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  res.json({ query: q, items: q ? await catalog.searchCerts(q, limit) : [] });
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
app.get('/api/jobs', async (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(await catalog.jobCatalog());
});

/* ── 학과 카탈로그 ────────────────────────────────────────────
   스펙 입력의 '학과' 검색 목록. 지금은 손으로 추린 임시 목록이고,
   커리어넷 학과정보 키가 나오면 수집 스크립트로 교체한다(major-catalog.js 주석).

   dept 는 careerly 통계를 묶는 키다. 학과명만 저장하면 스펙이 수천 갈래로 흩어져
   합격자 평균이 무의미해지므로, 학과명과 함께 어느 분류로 묶이는지도 같이 준다. */
app.get('/api/majors', async (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(await catalog.majorCatalog());
});

/* 학과 검색 — 입력할 때마다 부른다(프론트가 debounce 로 묶는다).
   회사명 자동완성(/api/company/suggest)과 같은 규약이다: q · limit 을 받고
   { items: [...] } 를 돌려준다. 세 검색이 같은 모양이라야 프론트 부품 하나로 끝난다.

   지금 카탈로그는 193개라 목록을 통째로 내려도 되지만, 커리어넷 학과정보 키가 나오면
   수천 개가 된다. 그때 구조를 다시 바꾸지 않도록 처음부터 서버 검색으로 둔다. */
app.get('/api/majors/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  res.json({ query: q, items: q ? await catalog.searchMajors(q, limit) : [] });
});

/* 목록에 없는 학과명을 직접 적었을 때 어느 분류로 묶일지 알려준다.
   못 맞추면 dept:null — 화면이 '직접 골라주세요'로 빠진다. */
app.get('/api/majors/classify', async (req, res) => {
  const name = String(req.query.name || '').trim();
  res.json({ major: name, dept: await catalog.deptOfMajor(name) });
});

/* ── 백오피스 (개발 전용) ──────────────────────────────────────
   회원 목록 조회·삭제, 데모 시드, 전체 초기화. 인증·권한 체계가 아직 없으므로
   운영 환경에서는 전부 404 로 막는다. 관리자 역할을 도입하기 전까지의 임시 조치. */
const IS_PROD = process.env.NODE_ENV === 'production';

function devOnly(req, res, next) {
  if (IS_PROD) return res.status(404).json({ error: '요청한 경로를 찾을 수 없습니다.' });
  next();
}

app.get('/api/admin/users', devOnly, async (req, res) => {
  const users = await repo.users.listAll();
  res.json({ users: users.map(u => ({ ...publicUser(u), hasSpec: u.hasSpec })) });
});

app.delete('/api/admin/users/:username', devOnly, async (req, res) => {
  /* 프로필·세션·스펙·자격증·활동은 외래키 CASCADE 로 함께 지워진다.
     예전에는 배열마다 직접 걸러냈고, 새 컬렉션이 생길 때마다 빠뜨리기 쉬웠다. */
  const removed = await repo.users.deleteByUsername(req.params.username);
  if (!removed) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
  res.json({ message: '삭제되었습니다.' });
});

app.post('/api/admin/clear', devOnly, async (req, res) => {
  // users 만 지우면 프로필·세션·스펙은 CASCADE 로 따라간다
  await query('DELETE FROM users');
  res.clearCookie(SESSION_COOKIE);
  res.json({ message: '초기화되었습니다.' });
});

app.post('/api/admin/seed', devOnly, async (req, res) => {
  // 고정 데모는 계정마다 비밀번호가 다를 수 있어 개별 해싱한다
  for (const { u, s } of DEMO_SEED) {
    if (await repo.users.usernameTaken(u.username)) continue;
    await insertSeedUser(u, s, await bcrypt.hash(u.password, 10));
  }
  res.json({ message: '데모 데이터가 추가되었습니다.' });
});

// 무작위 N명 추가 — 커리어 로드맵·CAS 집계를 채우기 위한 대량 시드
app.post('/api/admin/seed-random', devOnly, async (req, res) => {
  const count = Math.min(Math.max(parseInt(req.body?.count, 10) || 50, 1), 200);

  // 무작위 계정은 비밀번호가 모두 같으므로 해시를 한 번만 계산해 재사용한다
  const sharedHash = await bcrypt.hash('demo1234!', 10);
  let added = 0;
  for (const { u, s } of generateRandom(count)) {
    if (await repo.users.usernameTaken(u.username)) continue;
    if (await repo.users.emailTaken(u.email)) continue;
    await insertSeedUser(u, s, sharedHash);
    added++;
  }
  res.json({ message: `무작위 회원 ${added}명이 추가되었습니다.`, added });
});

async function insertSeedUser(u, s, passwordHash) {
  const user = await repo.users.create({
    id: nanoid(),
    username: u.username, passwordHash,
    name: u.name, email: u.email, role: u.role, nickname: null,
  });
  if (s) await repo.specs.upsert(user.id, s);
}

/* 학과·직무 참조 자료는 회원 데이터가 아니라 정적 자료다(db-seed.json).
   테이블로 만들 이유가 없어 파일에서 그대로 읽는다. */
app.get('/api/departments', (req, res) => {
  res.json({ departments: repo.reference.departments() });
});

app.get('/api/career-specs', (req, res) => {
  const { departmentId, jobId } = req.query;
  let specs = repo.reference.careerSpecs();
  if (departmentId) specs = specs.filter(s => s.departmentId === departmentId);
  if (jobId) specs = specs.filter(s => s.jobId === jobId);
  res.json({ specs });
});

app.get('/api/jobs/:jobId/specs', (req, res) => {
  const spec = repo.reference.careerSpecs().find(s => s.jobId === req.params.jobId);
  if (!spec) return res.status(404).json({ error: '해당 직무 데이터를 찾을 수 없습니다.' });
  res.json({ spec });
});

app.use((req, res) => {
  res.status(404).json({ error: '요청한 경로를 찾을 수 없습니다.' });
});

/* 라우트에서 던진 예외를 잡는다. 없으면 async 라우트의 실패가 응답 없이 매달려
   요청이 타임아웃될 때까지 브라우저가 기다린다. */
app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.path, '-', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: '서버에서 문제가 생겼습니다.' });
});

/* DB 연결을 확인한 뒤에 포트를 연다. 연결이 안 되는데 서버만 떠 있으면
   모든 API 가 500 을 내면서 '살아있는 척' 해서 원인을 찾기 어렵다. */
assertConnection()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Careerly backend running on http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    /* 에러를 버리면 안 된다. 접속 정보 자체가 깨진 경우(URL 파싱 실패)는
       assertConnection 의 로그까지 가지도 못해서, 이 줄만 찍히고 원인이
       사라진다. 배포에서 그것 때문에 한참 헤맸다. */
    console.error('DB 에 연결하지 못해 서버를 시작하지 않습니다. 접속 정보를 확인하세요.');
    console.error(`        ${e.message}`);
    process.exit(1);
  });
