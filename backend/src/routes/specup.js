/* 스펙업 — 자격증 시험일정 · 공모전/대외활동 모집
   계산은 src/specup.js 가 한다. 여기는 입력을 다듬고 실패를 사용자가 할 수 있는
   말로 바꾸는 얇은 껍데기다.

   ── 실패를 500 한 줄로 뭉개지 않는다 ──
   키 없음 · 활용신청 전 · 한도 초과는 사용자가 할 일이 전부 다르다. 예전에 AI
   라우트가 이걸 "AI 분석에 실패했습니다" 하나로 뭉개서 아무도 원인을 몰랐다
   (작업정리 2-3-1). 같은 실수를 반복하지 않으려고 specup.js 가 붙여 준
   `payload` 를 그대로 내려보낸다. */
const express = require('express');
const specup = require('../specup');

const router = express.Router();

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* specup.js 가 던지는 오류에는 payload(code·reason·error·how)가 붙어 있다.
   없으면 진짜 예상 못 한 오류이므로 502 로 올린다. */
function fail(res, err) {
  const p = err && err.payload;
  if (!p) {
    console.error('[specup]', err);
    return res.status(502).json({ error: '데이터를 불러오지 못했어요.', reason: 'unknown' });
  }
  return res.status(p.code || 502).json({ error: p.error, reason: p.reason, how: p.how });
}

/* GET /api/specup/exams?certs=정보처리기사,SQLD&year=2026
   부족한 자격증 이름을 받아 각각의 다음 회차를 돌려준다. */
router.get('/exams', ah(async (req, res) => {
  const certs = String(req.query.certs || '')
    .split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);   // 화면 한 장 분량이면 충분
  if (!certs.length) return res.json({ year: null, items: [] });

  const year = Number(req.query.year) || undefined;
  try {
    res.json(await specup.certSchedules(certs, { year }));
  } catch (err) {
    fail(res, err);
  }
}));

/* GET /api/specup/activities?topic=contest|activity&page=1 */
router.get('/activities', ah(async (req, res) => {
  try {
    res.json(await specup.youthActivities({
      topic: String(req.query.topic || 'contest'),
      page: Math.max(1, Number(req.query.page) || 1),
    }));
  } catch (err) {
    fail(res, err);
  }
}));

module.exports = router;
