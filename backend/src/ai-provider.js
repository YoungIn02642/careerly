/* ══════════════════════════════════════════════════════════════
   LLM 프로바이더 한 겹  (기본 Groq · 자소서 초안만 Gemini 로 라우팅)

   원래 이 코드는 routes/casAnalyze.js 안에 있었다. AI 를 쓰는 화면이
   셋(CAS 스펙 분석 · 직무역량 코치 · 자소서 AI 초안)이 되면서 밖으로 뺐다.

   ── callModel 은 Groq 전용이다 (스펙 분류·역량 추출) ──
   초안만 산문 품질이 결과라, 아래 callDraftModel 이 GEMINI_API_KEY 유무를 보고
   Gemini(ai-gemini.js) 로 명시적으로 보낸다. 그 라우팅 규칙은 이 파일 맨 아래.

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
   그때 코드를 고쳐 배포하지 않아도 되도록 env 로 뺀다.

   ── 기본값도 살아 있는 모델이어야 한다 (실측) ──
   기본값이 llama-3.3-70b-versatile 이었는데 그 모델이 폐기됐다. 로컬은 .env 로
   갈아끼워 놨으니 멀쩡했고, GROQ_MODEL 을 안 넣은 **배포 서버만** 죽은 모델로
   떨어져 AI 기능이 전부 503 이었다. env 로 뺀 것은 갈아끼우기 위해서지 기본값이
   틀려도 된다는 뜻이 아니다 — 안 넣으면 이 값이 그대로 쓰인다. */
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

/* 프론트가 무한 대기하지 않게 상한을 둔다. Groq 는 보통 1초 안에 끝나지만,
   긴 출력(자소서 초안)에서는 몇 초씩 걸린다. */
const TIMEOUT_MS = Number(process.env.CAS_AI_TIMEOUT_MS || 60000);

/* ── 오류 문구는 읽는 사람이 둘이다 (사용자 지시 2026-09-04) ────────────────────
   지금까지는 설정 오류 메시지가 그대로 학생 화면에 떴다 — "GROQ_API_KEY 가 없습니다.
   console.groq.com/keys 에서 발급받아 backend/.env 에 넣어주세요." 는 **운영자가 할
   일**이지 학생이 할 수 있는 일이 아니고, 학생 입장에서는 무슨 말인지도 모른다.

   그래서 가른다: `message` 는 화면에 그대로 떠도 되는 말만 담고(라우트가 이걸
   내려보낸다), 원인은 `detail` 로 서버 로그에 남긴다. 원인을 지우는 게 아니라
   **읽을 사람 앞에만 놓는다** — 키가 빠졌을 때 운영자가 로그에서 못 찾으면 그게 더 나쁘다. */
const AI_OFF_MSG = 'AI 기능을 지금 쓸 수 없어요. 잠시 후 다시 시도해 주세요.';

function aiError(status, userMsg, detail) {
  if (detail) console.error(`[ai:groq] ${detail}`);
  const e = new Error(userMsg);
  e.status = status;
  e.detail = detail || '';
  return e;
}
function cfgError(detail) { throw aiError(503, AI_OFF_MSG, detail); }

/* 지금까지 어떤 모델로 답했는지 — 응답에 실어 화면에 표시한다. */
const modelLabel = () => GROQ_MODEL;

const isConfigured = () => Boolean((process.env.GROQ_API_KEY || '').trim());

/* 호출 한 겹. 반환값은 모델이 낸 JSON 문자열.

   num_ctx / num_predict 는 로컬 추론 시절의 인자다. Groq 는 컨텍스트를 알아서
   잡으므로 num_ctx 는 쓰지 않고, num_predict 만 max_tokens 로 넘긴다.
   호출하는 쪽 코드를 건드리지 않으려고 인자 모양은 그대로 둔다. */
/* ── 추론형 모델은 생각하다가 토큰을 다 쓴다 (실측) ──────────────
   지금 .env 의 모델은 `openai/gpt-oss-120b` 다. 이 계열은 답을 내기 전에 추론
   토큰을 먼저 쓰는데, 그 몫도 max_tokens 안에서 나간다. 자소서 초안처럼 프롬프트가
   긴 요청에서는 추론에서 예산을 다 쓰고 **본문이 빈 채로 끝난다.**

   그러면 Groq 는 JSON 검증에 걸려 `HTTP 400 json_validate_failed` 를 낸다
   (failed_generation 이 빈 문자열이다). 화면에는 "AI 초안을 만들지 못했어요" 로만
   보이는데, 원인이 프롬프트도 키도 쿼터도 아니라서 아무리 다시 눌러도 똑같다.

   실측 — 같은 프롬프트·같은 모델:
     max_completion_tokens 1100                        → 400 (본문 0자)
     max_completion_tokens 1100 + reasoning_effort low  → 200 (본문 470자)
   짧은 프롬프트에서는 그냥 되기 때문에, 이 기능에서만 죽어 있었다.

   추론을 안 쓰는 모델(llama 계열)에 이 인자를 보내면 거절당하므로 모델 이름으로 가른다. */
const REASONING_MODEL = /gpt-oss|^o[13]|reason|qwen.*thinking|deepseek-r/i;
const reasoningOpt = () => (REASONING_MODEL.test(GROQ_MODEL) ? { reasoning_effort: 'low' } : {});

/* 호출 실패를 학생용 문구·운영자용 원인·상태코드로 옮긴다. 스트리밍이든 아니든
   실패 종류는 같으므로 한 곳에 둔다 — 두 벌로 두면 한쪽만 고쳐진다. */
function mapGroqError(e) {
  const status = e?.status;
  const detail = String(e?.error?.error?.message || e?.message || '').slice(0, 200);
  /* msg = 학생이 볼 말, log = 운영자가 볼 원인(cfgError 주석 참고). */
  let msg, out, log;

  if (status === 401 || status === 403) {
    msg = AI_OFF_MSG;
    log = `인증 실패(HTTP ${status}) — GROQ_API_KEY 가 올바른지 확인하세요 (https://console.groq.com/keys)`;
    out = 503;                                    // 키 문제 = 설정 문제
  } else if (status === 429) {
    msg = '지금 요청이 몰려 있어요. 잠시 뒤 다시 시도해 주세요.';
    log = `무료 쿼터 초과(HTTP 429): ${detail}`;
    out = 429;                                    // 재시도하면 되는 상황 — 503 과 구분한다
  } else if (status === 404 || /decommission|not.*exist|model/i.test(detail)) {
    msg = AI_OFF_MSG;
    log = `모델 "${GROQ_MODEL}" 을(를) 쓸 수 없습니다(${detail}). 폐기된 모델일 수 있습니다 `
        + `— .env 의 GROQ_MODEL 을 현행 모델로 바꾸세요 (https://console.groq.com/docs/models)`;
    out = 503;
  } else if (e?.name === 'APIConnectionTimeoutError' || /timeout/i.test(detail)) {
    msg = `AI 응답이 ${Math.round(TIMEOUT_MS / 1000)}초 안에 오지 않았어요. 잠시 뒤 다시 시도해 주세요.`;
    log = `타임아웃(${TIMEOUT_MS}ms): ${detail}`;
    out = 504;
  } else {
    msg = 'AI 응답을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    log = `호출 실패${status ? ` (HTTP ${status})` : ''}: ${detail}`;
    out = 502;
  }
  return aiError(out, msg, log);
}

/* ── 스트리밍(stream:true)은 쓸 수 없다 — 실측 2026-09-04 ────────────────────
   화면 작성률을 '실제로 써진 글자 수' 로 그리려고 토큰 스트리밍을 붙여 봤다가 걷어냈다.
   `openai/gpt-oss-120b` 는 `response_format: json_object` 와 `stream: true` 를 같이 주면
   **호출 자체가 깨진다**(`Failed to generate JSON`). 같은 프롬프트·같은 모델로:
     stream=false → 2,190ms 성공 (1,087자, 파싱 성공)
     stream=true  → 502 Failed to generate JSON
   JSON 모드를 포기하면 스트리밍은 되지만, 초안 파이프라인 전체(parseDraft·빈칸 세기·
   coach 필드)가 JSON 계약 위에 서 있어서 막대 하나 때문에 버릴 것이 아니다.
   그래서 진행률은 **시간을 재서** 그린다(jd-coach.js startAiProgress). */
async function callModel(text, system, { num_predict = 512 } = {}) {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) {
    cfgError('GROQ_API_KEY 가 없습니다. https://console.groq.com/keys 에서 발급받아 '
           + 'backend/.env 의 GROQ_API_KEY 에 넣어주세요.');
  }

  const Groq = require('groq-sdk');
  const client = new Groq({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 1 });
  const req = {
    model: GROQ_MODEL,
    temperature: 0.2,
    max_tokens: num_predict,
    response_format: { type: 'json_object' },
    ...reasoningOpt(),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ],
  };

  /* 오류 처리가 없던 시절엔 키 오타·무료쿼터 소진·모델 폐기가 전부
     "AI 분석에 실패했습니다"(500) 한 줄로 뭉개져, 사용자가 무엇을 해야 하는지
     알 수 없었다. 상태코드별로 할 일이 다르므로 갈라 준다(mapGroqError). */
  try {
    const completion = await client.chat.completions.create(req);
    return completion.choices?.[0]?.message?.content || '{}';
  } catch (e) { throw mapGroqError(e); }
}

/* ── 자소서 AI 초안 프로바이더 라우팅 ──────────────────────────
   초안(/api/jd/draft·/motive)만 산문 품질이 결과라, 한국어가 더 자연스러운 Gemini 로
   보낸다(사용자 선택 2026-08-28). 나머지(스펙 분류·역량 추출)는 위 callModel = Groq 그대로.

   **명시적 라우팅이다** — 옛 Ollama 사고(환경변수가 안 읽혀 조용히 엉뚱한 데로 떨어짐)를
   되풀이하지 않으려고, GEMINI_API_KEY 가 있을 때만 Gemini 로 가고 없으면 Groq 로
   되돌아간다. 되돌아가는 곳이 '안 켜진 로컬 도구'가 아니라 이미 설정된 Groq 라 정상
   경로다. 무엇으로 썼는지는 draftProvider()·draftModel() 이 딱 잘라 말한다(응답에 실어
   화면이 구분한다). 판단 기준이 '키의 존재' 하나라 이 세 함수는 항상 같은 답을 준다. */
const GEMINI = require('./ai-gemini');
const useGemini = () => GEMINI.isConfigured();

const draftProvider = () => (useGemini() ? GEMINI.PROVIDER : PROVIDER);
const draftModel = () => (useGemini() ? GEMINI.modelLabel() : modelLabel());

/* ── Gemini 가 죽으면 Groq 로 넘긴다 (2026-09-03 운영 사고) ────────────────────
   ── 무슨 일이 있었나 ──
   Gemini 가 `HTTP 503 This model is currently experiencing high traffic` 를 내기
   시작했고, **AI 초안이 통째로 죽었다.** 화면에는 504 만 보였다. 그런데 같은 순간
   Groq 는 멀쩡했다(같은 프롬프트로 4.7초·494자 정상). 앱의 나머지 AI 기능은 전부
   Groq 로 돌고 있었으니, 초안만 살릴 수 있는데 안 살린 것이다.

   원인은 라우팅이 **키의 존재 하나로만** 갈렸다는 것이다. 키가 있으면 무조건 Gemini 고,
   429(쿼터)·503(과부하)·타임아웃 어느 쪽이든 되돌아갈 길이 없었다. 검증 중에 쿼터가
   소진돼 같은 증상을 두 번 봤는데도 '나중에' 로 미뤄 뒀다가 운영에서 터졌다.

   ── 왜 '조용한 폴백' 이 여기서는 맞나 ──
   이 파일 위 주석이 명시적 라우팅을 고집하는 이유는 옛 Ollama 사고 때문이다 —
   환경변수가 안 읽혀 **안 켜진 로컬 도구**로 조용히 떨어졌다. 여기는 다르다.
   되돌아가는 곳이 이미 설정돼 돌아가는 Groq 이고, 무엇으로 썼는지는 응답의
   provider·model 이 딱 잘라 말한다(화면이 그걸 그대로 보여준다).

   ── 두 번 부르는 시간을 감당할 수 있나 ──
   Gemini 실패는 대개 즉시 온다(503·429 는 5초 안쪽). 최악은 타임아웃(60초) + Groq(5초)
   인데, 라우트가 외국어·베낌으로 최대 두 번 더 부를 수 있어 그대로 두면 프록시가
   먼저 끊는다. 그래서 **폴백이 가능할 때는 Gemini 쪽 상한을 짧게 준다** — 어차피
   60초를 기다려 봐야 나오지 않을 응답이다. */
const GEMINI_FIRST_TRY_MS = Number(process.env.DRAFT_GEMINI_TIMEOUT_MS || 25000);

/* used 를 넘기면 **실제로 쓴 프로바이더**를 적어 준다. 폴백했는데 응답에 'gemini' 라고
   적히면 화면이 거짓말을 한다 — 어느 모델이 쓴 글인지가 이 기능의 판단 근거다. */
async function callDraftModel(text, system, opts = {}, used = null) {
  const mark = (provider, model) => { if (used) { used.provider = provider; used.model = model; } };
  if (!useGemini()) { mark(PROVIDER, modelLabel()); return callModel(text, system, opts); }
  try {
    const out = await GEMINI.callModel(text, system, { ...opts, timeoutMs: GEMINI_FIRST_TRY_MS });
    mark(GEMINI.PROVIDER, GEMINI.modelLabel());
    return out;
  } catch (e) {
    /* 키가 잘못됐으면 Groq 로 넘겨도 같은 글을 못 쓴다 — 는 아니지만, 설정이 틀린 것을
       조용히 덮으면 영영 못 고친다. 그래도 사용자 앞에서 기능이 죽는 것보다는 낫다:
       넘기되 **로그에는 남긴다.** 무엇으로 썼는지는 응답의 provider 가 말해 준다. */
    /* 로그에는 **원인**(detail)을 적는다 — message 는 학생에게 보여줄 말이라
       "잠시 뒤 다시 시도해 주세요" 뿐이고, 그건 운영자가 볼 이유가 없다. */
    console.warn('[초안] Gemini 실패 → Groq 로 넘어갑니다 —',
      String(e?.detail || e?.message || e).slice(0, 160));
    if (!isConfigured()) throw e;          // Groq 도 없으면 원래 오류를 그대로 올린다
    mark(PROVIDER, modelLabel());
    return callModel(text, system, opts);
  }
}

module.exports = {
  callModel, modelLabel, isConfigured,
  PROVIDER, GROQ_MODEL, TIMEOUT_MS,
  callDraftModel, draftProvider, draftModel,
};
