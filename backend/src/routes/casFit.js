/* POST /api/cas/fit — 직무 적합도 채점
   { jobCode, jobName, spec } → { total, axes, gaps, traits }

   ── 역할 분담 (작업정리 6장·9장의 원칙 그대로) ──
     1단계  업무특성 가져오기 : wage-traits.js (임금직업정보시스템 · 디스크 캐시)
     2단계  매칭             : AI. "내 활동 A 가 업무특성 B 를 뒷받침하는가" 만 답한다
     3단계  채점             : cas-fit.js. **점수는 코드가 낸다**
   모델이 총점을 말해도 쓰지 않는다. 같은 입력이면 같은 점수가 나와야 하고, 항목마다
   왜 그 점수인지 짚을 수 있어야 한다.

   AI 가 죽어도 화면은 산다 — 매칭이 비면 근거 없는 상태로 채점되고(BASE_FLOOR),
   "무엇을 채우면 오르는지" 는 그대로 나온다. */
const express = require('express');
const { callModel, modelLabel, PROVIDER } = require('../ai-provider');
const TRAITS = require('../wage-traits');
const FIT = require('../cas-fit');

const router = express.Router();
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const SYSTEM = [
  '너는 직무 적합도를 평가하는 채용 담당자다.',
  '지원자가 실제로 한 활동과, 그 직업이 요구하는 업무특성을 짝지어 주는 일만 한다.',
  '',
  '**점수를 매기지 마라.** 총점·백분율·등급을 쓰지 마라 — 그건 우리 코드가 계산한다.',
  '너는 "이 활동이 이 특성을 뒷받침하는가" 와 그 근거만 답한다.',
  '',
  '지원자의 활동에 적혀 있지 않은 사실을 지어내지 마라. 근거가 약하면 낮은 강도를',
  '고르거나 아예 빼라. 억지로 이어 붙이면 학생이 면접에서 답하지 못한다.',
  '',
  '반드시 JSON 객체 하나만 출력한다. 설명·코드펜스를 붙이지 마라. 한국어로만 쓴다.',
].join('\n');

/* 스펙 → 모델이 읽을 수 있는 줄. 없는 필드는 아예 안 넣는다 —
   '없음' 을 채워 보내면 모델이 그 '없음' 을 근거로 쓴다(draft-coach.js 에서 겪었다). */
function specLines(spec) {
  const out = [];
  if (spec?.dept) out.push(`전공 계열: ${spec.dept}`);
  if (spec?.gpa != null && spec?.gpaMax) out.push(`학점: ${spec.gpa} / ${spec.gpaMax}`);
  const sc = spec?.scores || {};
  const lang = [
    sc.toeic && `TOEIC ${sc.toeic}`, sc.toefl && `TOEFL ${sc.toefl}`,
    sc.opic && `OPIc ${sc.opic}`, sc.toeicSpeaking && `TOEIC Speaking ${sc.toeicSpeaking}`,
  ].filter(Boolean);
  if (lang.length) out.push(`어학: ${lang.join(' · ')}`);
  if (spec?.certs?.length) out.push(`자격증: ${spec.certs.join(', ')}`);

  for (const a of spec?.activities || []) {
    const bits = [a.name].filter(Boolean);
    if (a.typeLabel || a.type) bits.push(`종류 ${a.typeLabel || a.type}`);
    if (a.duration) bits.push(`기간 ${a.duration}`);
    if (a.role) bits.push(`역할 ${a.role}`);
    if (a.outcome && a.outcome !== '결과물 없음') bits.push(`성과 ${a.outcome}`);
    if (bits.length) out.push(`활동: ${bits.join(' / ')}`);
  }
  return out;
}

function buildPrompt({ jobName, traits, spec }) {
  const mine = specLines(spec);

  const axisBlock = traits.map(a => [
    `[${a.key}] ${a.label} — ${a.what}`,
    ...a.items.map(i => `  · ${i.name} (중요도 ${i.score}) : ${i.desc}`),
  ].join('\n')).join('\n\n');

  return [
    `# 직업\n${jobName}`,
    '',
    `# 이 직업이 요구하는 업무특성 (임금직업정보시스템)\n${axisBlock}`,
    '',
    mine.length
      ? `# 지원자가 실제로 한 것 (이것 말고는 아는 게 없다)\n${mine.map(l => `- ${l}`).join('\n')}`
      : '# 지원자가 실제로 한 것\n(입력된 스펙이 없다. 매칭을 만들지 말고 빈 배열을 돌려줘라.)',
    '',
    '# 할 일',
    '위 업무특성 항목 중 **지원자의 활동·자격·전공이 실제로 뒷받침하는 것만** 골라라.',
    'trait 는 위에 적힌 항목 이름을 **글자 그대로** 옮긴다(바꾸면 우리 코드가 못 찾는다).',
    'strength 는 뒷받침하는 정도다:',
    '  3 = 그 일을 직접 해 본 경험이 있다',
    '  2 = 비슷한 일을 했거나 자격·전공으로 뒷받침된다',
    '  1 = 스쳐 지나간 수준이다',
    'evidence 는 **지원자의 활동에 적힌 사실만** 한 줄로. from 은 그 활동 이름.',
    '근거가 없는 항목은 넣지 마라 — 안 넣은 항목은 우리가 "아직 못 채웠다" 로 다룬다.',
    '',
    '# 출력',
    '{"matches":[{"axis":"ability","trait":"조작 및 통제","strength":2,',
    ' "evidence":"로봇 동아리에서 제어 장비를 다뤘습니다","from":"로봇 동아리"}]}',
  ].join('\n');
}

/* 모델 응답 → 매칭 배열. 우리가 아는 축·항목 이름만 남긴다 — 모델이 항목 이름을
   살짝 바꿔 오면(띄어쓰기·조사) 채점에서 조용히 빠지므로, 공백을 지운 형태로도 맞춰 본다. */
function parseMatches(raw, traits) {
  const text = String(raw || '');
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e <= s) return [];
  let data;
  try { data = JSON.parse(text.slice(s, e + 1)); } catch { return []; }

  const nameOf = new Map();           // 축 → (공백제거 이름 → 원래 이름)
  for (const a of traits) {
    const m = new Map();
    for (const i of a.items) m.set(i.name.replace(/\s+/g, ''), i.name);
    nameOf.set(a.key, m);
  }

  const out = [];
  for (const r of Array.isArray(data.matches) ? data.matches : []) {
    const axis = String(r?.axis || '').trim();
    const want = String(r?.trait || '').trim().replace(/\s+/g, '');
    const real = nameOf.get(axis)?.get(want);
    if (!real) continue;              // 모르는 축·항목은 버린다(지어낸 것일 수 있다)
    out.push({
      axis, trait: real,
      strength: Math.max(0, Math.min(3, Number(r.strength) || 0)),
      evidence: String(r.evidence || '').trim().slice(0, 200),
      from: String(r.from || '').trim().slice(0, 80),
    });
  }
  return out;
}

router.post('/fit', ah(async (req, res) => {
  const jobCode = String(req.body?.jobCode || '').trim();
  const jobName = String(req.body?.jobName || '').trim() || '이 직업';
  if (!jobCode) return res.status(400).json({ error: '어느 직업으로 볼지 알려 주세요.' });

  const raw = await TRAITS.traitsOf(jobCode);
  if (!raw) {
    return res.status(503).json({
      error: '이 직업의 업무특성 자료를 가져오지 못했어요.',
      reason: 'no-traits',
      how: '임금직업정보시스템(wagework.go.kr)에서 받아오는 값이라, 그쪽이 응답하지 않으면 잠시 뒤 다시 시도해 주세요.',
    });
  }
  const traits = TRAITS.topTraits(raw, 5);

  const spec = req.body?.spec || null;
  const hasSpec = specLines(spec).length > 0;

  let matches = [];
  let aiError = null;
  if (hasSpec) {
    try {
      matches = parseMatches(
        /* ── 토큰을 넉넉히 준다 ──────────────────────────────
           지금 모델(gpt-oss 계열)은 **추론 모델**이라 답을 쓰기 전에 토큰을 먼저
           쓴다. 1400 으로 잡았더니 추론에 다 쓰고 JSON 이 중간에 잘려,
           Groq 의 json_object 검증이 'Failed to validate JSON' 으로 튕겼다
           (실측: 같은 프롬프트가 4000 에서는 매칭 11건). 업무특성 35항목을 훑는
           일이라 응답 자체도 길다. */
        await callModel(buildPrompt({ jobName, traits, spec }), SYSTEM, { num_predict: 4000 }),
        traits);
    } catch (e) {
      console.error('[cas-fit] AI 매칭 실패:', e.message);
      /* 매칭이 없으면 근거 없는 상태로 채점된다 — 점수는 낮게 나오지만 화면은 산다.
         무엇이 빠졌는지는 알려 준다(조용히 낮은 점수를 주면 오해한다). */
      aiError = e.message;
    }
  }

  const fit = FIT.compute({ traits, matches });
  if (!fit) return res.status(503).json({ error: '업무특성이 비어 있어 채점할 수 없어요.', reason: 'no-traits' });

  res.json({
    ...fit,                       // total · percent · grade · axes · gaps
    jobCode, jobName,
    traits,
    matchCount: matches.length,
    hasSpec,
    /* 근거를 못 붙인 이유를 구분해서 준다 — 스펙이 없는 것과 AI 가 죽은 것은 다르다. */
    notice: !hasSpec ? '스펙을 입력하면 내 활동과 업무특성을 맞춰 점수를 냅니다.'
      : aiError ? 'AI 매칭에 실패해 근거 없이 계산했어요. 잠시 후 다시 시도해 주세요.'
      : undefined,
    provider: matches.length ? PROVIDER : null,
    model: matches.length ? modelLabel() : null,
  });
}));

module.exports = router;
