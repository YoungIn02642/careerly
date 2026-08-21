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
const GUIDE = require('../cover-guide');
const DRAFT = require('../draft-coach');

const router = express.Router();

/* 규칙이 이만큼 잡았으면 AI 를 부르지 않는다. 공고 한 장에서 역량 4개면 충분하고,
   부르지 않는 만큼 응답이 즉시 끝난다. */
const ENOUGH = 4;
/* 화면에 한 번에 보여줄 역량 수. 8개를 넘기면 사용자가 우선순위를 못 잡는다. */
const MAX_ITEMS = 7;
/* JD 원문이 아주 길 때(공고 전문 + 회사 소개) 프롬프트 길이가 곧 대기시간이므로 자른다. */
const MAX_JD_CHARS = 6000;

/* ── 화면 전체에 걸리는 안내·기준 ────────────────────────────
   역량 목록과 달리 **입력이 무엇이든 똑같은** 값들이다. /coach 안에 인라인으로
   적혀 있던 것을 함수로 뽑았다 — 공고 없이 회사 근거만으로 시작하는 경로(/guide)가
   같은 문구를 써야 하는데, 프론트에 복사하면 한쪽만 고쳐진다.

   특히 disclaimer 는 "문장을 대신 써 주지 않는다" 를 말하는 문구다. 경로마다
   다르게 적히면 그게 바로 오해의 출발점이 된다. */
function guidePayload({ company, competencies = [] } = {}) {
  return {
    disclaimer: '완성된 자소서 문장을 대신 써 드리지는 않습니다. 무엇을 어떤 순서로 쓸지에 대한 작성 지침이며, '
      + '첫 문장은 빈칸이 있는 틀로만 드립니다 — [대괄호]는 본인 사실로 채우셔야 합니다 '
      + '(대필 문장은 유사도·AI 검출에 걸립니다).',
    /* ── 문항 전체에 걸리는 작성 기준 ──
       역량 카드마다 반복하지 않고 응답에 한 번만 싣는다. STAR 를 카드마다 붙이면
       역량별 frame 과 골격이 두 개로 보여 어느 쪽을 따를지 알 수 없게 된다. */
    star: GUIDE.STAR,
    /* 칸을 실제로 어떻게 채우는가(질문·나쁜 예·고친 예). STAR 입력 도우미가 쓰고,
       AI 초안 프롬프트도 같은 표를 읽는다 — 둘이 갈리면 화면이 시킨 것과 AI 가 쓴 것이
       달라진다(cover-guide.js STAR_WRITE 머리주석). */
    starWrite: GUIDE.STAR_WRITE,
    checklist: GUIDE.SUBMIT_CHECKLIST,
    /* 검사 목록을 값으로 내려보낸다 — 화면이 초안을 서버로 보내지 않고 그 자리에서
       검사할 수 있게 하려는 것이다. 자소서 초안은 남의 서버에 안 보내는 편이 낫다. */
    cliches: GUIDE.CLICHES,
    aiTells: GUIDE.AI_TELLS,
    /* 회사명은 프론트가 입력칸에서 보내온다. 없으면 '지원 회사'로 나간다. */
    interview: GUIDE.interviewQuestions({
      company,
      hasNews: false,                    // 뉴스는 /api/company/analysis 쪽 책임이다
      competencies,
    }).filter(q => q.from === 'competency'),
  };
}

/* GET /api/jd/guide?company=
   공고 없이 **회사 근거만으로** 4단계를 시작할 때 쓴다.

   ── 왜 이 경로가 필요한가 ──
   공고를 못 구하는 것이 예외가 아니라 보통이다 — 대기업 공채는 자사 채용 사이트로만
   올라와서 워크넷·잡알리오 어느 쪽에도 안 잡힌다. 그런데 /coach 는 공고 30자를
   필수로 걸고 있어서, 3단계에서 회사를 골라 와도 대부분 여기서 막혔다.

   ── 역량은 주지 않는다 ──
   역량은 공고에서 나온다. 공고가 없는데 "이 직무는 보통 이런 역량을 요구합니다" 를
   지어서 주면 근거 없는 목록이 된다(직무 트렌드 집계는 워크넷 목록 API 가 막혀 있어
   캐시가 비어 있다 — job-trends.js 머리주석). 여기서는 **작성 기준과 검사 사전만**
   주고, 역량 칸은 "공고를 넣으면 나온다" 고 화면이 그대로 말한다. */
router.get('/guide', (req, res) => {
  res.json({
    mode: 'company',
    provider: 'guide',
    items: [],
    jdSentences: 0,
    market: null,
    ...guidePayload({ company: req.query.company }),
  });
});

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
    /* 첫 문장 틀 — 배정된 활동이 있을 때만 만든다. spreadMaterials 가 소재를
       나눠 배정한 **뒤**라야 카드마다 다른 활동으로 문장이 나온다. */
    item.openings = GUIDE.openingDrafts(item.mine, { reuse: item.reuse });
  }

  res.json({
    provider: usedAi ? PROVIDER : 'rule',
    model: usedAi ? modelLabel() : null,
    mode: 'posting',
    jdSentences: rule.sentenceCount,
    /* 트렌드 출처·기준을 함께 내려보낸다. 비율만 던지면 그게 어디서 나온 숫자인지
       화면에서 설명할 수 없다(제목 기준이라는 한계도 여기서 전달된다). */
    market: bucket ? { bucket, ...TRENDS.meta() } : null,
    items,
    ...guidePayload({ company: req.body?.company, competencies: items }),
    notice: aiError ? 'AI 보강은 실패해서, 공고에서 직접 찾아낸 역량만 정리했어요.' : undefined,
  });
});

/* ── POST /api/jd/draft ─────────────────────────────────────
   역량 하나에 대한 자소서 문단 초안. 역량 추출(/coach)과 분리한 이유는 셋이다:
     · 사용자가 역량 6개를 다 쓰지 않는다. 누른 역량만 만들면 되는데 한 번에 다
       만들면 안 쓸 문단까지 기다리게 된다.
     · 초안은 활동·문항이 바뀌면 다시 만들어야 한다. 그때마다 공고 분석을
       처음부터 돌릴 이유가 없다.
     · 실패해도 역량 카드는 살아 있어야 한다. 같은 응답에 묶으면 같이 죽는다.

   초안은 서버에 저장하지 않는다. 만들어서 돌려주고 끝이며, 보관은 브라우저가 한다
   (초안 검사와 같은 원칙 — 남의 서버에 둘 이유가 없는 글이다). */
/* STAR 입력을 S/T/A/R 네 키만 남기고 다듬는다. 화면이 보내는 값을 그대로 믿지 않는
   것은 다른 라우트와 같은 규약이고, 칸당 900자로 자르는 것은 한 칸에 소설을 붙여
   보냈을 때 프롬프트 뒤쪽 규칙(10~14번)이 잘려 나가는 것을 막기 위해서다. */
function starOf(v) {
  if (!v || typeof v !== 'object') return null;
  const out = {};
  for (const k of ['S', 'T', 'A', 'R']) {
    const s = String(v[k] || '').trim().slice(0, 900);
    if (s) out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

router.post('/draft', async (req, res) => {
  const competency = String(req.body?.competency || '').trim();
  if (!competency) return res.status(400).json({ error: '어느 역량으로 쓸지 알려 주세요.' });

  const limit = Math.min(Math.max(Number(req.body?.limit) || 600, 200), 1500);
  /* 아래 '예시 베낌' 검사도 이 값을 본다 — 사용자가 직접 적은 대목은 베낌이 아니다. */
  const star = starOf(req.body?.star);
  const prompt = DRAFT.buildPrompt({
    company: String(req.body?.company || '').trim(),
    jobTitle: String(req.body?.jobTitle || '').trim(),
    competency,
    quotes: Array.isArray(req.body?.quotes) ? req.body.quotes.slice(0, 4).map(String) : [],
    reads: String(req.body?.reads || '').trim(),
    frame: String(req.body?.frame || '').trim(),
    activities: Array.isArray(req.body?.activities) ? req.body.activities.slice(0, 5) : [],
    question: String(req.body?.question || '').trim(),
    /* 사용자가 STAR 칸에 직접 쓴 문장. 활동 목록(이름·기간·역할)은 분류일 뿐이라
       '무슨 일이 있었는지' 를 담지 못한다 — 그 빈자리를 모델이 관용구로 메운 것이
       "노력했고 잘 마무리했습니다" 문단의 원인이었다(draft-coach.js 주석).
       칸당 길이를 자르는 것은 프롬프트가 통째로 길어져 뒤쪽 규칙이 잘리는 것을 막기 위해서다. */
    star,
    limit,
  });

  try {
    /* num_predict 를 넉넉히 준다 — 문단 + 빈칸 안내 + 검토까지 한 응답에 담기므로
       기본값(512)이면 JSON 이 중간에 잘려서 파싱이 통째로 실패한다. */
    const ask = async () => DRAFT.parseDraft(
      await callModel(prompt, DRAFT.SYSTEM, { num_ctx: 8192, num_predict: 1100 }));

    let out = await ask();
    /* 한국어가 아닌 글자가 섞이면 한 번만 다시 부른다. 실측으로 8회 중 1회꼴이라
       (일본어·중국어·베트남어) 한 번 더 부르면 사실상 사라진다. Groq 는 1초대라
       재시도 비용이 사용자가 느낄 정도가 아니다. 두 번째도 섞이면 그대로 내보내되,
       화면의 검사기가 잡을 수 있게 flag 를 함께 준다. */
    if (DRAFT.hasForeign(out)) {
      const retry = await ask().catch(() => null);
      if (retry && !DRAFT.hasForeign(retry)) out = retry;
      else if (retry) out = { ...retry, foreignWarning: true };
      else out = { ...out, foreignWarning: true };
    }

    /* ── 예시를 베껴 왔으면 내보내지 않는다 ────────────────────────
       실측으로 한 번 겪었다: STAR 안내에 있던 예시 문장('화면 정의서'·'검색 결과
       정렬')이 초안에 통째로 들어왔다. 사용자가 겪지도 않은 일이 자소서에 사실처럼
       적히는 것이라, 외국어가 섞이는 것보다 훨씬 나쁘다 — 면접에서 바로 무너진다.
       한 번 다시 부르고, 그래도 베끼면 **초안을 주지 않는다.** 지어낸 문장을 주는
       것보다 "실패했다"고 말하는 편이 낫다(parseDraft 와 같은 원칙). */
    let copied = DRAFT.copiedFromExample(out.draft, star);
    if (copied) {
      const retry = await ask().catch(() => null);
      if (retry && !DRAFT.copiedFromExample(retry.draft, star)) { out = retry; copied = null; }
      else copied = DRAFT.copiedFromExample((retry || out).draft, star);
    }
    if (copied) {
      return res.status(502).json({
        error: 'AI 가 안내 예시를 그대로 베껴 와서 초안을 버렸어요. 다시 눌러 주세요.',
        detail: `예시(${copied.key})와 겹침: ${copied.chunk}`,
      });
    }
    res.json({ ...out, model: modelLabel(), provider: PROVIDER });
  } catch (e) {
    const status = e?.status || 502;
    res.status(status).json({
      error: (status === 503 || status === 429)
        ? e.message
        : 'AI 초안을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
      detail: e.message,
    });
  }
});

/* POST /api/jd/motive
   지원동기 문단 초안 — 3단계에서 담아 온 회사 근거로 쓴다.

   ── /draft 와 왜 나눴는가 ──
   /draft 는 **역량 하나를 내 경험으로 증명하는** 문단이다(STAR). 지원동기는 축이
   다르다 — 증명 대상이 내 경험이 아니라 "왜 이 회사인가" 이고, 재료가 활동이 아니라
   회사 근거다. 한 라우트에 얹으면 프롬프트 분기가 함수 안에서 갈라져서, 어느 쪽
   규칙이 적용됐는지 응답만 봐서는 알 수 없게 된다.

   ── 근거가 없으면 부르지 않는다 ──
   근거 없이 부르면 모델이 회사 이야기를 통째로 지어낸다. 그건 "대괄호로 비운다"
   규칙으로도 못 막는데, 지어낼 재료가 프롬프트 밖(모델의 사전지식)에 있기 때문이다.
   빈손이면 400 으로 돌려보내고 화면이 "먼저 담아 오라"고 말한다. */
router.post('/motive', async (req, res) => {
  const company = String(req.body?.company || '').trim();
  const evidence = (Array.isArray(req.body?.evidence) ? req.body.evidence : [])
    .slice(0, 8)
    .map(e => ({
      kind: String(e?.kind || '').trim(),
      /* 사업보고서 문단은 통째로 수천 자다 — 프롬프트가 그만큼 길어지면 뒤쪽
         Restriction 이 밀려서 지어내기 금지 규칙이 잘린다. 앞부분만 보낸다. */
      text: String(e?.text || '').trim().slice(0, 700),
      source: String(e?.source || '').trim().slice(0, 120),
    }))
    .filter(e => e.text);

  if (!company) return res.status(400).json({ error: '어느 회사에 쓰는 자소서인지 알려 주세요.' });
  if (!evidence.length) {
    return res.status(400).json({
      error: '담아 온 회사 근거가 없어요. 회사 리포트에서 개요·재무·최근 이슈를 담아 오세요.',
    });
  }

  const limit = Math.min(Math.max(Number(req.body?.limit) || 600, 200), 1500);
  const prompt = DRAFT.buildMotivePrompt({
    company,
    jobTitle: String(req.body?.jobTitle || '').trim(),
    question: String(req.body?.question || '').trim(),
    evidence,
    activities: Array.isArray(req.body?.activities) ? req.body.activities.slice(0, 5) : [],
    limit,
  });

  try {
    const ask = async () => DRAFT.parseDraft(
      await callModel(prompt, DRAFT.SYSTEM, { num_ctx: 8192, num_predict: 1100 }));

    let out = await ask();
    /* 외국어 혼입은 /draft 와 같은 규칙으로 막는다 — 같은 모델·같은 출력 형식이라
       여기만 안 걸면 지원동기 문단으로 새어 나온다. */
    if (DRAFT.hasForeign(out)) {
      const retry = await ask().catch(() => null);
      if (retry && !DRAFT.hasForeign(retry)) out = retry;
      else out = { ...(retry || out), foreignWarning: true };
    }

    /* 담아 온 근거를 그대로 돌려준다 — 화면이 "이 초안은 이 근거로 썼다" 를
       초안 옆에 적을 수 있어야 한다. 출처 없이 나온 문단은 검증할 방법이 없다. */
    res.json({ ...out, usedEvidence: evidence, model: modelLabel(), provider: PROVIDER });
  } catch (e) {
    const status = e?.status || 502;
    res.status(status).json({
      error: (status === 503 || status === 429)
        ? e.message
        : '지원동기 초안을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
      detail: e.message,
    });
  }
});

module.exports = router;
