/* 파일 DB(JSON) → MySQL 이관.

     node scripts/migrate-to-mysql.js            # db.json + 카탈로그 캐시 전부
     node scripts/migrate-to-mysql.js --catalog  # 카탈로그만 (회원 데이터는 건드리지 않음)
     node scripts/migrate-to-mysql.js --fresh    # 기존 행을 지우고 다시 넣는다

   ── 두 종류의 데이터를 옮긴다 ──
   1) 회원 데이터  : data/db.json (users·profiles·sessions·userSpecs·mentoringRequests)
   2) 카탈로그     : data/*.json (자격증·직업분류·기업분류) + 코드에 있는 학과 목록
   카탈로그는 수집 스크립트가 다시 만들 수 있으므로 --catalog 로 언제든 갱신한다.

   ── 왜 배치로 넣나 ──
   기업 분류가 3만 건이다. 한 건씩 INSERT 하면 왕복이 3만 번이라 몇 분씩 걸린다.
   500건씩 묶어 넣으면 수 초로 끝난다.

   ── 이미 있는 행을 만나면 ──
   재실행이 안전해야 한다(중간에 끊기면 다시 돌려야 하므로). ON DUPLICATE KEY UPDATE 로
   덮어쓴다. 회원 데이터는 --fresh 를 주지 않는 한 지우지 않는다.
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { query, transaction, assertConnection, pool } = require('../src/mysql');

const DATA = path.join(__dirname, '..', 'data');
const readJson = f => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); }
  catch { return null; }
};

const arg = n => process.argv.includes(`--${n}`);
const CHUNK = 500;

/* 여러 행을 한 문장으로 넣는다. 컬럼 수 × 행 수만큼 ? 를 만든다. */
async function bulkInsert(table, columns, rows, { update = [] } = {}) {
  if (!rows.length) return 0;
  const cols = columns.map(c => `\`${c}\``).join(',');
  const dup = update.length
    ? ' ON DUPLICATE KEY UPDATE ' + update.map(c => `\`${c}\`=VALUES(\`${c}\`)`).join(',')
    : ' ON DUPLICATE KEY UPDATE ' + `\`${columns[0]}\`=VALUES(\`${columns[0]}\`)`;

  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const ph = slice.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const params = slice.flatMap(r => columns.map(c => r[c] ?? null));
    /* execute() 는 준비된 문장이라 파라미터 수 제한(65535)이 있다. CHUNK×컬럼수가
       그 안에 있는지 확인하고, 넘으면 query() 로 떨어뜨린다. */
    await pool().query(`INSERT INTO \`${table}\` (${cols}) VALUES ${ph}${dup}`, params);
    n += slice.length;
  }
  return n;
}

const j = v => (v == null ? null : JSON.stringify(v));

// ── 회원 데이터 ─────────────────────────────────────────────
async function migrateUsers(db) {
  const users = db.users || [];
  console.log(`\n회원 ${users.length}명`);

  await bulkInsert('users',
    ['id', 'username', 'password_hash', 'name', 'email', 'role', 'nickname', 'provider', 'provider_id', 'created_at'],
    users.map(u => ({
      id: u.id,
      username: u.username,
      password_hash: u.passwordHash ?? null,
      name: u.name || u.username,
      /* 이메일은 UNIQUE 다. 빈 문자열이 여러 건이면 충돌하므로 NULL 로 바꾼다
         (MySQL 은 NULL 끼리는 중복으로 보지 않는다). */
      email: (u.email || '').trim() || null,
      role: u.role || null,
      nickname: u.nickname ?? null,
      provider: u.provider || null,
      provider_id: u.providerId || null,
      created_at: (u.createdAt || new Date().toISOString()).slice(0, 19).replace('T', ' '),
    })),
    { update: ['username', 'password_hash', 'name', 'email', 'role', 'nickname'] });
  console.log(`  users ✓`);

  const profiles = (db.profiles || []).filter(p => users.some(u => u.id === p.userId));
  await bulkInsert('profiles',
    ['user_id', 'nickname', 'university', 'current_job', 'tips'],
    profiles.map(p => ({
      user_id: p.userId, nickname: p.nickname ?? null,
      university: p.university ?? null, current_job: p.currentJob ?? null, tips: p.tips ?? null,
    })),
    { update: ['nickname', 'university', 'current_job', 'tips'] });
  console.log(`  profiles ${profiles.length}건 ✓`);

  /* 만료된 세션은 옮기지 않는다 — 어차피 못 쓰는 행이다. */
  const now = Date.now();
  const sessions = (db.sessions || [])
    .filter(s => s.expiresAt > now && users.some(u => u.id === s.userId));
  await bulkInsert('sessions', ['token', 'user_id', 'created_at', 'expires_at'],
    sessions.map(s => ({ token: s.token, user_id: s.userId, created_at: s.createdAt, expires_at: s.expiresAt })));
  console.log(`  sessions ${sessions.length}건 ✓ (만료분 제외)`);
}

async function migrateSpecs(db) {
  const users = new Set((db.users || []).map(u => u.id));
  /* 회원이 없는 스펙은 외래키에 걸린다. 옛 데이터에 흔하므로 미리 걸러낸다. */
  const specs = (db.userSpecs || []).filter(s => users.has(s.userId));
  const dropped = (db.userSpecs || []).length - specs.length;
  console.log(`\n스펙 ${specs.length}건${dropped ? ` (회원 없는 ${dropped}건 제외)` : ''}`);

  await bulkInsert('user_specs',
    ['user_id', 'dept', 'major', 'field', 'job', 'company', 'corp_type', 'gpa', 'gpa_max',
     'scores', 'qual', 'detail', 'cert_meta', 'interest_companies', 'careers'],
    specs.map(s => ({
      user_id: s.userId,
      dept: s.dept ?? null,
      major: s.major ?? null,
      field: s.field ?? null,
      job: s.job ?? null,
      /* 옛 데이터에 company 가 객체로 들어간 건이 있다(실측). 문자열만 받는다. */
      company: typeof s.company === 'string' ? s.company : null,
      corp_type: s.corpType ?? null,
      gpa: typeof s.gpa === 'number' ? s.gpa : null,
      gpa_max: typeof s.gpaMax === 'number' ? s.gpaMax : null,
      scores: j(s.scores), qual: j(s.qual), detail: j(s.detail),
      cert_meta: j(s.certMeta),
      interest_companies: j(s.interestCompanies),
      careers: j(s.careers),
    })),
    { update: ['dept', 'major', 'field', 'job', 'company', 'corp_type', 'gpa', 'gpa_max',
               'scores', 'qual', 'detail', 'cert_meta', 'interest_companies', 'careers'] });
  console.log(`  user_specs ✓`);

  /* 자격증·활동은 통째로 다시 넣는다(부분 갱신보다 단순하고, 재실행이 안전하다). */
  const ids = specs.map(s => s.userId);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const ph = slice.map(() => '?').join(',');
    await pool().query(`DELETE FROM spec_certs WHERE user_id IN (${ph})`, slice);
    await pool().query(`DELETE FROM spec_activities WHERE user_id IN (${ph})`, slice);
  }

  const certs = specs.flatMap(s =>
    [...new Set((s.certs || []).map(c => String(c || '').trim()).filter(Boolean))]
      .map(name => ({ user_id: s.userId, cert_name: name })));
  await bulkInsert('spec_certs', ['user_id', 'cert_name'], certs);
  console.log(`  spec_certs ${certs.length}건 ✓`);

  const acts = specs.flatMap(s => (s.activities || [])
    .filter(a => a && a.type)
    .map(a => ({
      user_id: s.userId, type: a.type,
      name: a.name ?? null, org: a.org ?? null, duration: a.duration ?? null,
      role: a.role ?? null, stage: a.stage ?? null, outcome: a.outcome ?? null,
      company_tier: a.companyTier ?? null, company_name: a.companyName ?? null,
    })));
  await bulkInsert('spec_activities',
    ['user_id', 'type', 'name', 'org', 'duration', 'role', 'stage', 'outcome', 'company_tier', 'company_name'],
    acts);
  console.log(`  spec_activities ${acts.length}건 ✓`);
}

async function migrateMentoring(db) {
  const users = new Set((db.users || []).map(u => u.id));
  const rows = (db.mentoringRequests || []).filter(r => users.has(r.menteeId));
  if (!rows.length) return console.log('\n멘토링 신청 0건 (건너뜀)');
  console.log(`\n멘토링 신청 ${rows.length}건`);
  await bulkInsert('mentoring_requests',
    ['id', 'mentee_id', 'mentor_id', 'mentor_name', 'format', 'format_name', 'amount',
     'message', 'status', 'order_id', 'payment'],
    rows.map(r => ({
      id: r.id, mentee_id: r.menteeId, mentor_id: r.mentorId, mentor_name: r.mentorName ?? null,
      format: r.format, format_name: r.formatName ?? null, amount: r.amount,
      message: r.message ?? null, status: r.status || 'pending',
      order_id: r.orderId ?? null, payment: j(r.payment),
    })),
    { update: ['status', 'order_id', 'payment', 'amount'] });
  console.log('  mentoring_requests ✓');
}

// ── 카탈로그 ────────────────────────────────────────────────
async function migrateCatalog() {
  console.log('\n── 카탈로그 ──');

  // 자격증 (국가자격 + 민간자격 합본은 cert-catalog 가 만든다)
  const { catalog: certCatalog } = require('../src/cert-catalog');
  const certs = certCatalog().certs || [];
  await bulkInsert('certs', ['name', 'code', 'kind', 'kind_label', 'grade', 'field', 'mid_field'],
    certs.map(c => ({
      name: c.id, code: c.code ?? null, kind: c.kind ?? null, kind_label: c.kindLabel ?? null,
      grade: c.grade ?? null, field: c.field ?? null, mid_field: c.midField ?? null,
    })),
    { update: ['code', 'kind', 'kind_label', 'grade', 'field', 'mid_field'] });
  console.log(`  certs ${certs.length}종 ✓`);

  // 학과
  const { MAJORS } = require('../src/major-catalog');
  await bulkInsert('majors', ['name', 'dept'],
    MAJORS.map(([name, dept]) => ({ name, dept })), { update: ['dept'] });
  console.log(`  majors ${MAJORS.length}개 ✓`);

  // 기업 분류 — 가장 크다(3만 건)
  const cc = require('../src/company-classify');
  const map = cc.reloadCache().map;
  const companies = [];
  for (const [norm, v] of map) {
    if (!v.name) continue;
    companies.push({
      norm_name: norm, name: v.name,
      corp_type: cc.CORP_TYPE_ID[v.type] || null, source: (v.source || '').slice(0, 190),
    });
  }
  await bulkInsert('companies', ['norm_name', 'name', 'corp_type', 'source'], companies,
    { update: ['name', 'corp_type', 'source'] });
  console.log(`  companies ${companies.length}건 ✓`);

  // 직업 분류 (3단계)
  const { catalog: jobCatalog } = require('../src/wage-jobs');
  const jc = jobCatalog();
  if (jc.empty) return console.log('  jobs — wage-jobs.json 이 없어 건너뜀');

  await bulkInsert('job_majors', ['code', 'no', 'name', 'emoji', 'descr'],
    jc.majors.map(m => ({ code: m.code, no: m.no, name: m.name, emoji: m.emoji, descr: m.desc })),
    { update: ['no', 'name', 'emoji', 'descr'] });

  const mids = jc.majors.flatMap(M => M.middles.map(S => ({
    code: S.code, major_code: M.code, name: S.name,
    majors: j(S.majors), legacy: j(S.legacy ?? null),
  })));
  await bulkInsert('job_middles', ['code', 'major_code', 'name', 'majors', 'legacy'], mids,
    { update: ['major_code', 'name', 'majors', 'legacy'] });

  const jobs = jc.majors.flatMap(M => M.middles.flatMap(S => S.jobs.map(job => ({
    code: job.code, middle_code: S.code, name: job.name,
    avg_wage: job.avgWage ?? null, outlook: job.outlook ?? null, summary: job.summary ?? null,
  }))));
  await bulkInsert('jobs', ['code', 'middle_code', 'name', 'avg_wage', 'outlook', 'summary'], jobs,
    { update: ['middle_code', 'name', 'avg_wage', 'outlook', 'summary'] });
  console.log(`  jobs ${jc.majors.length}/${mids.length}/${jobs.length} (1차/2차/직업) ✓`);
}

async function wipe() {
  console.log('--fresh — 기존 행을 지웁니다');
  /* 외래키 때문에 자식부터 지운다. 카탈로그는 부모(job_majors)를 지우면 CASCADE 로 따라간다. */
  for (const t of ['spec_certs', 'spec_activities', 'mentoring_requests', 'user_specs',
                   'sessions', 'profiles', 'users', 'certs', 'majors', 'companies', 'jobs',
                   'job_middles', 'job_majors']) {
    await query(`DELETE FROM \`${t}\``);
  }
}

(async () => {
  await assertConnection();
  if (arg('fresh')) await wipe();

  if (!arg('catalog')) {
    const db = readJson('db.json');
    if (!db) {
      console.log('\ndata/db.json 이 없습니다 — 회원 데이터는 건너뜁니다.');
    } else {
      await migrateUsers(db);
      await migrateSpecs(db);
      await migrateMentoring(db);
    }
  }
  await migrateCatalog();

  console.log('\n── 결과 ──');
  for (const t of ['users', 'profiles', 'sessions', 'user_specs', 'spec_certs', 'spec_activities',
                   'mentoring_requests', 'certs', 'majors', 'companies', 'job_majors', 'job_middles', 'jobs']) {
    const [{ n }] = await query(`SELECT COUNT(*) AS n FROM \`${t}\``);
    console.log(`  ${t.padEnd(20)} ${String(n).padStart(7)}`);
  }
  await pool().end();
})().catch(async e => {
  console.error('\n이관 실패:', e.message);
  try { await pool().end(); } catch { /* 이미 닫힘 */ }
  process.exit(1);
});
