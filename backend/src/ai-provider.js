/* ══════════════════════════════════════════════════════════════
   LLM 프로바이더 한 겹  (Groq 전용)

   원래 이 코드는 routes/casAnalyze.js 안에 있었다. AI 를 쓰는 화면이
   셋(CAS 스펙 분석 · 직무역량 코치 · 자소서 AI 초안)이 되면서 밖으로 뺐다.

   ── Ollama 를 걷어낸 이유 (2026-08) ──────────────────────────
   예전에는 Ollama(로컬)를 기본으로 두고 Groq 를 선택지로 뒀다. 그런데 기본값이
   로컬이라, 환경변수가 어떤 이유로든 안 읽히면 **조용히 Ollama 로 떨어져서**
   "로컬 Ollama(127.0.0.1:11434)에 연결할 수 없습니다" 라는, 쓰지도 않는 도구의
   오류가 사용자 화면에 떴다. 실제로 그 사고가 났다.

   프로바이더가 하나면 이 실패 모드 자체가 없어진다. 로컬 모델이 다시 필요해지면
   그때 되살리되, **기본값으로는 두지 않는다** — 안 켜져 있는 것이 기본인 도구를
   기본 경로로 두면 안 된다.

   여기 담긴 처리는 전부 "한 번 데어서 알게 된" 것들이라 복사해 두면 반드시
   한쪽만 고쳐지고 갈린다:
     · 키 오타·쿼터 소진·모델 폐기는 사용자가 할 일이 달라서 상태코드를 가른다
     · 모델 폐기(decommission)는 코드 수정 없이 env 로 갈아끼울 수 있어야 한다

   env: GROQ_API_KEY (필수) · GROQ_MODEL · CAS_AI_TIMEOUT_MS
   ══════════════════════════════════════════════════════════════ */
const PROVIDER = 'groq';

/* Groq 는 모델을 예고 후 폐기(decommission)한다. 폐기되면 400/404 가 오는데,
   그때 코드를 고쳐 배포하지 않아도 되도록 env 로 뺀다. */
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/* 프론트가 무한 대기하지 않게 상한을 둔다. Groq 는 보통 1초 안에 끝나지만,
   긴 출력(자소서 초안)에서는 몇 초씩 걸린다. */
const TIMEOUT_MS = Number(process.env.CAS_AI_TIMEOUT_MS || 60000);

function cfgError(msg) { const e = new Error(msg); e.status = 503; throw e; }

/* 지금까지 어떤 모델로 답했는지 — 응답에 실어 화면에 표시한다. */
const modelLabel = () => GROQ_MODEL;

const isConfigured = () => Boolean((process.env.GROQ_API_KEY || '').trim());

/* 호출 한 겹. 반환값은 모델이 낸 JSON 문자열.

   num_ctx / num_predict 는 로컬 추론 시절의 인자다. Groq 는 컨텍스트를 알아서
   잡으므로 num_ctx 는 쓰지 않고, num_predict 만 max_tokens 로 넘긴다.
   호출하는 쪽 코드를 건드리지 않으려고 인자 모양은 그대로 둔다. */
async function callModel(text, system, { num_predict = 512 } = {}) {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) {
    cfgError('GROQ_API_KEY 가 없습니다. https://console.groq.com/keys 에서 발급받아 '
           + 'backend/.env 의 GROQ_API_KEY 에 넣어주세요.');
  }

  const Groq = require('groq-sdk');

  /* 오류 처리가 없던 시절엔 키 오타·무료쿼터 소진·모델 폐기가 전부
     "AI 분석에 실패했습니다"(500) 한 줄로 뭉개져, 사용자가 무엇을 해야 하는지
     알 수 없었다. 상태코드별로 할 일이 다르므로 갈라 준다. */
  let completion;
  try {
    completion = await new Groq({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 1 })
      .chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: num_predict,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
      });
  } catch (e) {
    const status = e?.status;
    const detail = String(e?.error?.error?.message || e?.message || '').slice(0, 200);
    let msg, out;

    if (status === 401 || status === 403) {
      msg = `Groq 인증에 실패했습니다(HTTP ${status}). GROQ_API_KEY 가 올바른지 확인해 주세요 `
          + `— https://console.groq.com/keys`;
      out = 503;                                    // 키 문제 = 설정 문제
    } else if (status === 429) {
      msg = 'Groq 무료 쿼터를 초과했습니다. 잠시 뒤 다시 시도해 주세요.';
      out = 429;                                    // 재시도하면 되는 상황 — 503 과 구분한다
    } else if (status === 404 || /decommission|not.*exist|model/i.test(detail)) {
      msg = `Groq 모델 "${GROQ_MODEL}" 을(를) 쓸 수 없습니다(${detail}). `
          + `폐기된 모델일 수 있습니다 — .env 의 GROQ_MODEL 을 현행 모델로 바꿔주세요 `
          + `(목록: https://console.groq.com/docs/models).`;
      out = 503;
    } else if (e?.name === 'APIConnectionTimeoutError' || /timeout/i.test(detail)) {
      msg = `AI 응답이 ${Math.round(TIMEOUT_MS / 1000)}초 안에 오지 않았습니다. `
          + `잠시 뒤 다시 시도해 주세요.`;
      out = 504;
    } else {
      msg = `Groq 호출 실패${status ? ` (HTTP ${status})` : ''}: ${detail}`;
      out = 502;
    }
    const err = new Error(msg);
    err.status = out;
    throw err;
  }
  return completion.choices?.[0]?.message?.content || '{}';
}

module.exports = {
  callModel, modelLabel, isConfigured,
  PROVIDER, GROQ_MODEL, TIMEOUT_MS,
};
