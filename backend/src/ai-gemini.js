/* ══════════════════════════════════════════════════════════════
   LLM 프로바이더 — Google Gemini (자소서 AI 초안 전용)

   ── 왜 Groq 옆에 하나 더 두나 ──────────────────────────────────
   역량 추출·스펙 분류는 "짧은 JSON" 이라 속도가 전부고, 거기선 Groq(gpt-oss-120b)가
   빠르고 일일 한도도 넉넉하다. 그대로 둔다(ai-provider.js).
   유일하게 갈아 끼우는 곳은 **자소서 AI 초안**이다 — 여기만 산문 품질이 곧 결과라,
   한국어 문장이 더 자연스러운 Gemini 2.5 Flash 를 쓴다(사용자 선택 2026-08-28).

   ── 옛 Ollama 사고를 되풀이하지 않는다 ─────────────────────────
   프로바이더가 둘이 되면 "환경변수가 안 읽혀 조용히 엉뚱한 데로 떨어지는" 실패 모드가
   되살아난다(ai-provider.js 머리주석). 그래서 라우팅은 **명시적**이다:
     · GEMINI_API_KEY 가 있으면 초안은 Gemini.
     · 없으면 초안도 Groq 로 **되돌아가되(fallback)**, 그건 안 켜진 로컬 도구가 아니라
       이미 설정된 다른 프로바이더라 오류가 아니라 정상 경로다. 응답의 provider·model
       필드에 무엇으로 썼는지 실어 화면이 구분한다.
   (이 라우팅은 ai-provider.js 의 callDraftModel 이 한다. 이 파일은 Gemini 호출만.)

   ── SDK 를 안 쓴다 ─────────────────────────────────────────────
   Node 24 는 전역 fetch 가 있고, Gemini 는 REST 한 방이면 된다. 의존성을 늘리지 않는다
   (이 저장소는 groq-sdk 말고는 LLM SDK 가 없다). 인증키는 **URL 이 아니라 헤더**로 보낸다
   — 쿼리스트링에 키를 실으면 로그·프록시에 남는다.

   env: GEMINI_API_KEY (필수) · GEMINI_MODEL · CAS_AI_TIMEOUT_MS (Groq 와 공유)
   ══════════════════════════════════════════════════════════════ */
const PROVIDER = 'gemini';

/* 모델은 env 로 뺀다 — Google 도 모델을 예고 후 폐기하고, 그때 코드를 고치지 않고
   갈아끼울 수 있어야 한다(Groq 쪽과 같은 이유). 기본값도 살아 있는 모델이어야 한다. */
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

/* Groq 와 같은 상한을 공유한다 — 사용자가 CAS_AI_TIMEOUT_MS 하나만 만지면 둘 다 걸린다. */
const TIMEOUT_MS = Number(process.env.CAS_AI_TIMEOUT_MS || 60000);

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const modelLabel = () => GEMINI_MODEL;
const isConfigured = () => Boolean((process.env.GEMINI_API_KEY || '').trim());

function cfgError(msg) { const e = new Error(msg); e.status = 503; throw e; }

/* 호출 한 겹. 반환값은 모델이 낸 JSON 문자열 — Groq 의 callModel 과 같은 계약이라
   호출부(parseDraft)가 어느 프로바이더든 똑같이 읽는다.

   ── 사고(thinking) 예산을 못박아 지연을 잡는다 (실측 2026-08-28) ──
   Gemini 2.5+ 는 답 전에 '사고' 토큰을 먼저 쓰는데 그 몫도 maxOutputTokens 에서 나간다
   (gpt-oss 에서 본문이 빈 채 끝나던 그 사고 — ai-provider.js reasoningOpt 주석).
   초안은 추론이 필요 없어 사고를 끄려 thinkingBudget:0 을 넣었더니 gemini-3.6-flash 가
   400 INVALID_ARGUMENT 로 거절했다 — 이 세대는 사고를 **완전히는** 못 끈다.
   그런데 실측하면 **0만 거절이고 낮은 양수는 받는다.** 게다가 지연이 예산에 정비례한다:
     thinkingBudget 무제한(기본) → 25~32초 · 512 → 5초 · 128 → 14초 (마지막이 더 느린 건
     예산이 모자라 다시 사고하기 때문으로 보인다). 512 면 초안 품질은 그대로면서 빠르다.
   그래서 512 로 못박고, maxOutputTokens 는 사고 몫(THINK_BUDGET)+본문(num_predict)을
   함께 덮게 준다 — 안 그러면 사고가 예산을 먹어 본문이 빈 채 끝난다. */
const THINK_BUDGET = 512;
/* timeoutMs 는 호출하는 쪽이 더 짧게 줄 수 있다 — 초안은 Gemini 가 실패하면 Groq 로
   넘어가므로(ai-provider.js callDraftModel), 60초를 다 기다릴 이유가 없다. */
async function callModel(text, system, { num_predict = 512, timeoutMs } = {}) {
  const limitMs = Number(timeoutMs) > 0 ? Number(timeoutMs) : TIMEOUT_MS;
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    cfgError('GEMINI_API_KEY 가 없습니다. https://aistudio.google.com/apikey 에서 발급받아 '
           + 'backend/.env 의 GEMINI_API_KEY 에 넣어주세요.');
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), limitMs);

  let res, data;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          temperature: 0.2,
          /* 상한은 사고 몫 + 본문을 함께 덮는다(위 주석). */
          maxOutputTokens: num_predict + THINK_BUDGET,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: THINK_BUDGET },
        },
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    /* 네트워크·타임아웃은 사용자가 할 일(잠시 뒤 재시도)이 같아 하나로 묶는다. */
    const timedOut = e?.name === 'AbortError';
    const err = new Error(timedOut
      ? `AI 응답이 ${Math.round(limitMs / 1000)}초 안에 오지 않았습니다. 잠시 뒤 다시 시도해 주세요.`
      : `Gemini 연결 실패: ${String(e?.message || '').slice(0, 200)}`);
    err.status = timedOut ? 504 : 502;
    throw err;
  }
  clearTimeout(timer);

  try { data = await res.json(); } catch { data = null; }

  /* 상태코드별로 사용자가 할 일이 다르므로 갈라 준다(Groq 쪽과 같은 정책). */
  if (!res.ok) {
    const detail = String(data?.error?.message || `HTTP ${res.status}`).slice(0, 200);
    let msg, out;
    if (res.status === 400 && /api.?key|api_key_invalid/i.test(detail)) {
      msg = 'Gemini 인증에 실패했습니다. GEMINI_API_KEY 가 올바른지 확인해 주세요 '
          + '— https://aistudio.google.com/apikey';
      out = 503;
    } else if (res.status === 401 || res.status === 403) {
      msg = `Gemini 인증에 실패했습니다(HTTP ${res.status}). GEMINI_API_KEY 를 확인해 주세요.`;
      out = 503;
    } else if (res.status === 429) {
      msg = 'Gemini 무료 쿼터를 초과했습니다. 잠시 뒤 다시 시도해 주세요.';
      out = 429;
    } else if (res.status === 404 || /not found|not.*support|deprecated/i.test(detail)) {
      msg = `Gemini 모델 "${GEMINI_MODEL}" 을(를) 쓸 수 없습니다(${detail}). `
          + '.env 의 GEMINI_MODEL 을 현행 모델로 바꿔주세요 '
          + '(목록: https://ai.google.dev/gemini-api/docs/models).';
      out = 503;
    } else {
      msg = `Gemini 호출 실패 (HTTP ${res.status}): ${detail}`;
      out = 502;
    }
    const err = new Error(msg);
    err.status = out;
    throw err;
  }

  /* 안전필터에 막히면 candidates 가 비어 온다 — 빈 문자열로 넘기면 parseDraft 가
     "AI 응답을 읽지 못했습니다" 로 알린다. 사유(blockReason)를 detail 로 실어 둔다. */
  const cand = data?.candidates?.[0];
  const parts = cand?.content?.parts || [];
  const outText = parts.map(p => p?.text || '').join('').trim();
  if (!outText) {
    const reason = data?.promptFeedback?.blockReason || cand?.finishReason || 'EMPTY';
    const err = new Error(`Gemini 가 빈 응답을 냈어요(${reason}). 다시 시도해 주세요.`);
    err.status = 502;
    throw err;
  }
  return outText;
}

module.exports = {
  callModel, modelLabel, isConfigured,
  PROVIDER, GEMINI_MODEL, TIMEOUT_MS,
};
