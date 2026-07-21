/* POST /api/cas/analyze
   반정형 스펙 텍스트(예시 양식)를 받아 LLM 으로 다음을 수행한다:
     1) 정성 활동을 CAS 폼의 정해진 enum(유형·기간·역할/단계·결과물)으로 정규화
     2) 유형 미기입·역할 미기입 등 빈칸을 맥락으로 추론(반정형 보정)
     3) 각 활동 원점수와 정성 총점(0~600)을 산정하고 근거를 남김
     4) 정량 스펙(학점/어학/자격증)도 구조화

   사용자 결정: "AI가 점수까지 산정" + "반정형 입력" + 무료 AI.
   원래 Gemini 로 붙였으나 사용자 구글 계정이 무료 티어 미지원(free_tier limit 0,
   프로젝트를 새로 만들어도 재발)이라 Groq 로 전환했고, 다시 **로컬 Ollama 기본**으로
   바꿨다(키·쿼터·네트워크 없이 동작). CAS_AI_PROVIDER=groq 로 두면 Groq 도 그대로 쓴다.

   채점 흔들림을 줄이려고 채점 루브릭(기본배점·배수표)을 cas.js 단일 출처에서
   읽어 그대로 프롬프트에 주입하고, JSON 강제 출력(response_format json_object)으로
   형식을 맞춘다. enum 은 서버에서 cas.js 기준으로 교정(coerce)한다.
   또한 cas.js 의 결정론 채점을 교차검증값으로 함께 반환한다. */
const express = require('express');
const CAS = require('../../../frontend/js/cas.js');   // 채점 루브릭·결정론 채점 재사용

const router = express.Router();

/* 기본은 로컬 Ollama. .env 로 바꿀 수 있다.
     CAS_AI_PROVIDER = ollama | groq
     OLLAMA_HOST     = http://127.0.0.1:11434
     OLLAMA_MODEL    = qwen3:8b 등 (ollama pull 로 받아둔 모델)  */
const PROVIDER     = (process.env.CAS_AI_PROVIDER || 'ollama').toLowerCase();
const OLLAMA_HOST  = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const MODEL        = PROVIDER === 'groq' ? GROQ_MODEL : OLLAMA_MODEL;

/* 로컬 8B 는 CPU/iGPU 에서 느리다. 프론트가 무한 대기하지 않게 상한을 둔다. */
const TIMEOUT_MS = Number(process.env.CAS_AI_TIMEOUT_MS || 240000);

/* qwen3·deepseek-r1·gpt-oss 계열은 추론 토큰(<think>)을 뱉어 JSON 을 깨뜨린다.
   Ollama 의 think:false 로 끄되, 지원하지 않는 모델에 보내면 400 이라 계열을 보고 붙인다. */
const THINKING_MODEL = /^(qwen3|deepseek-r1|gpt-oss|magistral)/i;

/* cas.js 의 유효 enum 을 그대로 뽑아 프롬프트·교정에 쓴다(단일 출처). */
const TYPE_IDS   = CAS.ACTIVITY_TYPES.map(t => t.id);
const DURATIONS  = Object.keys(CAS.DURATION_MULT);
const ROLES      = Object.keys(CAS.ROLE_MULT);
const STAGES     = Object.keys(CAS.STAGE_MULT);
const OUTCOMES   = Object.keys(CAS.OUTCOME_MULT);

/* 루브릭을 사람이 읽는 표로 직렬화해 시스템 프롬프트에 넣는다. */
function rubricText() {
  const types = CAS.ACTIVITY_TYPES
    .map(t => `  - ${t.id} (${t.label}) 기본배점 ${t.base}, 역할축=${t.roleKind}`)
    .join('\n');
  const mult = (label, map) =>
    `  ${label}: ` + Object.entries(map).map(([k, v]) => `${k}×${v}`).join(', ');
  return [
    '유형별 기본배점(높을수록 가중치 큼 — 인턴십>공모전>프로젝트 순):',
    types,
    '활동 1건 원점수 = 기본배점 × 기간배수 × 역할(또는 연구단계)배수 × 결과물배수',
    mult('기간배수', CAS.DURATION_MULT),
    mult('역할배수', CAS.ROLE_MULT),
    mult('연구단계배수', CAS.STAGE_MULT),
    mult('결과물배수', CAS.OUTCOME_MULT),
  ].join('\n');
}

const SYSTEM = `당신은 한국 대학생 커리어 플랫폼 careerly 의 CAS(Career Asset Score) 정성 스펙 분석기다.
사용자가 반정형(부분적으로만 구조화된) 스펙 텍스트를 주면, 아래 규칙으로 분석해 JSON 만 출력한다.

[정성 활동 정규화]
- 각 활동을 반드시 아래 정해진 enum 값으로만 매핑한다. 임의 값 금지.
  · type: ${TYPE_IDS.join(' | ')}
  · duration: ${DURATIONS.join(' | ')}
  · role(팀형/동아리형 활동만, 없으면 null): ${ROLES.join(' | ')}
  · stage(research 유형만, 없으면 null): ${STAGES.join(' | ')}
  · outcome: ${OUTCOMES.join(' | ')}
- 빈칸/미기입은 맥락으로 합리적으로 추론하되, 추론한 항목은 assumed:true 로 표시한다.
  근거 없이 과하게 좋은 값으로 채우지 말 것(예: 역할 미기입 팀 활동은 '팀원').
- '직무 미입력' 같이 점수와 무관한 자유서술은 무시한다.

[채점 루브릭 — 아래 표를 반드시 그대로 적용]
${rubricText()}
- 각 활동 rawScore 는 위 곱셈식으로 계산한다.
- 정성 총점(qualTotal, 0~600): 상위 최대 6개 활동 rawScore 합(qualRaw)을 합격자 평균
  원점수(기준 ${CAS.DEFAULT_QUAL_BENCH}) 대비 상대평가로 환산한다. 평균과 동률이면 만점의 80%,
  평균의 1.25배 이상이면 만점(600). 총점은 0~600 을 넘지 않는다.

[정량 파싱]
- gpa(학점), gpaMax(만점, 보통 4.5), certs(자격증 배열), lang(어학) 을 구조화한다.
  lang 은 { opic, toeic, toeicSpeaking, toefl } 중 해당되는 것만, 없으면 null.

[출력 형식] 아래 JSON 스키마를 정확히 따르고, 그 외 텍스트는 절대 출력하지 않는다:
{
  "activities": [
    { "type": <enum>, "name": <string>, "duration": <enum>,
      "role": <enum|null>, "stage": <enum|null>, "outcome": <enum>,
      "assumed": <boolean>, "rawScore": <number>, "reason": <짧은 한국어 근거> }
  ],
  "qualTotal": <number>,
  "qualRationale": <짧은 한국어 근거>,
  "quant": {
    "gpa": <number|null>, "gpaMax": <number|null>, "certs": [<string>],
    "lang": { "opic": <string|null>, "toeic": <number|null>,
              "toeicSpeaking": <string|null>, "toefl": <number|null> }
  }
}`;

/* 프로바이더별 호출을 한 함수로 감싼다. 둘 다 JSON 강제 출력 옵션이 있다.
   반환값은 모델이 낸 JSON 문자열. */
async function callModel(text) {
  if (PROVIDER === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      const err = new Error('GROQ_API_KEY 가 없습니다.');
      err.status = 503;
      throw err;
    }
    const Groq = require('groq-sdk');
    const completion = await new Groq({ apiKey: key }).chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
    });
    return completion.choices?.[0]?.message?.content || '{}';
  }

  // Ollama 네이티브 /api/chat — SDK 없이 fetch 로 충분하다.
  const body = {
    model: OLLAMA_MODEL,
    stream: false,
    format: 'json',                       // JSON 강제
    options: { temperature: 0.2, num_ctx: 8192 },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: text },
    ],
  };
  if (THINKING_MODEL.test(OLLAMA_MODEL)) body.think = false;

  let r;
  try {
    r = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // 연결 거부 = Ollama 미실행. 502 로 뭉뚱그리지 말고 설치 안내를 준다.
    const err = new Error(
      `로컬 Ollama(${OLLAMA_HOST})에 연결할 수 없습니다. Ollama 를 실행하고 ` +
      `\`ollama pull ${OLLAMA_MODEL}\` 로 모델을 받아주세요.`);
    err.status = 503;
    throw err;
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    const err = new Error(`Ollama 응답 오류 ${r.status}: ${detail.slice(0, 300)}`);
    // 모델 미설치도 404 로 온다 → 설정 문제이므로 503.
    err.status = r.status === 404 ? 503 : 502;
    throw err;
  }
  const data = await r.json();
  return data?.message?.content || '{}';
}

/* 모델이 넘긴 활동의 enum 을 cas.js 기준으로 교정한다.
   유효하지 않은 값은 결정론 채점에서 0점 처리되므로, 유효 목록에 없으면 버린다. */
const inList = (v, list) => (v != null && list.includes(v) ? v : null);
function coerceActivity(a) {
  const type = inList(a?.type, TYPE_IDS);
  if (!type) return null;                       // 유형이 유효하지 않으면 채점 불가
  return {
    type,
    name: String(a?.name || '').trim(),
    duration: inList(a?.duration, DURATIONS),
    role: inList(a?.role, ROLES),
    stage: inList(a?.stage, STAGES),
    outcome: inList(a?.outcome, OUTCOMES),
    assumed: !!a?.assumed,
    reason: String(a?.reason || ''),
  };
}

/* 모델이 낸 rawScore 는 믿지 않는다 — 로컬 8B 는 근거(reason)엔 곱셈 결과를 써놓고
   rawScore 엔 기본배점만 넣는 식으로 자주 어긋난다. enum 만 받고 점수는 cas.js 로 다시 낸다. */
function rescore(a) {
  return { ...a, rawScore: Math.round(CAS.scoreActivity(a) * 10) / 10 };
}

router.post('/analyze', async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: '분석할 스펙 텍스트(text)가 없습니다.' });

  try {
    const jsonText = await callModel(text);
    const ai = JSON.parse(jsonText);

    const activities = (Array.isArray(ai.activities) ? ai.activities : [])
      .map(coerceActivity)
      .filter(Boolean)
      .map(rescore);

    /* 교차검증: 같은 활동을 cas.js 결정론 엔진으로도 채점해 함께 돌려준다.
       AI 점수가 흔들릴 때 비교 근거가 되고, 프론트가 원하면 이 값을 쓸 수 있다. */
    const deterministic = CAS.computeQual({ spec: { activities } });

    res.json({
      provider: PROVIDER,
      model: MODEL,
      activities,
      qual: {
        aiTotal: Math.max(0, Math.min(CAS.TOTAL_QUAL, Math.round(Number(ai.qualTotal) || 0))),
        deterministicTotal: deterministic.total,   // cas.js 교차검증
        rationale: String(ai.qualRationale || ''),
        raw: deterministic.raw,
        benchRaw: deterministic.benchRaw,
      },
      quant: ai.quant || null,
    });
  } catch (e) {
    console.error('CAS analyze 실패:', e?.message);
    const status = e?.status || 502;
    // 503 은 "설정이 덜 됨"이라 사용자에게 그대로 보여줘야 한다.
    res.status(status).json({
      error: status === 503 ? e.message : 'AI 분석에 실패했습니다.',
      detail: e?.message,
    });
  }
});

module.exports = router;
