/* 자소서 기증 — 동의 기반 합격 코퍼스(A 참조군)
   합격한 사용자가 **본인 자소서를 직접, 동의 아래** 기증한다(남의 글을 긁지 않는다 —
   저작권·개인정보 때문. 조사 결과는 대화 기록/CROAD-작업정리 참고).

   ── 저장되는 것은 언제나 서버가 다시 익명화한 본문이다 ──
   화면(donate.js)이 미리 익명화해 보여주지만, 그 결과를 믿지 않고 여기서 **다시**
   익명화한다(frontend/js/anonymize.js 단일 규칙). 클라이언트가 무엇을 보냈든 원문
   개인정보가 그대로 저장되는 일이 없어야 한다.

   ── 문장 복붙이 아니라 통계 참조군이다 ──
   /stats 는 직무·문항유형별 **통계**만 돌려준다(건수·평균 길이·결과에 수치 포함 비율).
   합격 자소서 문장을 그대로 내려보내지 않는다 — 그러면 표절·대필 도구가 된다. */
const express = require('express');
const { query, queryOne } = require('../mysql');
const Anonymize = require('../../../frontend/js/anonymize.js');

const router = express.Router();

/* ── 단일 출처: 직무·문항유형 목록 ─────────────────────────────
   화면(donate.js)이 /meta 로 받아 쓴다. 프론트에 사본을 두면 한쪽만 바뀐다. */
const JOB_FIELDS = [
  { id: 'planning', label: '기획·전략' }, { id: 'marketing', label: '마케팅·브랜드' },
  { id: 'sales', label: '영업·영업관리' }, { id: 'dev', label: '개발·엔지니어링' },
  { id: 'data', label: '데이터·AI' }, { id: 'design', label: '디자인' },
  { id: 'hr', label: '인사·HR' }, { id: 'finance', label: '재무·회계' },
  { id: 'operation', label: '운영·CS' }, { id: 'rnd', label: '연구개발(R&D)' },
  { id: 'etc', label: '기타' },
];
/* 문항유형 id 는 자소서 코치(jd-coach.js QUESTION_TYPES)와 같은 말이다 — 나중에 통계를
   문항 분류와 맞물리게 하려면 같은 축이어야 한다. */
const QUESTION_TYPES = [
  { id: 'motive', label: '지원동기·포부' }, { id: 'competency', label: '직무역량' },
  { id: 'collab', label: '협업·갈등' }, { id: 'challenge', label: '도전·실패' },
  { id: 'growth', label: '성장·가치관' },
];
const jobIds = new Set(JOB_FIELDS.map(j => j.id));
const qTypeIds = new Set(QUESTION_TYPES.map(q => q.id));

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  next();
}
/* express 4 는 async 핸들러 예외를 자동으로 못 잡는다(server.js ah() 주석과 같은 이유). */
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const STAR_KEYS = ['s', 't', 'a', 'r'];
const strArr = v => (Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 20);

/* GET /api/donations/meta — 직무·문항유형 목록(화면 드롭다운). */
router.get('/meta', (req, res) => {
  res.json({ jobFields: JOB_FIELDS, questionTypes: QUESTION_TYPES });
});

/* POST /api/donations — 기증. 동의 필수. 서버가 다시 익명화해 저장한다. */
router.post('/', requireAuth, ah(async (req, res) => {
  const jobField = String(req.body?.jobField || '').trim();
  const questionType = String(req.body?.questionType || '').trim();
  const consent = req.body?.consent === true;
  const rawStar = (req.body?.star && typeof req.body.star === 'object') ? req.body.star : {};
  /* 가릴 말(이름·회사·학교) — 화면에서 사용자가 알려준다. 본인 이름·닉네임은 자동으로 넣는다. */
  const terms = strArr(req.body?.terms).concat([req.user.name, req.user.nickname].filter(Boolean));

  if (!consent) return res.status(400).json({ error: '통계·익명 참조 활용에 동의해야 기증할 수 있어요.' });
  if (!jobIds.has(jobField)) return res.status(400).json({ error: '직무를 선택해 주세요.' });
  if (!qTypeIds.has(questionType)) return res.status(400).json({ error: '문항 유형을 선택해 주세요.' });

  /* 칸마다 서버에서 다시 익명화한다. 저장되는 건 이 결과뿐이다. */
  const star = {};
  const maskCount = {};
  for (const k of STAR_KEYS) {
    const { text, masked } = Anonymize.anonymize(rawStar[k] || '', { terms });
    star[k] = text;
    for (const m of masked) maskCount[m.type] = (maskCount[m.type] || 0) + m.count;
  }
  const joined = STAR_KEYS.map(k => star[k]).join(' ').trim();
  if (joined.replace(/\s+/g, '').length < 20) {
    return res.status(400).json({ error: '자소서 내용을 조금 더 적어 주세요(20자 이상).' });
  }
  const masked = Object.entries(maskCount).map(([type, count]) => ({ type, count }));
  const charCount = STAR_KEYS.reduce((n, k) => n + star[k].length, 0);
  const hasNumberResult = /\d/.test(star.r) ? 1 : 0;

  await query(
    `INSERT INTO cover_donations
       (user_id, job_field, question_type, result, star, char_count, has_number_result, masked, consent)
     VALUES (?, ?, ?, 'pass', CAST(? AS JSON), ?, ?, CAST(? AS JSON), 1)`,
    [req.user.id, jobField, questionType, JSON.stringify(star), charCount, hasNumberResult, JSON.stringify(masked)]
  );

  /* 무엇을 가렸는지 돌려준다 — 화면이 "이렇게 익명화해서 저장했어요" 로 보여준다. */
  res.status(201).json({ ok: true, masked, charCount, hasNumberResult: Boolean(hasNumberResult) });
}));

/* GET /api/donations/stats?job=&qtype= — 직무·문항유형별 통계(참조군). 문장은 안 준다. */
router.get('/stats', ah(async (req, res) => {
  const job = String(req.query.job || '').trim();
  const qtype = String(req.query.qtype || '').trim();
  const where = [];
  const params = [];
  if (jobIds.has(job)) { where.push('job_field = ?'); params.push(job); }
  if (qTypeIds.has(qtype)) { where.push('question_type = ?'); params.push(qtype); }
  const sql = `SELECT COUNT(*) AS n,
                      ROUND(AVG(char_count)) AS avg_chars,
                      ROUND(AVG(has_number_result) * 100) AS pct_number_result
               FROM cover_donations${where.length ? ' WHERE ' + where.join(' AND ') : ''}`;
  const row = await queryOne(sql, params);
  res.json({
    job: job || null, qtype: qtype || null,
    count: Number(row?.n || 0),
    avgCharCount: row?.avg_chars != null ? Number(row.avg_chars) : null,
    pctNumberInResult: row?.pct_number_result != null ? Number(row.pct_number_result) : null,
  });
}));

/* GET /api/donations/mine — 내가 기증한 목록(신뢰용: 무엇을 냈는지 본인이 확인). */
router.get('/mine', requireAuth, ah(async (req, res) => {
  const rows = await query(
    `SELECT id, job_field, question_type, char_count, has_number_result, masked, created_at
       FROM cover_donations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({ items: rows.map(r => ({
    id: r.id, jobField: r.job_field, questionType: r.question_type,
    charCount: r.char_count, hasNumberResult: Boolean(r.has_number_result),
    masked: r.masked || [], createdAt: r.created_at,
  })) });
}));

module.exports = router;
