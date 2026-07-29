/* 멘토링 신청 — 결제가 붙는 유일한 흐름.

   ── 왜 서버로 옮겼나 ──
   신청 내역이 브라우저 localStorage 에만 있었다. 결제를 붙이려면 반드시 서버에
   있어야 한다. 금액과 주문을 브라우저가 들고 있으면 개발자도구에서 20,000원을
   100원으로 바꿔 결제한 뒤 "결제했다" 고 주장할 수 있다.

   ── 금액은 절대 클라이언트에서 받지 않는다 ──
   요청 본문의 amount 를 그대로 쓰면 위 공격이 성립한다. 여기서는 **format 만 받고
   금액은 서버가 FORMATS 에서 찾아 정한다**. 결제 승인 때도 이 값과 대조한다.

   ── 멘토는 아직 시드 데이터다 ──
   프론트 mentoring.js 의 MENTORS 배열이 원본이고 실제 회원이 아니다. 그래서
   mentorId 검증을 하지 않고 이름을 함께 저장해 둔다. 멘토가 실제 회원이 되면
   여기서 db.users 를 조회하도록 바꾼다. */
const express = require('express');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../store');

const router = express.Router();

/* 가격표의 단일 출처. 프론트에도 같은 목록이 있지만 화면 표시용이고,
   실제 청구 금액은 **여기 값만** 쓴다. 둘이 어긋나면 서버가 이긴다. */
const FORMATS = [
  { id: 'video30',  name: '화상 30분', amount: 20000 },
  { id: 'onsite60', name: '대면 60분', amount: 45000 },
  { id: 'text',     name: '텍스트',    amount: 12000 },
];
const formatById = id => FORMATS.find(f => f.id === id) || null;

/* 신청 상태
     pending  — 신청만 하고 아직 결제 전
     paid     — 결제 승인 완료 (멘토 응답 대기)
     accepted / rejected — 멘토가 답함
     cancelled — 멘티가 취소 */
const OPEN_STATUSES = ['pending', 'paid'];

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  next();
}

// 가격표 — 화면이 서버 가격을 그대로 보여주도록
router.get('/formats', (req, res) => res.json({ formats: FORMATS }));

/* 내 신청 목록. 멘티는 자기가 보낸 것, 멘토는 자기가 받은 것을 본다.
   지금은 멘토가 시드라 받은 요청 조회는 아직 쓰이지 않는다. */
router.get('/requests', requireAuth, (req, res) => {
  const db = readDb();
  const list = (db.mentoringRequests || [])
    .filter(r => r.menteeId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ requests: list });
});

router.post('/requests', requireAuth, (req, res) => {
  const { mentorId, mentorName, format, message } = req.body || {};
  const f = formatById(format);
  if (!mentorId || !f) {
    return res.status(400).json({ error: '멘토와 멘토링 형식을 선택해주세요.' });
  }

  const db = readDb();
  if (!db.mentoringRequests) db.mentoringRequests = [];

  /* 같은 멘토에게 결제 전 신청이 이미 있으면 새로 만들지 않고 그것을 갱신한다.
     아니면 결제창을 닫을 때마다 미결제 주문이 쌓인다. */
  const open = db.mentoringRequests.find(r =>
    r.menteeId === req.user.id && r.mentorId === mentorId && r.status === 'pending');

  const now = new Date().toISOString();
  let reqRow;
  if (open) {
    reqRow = open;
    reqRow.format = f.id;
    reqRow.formatName = f.name;
    reqRow.amount = f.amount;
    reqRow.message = (message || '').trim();
    reqRow.updatedAt = now;
  } else {
    reqRow = {
      id: nanoid(),
      menteeId: req.user.id,
      mentorId,
      mentorName: (mentorName || '').trim() || null,
      format: f.id,
      formatName: f.name,
      amount: f.amount,              // ← 서버가 정한 금액. 클라이언트 값은 쓰지 않는다
      message: (message || '').trim(),
      status: 'pending',
      payment: null,
      createdAt: now,
      updatedAt: now,
    };
    db.mentoringRequests.push(reqRow);
  }
  writeDb(db);

  /* orderId 는 결제사에 넘길 주문번호다. 신청 id 를 그대로 쓰면 재결제 때 중복되므로
     매번 새로 만들고, 승인 시 이 값으로 신청을 되찾는다. */
  res.status(201).json({ request: reqRow });
});

router.post('/requests/:id/cancel', requireAuth, (req, res) => {
  const db = readDb();
  const row = (db.mentoringRequests || []).find(r => r.id === req.params.id);
  if (!row || row.menteeId !== req.user.id) {
    return res.status(404).json({ error: '신청을 찾을 수 없습니다.' });
  }
  if (!OPEN_STATUSES.includes(row.status)) {
    return res.status(409).json({ error: '이미 처리된 신청입니다.' });
  }
  /* 결제까지 끝난 건은 환불이 따라야 하므로 여기서 그냥 지우지 않는다.
     환불 흐름을 만들기 전까지는 미결제 건만 취소할 수 있다. */
  if (row.status === 'paid') {
    return res.status(409).json({ error: '결제가 완료된 신청은 아직 취소할 수 없어요. 멘토에게 문의해 주세요.' });
  }

  row.status = 'cancelled';
  row.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ message: '신청을 취소했습니다.', request: row });
});

module.exports = { router, FORMATS, formatById };
