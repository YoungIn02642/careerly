/* ════════════════════════════════════════════════════════════
   AI 초안 — 역량 하나에 대한 자소서 문단 초안

   ── 이 파일이 존재하는 이유 ──────────────────────────────────
   자소서 코치는 지금까지 "무엇을 어떤 순서로 쓸지"만 알려 줬다. 그런데 순서를 알아도
   첫 문장을 못 쓰는 사람이 많다. 그래서 **내 활동을 재료로 한 예시 문단**을 만들어 준다.

   ── 그래도 대필은 하지 않는다 ────────────────────────────────
   원칙은 그대로다. 모델이 아는 것은 사용자가 입력한 활동 이름·기간·역할뿐이고,
   구체적 수치와 상황은 모른다. 그 자리를 지어내면 면접에서 그대로 무너지므로
   **모르는 값은 반드시 [대괄호]로 남기게** 한다. 화면의 빈칸 카운터가 그걸 세고,
   빈칸이 남은 초안은 그대로 제출할 수 없다. 지어낸 문장을 주는 것보다 이 편이 낫다.

   ── 답변 틀 (P.C.R.O) ────────────────────────────────────────
   링커리어 취업자료의 자소서 AI 활용 프레임을 그대로 골격으로 쓴다:
     Persona     — 누구로서 답하는가 (해당 직무 실무자 + 채용 담당자)
     Context     — 무엇을 아는 상태인가 (회사·공고 근거 문장·요구 역량·내 활동)
     Restriction — 무엇을 하면 안 되는가 (지어내기·상투어·AI 흔적·글자수)
     Output      — 어떤 모양으로 답하는가 (JSON 고정)
   그리고 생성 자체를 5단계로 나눈 원문 방법론(직무분석 → 경험 구조화(STAR) →
   초안 → 다듬기 → 검토) 중 **앞 네 단계는 코드가 이미 하고 있다**:
     직무분석 = jd-competency 의 역량 추출, 경험 구조화 = STAR 틀,
     다듬기 = CLICHES/AI_TELLS 사전. 그래서 모델에는 '초안'만 시키고, 나머지는
     프롬프트의 제약으로 넣는다. 모델이 매번 다르게 판단할 여지를 줄이는 게 목적이다.
     (출처: community.linkareer.com/employment_data/6215449, /6273451)

   ── 왜 규칙을 프롬프트에 다시 쓰지 않고 사전에서 읽는가 ──────
   상투어·AI 흔적 목록은 cover-guide.js 가 이미 갖고 있고 화면의 검사기도 그걸 쓴다.
   프롬프트에 따로 적으면 두 목록이 갈라져서, 모델이 쓴 문장을 우리 검사기가 빨간 줄로
   긋는 일이 생긴다. 한 곳에서 읽는다.
   ════════════════════════════════════════════════════════════ */
const GUIDE = require('./cover-guide');

/* 모델에 넘기는 활동 요약. 있는 필드만 붙인다 — 빈 값을 '없음'으로 채워 보내면
   모델이 그 '없음'을 문장에 그대로 쓴다(실측).

   ── 항목 이름을 붙여서 넘긴다 ──
   처음에는 '교내 마케팅 공모전 · 대외활동 · 3개월 · 팀장' 처럼 가운뎃점으로만 이었는데,
   모델이 어느 조각이 활동 이름인지 몰라서 문단을 "3개월에서…", "대외활동 프로젝트에서…"
   로 시작했다(실측 3회 중 3회). 라벨을 붙이면 이름을 정확히 집어 쓴다. */
function activityLine(m) {
  if (!m || !m.name) return null;
  const bits = [`이름: ${m.name}`];
  if (m.typeLabel) bits.push(`종류: ${m.typeLabel}`);
  if (m.duration) bits.push(`기간: ${m.duration}`);
  if (m.role) bits.push(`역할: ${m.role}`);
  if (m.outcome && m.outcome !== '결과물 없음') bits.push(`성과: ${m.outcome}`);
  return bits.join(' / ');
}

const SYSTEM = [
  '너는 한국 대기업 채용에서 자기소개서를 15년간 평가해 온 인사담당자이자,',
  '지원 직무를 실제로 수행해 온 현업 10년차다. 지원자가 쓴 문단을 읽고',
  '"이 사람이 우리 일을 할 수 있는가"를 판단하는 쪽에 서서 초안을 만든다.',
  '',
  '너는 지원자의 활동에 대해 아래 Context 에 적힌 것 말고는 아무것도 모른다.',
  '모르는 사실(수치·기간·팀 규모·구체적 상황)을 절대 지어내지 마라.',
  '그런 자리는 대괄호로 비워 두되, 대괄호 안에는 **채워야 할 항목의 이름**을 적어라.',
  '예: [팀원 수]명과 함께 / 전환율이 [개선 전 %]에서 [개선 후 %]로',
  '"[대괄호]" 나 "[빈칸]" 처럼 안내어를 그대로 쓰면 안 된다. 무엇을 채울지 알 수 없다.',
  '비워 둔 자리가 하나도 없는 답은 틀린 답이다.',
  '',
  '반드시 JSON 객체 하나만 출력한다. 설명·인사말·코드펜스를 붙이지 마라.',
  '',
  /* 실측: review 에 베트남어("cụ thể")가 섞여 나왔다. 제약을 draft 에만 걸어 뒀더니
     나머지 필드가 새어 나온 것이다. 출력 전체로 범위를 넓힌다. */
  'draft·blanks·review **모든 필드를 한국어로만** 쓴다. 다른 언어를 한 글자도 섞지 마라',
  '(고유명사와 널리 쓰는 약어는 예외).',
].join('\n');

/* 사전에서 금지어를 만든다. 목록이 길어 모델이 다 못 읽는 일이 없게 앞쪽 몇 개만
   보낸다 — 어차피 전수 검사는 화면의 검사기가 한다. */
function banned(limit = 8) {
  return GUIDE.CLICHES.slice(0, limit).map(c => c.term);
}
function tells(limit = 4) {
  return GUIDE.AI_TELLS.slice(0, limit).map(t => t.term);
}

/* ── 프롬프트 조립 (P.C.R.O) ──────────────────────────────── */
function buildPrompt({ company, jobTitle, competency, quotes, reads, frame, activities, question, limit }) {
  const acts = (activities || []).map(activityLine).filter(Boolean);
  const names = (activities || []).map(a => a?.name).filter(Boolean);
  const star = GUIDE.STAR.map(s => `${s.key}(${s.label}): ${s.what} — ${s.check}`);

  const context = [
    `지원 회사: ${company || '(미지정)'}`,
    jobTitle ? `지원 직무: ${jobTitle}` : null,
    question ? `자소서 문항: ${question}` : null,
    `이번에 쓸 요구 역량: ${competency}`,
    reads ? `이 역량으로 기업이 보는 것: ${reads}` : null,
    quotes?.length ? `공고 원문 근거:\n${quotes.map(q => `  - ${q}`).join('\n')}` : null,
    frame ? `이 역량을 쓰는 순서: ${frame}` : null,
    acts.length
      ? `지원자가 실제로 한 활동(이것 말고는 아는 것이 없다):\n${acts.map(a => `  - ${a}`).join('\n')}\n`
        + `  ※ 이 중 하나를 골라 **'이름:' 값을 문장에 그대로 넣고** 그 경험으로 문단을 써라.`
        + ` 활동 이름이 문단에 없으면 틀린 답이다.`
      : '지원자의 활동 정보가 없다. 활동 자리도 전부 대괄호로 남겨라.',
  ].filter(Boolean).join('\n');

  const restriction = [
    /* 실측: '지어내지 마라' 만 강하게 걸었더니 **아는 값까지 대괄호로 비웠다**
       (기간 3개월·역할 팀장·성과 최우수상이 주어졌는데 [기간]·[역할]·[성과]로 나왔고,
       한 문단에 빈칸이 13개였다). 아는 것은 쓰라고 같이 말해야 균형이 잡힌다. */
    `1. 위 활동에 **적혀 있는 값(이름·종류·기간·역할·성과)은 대괄호로 비우지 말고 그대로 써라.**`
      + ` 거기 없는 사실(구체적 수치·인원·상황)만 대괄호로 비운다.`
      + ` 대괄호 안에는 채울 항목의 이름을 적는다 — [팀원 수], [전환율 변화] 처럼.`,
    `1-1. 대괄호는 한 문단에 **최대 4개**까지만 쓴다. 그보다 많으면 문장이 아니라 서식이다.`,
    `2. 아래 표현은 쓰지 마라(변별력이 없다): ${banned().join(', ')}`,
    `3. 아래 연결어를 반복하지 마라(AI 초안 티가 난다): ${tells().join(', ')}`,
    `4. STAR 순서를 지킨다:\n${star.map(s => `   ${s}`).join('\n')}`,
    `5. 역량 이름("${competency}")을 문장에 그대로 쓰지 마라. 그 역량을 쓴 상황으로 보여라.`,
    `6. 전체 ${limit}자 안팎. 소감·다짐·포부로 끝내지 말고 결과와 배운 점으로 닫는다.`,
    `7. 존댓말 서술체(~했습니다)로 쓴다.`,
    /* 실측: 대괄호 안에 '[どこ에서]' 처럼 일본어가, review 에는 베트남어가 섞여 나왔다.
       한국어 자소서에 외국어가 한 글자라도 섞이면 그대로 제출되어 사고가 된다. */
    `8. 대괄호 안까지 포함해 **한국어로만** 쓴다. 영어·일본어·중국어·베트남어를 섞지 마라`
      + '(고유명사와 널리 쓰는 약어는 예외).',
    acts.length
      ? `9. 다음 활동 이름 중 하나를 문단에 **그대로** 써라: ${names.map(n => `"${n}"`).join(', ')}.`
        + ` '대외활동'·'3개월' 같은 분류나 기간이 아니라 **이름**이다. 일반론을 쓰지 마라.`
      : null,
  ].filter(Boolean).join('\n');

  const output = [
    '{',
    '  "draft": "완성된 문단 한 개. 줄바꿈은 \\n 으로.",',
    '  "blanks": ["대괄호로 남긴 자리마다 무엇을 채워야 하는지 한 줄씩"],',
    '  "review": ["채용담당자 관점에서 이 초안의 약한 지점 2~3개"]',
    '}',
  ].join('\n');

  return `# Context\n${context}\n\n# Restriction\n${restriction}\n\n# Output\n아래 JSON 형식으로만 답하라.\n${output}`;
}

/* ── 응답 정리 ────────────────────────────────────────────────
   모델이 코드펜스를 붙이거나 앞뒤에 말을 얹는 일이 잦다. 첫 '{' 부터 마지막 '}' 까지만
   잘라서 파싱한다. 파싱이 안 되면 초안을 주지 않는다 — 깨진 문장을 자소서에 넣게
   두는 것보다 "실패했다"고 말하는 편이 낫다. */
function parseDraft(raw) {
  const text = String(raw || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI 응답을 읽지 못했습니다.');

  let data;
  try { data = JSON.parse(text.slice(start, end + 1)); }
  catch { throw new Error('AI 응답을 읽지 못했습니다.'); }

  const draft = String(data.draft || '').trim();
  if (!draft) throw new Error('AI 가 초안을 만들지 못했습니다.');

  return {
    draft,
    blanks: toLines(data.blanks),
    review: toLines(data.review),
    /* 서버가 직접 센다. 모델이 "빈칸 3개" 라고 말해도 실제 문장과 다를 수 있어서,
       화면에 띄우는 숫자는 문자열에서 세는 값만 믿는다. */
    blankCount: GUIDE.countBlanks(draft),
    cliches: GUIDE.findCliches(draft),
    aiTells: GUIDE.findAiTells(draft),
  };
}

function toLines(v) {
  if (!Array.isArray(v)) return [];
  return v.map(x => String(x || '').trim()).filter(Boolean).slice(0, 5);
}

/* ── 한국어가 아닌 글자 감지 ──────────────────────────────────
   프롬프트로 "한국어로만" 을 못 박아도 완전히 막히지 않는다. 실측(8회 반복):
   일본어 '[どこ에서]', 베트남어 'cụ thể', 중국어 '活动' 이 8회 중 1회꼴로 섞였다.
   자소서에 다른 언어가 한 글자라도 들어가면 그대로 제출되어 사고가 되므로,
   말로 부탁하는 대신 **받아서 확인하고 다시 부른다**(호출하는 쪽이 재시도).

   가나·한자·베트남어 성조기호만 본다. 영문은 자소서에도 정상적으로 들어가고
   (AI·SQL·MOU), 한글 자모는 당연히 통과시킨다. */
const FOREIGN = /[぀-ヿ一-鿿À-ỹ]/;

function hasForeign(out) {
  const text = [out?.draft, ...(out?.blanks || []), ...(out?.review || [])].join(' ');
  return FOREIGN.test(text);
}

module.exports = { buildPrompt, parseDraft, activityLine, hasForeign, SYSTEM };
