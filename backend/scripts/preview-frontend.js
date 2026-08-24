/* ════════════════════════════════════════════════════════════
   프론트엔드 미리보기 서버 — MySQL·Docker 없이 화면만 띄운다.

   ── 왜 있나 ────────────────────────────────────────────────
   C:road 는 데이터가 전부 서버 API 에 있어서 careerly.html(문서 하나짜리 SPA)을 파일로 열면
   아무것도 나오지 않는다(README 의 경고). 그렇다고 화면 한 줄 고치는 데까지
   Docker 를 설치하고 MySQL 을 세우게 하면, 프론트 작업의 시작 비용이 너무 크다.
   이 스크립트는 **DB 가 필요 없는 진짜 라우터는 그대로 쓰고, DB 가 필요한 것만
   메모리로 대신해서** 화면 15개를 전부 열어 준다.

   ── 무엇이 진짜이고 무엇이 흉내인가 ─────────────────────────
   진짜 (backend/src 의 코드를 그대로 부른다):
     · 자소서 코치   /api/jd/*                 routes/jdCoach.js
     · 기업분석      /api/company/analysis     routes/companyAnalysis.js
     · 추천          /api/recommendations      routes/recommendations.js
     · 자격증·학과·회사·직업 카탈로그          cert-catalog · major-catalog ·
                                               company-classify · wage-jobs
       (외부 API 키가 없으면 그 기능만 빠진다 — 운영 서버와 같은 동작이다)

   흉내 (이 파일 안, 전부 메모리):
     · 로그인·회원·스펙·프로필·백오피스·인사이트·멘토링·결제
     · **비밀번호를 검사하지 않는다.** 아무 아이디로나 로그인된다.
     · 서버를 끄면 적은 것이 다 사라진다.

   그래서 이 스크립트는 **개발 기계 전용**이다. 배포되는 서버는 backend/src/server.js
   하나뿐이고, 이 파일은 거기에 연결되지 않는다.

   실행: node backend/scripts/preview-frontend.js   (또는 npm run preview)
   접속: http://localhost:3100
   ════════════════════════════════════════════════════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { nanoid } = require('nanoid');

/* DB 를 타지 않는 라우터·모듈만 가져온다. repo.js·catalog-db.js·mysql.js 는
   부르지 않는다 — 그것들이 이 서버가 못 뜨는 이유이기 때문이다. */
const jdCoachRouter = require('../src/routes/jdCoach');
const companyAnalysisRouter = require('../src/routes/companyAnalysis');
const recommendationsRouter = require('../src/routes/recommendations');
/* croad 에서 새로 붙은 화면들. 둘 다 DB 를 타지 않는다 —
   casFit 은 ai-provider·wage-traits·cas-fit, specup 은 src/specup 만 쓴다. */
const casFitRouter = require('../src/routes/casFit');
const specupRouter = require('../src/routes/specup');
const certCatalog = require('../src/cert-catalog');
const majorCatalog = require('../src/major-catalog');
const companies = require('../src/company-classify');
const wageJobs = require('../src/wage-jobs');
const jobFilter = require('../src/job-filter');
const { DEMO_SEED, generateRandom } = require('../src/demo-seed');

const app = express();
const PORT = process.env.PREVIEW_PORT || 3100;
const SESSION_COOKIE = 'careerly_session';
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

/* ── 메모리 저장소 ──────────────────────────────────────────
   운영 서버의 users·user_specs·profiles·insight_*·mentoring_requests 를
   Map 몇 개로 대신한다. 화면이 기대하는 **모양**만 맞추면 되고, 무결성·동시성은
   여기서 볼 문제가 아니다(혼자 쓰는 미리보기다). */
const store = {
  users: new Map(),        // username → user
  specs: new Map(),        // username → spec
  profiles: new Map(),     // username → profile
  sessions: new Map(),     // token → username
  posts: [],               // 인사이트 게시글
  comments: [],            // 인사이트 댓글
  requests: [],            // 멘토링 신청
};

const ONE_DAY = 24 * 60 * 60 * 1000;

function makeUser({ username, name, email, role, nickname }) {
  return {
    id: nanoid(), username, name: name || username, email: email || null,
    role: role || null, nickname: nickname ?? null,
    createdAt: new Date(Date.now() - 30 * ONE_DAY),
  };
}

/* publicUser — server.js 의 같은 이름 함수와 필드를 맞춘다. 하나라도 빠지면
   화면이 undefined 를 그린다(특히 needsOnboarding·isAdmin 은 분기에 쓰인다). */
function publicUser(u) {
  return {
    id: u.id, username: u.username, name: u.name, email: u.email,
    role: u.role || null, nickname: u.nickname ?? null, provider: u.provider || null,
    needsOnboarding: !u.role,
    verified: true,                 // 본인확인은 미리보기에서 통과한 것으로 둔다
    phoneMasked: '010-****-0000',
    /* 미리보기에서는 **모두 관리자**다. 백오피스도 화면이라 열려 있어야 한다. */
    isAdmin: true,
    pendingRole: u.pendingRole || null,
    roleChangeEffectiveAt: u.roleChangeEffectiveAt || null,
    roleChangeAvailableAt: new Date(new Date(u.createdAt).getTime() + 10 * ONE_DAY),
  };
}

const currentUser = req => store.users.get(store.sessions.get(req.cookies[SESSION_COOKIE]) || '') || null;

function requireAuth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: '로그인이 필요합니다.' });
  req.user = u;
  next();
}

function startSession(res, user) {
  const token = nanoid(48);
  store.sessions.set(token, user.username);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax' });
}

/* 시드 — 화면을 열자마자 집계·백분위·로드맵에 값이 보이게 한다. 빈 화면은
   "고장난 것"과 구분되지 않아서, 미리보기의 기본값은 데이터가 있는 쪽이다. */
function seed(count = 60) {
  [...DEMO_SEED, ...generateRandom(count)].forEach(({ u, s }) => {
    const user = makeUser(u);
    store.users.set(user.username, user);
    if (s) store.specs.set(user.username, { ...s, activities: s.activities || [] });
  });
}
seed();

/* ── 진짜 라우터 ───────────────────────────────────────────── */
app.use('/api/jd', jdCoachRouter);
app.use('/api/company', companyAnalysisRouter);   // /analysis 만 있다. classify·suggest 는 아래
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/cas', casFitRouter);        // 직무 적합도
app.use('/api/specup', specupRouter);     // 스펙UP

/* ── 카탈로그 — 파일 기반 모듈로 대신한다 ────────────────────
   운영은 catalog-db.js(MySQL)를 쓰지만 응답 모양은 같다. 자동완성 세 개
   (회사·자격증·학과)는 { query, items } 라는 같은 규약을 쓴다. */
const q = req => String(req.query.q || '').trim();
const lim = req => Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);

/* 응답 모양은 server.js 의 같은 경로를 그대로 따른다 — 못 찾았을 때 corpType 을
   비워 두는 것까지 같아야 한다. 'small' 을 채워 보내면 화면이 **확인된 중소기업**과
   **명단에 없음**을 구분하지 못한다(server.js 의 주석). */
app.get('/api/company/classify', (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: '회사명이 필요합니다.' });
  const r = companies.classify(name);
  res.json({
    company: name,
    corpType: r.matched ? (companies.CORP_TYPE_ID[r.type] || null) : null,
    label: r.matched ? r.type : null,
    source: r.source,
    matched: r.matched,
    fallbackCorpType: r.matched ? null : 'small',
  });
});
app.get('/api/company/suggest', (req, res) =>
  res.json({ query: q(req), items: q(req) ? companies.suggest(q(req), lim(req)) : [] }));
app.get('/api/company/stats', (req, res) => res.json(companies.stats()));

app.get('/api/certs', (req, res) => res.json(certCatalog.catalog()));
app.get('/api/certs/suggest', (req, res) =>
  res.json({ query: q(req), items: q(req) ? certCatalog.searchCerts(q(req), lim(req)) : [] }));

app.get('/api/majors', (req, res) => res.json(majorCatalog.catalog()));
app.get('/api/majors/suggest', (req, res) =>
  res.json({ query: q(req), items: q(req) ? majorCatalog.searchMajors(q(req), lim(req)) : [] }));
app.get('/api/majors/classify', (req, res) => {
  const name = String(req.query.name || '').trim();
  res.json({ major: name, dept: majorCatalog.deptOf(name) });
});

/* 대학 자동완성은 커리어넷 캐시(DB)에만 있다. 비어 있어도 화면은 동작한다 —
   자동완성만 안 뜨고 직접 입력은 계속된다(server.js 의 같은 주석). */
app.get('/api/universities/suggest', (req, res) => res.json({ query: q(req), items: [] }));

/* 직업 트리는 wage-jobs.json 캐시에서 그대로 나온다. **filterTree 를 빠뜨리면 안 된다** —
   운영은 catalog-db.jobCatalog() 안에서 이걸 거쳐 내보내므로, 여기서 안 걸면 미리보기에만
   대학생 취업 선택지가 아닌 직업이 더 보인다(같은 화면인데 목록이 달라진다). */
app.get('/api/jobs', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(jobFilter.filterTree(wageJobs.catalog()));
});

/* ── 인증 — 비밀번호를 보지 않는다 ───────────────────────────
   미리보기의 목적은 화면을 여는 것이다. 모르는 아이디로 로그인하면 그 자리에서
   회원을 만들어 통과시킨다. **이 동작 때문에 이 서버를 남에게 열어두면 안 된다.** */
app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim() || 'preview';
  let user = store.users.get(username);
  if (!user) {
    user = makeUser({ username, name: username, role: 'mentee' });
    store.users.set(username, user);
  }
  startSession(res, user);
  res.json({ message: '로그인 성공', user: publicUser(user) });
});

app.post('/api/auth/signup', (req, res) => {
  const { username, name, email, role, nickname } = req.body || {};
  const id = String(username || '').trim();
  if (!id) return res.status(400).json({ error: '아이디를 입력해주세요.' });
  if (store.users.has(id)) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  const user = makeUser({ username: id, name, email, role, nickname });
  store.users.set(id, user);
  startSession(res, user);
  res.status(201).json({ message: '가입되었습니다.', user: publicUser(user) });
});

app.post('/api/auth/onboarding', requireAuth, (req, res) => {
  const { role, nickname } = req.body || {};
  if (role) req.user.role = role;
  if (nickname !== undefined) req.user.nickname = nickname;
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/logout', (req, res) => {
  store.sessions.delete(req.cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ message: '로그아웃되었습니다.' });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/api/auth/check-username', (req, res) =>
  res.json({ available: !store.users.has(String(req.query.username || '').trim()) }));
app.get('/api/auth/providers', (req, res) => res.json({ providers: [] }));

app.post('/api/auth/password', requireAuth, (req, res) => res.json({ message: '변경되었습니다.' }));
app.post('/api/auth/withdraw', requireAuth, (req, res) => {
  store.users.delete(req.user.username);
  store.specs.delete(req.user.username);
  store.sessions.delete(req.cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ message: '탈퇴되었습니다.' });
});

/* 본인확인(NICE)은 계약이 필요한 외부 서비스다. 미리보기에서는 아예 '못 쓰는
   상태'로 알려서 화면이 인증 단계를 건너뛰게 한다 — 버튼만 띄우고 503 을
   보여주는 것보다 낫다(server.js 의 같은 판단). */
app.get('/api/verify/status', (req, res) =>
  res.json({ configured: false, devMode: false, available: false }));

app.post('/api/verify/request', (req, res) =>
  res.status(503).json({ error: '미리보기 서버에서는 본인확인을 쓸 수 없습니다.' }));

/* ── 회원·프로필 ───────────────────────────────────────────── */
app.put('/api/users/me', requireAuth, (req, res) => {
  ['name', 'email', 'nickname', 'role'].forEach(k => {
    if (req.body?.[k] !== undefined) req.user[k] = req.body[k];
  });
  res.json({ user: publicUser(req.user) });
});

app.post('/api/users/me/role-change', requireAuth, (req, res) => {
  req.user.pendingRole = req.user.role === 'mentor' ? 'mentee' : 'mentor';
  req.user.roleChangeEffectiveAt = new Date(Date.now() + 7 * ONE_DAY);
  res.json({ user: publicUser(req.user) });
});

app.get('/api/profile', requireAuth, (req, res) =>
  res.json({ profile: store.profiles.get(req.user.username) || null }));

app.put('/api/profile', requireAuth, (req, res) => {
  const cur = store.profiles.get(req.user.username) || {};
  const next = { ...cur, ...req.body };
  store.profiles.set(req.user.username, next);
  res.json({ profile: next });
});

/* ── 스펙·집계 ───────────────────────────────────────────────
   닉네임은 로그인했을 때만 싣는다 — 운영 서버(server.js /api/specs)와 같은 규칙이다.
   미리보기라고 규칙을 느슨하게 두면, 여기서 되던 화면이 운영에서 안 되는 일이 생긴다. */
app.get('/api/specs', (req, res) => {
  const signedIn = Boolean(currentUser(req));
  res.json({
    specs: [...store.specs.entries()].map(([username, s]) => {
      const { detail, ...rest } = s;
      const u = store.users.get(username);
      return signedIn
        ? { ...rest, nick: u?.nickname || null, isMentor: u?.role === 'mentor' }
        : rest;
    }),
  });
});

app.get('/api/specs/me', requireAuth, (req, res) =>
  res.json({ spec: store.specs.get(req.user.username) || null }));

/* **덮어쓰지 않고 넘어온 키만 고친다** — 운영 서버(repo.specs.upsert)와 같은 규칙이다.
   통째로 갈아치우면, 직무를 고를 때 흐름 상태가 { jobMajor, jobMiddles } 만 보내는
   순간 학과·학점·자격증이 전부 사라진다(실측: 스펙을 넣어 뒀는데 '학과를 아직
   몰라요' 가 떴다). 여기만 규칙이 다르면 미리보기에서만 나는 고장이 된다. */
app.put('/api/specs/me', requireAuth, (req, res) => {
  const cur = store.specs.get(req.user.username) || {};
  store.specs.set(req.user.username, { ...cur, ...(req.body || {}) });
  res.json({ message: '저장되었습니다.' });
});

app.get('/api/stats', (req, res) => {
  const counts = { mentor: 0, mentee: 0, unknown: 0 };
  store.users.forEach(u => { counts[u.role || 'unknown'] = (counts[u.role || 'unknown'] || 0) + 1; });
  res.json({ counts, userCount: store.users.size, specCount: store.specs.size });
});

/* ── 백오피스 ──────────────────────────────────────────────── */
app.get('/api/admin/users', requireAuth, (req, res) => {
  res.json({
    users: [...store.users.values()].map(u => ({
      ...publicUser(u), hasSpec: store.specs.has(u.username),
    })),
  });
});
app.delete('/api/admin/users/:username', requireAuth, (req, res) => {
  const gone = store.users.delete(req.params.username);
  store.specs.delete(req.params.username);
  if (!gone) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
  res.json({ message: '삭제되었습니다.' });
});
app.post('/api/admin/seed', requireAuth, (req, res) => {
  DEMO_SEED.forEach(({ u, s }) => {
    const user = makeUser(u);
    store.users.set(user.username, user);
    if (s) store.specs.set(user.username, s);
  });
  res.json({ message: '데모 데이터를 넣었습니다.' });
});
app.post('/api/admin/seed-random', requireAuth, (req, res) => {
  const count = Math.min(Math.max(parseInt(req.body?.count, 10) || 50, 1), 500);
  seed(count);
  res.json({ message: `${count}명을 추가했습니다.`, count });
});
app.post('/api/admin/clear', requireAuth, (req, res) => {
  store.users.clear(); store.specs.clear(); store.profiles.clear(); store.sessions.clear();
  res.json({ message: '초기화했습니다.' });
});

/* ── 커리어 인사이트 (게시판) ────────────────────────────────
   routes/insight.js 와 같은 카테고리·응답 모양. 정렬은 최신순, 페이지는 그대로. */
const INSIGHT_CATEGORIES = [
  { id: 'free', label: '자유' }, { id: 'jobinfo', label: '취업정보' },
  { id: 'review', label: '후기' }, { id: 'qna', label: '질문' },
];
const authorName = username => store.users.get(username)?.nickname
  || store.users.get(username)?.name || '탈퇴한 회원';
const postSummary = p => ({
  id: p.id, category: p.category, title: p.title,
  preview: (p.body || '').replace(/\s+/g, ' ').trim().slice(0, 120),
  authorId: p.authorId, authorName: authorName(p.username),
  viewCount: p.viewCount, commentCount: store.comments.filter(c => c.postId === p.id).length,
  createdAt: p.createdAt,
});

/* 추천 글 카드. 미리보기에는 게시판 시드가 없어 postId 를 채우지 못한다 —
   seeded:false 로 알려 주면 화면이 '아직 준비 안 됨' 으로 받는다. */
app.get('/api/insights/featured', (req, res) => {
  const F = require('../src/insight-featured');
  res.json({
    articles: F.ARTICLES.map(a => ({
      key: a.key, cover: a.cover, chip: a.chip, minutes: a.minutes, title: a.title, postId: null,
    })),
    seeded: false,
  });
});

app.get('/api/insights/categories', (req, res) => res.json({ categories: INSIGHT_CATEGORIES }));

app.get('/api/insights', (req, res) => {
  const category = String(req.query.category || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const all = category ? store.posts.filter(p => p.category === category) : store.posts;
  const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
  res.json({
    posts: sorted.slice((page - 1) * limit, page * limit).map(postSummary),
    total: all.length, page, limit,
  });
});

app.get('/api/insights/:id', (req, res) => {
  const p = store.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
  p.viewCount += 1;
  res.json({
    post: { id: p.id, category: p.category, title: p.title, body: p.body,
            authorId: p.authorId, authorName: authorName(p.username),
            viewCount: p.viewCount, createdAt: p.createdAt, updatedAt: p.updatedAt },
    comments: store.comments.filter(c => c.postId === p.id).map(c => ({
      id: c.id, postId: c.postId, authorId: c.authorId, authorName: authorName(c.username),
      body: c.body, createdAt: c.createdAt,
    })),
  });
});

app.post('/api/insights', requireAuth, (req, res) => {
  const { category, title, body } = req.body || {};
  if (!INSIGHT_CATEGORIES.some(c => c.id === category)) {
    return res.status(400).json({ error: '카테고리를 선택해주세요.' });
  }
  if (!String(title || '').trim() || !String(body || '').trim()) {
    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
  }
  const post = {
    id: nanoid(), category, title, body, username: req.user.username,
    authorId: req.user.id, viewCount: 0, createdAt: new Date(), updatedAt: new Date(),
  };
  store.posts.push(post);
  res.status(201).json({ post: postSummary(post) });
});

app.put('/api/insights/:id', requireAuth, (req, res) => {
  const p = store.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
  if (p.username !== req.user.username) return res.status(403).json({ error: '내 글만 고칠 수 있습니다.' });
  if (req.body?.title) p.title = req.body.title;
  if (req.body?.body) p.body = req.body.body;
  p.updatedAt = new Date();
  res.json({ post: postSummary(p) });
});

app.delete('/api/insights/:id', requireAuth, (req, res) => {
  const i = store.posts.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
  if (store.posts[i].username !== req.user.username) {
    return res.status(403).json({ error: '내 글만 지울 수 있습니다.' });
  }
  store.posts.splice(i, 1);
  store.comments = store.comments.filter(c => c.postId !== req.params.id);
  res.json({ message: '삭제되었습니다.' });
});

app.post('/api/insights/:id/comments', requireAuth, (req, res) => {
  const p = store.posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
  if (!String(req.body?.body || '').trim()) return res.status(400).json({ error: '댓글을 입력해주세요.' });
  const c = {
    id: nanoid(), postId: p.id, username: req.user.username, authorId: req.user.id,
    body: req.body.body, createdAt: new Date(),
  };
  store.comments.push(c);
  res.status(201).json({ comment: { ...c, authorName: authorName(c.username) } });
});

app.delete('/api/insights/:postId/comments/:commentId', requireAuth, (req, res) => {
  const i = store.comments.findIndex(c => c.id === req.params.commentId);
  if (i < 0) return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
  store.comments.splice(i, 1);
  res.json({ message: '삭제되었습니다.' });
});

/* ── 멘토링 · 결제 ──────────────────────────────────────────
   가격표는 routes/mentoring.js 의 FORMATS 와 같은 값이다. 결제는 토스 키가
   있어야 하므로 미리보기에서는 '설정 안 됨' 으로 두고, 신청만 남긴다. */
const FORMATS = [
  { id: 'video30', name: '화상 30분', amount: 20000 },
  { id: 'onsite60', name: '대면 60분', amount: 45000 },
  { id: 'text', name: '텍스트', amount: 12000 },
];

app.get('/api/mentoring/formats', (req, res) => res.json({ formats: FORMATS }));

app.get('/api/mentoring/requests', requireAuth, (req, res) =>
  res.json({ requests: store.requests.filter(r => r.menteeId === req.user.id) }));

app.post('/api/mentoring/requests', requireAuth, (req, res) => {
  const { mentorId, mentorName, format, message, slotDate, slotTime } = req.body || {};
  const f = FORMATS.find(x => x.id === format);
  if (!mentorId || !f) return res.status(400).json({ error: '멘토와 멘토링 형식을 선택해주세요.' });
  const r = {
    id: nanoid(), menteeId: req.user.id, mentorId, mentorName: mentorName || '',
    format: f.id, formatName: f.name, amount: f.amount, message: message || '',
    status: 'pending', orderId: nanoid(), payment: null,
    slotDate: slotDate || null, slotTime: slotTime || null,
    createdAt: new Date(), updatedAt: new Date(),
  };
  store.requests.unshift(r);
  res.status(201).json({ request: r });
});

app.post('/api/mentoring/requests/:id/cancel', requireAuth, (req, res) => {
  const r = store.requests.find(x => x.id === req.params.id && x.menteeId === req.user.id);
  if (!r) return res.status(404).json({ error: '신청을 찾을 수 없습니다.' });
  r.status = 'cancelled';
  r.updatedAt = new Date();
  res.json({ request: r });
});

app.get('/api/payments/config', (req, res) => res.json({ enabled: false, clientKey: null }));
app.post('/api/payments/prepare', requireAuth, (req, res) =>
  res.status(503).json({ error: '미리보기 서버에서는 결제를 쓸 수 없습니다.' }));
app.post('/api/payments/confirm', requireAuth, (req, res) =>
  res.status(503).json({ error: '미리보기 서버에서는 결제를 쓸 수 없습니다.' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'croad-frontend-preview' }));

/* ── 정적 파일 ─────────────────────────────────────────────
   no-cache 는 '캐시 금지'가 아니라 '쓰기 전에 물어보라'는 뜻이다. 화면을 고치고
   새로고침했는데 안 바뀌는 일을 막는다(server.js 의 같은 설정). */
app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(FRONTEND_DIR, 'careerly.html'));
});
app.use(express.static(FRONTEND_DIR, { setHeaders: res => res.set('Cache-Control', 'no-cache') }));

app.use((req, res) => res.status(404).json({ error: '요청한 경로를 찾을 수 없습니다.' }));
app.use((err, req, res, next) => {
  console.error('[preview]', err);
  res.status(500).json({ error: err.message || '서버에서 문제가 생겼습니다.' });
});

app.listen(PORT, () => {
  console.log(`
  ┌─ C:road 프론트엔드 미리보기 ─────────────────────────────
  │  http://localhost:${PORT}
  │
  │  MySQL 없이 화면만 봅니다. 로그인은 **아무 아이디나** 통과합니다.
  │  회원·스펙·게시글은 메모리에만 있어 서버를 끄면 사라집니다.
  │  자소서 코치·기업분석·카탈로그는 실제 서버 코드가 그대로 답합니다.
  │
  │  배포되는 서버는 backend/src/server.js 입니다 (npm run dev).
  └────────────────────────────────────────────────────────────`);
});
