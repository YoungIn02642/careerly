/* 자소서 초안 프로바이더 라우팅 — Gemini 가 죽으면 Groq 로 넘어가는가

   ── 왜 이 테스트가 있나 (2026-09-03 운영 사고) ──
   Gemini 가 `503 This model is currently experiencing high traffic` 를 내기 시작하자
   **AI 초안이 통째로 죽었다.** 화면에는 504 만 보였다. 그런데 같은 순간 Groq 는
   멀쩡했고(같은 프롬프트로 4.7초·494자), 앱의 나머지 AI 기능은 전부 Groq 로 돌고
   있었다. 살릴 수 있는 기능이 죽은 것이다.

   원인은 라우팅이 **키의 존재 하나로만** 갈렸다는 것 — 키가 있으면 무조건 Gemini 고
   429·503·타임아웃 어느 쪽이든 되돌아갈 길이 없었다. 그 길을 만들었고, 여기서 지킨다.

   네트워크를 타지 않는다. fetch 와 groq-sdk 를 가로채 **어느 쪽이 불렸는지만** 본다 —
   실제 모델 호출은 느리고 쿼터를 먹고 결과가 매번 달라서 회귀 테스트에 못 쓴다. */
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

/* ── 가짜 Gemini (fetch) ────────────────────────────────────────
   ai-gemini.js 는 전역 fetch 로 부른다. 부르는 족족 세고, 시킨 대로 실패시킨다. */
const calls = { gemini: 0, groq: 0 };
let geminiMode = 'ok';            // 'ok' | 'overloaded' | 'quota' | 'hang'
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (!String(url).includes('generativelanguage')) return realFetch(url, opts);
  calls.gemini++;
  if (geminiMode === 'overloaded') {
    return new Response(JSON.stringify({ error: { message: 'This model is currently experiencing high traffic' } }),
      { status: 503, headers: { 'content-type': 'application/json' } });
  }
  if (geminiMode === 'quota') {
    return new Response(JSON.stringify({ error: { message: 'quota exceeded' } }),
      { status: 429, headers: { 'content-type': 'application/json' } });
  }
  if (geminiMode === 'hang') {
    /* 끊길 때까지 안 돌아온다 — 폴백이 타임아웃에서도 도는지 본다. */
    await new Promise((_, rej) => opts?.signal?.addEventListener('abort', () => rej(
      Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  }
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"draft":"제미나이가 쓴 문단입니다.","blanks":[],"coach":[],"review":[]}' }] } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

/* ── 가짜 Groq (groq-sdk) ──────────────────────────────────────
   ai-provider.js 가 호출 시점에 require 하므로, 캐시에 미리 심어 두면 그걸 쓴다. */
const groqPath = require.resolve('groq-sdk', { paths: [require('path').join(__dirname, '..', 'backend')] });
require.cache[groqPath] = {
  id: groqPath, filename: groqPath, loaded: true,
  exports: class FakeGroq {
    constructor() {
      this.chat = { completions: { create: async () => {
        calls.groq++;
        return { choices: [{ message: { content: '{"draft":"그록이 쓴 문단입니다.","blanks":[],"coach":[],"review":[]}' } }] };
      } } };
    }
  },
};

process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.DRAFT_GEMINI_TIMEOUT_MS = '300';      // 'hang' 을 빨리 끊는다
const AI = require('../backend/src/ai-provider.js');

const reset = mode => { calls.gemini = 0; calls.groq = 0; geminiMode = mode; };

(async () => {
  console.log('── 1. Gemini 가 정상이면 Gemini 를 쓴다 ──');
  reset('ok');
  let used = {};
  let out = await AI.callDraftModel('본문', '시스템', {}, used);
  ok('Gemini 가 불렸다', calls.gemini === 1 && calls.groq === 0, `→ gemini ${calls.gemini} · groq ${calls.groq}`);
  ok('Gemini 결과가 온다', out.includes('제미나이'));
  ok('실제로 쓴 곳을 기록한다', used.provider === 'gemini', `→ ${used.provider}`);

  console.log('\n── 2. 과부하(503)면 Groq 로 넘어간다 ──');
  /* 이게 이번 사고의 조건이다. 예전에는 여기서 기능이 죽었다. */
  reset('overloaded');
  used = {};
  out = await AI.callDraftModel('본문', '시스템', {}, used);
  ok('Gemini 를 먼저 시도한다', calls.gemini === 1);
  ok('Groq 로 넘어간다', calls.groq === 1, `→ groq ${calls.groq}`);
  ok('Groq 결과가 온다 (기능이 살아 있다)', out.includes('그록'));
  ok('provider 가 groq 로 바뀐다', used.provider === 'groq', `→ ${used.provider}`);
  /* 폴백했는데 응답에 'gemini' 라고 적히면 화면이 거짓말을 한다. */
  ok('draftProvider() 는 여전히 gemini (보내려던 곳)', AI.draftProvider() === 'gemini',
    '실제로 쓴 곳은 used 가 말한다 — 둘은 다른 질문이다');

  console.log('\n── 3. 쿼터 소진(429)도 같다 ──');
  reset('quota');
  used = {};
  out = await AI.callDraftModel('본문', '시스템', {}, used);
  ok('Groq 로 넘어간다', calls.groq === 1 && out.includes('그록'));
  ok('provider 기록도 groq', used.provider === 'groq');

  console.log('\n── 4. 응답이 안 오면(타임아웃) 넘어간다 ──');
  /* 504 의 직접 원인이다. 기다리다 프록시가 먼저 끊으면 사용자는 원인도 못 본다. */
  reset('hang');
  used = {};
  const t = Date.now();
  out = await AI.callDraftModel('본문', '시스템', {}, used);
  const took = Date.now() - t;
  ok('Groq 로 넘어간다', out.includes('그록'));
  ok('짧은 상한 안에 끊는다', took < 3000, `→ ${took}ms (상한 300ms + Groq)`);

  console.log('\n── 5. Gemini 키가 없으면 처음부터 Groq ──');
  const keep = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  reset('ok');
  used = {};
  out = await AI.callDraftModel('본문', '시스템', {}, used);
  ok('Gemini 를 아예 안 부른다', calls.gemini === 0);
  ok('Groq 결과가 온다', out.includes('그록'));
  ok('provider 는 groq', used.provider === 'groq');
  ok('draftProvider() 도 groq', AI.draftProvider() === 'groq');
  process.env.GEMINI_API_KEY = keep;

  console.log('\n── 6. Groq 도 없으면 원래 오류를 그대로 올린다 ──');
  /* 둘 다 죽었으면 조용히 삼키지 않는다 — 무엇이 잘못됐는지는 알려줘야 한다. */
  const keepGroq = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  reset('overloaded');
  let threw = null;
  try { await AI.callDraftModel('본문', '시스템', {}, {}); } catch (e) { threw = e; }
  ok('예외가 올라온다', Boolean(threw));
  ok('Gemini 쪽 오류다', /Gemini|503|traffic/i.test(threw?.message || ''), `→ ${threw?.message?.slice(0, 50)}`);
  process.env.GROQ_API_KEY = keepGroq;

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  if (fail) process.exit(1);
})();
