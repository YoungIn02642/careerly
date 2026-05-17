const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_COOKIE = 'careerly_session';
const ONE_DAY = 24 * 60 * 60 * 1000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
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

app.get('/api/career-data', (req, res) => {
  const filePath = path.join(__dirname, '..', 'data', 'career-data.json');

  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const careerData = JSON.parse(rawData);

    res.json({
      success: true,
      data: careerData
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: '커리어 데이터를 불러오지 못했습니다.'
    });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const { username, password, name, email } = req.body || {};

  if (!username || !password || !name || !email) {
    return res.status(400).json({ error: '필수 입력값이 누락되었습니다.' });
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
