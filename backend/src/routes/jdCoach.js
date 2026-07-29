/* POST /api/jd/coach
   직무기술서(채용공고) 원문 → 요구역량 목록 + 역량별 "자소서에 이렇게 적어라" 가이드

   ── 역할 분담 (jd-competency.js 머리주석과 같은 이야기) ──
     1단계 규칙 추출 : JD 문장에서 키워드로 역량을 찾는다. 대부분 여기서 끝난다.
     2단계 AI 보강   : 규칙이 3개 미만으로 잡았을 때만 부른다. AI 가 하는 일은
                      "역량 id 를 고르는 것"뿐 — 짧은 JSON 이라 CPU 8B 도 감당한다.
     3단계 가이드 조립: 문장은 전부 코드가 만든다. AI 는 문장을 쓰지 않는다.

   AI 가 죽어도 규칙 결과로 화면이 완성된다(casAnalyze.js 와 같은 정책).
   활동(activities)은 프론트가 자기 스펙에서 보내온다 — 남의 데이터가 아니라
   본인 것을 본인 화면에 되돌려주는 용도라 서버 세션까지 뒤질 이유가 없다. */
const express = require('express');
const { callModel, modelLabel, PROVIDER } = require('../ai-provider');
const JD = require('../jd-competency');
const TRENDS = require('../job-trends');

const router = express.Router();

/* 규칙이 이만큼 잡았으면 AI 를 부르지 않는다. 공고 한 장에서 역량 4개면 충분하고,
   부르지 않는 만큼 응답이 즉시 끝난다. */
const ENOUGH = 4;
/* 화면에 한 번에 보여줄 역량 수. 8개를 넘기면 사용자가 우선순위를 못 잡는다. */
const MAX_ITEMS = 7;
/* JD 원문이 아주 길 때(공고 전문 + 회사 소개) 프롬프트 길이가 곧 대기시간이므로 자른다. */
const MAX_JD_CHARS = 6000;

const SYSTEM = `한국 채용공고에서 요구 역량을 골라 JSON 만 출력한다.
아래 목록의 id 중에서만 고른다. 목록에 없는 요건은 custom 으로 넘긴다.
${JD.ARCHETYPES.map(a => `${a.id}: ${a.label}`).join('\n')}

규칙:
- 공고에 근거 문장이 있는 역량만 고른다. 일반적으로 좋은 역량이라고 넣지 말 것.
- 각 역량마다 근거가 된 공고 원문 문장을 quote 에 그대로 옮긴다(요약·수정 금지).
- 최대 6개. 중요한 순서대로.
- 점수·자소서 문장·조언을 쓰지 말 것. 역량 선택만 한다.

출력: {"competencies":[{"id":<위 id 중 하나 또는 "custom">,"label":<custom 일 때만 역량 이름>,"quote":<공고 원문 문장>}]}`;

/* AI 응답을 규칙 결과와 같은 모양으로 맞춘다. 모르는 id 는 버린다
   (그럴듯한 이름을 지어내 가이드를 붙이면 사용자가 검증할 수 없다). */
function coerceAi(list) {
  const out = [];
  for (const c of Array.isArray(list) ? list : []) {
    const id = String(c?.id || '').trim();
    const quote = String(c?.quote || '').trim();
    if (id === 'custom') {
      const label = String(c?.label || '').trim();
      if (label) out.push({ id: 'custom', label, quotes: quote ? [quote] : [], source: 'ai' });
      continue;
    }
    if (JD.BY_ID[id]) out.push({ id, quotes: quote ? [quote] : [], matched: [], source: 'ai' });
  }
  return out;
}

router.post('/coach', async (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, MAX_JD_CHARS);
  const activities = Array.isArray(req.body?.activities) ? req.body.activities : [];
  const hasSpec = activities.length > 0;
  /* 사용자가 AI 를 끄고 규칙만 쓸 수 있게 한다 — 로컬 8B 는 느리고, 규칙만으로도
     대부분의 공고는 충분히 읽힌다. */
  const useAi = req.body?.useAi !== false;

  if (text.length < 30) {
    return res.status(400).json({ error: '직무기술서(채용공고) 내용을 30자 이상 붙여넣어 주세요.' });
  }

  const rule = JD.ruleExtract(text);
  let entries = rule.found.map(f => ({ ...f, source: 'rule' }));
  let aiError = null;
  let usedAi = false;

  if (useAi && entries.length < ENOUGH) {
    try {
      const raw = await callModel(text, SYSTEM, { num_ctx: 8192, num_predict: 700 });
      const aiEntries = coerceAi(JSON.parse(raw).competencies)
        .filter(a => !entries.some(e => e.id === a.id));      // 규칙이 이미 잡은 건 그대로 둔다
      entries = entries.concat(aiEntries);
      usedAi = true;
    } catch (e) {
      /* AI 가 없어도 규칙 결과로 화면은 완성된다. 규칙도 못 잡았을 때만 진짜 실패다. */
      aiError = e.message;
      if (!entries.length) {
        const status = e?.status || 502;
        return res.status(status).json({
          error: (status === 503 || status === 429) ? e.message : 'AI 분석에 실패했습니다.',
          detail: e.message,
        });
      }
      console.warn('JD coach — AI 보강 실패, 규칙 결과만 반환:', e?.message);
    }
  }

  if (!entries.length) {
    return res.status(422).json({
      error: '이 글에서 요구 역량을 찾지 못했어요. 채용공고의 "자격요건 · 우대사항 · 주요업무" 부분을 포함해 붙여넣어 주세요.',
    });
  }

  const items = JD.spreadMaterials(
    entries
      .slice(0, MAX_ITEMS)
      .map(e => (e.id === 'custom' ? JD.buildCustom(e) : JD.buildGuide(e, activities, hasSpec)))
      .filter(Boolean)
  );

  /* 시장 빈도 붙이기 — "이 직무 공고 N건 중 M% 가 요구".
     채용공고 캐시가 없으면(인증키 승인 전) 전부 null 이라 카드에서 조용히 빠진다.
     careerly 만 할 수 있는 말이 여기서 나온다: 흔한 요구인지 희소한 요구인지에 따라
     자소서 전략이 갈린다. */
  const bucket = TRENDS.pickBucket(text, req.body?.jobKeyword);
  for (const item of items) {
    item.market = item.custom ? null : TRENDS.marketFor(bucket, item.id);
  }

  res.json({
    provider: usedAi ? PROVIDER : 'rule',
    model: usedAi ? modelLabel() : null,
    /* 화면에 그대로 띄우는 안내. 이 기능은 문장을 대신 써 주지 않는다는 것을
       사용자가 오해하지 않게 서버가 문구를 갖고 있는다. */
    disclaimer: '완성된 자소서 문장을 대신 써 드리지는 않습니다. 무엇을 어떤 순서로 쓸지에 대한 작성 지침이며, '
      + '문장은 직접 쓰셔야 합니다(대필 문장은 유사도·AI 검출에 걸립니다).',
    jdSentences: rule.sentenceCount,
    /* 트렌드 출처·기준을 함께 내려보낸다. 비율만 던지면 그게 어디서 나온 숫자인지
       화면에서 설명할 수 없다(제목 기준이라는 한계도 여기서 전달된다). */
    market: bucket ? { bucket, ...TRENDS.meta() } : null,
    items,
    notice: aiError ? 'AI 보강은 실패해서, 공고에서 직접 찾아낸 역량만 정리했어요.' : undefined,
  });
});

module.exports = router;
