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
    /* 어느 경로로 가져왔는지 함께 준다(키 값이 아니라 경로 이름이라 비밀이 아니다).
       배포에서 키를 넣었는데도 계속 웹 폴백이 돌던 적이 있는데, 응답만 봐선
       구분이 안 됐다 — 기사는 어느 쪽이든 나오기 때문이다. 웹 폴백은 기사
       날짜가 없어 주간 대표기사가 통째로 비고, 키워드에 사이트 이름 조각이
       섞인다. 그래서 '되는데 이상하다'로 보인다. */
    res.json({ ...data, provider: NEWS.provider(), guide: NEWS.MOTIVE_GUIDE });
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
