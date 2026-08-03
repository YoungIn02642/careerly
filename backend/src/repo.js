/* 데이터 접근 계층 — 라우트가 SQL 을 직접 쓰지 않게 한다.

   ── 왜 store.js(readDb/writeDb) 를 그대로 async 로 바꾸지 않았나 ──
   그러면 요청마다 회원 1,500명·스펙 1,200건을 통째로 읽고, 한 글자 고칠 때마다
   전부 다시 쓴다. 파일 DB 라서 어쩔 수 없이 그랬던 방식이고, MySQL 로 옮기는 이유
   자체가 그걸 안 하기 위해서다. 그래서 필요한 것만 집어오는 함수로 바꾼다.

   ── 바깥으로 나가는 모양은 예전과 같게 유지한다 ──
   화면(frontend/js/*)과 집계(aggregation.js)는 camelCase 필드를 기대한다
   (userId·gpaMax·corpType·activities…). DB 는 snake_case 다. 그 변환을 여기서만
   하고, 라우트와 화면은 예전 코드를 그대로 쓴다.

   ── 스펙 저장은 트랜잭션이다 ──
   user_specs·spec_certs·spec_activities 세 테이블을 함께 고친다. 중간에 실패하면
   자격증만 지워지고 본문은 옛날 값인 상태가 남는다. */
const path = require('path');
const { query, queryOne, transaction, pool } = require('./mysql');

/* 학과·직무 참조 데이터는 회원 데이터가 아니라 정적 자료다. 테이블로 만들 이유가
   없어 시드 파일에서 그대로 읽는다(수정되지 않는다). */
let _seed = null;
function seed() {
  if (!_seed) {
    try { _seed = require(path.join(__dirname, '..', 'data', 'db-seed.json')); }
    catch { _seed = { departments: [], careerSpecs: [] }; }
  }
  return _seed;
}

// ── 변환 ────────────────────────────────────────────────────
/* ci·phone 은 개인식별정보다. 여기서는 들고 오되(중복 검사·본인확인 여부 판단에 쓴다)
   **server.js 의 publicUser() 가 반드시 걸러낸다** — 화면으로 나가면 안 된다. */
const toUser = r => r && ({
  id: r.id, username: r.username, passwordHash: r.password_hash,
  name: r.name, email: r.email, role: r.role, nickname: r.nickname,
  provider: r.provider, providerId: r.provider_id, createdAt: r.created_at,
  ci: r.ci ?? null, phone: r.phone ?? null, verifiedAt: r.verified_at ?? null,
  /* MySQL 은 BOOLEAN 을 TINYINT 로 준다(0/1). 그대로 흘리면 화면에서
     `user.isAdmin === true` 가 false 가 되어 조용히 권한이 없는 것처럼 보인다. */
  isAdmin: !!r.is_admin,
});

/* JSON 컬럼은 드라이버가 파싱해 주지만, 옛 데이터나 수동 입력으로 문자열이 올 수 있다. */
const asJson = v => {
  if (v == null) return undefined;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return undefined; } }
  return v;
};

function toSpec(r, certs = [], activities = []) {
  if (!r) return null;
  const s = {
    userId: r.user_id,
    dept: r.dept ?? null, major: r.major ?? null,
    field: r.field ?? null, job: r.job ?? null,
    jobMajor: r.job_major ?? null,
    company: r.company ?? null, corpType: r.corp_type ?? null,
    /* DECIMAL 은 드라이버가 문자열로 준다. 화면이 숫자로 계산하므로 되돌린다
       (안 하면 평균이 문자열 연결로 나온다). */
    gpa: r.gpa == null ? null : Number(r.gpa),
    gpaMax: r.gpa_max == null ? null : Number(r.gpa_max),
    certs, activities,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
  const scores = asJson(r.scores);           if (scores) s.scores = scores;
  const qual = asJson(r.qual);               if (qual) s.qual = qual;
  const detail = asJson(r.detail);           if (detail) s.detail = detail;
  const certMeta = asJson(r.cert_meta);      if (certMeta) s.certMeta = certMeta;
  /* 세부직무는 여러 개다. 빈 배열도 '고른 게 없다'는 뜻이라 그대로 실어 보낸다 —
     없는 것(null)과 구분되지 않으면 화면이 이전 선택을 지운 건지 알 수 없다. */
  const jobMiddles = asJson(r.job_middles);  if (jobMiddles) s.jobMiddles = jobMiddles;
  const ic = asJson(r.interest_companies);   if (ic) s.interestCompanies = ic;
  const careers = asJson(r.careers);         if (careers) s.careers = careers;
  return s;
}

const toActivity = r => {
  const a = { type: r.type };
  for (const [k, v] of [['name', r.name], ['org', r.org], ['duration', r.duration],
                        ['role', r.role], ['stage', r.stage], ['outcome', r.outcome],
                        ['companyTier', r.company_tier], ['companyName', r.company_name]]) {
    if (v != null && v !== '') a[k] = v;
  }
  return a;
};

// ── 회원 ────────────────────────────────────────────────────
const users = {
  byId: async id => toUser(await queryOne('SELECT * FROM users WHERE id=?', [id])),
  byUsername: async u => toUser(await queryOne('SELECT * FROM users WHERE username=?', [u])),
  byProvider: async (p, pid) =>
    toUser(await queryOne('SELECT * FROM users WHERE provider=? AND provider_id=?', [p, pid])),

  usernameTaken: async u => !!(await queryOne('SELECT 1 AS x FROM users WHERE username=?', [u])),
  /* 이메일은 NULL 을 허용한다(카카오 선택 동의). NULL 은 중복 검사 대상이 아니다. */
  emailTaken: async e => !!e && !!(await queryOne('SELECT 1 AS x FROM users WHERE email=?', [e])),

  /* 본인확인 CI 로 이미 가입한 사람인지 본다. 옛 회원은 ci 가 NULL 이라
     여기서 안 잡힌다 — 소급 강제하지 않기로 한 결과이고, 의도한 동작이다. */
  ciTaken: async ci => !!ci && !!(await queryOne('SELECT 1 AS x FROM users WHERE ci=?', [ci])),
  byCi: async ci => (ci ? toUser(await queryOne('SELECT * FROM users WHERE ci=?', [ci])) : null),

  async create(u) {
    await query(
      `INSERT INTO users (id, username, password_hash, name, email, role, nickname,
                          provider, provider_id, ci, phone, verified_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [u.id, u.username, u.passwordHash ?? null, u.name, u.email || null,
       u.role || null, u.nickname ?? null, u.provider || null, u.providerId || null,
       u.ci || null, u.phone || null, u.ci ? new Date() : null]);
    await query('INSERT INTO profiles (user_id, nickname) VALUES (?,?) ON DUPLICATE KEY UPDATE nickname=VALUES(nickname)',
      [u.id, u.nickname ?? null]);
    return users.byId(u.id);
  },

  /* 부분 수정. 넘긴 키만 건드린다 — 전체를 덮어쓰면 동시에 다른 값을 고친 요청이 지워진다. */
  async update(id, patch) {
    const map = {
      name: 'name', email: 'email', role: 'role', nickname: 'nickname',
      /* 본인확인 결과. 소셜 가입자는 온보딩에서 뒤늦게 채운다. */
      ci: 'ci', phone: 'phone', verifiedAt: 'verified_at',
      /* 관리자 권한. **화면에서 오는 요청으로는 절대 이 키를 넣지 말 것** —
         server.js 의 허용 목록이 걸러 준다. 여기 있는 것은 백오피스와
         부팅 시 ADMIN_USERNAMES 반영을 위해서다. */
      isAdmin: 'is_admin',
    };
    const sets = [], vals = [];
    for (const [k, col] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) { sets.push(`\`${col}\`=?`); vals.push(patch[k]); }
    }
    if (sets.length) {
      await query(`UPDATE users SET ${sets.join(',')} WHERE id=?`, [...vals, id]);
      if ('nickname' in patch) await query('UPDATE profiles SET nickname=? WHERE user_id=?', [patch.nickname, id]);
    }
    return users.byId(id);
  },

  /* ADMIN_USERNAMES 에 적힌 아이디를 관리자로 올린다. 부팅 때 한 번 돈다.
     '첫 관리자를 누가 만드나' 문제를 푸는 유일한 경로다 — 이게 없으면 백오피스에
     들어갈 수 있는 사람이 아무도 없어서 다른 관리자도 지정할 수 없다.
     **권한을 내리지는 않는다.** 환경변수에서 이름을 뺐다고 관리자를 해제해 버리면
     배포 설정을 잠깐 잘못 건드렸을 때 전원이 백오피스에서 잠긴다. */
  async promoteAdmins(usernames) {
    const list = [...new Set(usernames.map(s => String(s).trim()).filter(Boolean))];
    if (!list.length) return [];
    await query(
      `UPDATE users SET is_admin=TRUE WHERE username IN (${list.map(() => '?').join(',')})`, list);
    const rows = await query(
      `SELECT username FROM users WHERE is_admin=TRUE AND username IN (${list.map(() => '?').join(',')})`,
      list);
    return rows.map(r => r.username);
  },

  async countByRole() {
    const rows = await query('SELECT role, COUNT(*) AS n FROM users GROUP BY role');
    const c = { mentor: 0, mentee: 0, unknown: 0 };
    rows.forEach(r => { c[r.role || 'unknown'] = Number(r.n); });
    return c;
  },
  count: async () => Number((await queryOne('SELECT COUNT(*) AS n FROM users')).n),

  /* 백오피스 목록 — 스펙 보유 여부를 같이 준다(예전 화면이 그렇게 그린다). */
  async listAll() {
    const rows = await query(
      `SELECT u.*, (s.user_id IS NOT NULL) AS has_spec
       FROM users u LEFT JOIN user_specs s ON s.user_id=u.id
       ORDER BY u.created_at DESC`);
    return rows.map(r => ({ ...toUser(r), hasSpec: !!r.has_spec }));
  },
  deleteByUsername: async u => {
    const r = await pool().query('DELETE FROM users WHERE username=?', [u]);
    return r[0].affectedRows > 0;      // 외래키 CASCADE 로 프로필·세션·스펙도 함께 지워진다
  },
};

// ── 세션 ────────────────────────────────────────────────────
const sessions = {
  async create(token, userId, expiresAt) {
    /* 한 회원의 옛 세션은 지운다(예전 동작 유지 — 한 기기만 로그인). */
    await query('DELETE FROM sessions WHERE user_id=? OR expires_at<=?', [userId, Date.now()]);
    await query('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)',
      [token, userId, Date.now(), expiresAt]);
  },
  /* 세션 조회는 모든 인증 요청에서 돈다. 두 번 왕복하지 않게 JOIN 으로 한 번에 가져온다. */
  async userByToken(token) {
    if (!token) return null;
    const r = await queryOne(
      `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token=? AND s.expires_at>?`, [token, Date.now()]);
    return toUser(r);
  },
  deleteByToken: t => query('DELETE FROM sessions WHERE token=?', [t]),
};

// ── 프로필 ──────────────────────────────────────────────────
const profiles = {
  async get(userId) {
    const r = await queryOne('SELECT * FROM profiles WHERE user_id=?', [userId]);
    if (!r) return { userId };
    return {
      userId: r.user_id, nickname: r.nickname, university: r.university,
      currentJob: r.current_job, tips: r.tips,
      avatar: r.avatar ?? null,
      gender: r.gender ?? null,
      /* DATE 는 드라이버가 dateStrings:true 라 'YYYY-MM-DD' 문자열로 온다.
         <input type="date"> 가 그대로 받는 형식이라 변환하지 않는다. */
      birthdate: r.birthdate ?? null,
      phone: r.phone ?? null,
      address: r.address ?? null,
      intro: r.intro ?? null,
      /* JSON 컬럼은 안 채워졌으면 undefined 가 아니라 **빈 배열**로 준다.
         화면이 `.map()` 을 바로 걸기 때문이다(없으면 거기서 죽는다). */
      specialties: asJson(r.specialties) || [],
      timeline: asJson(r.timeline) || [],
      modes: asJson(r.modes) || [],
      availability: asJson(r.availability) || [],
    };
  },
  async update(userId, patch) {
    /* **여기와 server.js 의 허용 목록을 함께 늘려야 한다.** 한쪽만 고치면
       저장은 성공했다고 나오는데 값이 조용히 사라진다. */
    const map = {
      nickname: 'nickname', university: 'university', currentJob: 'current_job', tips: 'tips',
      avatar: 'avatar', gender: 'gender', birthdate: 'birthdate',
      phone: 'phone', address: 'address',
      intro: 'intro', specialties: 'specialties', timeline: 'timeline', modes: 'modes',
      availability: 'availability',
    };
    const jsonKeys = new Set(['specialties', 'timeline', 'modes', 'availability']);
    const cols = [], vals = [];
    for (const [k, col] of Object.entries(map)) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      cols.push(col);
      vals.push(jsonKeys.has(k) ? (patch[k] == null ? null : JSON.stringify(patch[k])) : patch[k]);
    }
    if (!cols.length) return profiles.get(userId);
    await query(
      `INSERT INTO profiles (user_id, ${cols.join(',')}) VALUES (?${',?'.repeat(cols.length)})
       ON DUPLICATE KEY UPDATE ${cols.map(c => `\`${c}\`=VALUES(\`${c}\`)`).join(',')}`,
      [userId, ...vals]);
    return profiles.get(userId);
  },
};

// ── 스펙 ────────────────────────────────────────────────────
const specs = {
  async byUser(userId) {
    const r = await queryOne('SELECT * FROM user_specs WHERE user_id=?', [userId]);
    if (!r) return null;
    const [certs, acts] = await Promise.all([
      query('SELECT cert_name FROM spec_certs WHERE user_id=?', [userId]),
      query('SELECT * FROM spec_activities WHERE user_id=? ORDER BY id', [userId]),
    ]);
    return toSpec(r, certs.map(c => c.cert_name), acts.map(toActivity));
  },

  /* 집계용 — 전체를 준다. 화면(aggregation.js)이 이 배열로 평균·보유율을 낸다.
     N+1 을 피하려고 세 번만 질의하고 JS 에서 붙인다(1,200건 × 3회 vs 3,600회). */
  async listAll() {
    const [rows, certs, acts] = await Promise.all([
      query('SELECT * FROM user_specs'),
      query('SELECT user_id, cert_name FROM spec_certs'),
      query('SELECT * FROM spec_activities ORDER BY id'),
    ]);
    const certMap = new Map(), actMap = new Map();
    certs.forEach(c => (certMap.get(c.user_id) || certMap.set(c.user_id, []).get(c.user_id)).push(c.cert_name));
    acts.forEach(a => (actMap.get(a.user_id) || actMap.set(a.user_id, []).get(a.user_id)).push(toActivity(a)));
    return rows.map(r => toSpec(r, certMap.get(r.user_id) || [], actMap.get(r.user_id) || []));
  },

  count: async () => Number((await queryOne('SELECT COUNT(*) AS n FROM user_specs')).n),

  /* 저장 — 넘어온 키만 고친다. 세 테이블을 한 트랜잭션으로 묶는다. */
  async upsert(userId, patch) {
    const col = {
      dept: 'dept', major: 'major', field: 'field', job: 'job',
      jobMajor: 'job_major', jobMiddles: 'job_middles',
      company: 'company', corpType: 'corp_type', gpa: 'gpa', gpaMax: 'gpa_max',
      scores: 'scores', qual: 'qual', detail: 'detail', certMeta: 'cert_meta',
      interestCompanies: 'interest_companies', careers: 'careers',
    };
    const jsonKeys = new Set(['scores', 'qual', 'detail', 'certMeta',
                              'interestCompanies', 'careers', 'jobMiddles']);

    await transaction(async conn => {
      const cols = ['user_id'], vals = [userId];
      for (const [k, c] of Object.entries(col)) {
        if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
        cols.push(c);
        vals.push(jsonKeys.has(k) ? (patch[k] == null ? null : JSON.stringify(patch[k])) : patch[k]);
      }
      const upd = cols.slice(1);
      await conn.execute(
        `INSERT INTO user_specs (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})` +
        (upd.length
          ? ` ON DUPLICATE KEY UPDATE ${upd.map(c => `\`${c}\`=VALUES(\`${c}\`)`).join(',')}`
          : ' ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)'),
        vals);

      /* 자격증·활동은 '보낸 것으로 교체' 다. 부분 갱신을 하려면 무엇이 지워졌는지
         알아야 하는데 화면은 전체 목록을 보낸다. 지우고 다시 넣는 편이 정확하다. */
      if (Array.isArray(patch.certs)) {
        await conn.execute('DELETE FROM spec_certs WHERE user_id=?', [userId]);
        const list = [...new Set(patch.certs.map(c => String(c || '').trim()).filter(Boolean))];
        if (list.length) {
          await conn.query(
            `INSERT INTO spec_certs (user_id, cert_name) VALUES ${list.map(() => '(?,?)').join(',')}`,
            list.flatMap(c => [userId, c]));
        }
      }
      if (Array.isArray(patch.activities)) {
        await conn.execute('DELETE FROM spec_activities WHERE user_id=?', [userId]);
        const list = patch.activities.filter(a => a && a.type);
        if (list.length) {
          await conn.query(
            `INSERT INTO spec_activities
               (user_id, type, name, org, duration, role, stage, outcome, company_tier, company_name)
             VALUES ${list.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',')}`,
            list.flatMap(a => [userId, a.type, a.name ?? null, a.org ?? null, a.duration ?? null,
                               a.role ?? null, a.stage ?? null, a.outcome ?? null,
                               a.companyTier ?? null, a.companyName ?? null]));
        }
      }
    });
    return specs.byUser(userId);
  },
};

// ── 정적 참조 ───────────────────────────────────────────────
const reference = {
  departments: () => seed().departments || [],
  careerSpecs: () => seed().careerSpecs || [],
};

module.exports = { users, sessions, profiles, specs, reference };
