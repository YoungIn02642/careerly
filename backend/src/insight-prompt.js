/* ════════════════════════════════════════════════════════════
   프롬프트 공유 — 커리어 인사이트의 'AI 프롬프트' 카테고리 규칙

   ── 왜 카테고리 하나로 안 끝나나 (사용자 지시 2026-09-05) ──
   프롬프트를 글로만 올리면 읽는 사람이 **손으로 옮겨 적어야** 한다. 그런데 자소서
   코치에는 이미 '내 AI 프롬프트' 목록이 있다(초안을 쓸 때 기본 규칙 대신 끼우는 것).
   공유의 값은 "그 목록에 한 번에 담기는 것"에 있으므로, 프롬프트 원문을 본문과
   **따로** 받는다.

   ── 본문과 원문을 왜 가르나 ──
   본문은 "이 프롬프트를 왜 만들었나 · 어디에 잘 듣나" 같은 설명이고, 원문은 AI 에
   그대로 들어갈 규칙이다. 한 칸에 섞으면 담아 갔을 때 "이거 진짜 좋아요 ㅎㅎ" 가
   AI 규칙의 한 줄이 된다. 가르면 화면도 원문만 코드블록으로 보여줄 수 있다.

   ── 길이 상한은 자소서 코치와 같아야 한다 ──
   담아 가는 곳(jd-coach.js PROMPT_LEN_MAX)과 갈리면, 올릴 때는 통과한 글이
   담을 때 조용히 잘린다. 8,000자로 맞춰 두고 여기서 먼저 막는다.
   ════════════════════════════════════════════════════════════ */

const PROMPT_CATEGORY = 'prompt';
/* jd-coach.js PROMPT_LEN_MAX 와 같은 값 — 갈리면 담을 때 잘린다. */
const PROMPT_LEN_MAX = 8000;
/* 너무 짧은 것은 규칙이 아니다. "잘 써줘" 한 줄을 프롬프트라고 올리면 담아 간
   사람이 손해를 본다. 30자는 규칙 한 문장의 최소치로 잡은 값이다. */
const PROMPT_LEN_MIN = 30;

/* 담아 갈 때 붙일 이름. 제목을 그대로 쓰되 목록 칸에 맞춰 자른다
   (jd-coach 의 이름 입력칸 maxlength 40 과 같은 값). */
const PROMPT_NAME_MAX = 40;

/* 프롬프트 원문을 검사해 저장할 값으로 바꾼다.

   ── 카테고리가 프롬프트가 아니면 null 이다 ──
   '자유' 글에 프롬프트 원문이 딸려 오면 버린다. 지우지 않고 두면 목록·상세가
   '담기' 버튼을 어디에 붙일지 카테고리와 컬럼 두 곳을 봐야 한다.

   돌려주는 모양은 { ok, error, value } 다 — 라우트가 400 문구를 여기서 가져간다.
   문구를 라우트에 두면 만들기(POST)와 고치기(PUT)에 두 벌이 생긴다. */
function normalizePrompt(category, promptText) {
  if (category !== PROMPT_CATEGORY) return { ok: true, value: null };

  const t = String(promptText ?? '').trim();
  if (!t) {
    return { ok: false, error: 'AI 프롬프트 글에는 프롬프트 원문을 같이 올려주세요.' };
  }
  if (t.length < PROMPT_LEN_MIN) {
    return { ok: false, error: `프롬프트 원문은 ${PROMPT_LEN_MIN}자 이상이어야 해요.` };
  }
  if (t.length > PROMPT_LEN_MAX) {
    return { ok: false, error: `프롬프트 원문은 ${PROMPT_LEN_MAX.toLocaleString()}자까지예요.` };
  }
  return { ok: true, value: t };
}

/* 담아 갈 때 쓸 이름. 제목이 비면(있을 수 없지만) 기본 이름으로 떨어진다 —
   이름 없는 줄이 목록에 생기면 고를 수가 없다. */
function copyName(title) {
  const t = String(title ?? '').replace(/\s+/g, ' ').trim();
  return (t ? t.slice(0, PROMPT_NAME_MAX) : '공유 프롬프트');
}

module.exports = {
  PROMPT_CATEGORY, PROMPT_LEN_MAX, PROMPT_LEN_MIN, PROMPT_NAME_MAX,
  normalizePrompt, copyName,
};
