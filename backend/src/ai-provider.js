/* ══════════════════════════════════════════════════════════════
   LLM 프로바이더 한 겹  (Ollama 기본 / Groq 선택)

   원래 이 코드는 routes/casAnalyze.js 안에 있었다. AI 를 쓰는 화면이
   둘(CAS 스펙 분석 · 직무역량 코치)이 되면서 밖으로 뺐다. 여기 담긴
   것들은 전부 "한 번 데어서 알게 된" 처리라, 복사해 두면 반드시 한쪽만
   고쳐지고 갈린다:
     · qwen3·deepseek-r1 계열의 <think> 가 JSON 을 깨뜨린다 → think:false
       (지원하지 않는 모델에 보내면 400 이라 계열을 보고 붙여야 한다)
     · OLLAMA_MODEL 이 안 깔려 있으면 404 → 설치된 모델 중에서 고른다
     · 미실행/미설치는 502 가 아니라 503 (사용자가 할 일이 다르다)
     · 시간 초과와 연결 거부도 안내 문구가 다르다

   env: CAS_AI_PROVIDER(ollama|groq) · OLLAMA_HOST · OLLAMA_MODEL
        · CAS_AI_TIMEOUT_MS · GROQ_API_KEY
   ══════════════════════════════════════════════════════════════ */
const PROVIDER     = (process.env.CAS_AI_PROVIDER || 'ollama').toLowerCase();
const OLLAMA_HOST  = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

/* 로컬 8B 는 CPU/iGPU 에서 느리다. 프론트가 무한 대기하지 않게 상한을 둔다. */
const TIMEOUT_MS = Number(process.env.CAS_AI_TIMEOUT_MS || 240000);

/* OLLAMA_MODEL 이 실제로 설치돼 있지 않으면(새 환경 등) Ollama 가 404 를 준다.
   설치를 강요하는 대신 설치된 모델 중에서 고른다.
   앞에 있을수록 이 작업(JSON 강제 출력 + 한국어)에 잘 맞는 순서. */
const PREFERRED = ['qwen3', 'qwen2.5', 'llama3.1', 'llama3', 'mistral', 'gemma2', 'gemma'];
let _resolvedModel = null;

const THINKING_MODEL = /^(qwen3|deepseek-r1|gpt-oss|magistral)/i;

function cfgError(msg) { const e = new Error(msg); e.status = 503; throw e; }

async function resolveOllamaModel() {
  if (_resolvedModel) return _resolvedModel;

  let names = [];
  try {
    const r = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    names = (data?.models || []).map(m => m.name).filter(Boolean);
  } catch {
    cfgError(`로컬 Ollama(${OLLAMA_HOST})에 연결할 수 없습니다. Ollama 를 실행한 뒤 다시 시도해 주세요.`);
  }
  if (!names.length) cfgError(`Ollama 에 설치된 모델이 없습니다. \`ollama pull ${OLLAMA_MODEL}\` 로 모델을 받아주세요.`);

  const family = n => n.split(':')[0];
  _resolvedModel =
    names.find(n => n === OLLAMA_MODEL) ||
    names.find(n => family(n) === family(OLLAMA_MODEL)) ||
    PREFERRED.map(p => names.find(n => family(n).startsWith(p))).find(Boolean) ||
    names[0];

  if (_resolvedModel !== OLLAMA_MODEL) {
    console.warn(`[AI] ${OLLAMA_MODEL} 이(가) 없어 설치된 ${_resolvedModel} 로 분석합니다.`);
  }
  return _resolvedModel;
}

/* 지금까지 어떤 모델로 답했는지 — 응답에 실어 화면에 표시한다. */
const modelLabel = () => (PROVIDER === 'groq' ? GROQ_MODEL : (_resolvedModel || OLLAMA_MODEL));

/* 프로바이더별 호출을 한 함수로 감싼다. 둘 다 JSON 강제 출력 옵션이 있다.
   반환값은 모델이 낸 JSON 문자열.

   ctx/predict: CPU 추론에서는 프롬프트 길이와 출력 길이가 곧 대기시간이다.
   호출하는 쪽이 실제 필요한 만큼만 잡도록 인자로 열어 둔다(기본값은
   짧은 분류 작업 기준 — 긴 입력을 넣는 쪽이 늘려 쓴다). */
async function callModel(text, system, { num_ctx = 2048, num_predict = 512 } = {}) {
  if (PROVIDER === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) cfgError('GROQ_API_KEY 가 없습니다.');
    const Groq = require('groq-sdk');                 // 지연 require — ollama 만 쓸 땐 안 불린다
    const completion = await new Groq({ apiKey: key }).chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
    });
    return completion.choices?.[0]?.message?.content || '{}';
  }

  // Ollama 네이티브 /api/chat — SDK 없이 fetch 로 충분하다.
  const model = await resolveOllamaModel();
  const body = {
    model,
    stream: false,
    format: 'json',                                   // JSON 강제
    options: { temperature: 0.2, num_ctx, num_predict },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ],
  };
  if (THINKING_MODEL.test(model)) body.think = false;

  let r;
  try {
    r = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // 시간 초과와 미실행은 사용자가 할 일이 다르다 — 뭉뚱그리지 않는다.
    const err = new Error(e?.name === 'TimeoutError'
      ? `AI 분석이 ${Math.round(TIMEOUT_MS / 1000)}초 안에 끝나지 않았습니다. `
        + `입력을 줄이거나 더 작은 모델(OLLAMA_MODEL)을 써 주세요.`
      : `로컬 Ollama(${OLLAMA_HOST})에 연결할 수 없습니다. Ollama 를 실행하고 `
        + `\`ollama pull ${OLLAMA_MODEL}\` 로 모델을 받아주세요.`);
    err.status = 503;
    throw err;
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    const err = new Error(`Ollama 응답 오류 ${r.status}: ${detail.slice(0, 300)}`);
    err.status = r.status === 404 ? 503 : 502;        // 모델 미설치도 404 → 설정 문제이므로 503
    throw err;
  }
  const data = await r.json();
  return data?.message?.content || '{}';
}

module.exports = {
  callModel, modelLabel, resolveOllamaModel,
  PROVIDER, OLLAMA_HOST, OLLAMA_MODEL, GROQ_MODEL, TIMEOUT_MS,
};
