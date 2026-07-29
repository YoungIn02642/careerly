/* 결제 (토스페이먼츠).

   ── 이 파일의 존재 이유는 딱 하나: 승인을 서버가 한다 ──
   브라우저 SDK 가 결제창을 띄우고 성공하면 paymentKey·orderId·amount 를 돌려준다.
   그 시점은 **아직 결제가 끝난 게 아니다.** 서버가 시크릿 키로 승인 API 를 호출해야
   실제로 돈이 움직인다. 프론트에서 "성공했다" 는 말만 믿고 신청을 확정하면,
   결제창을 아예 열지 않고 성공 요청만 흉내 내도 통과한다.

   ── 금액도 서버가 다시 대조한다 ──
   SDK 에 넘긴 amount 는 브라우저에서 조작할 수 있다. 그래서 승인 직전에
   우리 DB 의 신청 금액(서버가 정한 값)과 대조하고, 다르면 승인하지 않는다.

   ── 시크릿 키는 절대 프론트로 내려보내지 않는다 ──
   test_sk_ / live_sk_ 로 시작하는 키는 서버 전용이다. 클라이언트 키(test_ck_)만
   화면이 쓴다. 이 구분이 무너지면 누구나 우리 상점으로 결제·취소를 부를 수 있다.
*/
const express = require('express');
const { query, queryOne } = require('../mysql');
const { toRequest } = require('./mentoring');

const router = express.Router();

const SECRET_KEY = (process.env.TOSS_SECRET_KEY || '').trim();
const CLIENT_KEY = (process.env.TOSS_CLIENT_KEY || '').trim();
const CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

const isEnabled = () => !!(SECRET_KEY && CLIENT_KEY);

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  next();
}

/* 화면이 결제창을 띄우려면 클라이언트 키가 필요하다. 설정 안 됐으면 그 사실을
   알려서 결제 버튼 자체를 숨기게 한다 — 눌렀을 때 깨지는 것보다 낫다. */
router.get('/config', (req, res) => {
  res.json({ enabled: isEnabled(), clientKey: CLIENT_KEY || null });
});

/* 결제창을 열기 직전에 부른다. 주문번호와 **서버가 정한 금액**을 받아 간다.
   화면은 이 값을 그대로 SDK 에 넘긴다. */
router.post('/prepare', requireAuth, async (req, res) => {
  if (!isEnabled()) return res.status(503).json({ error: '결제가 아직 설정되지 않았습니다.' });

  const row = await queryOne('SELECT * FROM mentoring_requests WHERE id=?', [req.body?.requestId]);
  if (!row || row.mentee_id !== req.user.id) {
    return res.status(404).json({ error: '신청을 찾을 수 없습니다.' });
  }
  if (row.status !== 'pending') {
    return res.status(409).json({ error: '이미 결제되었거나 처리된 신청입니다.' });
  }

  /* 주문번호는 결제 시도마다 새로 만든다. 같은 번호로 두 번 승인하면 결제사가
     거부하는데, 그때 사용자는 이유를 알 수 없다. */
  const orderId = `careerly_${row.id}_${Date.now()}`;
  await query('UPDATE mentoring_requests SET order_id=? WHERE id=?', [orderId, row.id]);

  res.json({
    orderId,
    amount: Number(row.amount),                           // 서버가 정한 금액
    orderName: `${row.mentor_name || '멘토'} 멘토링 · ${row.format_name}`,
    customerName: req.user.nickname || req.user.name || '회원',
  });
});

/* 결제창이 성공하면 화면이 여기로 보낸다. **여기서 비로소 결제가 확정된다.** */
router.post('/confirm', requireAuth, async (req, res) => {
  if (!isEnabled()) return res.status(503).json({ error: '결제가 아직 설정되지 않았습니다.' });

  const { paymentKey, orderId, amount } = req.body || {};
  if (!paymentKey || !orderId || amount == null) {
    return res.status(400).json({ error: '결제 정보가 올바르지 않습니다.' });
  }

  const row = await queryOne('SELECT * FROM mentoring_requests WHERE order_id=?', [orderId]);
  if (!row || row.mentee_id !== req.user.id) {
    return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
  }
  if (row.status === 'paid') {
    /* 새로고침 등으로 같은 승인이 두 번 올 수 있다. 이미 끝난 건이면 조용히 성공으로
       돌려준다 — 여기서 에러를 내면 결제는 됐는데 화면은 실패로 보인다. */
    return res.json({ message: '이미 결제가 완료된 신청입니다.', request: toRequest(row) });
  }
  if (row.status !== 'pending') {
    return res.status(409).json({ error: '결제할 수 없는 신청 상태입니다.' });
  }

  /* 핵심 검증: 브라우저가 보낸 금액이 우리가 정한 금액과 같은가.
     다르면 조작이므로 승인 자체를 하지 않는다(돈이 움직이기 전에 막는다). */
  if (Number(amount) !== Number(row.amount)) {
    console.warn('결제 금액 불일치:', { orderId, sent: amount, expected: Number(row.amount) });
    return res.status(400).json({ error: '결제 금액이 올바르지 않습니다.' });
  }

  try {
    /* 토스페이먼츠는 시크릿 키를 Basic 인증으로 받는다. 키 뒤의 콜론이 필수다
       (비밀번호가 빈 문자열이라는 뜻) — 빠뜨리면 401 이 난다. */
    const auth = Buffer.from(`${SECRET_KEY}:`).toString('base64');
    const r = await fetch(CONFIRM_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(row.amount) }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.warn('결제 승인 실패:', data.code, data.message);
      return res.status(400).json({ error: data.message || '결제 승인에 실패했습니다.' });
    }

    const payment = {
      paymentKey,
      orderId,
      amount: data.totalAmount ?? Number(row.amount),
      method: data.method || null,
      approvedAt: data.approvedAt || new Date().toISOString(),
      receiptUrl: data.receipt?.url || null,
    };
    await query("UPDATE mentoring_requests SET status='paid', payment=? WHERE id=?",
      [JSON.stringify(payment), row.id]);

    const updated = await queryOne('SELECT * FROM mentoring_requests WHERE id=?', [row.id]);
    res.json({ message: '결제가 완료되었습니다.', request: toRequest(updated) });
  } catch (e) {
    console.warn('결제 승인 중 오류:', e.message);
    /* 여기서 실패해도 돈이 빠져나갔을 수 있다(승인 요청은 갔는데 응답을 못 받은 경우).
       사용자에게 다시 시도하라고만 하면 이중 결제가 된다. 문의하라고 안내한다. */
    res.status(502).json({
      error: '결제 승인 중 문제가 생겼어요. 결제내역을 확인한 뒤 문의해 주세요.',
    });
  }
});

module.exports = { router, isEnabled };
