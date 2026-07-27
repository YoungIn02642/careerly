/* GET /api/news/company?name=<회사명>
   자소서 '지원동기' 문항용 — 이 회사의 최근 기사 + 기사에서 반복된 키워드 + 작성 지침

   기사를 요약하거나 자소서 문장을 만들어 주지 않는다(src/news.js 머리주석 참고).
   실패해도 자소서 코치 본체는 멀쩡해야 하므로, 이 라우트는 독립적으로 호출된다. */
const express = require('express');
const NEWS = require('../news');

const router = express.Router();

router.get('/company', async (req, res) => {
  const name = String(req.query.name || '').trim();

  try {
    const data = await NEWS.companyNews(name);
    res.json({ ...data, guide: NEWS.MOTIVE_GUIDE });
  } catch (e) {
    const status = e?.status || 502;
    console.warn('회사 뉴스 조회 실패:', e?.message);
    res.status(status).json({
      /* 400(입력 문제)·503(키 설정 문제)은 사용자가 할 일이 있으므로 문구를 그대로 보여준다. */
      error: status === 400 || status === 503
        ? e.message
        : '뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
  }
});

module.exports = router;
