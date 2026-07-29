/* 반정형 스펙 텍스트 → CAS 활동/정량 구조체 (규칙 기반)

   왜 규칙 파서가 따로 있나:
   로컬 Ollama 의 8B 모델은 "국민은행 인턴쉽 3개월 / 해커톤 우수상 / 학부연구생 1년"
   같은 평범한 세 줄도 전부 type='other', name='' 로 뭉개는 일이 잦다(4분 걸려서).
   한국어 스펙 표기는 어휘가 좁아 규칙으로 대부분 정확히 잡히므로, 규칙 파서를
   1차 결과로 쓰고 AI 는 규칙이 못 잡은 줄과 총평(rationale)에만 쓴다.
   그 결과 Ollama 가 꺼져 있어도 이 기능이 동작한다.

   enum 값은 cas.js 단일 출처를 그대로 따른다. */
const CAS = require('../../frontend/js/cas.js');

/* 유형 키워드 — 위에서부터 먼저 맞는 것을 쓴다(구체적인 것이 앞).
   '해커톤'은 cas.js 의 project 설명("캡스톤·해커톤")을 따라 프로젝트로 본다. */
const TYPE_RULES = [
  ['research',        /학부\s*연구생|연구실|랩실|대학원|석사|박사|연구\s*보조/],
  ['internship',      /인턴|현장\s*실습|채용\s*연계형/],
  ['project',         /해커톤|캡스톤|프로젝트|토이\s*프로젝트|사이드\s*프로젝트/],
  ['competition',     /공모전|경진\s*대회|경진|챌린지|대회/],
  // 교내 프로그램은 대외활동과 배점이 달라(42 vs 56) 유형을 나눈다. 대외활동보다
  // 먼저 검사해야 "교내 대외활동 프로그램" 같은 표기가 교내로 잡힌다.
  ['campus',          /교내\s*활동|비교과|교내\s*프로그램|학교\s*프로그램|교내\s*공모|멘토링|튜터링/],
  // 사전에 없는 표기는 그 줄만 AI 로 넘어가 수십 초가 걸리므로 흔한 말은 최대한 흡수한다.
  ['extracurricular', /대외\s*활동|서포터즈|기자단|홍보\s*대사|앰배서더|캠프|부트\s*캠프|아카데미|교육\s*과정|수료/],
  ['club',            /동아리|학회|학생회|스터디/],
  ['exchange',        /교환\s*학생|어학\s*연수|워킹\s*홀리데이|해외\s*봉사/],
];

/* 성과 — 강한 것부터. '우수상·장려상'처럼 '~상'으로 끝나는 표현을 폭넓게 잡는다. */
const OUTCOME_RULES = [
  ['전환, 정규직 합격',            /전환|정규직\s*합격|채용\s*확정/],
  ['논문',                         /논문|게재|SCI|KCI|학술지|저널/i],
  ['수상',                         /수상|입상|대상|최우수상|우수상|장려상|금상|은상|동상|특별상|\d+\s*위/],
  ['발표 또는 산출물 공개(깃헙 등)', /깃헙|깃허브|github|오픈\s*소스|배포|출시|발표|포스터|시연/i],
];

const ROLE_RULES = [
  /* '대표'는 단독으로 두면 "대표활동1) …" 같은 목록 머리말에 걸려 팀원이 팀장이 된다.
     (실측: 폼 placeholder 가 유도하는 표기 자체가 이 함정을 밟았다) */
  ['팀장',   /팀장|리더|조장|PM|프로젝트\s*매니저|대표(?!\s*활동)/i],
  ['임원진', /회장|부회장|임원|운영진|기장/],
  ['개인',   /개인|혼자|단독/],
  ['팀원',   /팀원|참가|참여/],
];

const STAGE_RULES = [['박사', /박사/], ['석사', /석사|대학원/], ['학부연구생', /학부\s*연구생|학부생|인턴\s*연구원/]];

/* 사용자 결정: 역할·성과가 안 적혀 있으면 임의로 좋게 주지 않고 최저 가정으로 고정. */
const DEFAULT_ROLE    = '팀원';
const DEFAULT_STAGE   = '학부연구생';
const DEFAULT_OUTCOME = '결과물 없음';

/* 역할 셀렉트의 선택지는 유형(roleKind)마다 다르다 — spec-form.js 의 ROLE_BY_KIND 와 같아야 한다.
   목록에 없는 값을 내려보내면 <option> 이 없어 셀렉트가 빈칸으로 렌더링된다.
   (동아리·학회는 '팀원'이 아니라 '동아리원, 일반학회원'이 기본이다.) */
const ROLE_BY_KIND = {
  team: ['팀장', '팀원', '개인'],
  exec: ['임원진', '동아리원, 일반학회원'],
};
const LEADER_ROLE = { team: '팀장', exec: '임원진' };
const MEMBER_ROLE = { team: '팀원', exec: '동아리원, 일반학회원' };
const IS_LEADER   = /팀장|임원진|리더/;

/* 규칙·AI 가 낸 역할을 그 유형이 실제로 고를 수 있는 값으로 맞춘다.
   roleKind 가 'free' 면 자유 입력 칸이라 무엇이든 그대로 둔다. */
function normalizeRole(roleKind, role) {
  if (roleKind === 'stage' || roleKind === 'none') return null;
  if (roleKind === 'free') return role || MEMBER_ROLE.team;

  const allowed = ROLE_BY_KIND[roleKind] || ROLE_BY_KIND.team;
  if (role && allowed.includes(role)) return role;
  // 목록 밖 값(동아리에 '팀장' 등)은 주도성만 살려 같은 뜻의 값으로 바꾼다.
  const kind = ROLE_BY_KIND[roleKind] ? roleKind : 'team';
  return role && IS_LEADER.test(role) ? LEADER_ROLE[kind] : MEMBER_ROLE[kind];
}

const firstMatch = (rules, s) => (rules.find(([, re]) => re.test(s)) || [null])[0];

/* 성과 표현 → enum. AI 가 낸 성과를 원문 근거로 검증할 때 쓴다(casAnalyze).
   모델은 근거 없이 "전환, 정규직 합격" 같은 높은 배수의 성과를 지어내는 일이 있다
   (실측 5회 중 3회). 점수를 직접 밀어올리므로 원문에 근거가 있을 때만 인정한다. */
const outcomeFromText = text => (text ? firstMatch(OUTCOME_RULES, String(text)) : null);

/* "3개월", "1년", "6주" → cas.js 기간 enum. 범위("3~6개월")는 큰 쪽을 기준으로 본다. */
function parseDuration(line) {
  // 이미 enum 을 그대로 적은 경우가 가장 정확하다.
  const exact = Object.keys(CAS.DURATION_MULT).find(k => line.includes(k));
  if (exact) return exact;

  const nums = [...line.matchAll(/(\d+(?:\.\d+)?)\s*(년|개월|달|주|일)/g)];
  if (!nums.length) return null;

  // 여러 개면 가장 긴 기간을 활동 기간으로 본다("2026년" 같은 연도는 아래에서 걸러진다).
  const months = nums.map(([, n, unit]) => {
    const v = parseFloat(n);
    if (unit === '년') return v > 100 ? null : v * 12;   // 2026년 = 연도, 기간 아님
    if (unit === '주') return v / 4.3;
    if (unit === '일') return v / 30;
    return v;
  }).filter(v => v != null);
  if (!months.length) return null;

  /* 경계는 위쪽 포함으로 본다 — "3개월"이라고 적으면 '1~3개월'(라벨에 3개월이 들어있다)이
     맞지 물 건너 '3개월~6개월'이 아니다. */
  const m = Math.max(...months);
  if (m < 1)   return '1개월 미만';
  if (m <= 3)  return '1~3개월';
  if (m <= 6)  return '3개월~6개월';
  if (m < 12)  return '6개월~1년';
  return '1년이상';
}

/* 웹 스니펫에서 기간 뽑기 — 본문 파싱보다 훨씬 보수적으로 간다.
   검색 결과에는 "2026년", "10년 전통" 처럼 기간이 아닌 숫자가 널려 있어서, 그냥
   parseDuration 을 돌리면 해커톤이 '1년이상'이 되는 식으로 망가진다.
   그래서 (1) 기간을 뜻하는 문맥 단어 바로 옆의 숫자만 보고, (2) 여러 스니펫에서
   같은 값이 반복될 때(최빈값)만 채택한다. */
const DURATION_CONTEXT =
  /(?:기간|동안|진행|일정|운영|근무|참여)[^.\n]{0,12}?(\d+)\s*(년|개월|달|주|일|시간)|(\d+)\s*(년|개월|달|주|일|시간)\s*(?:간|동안|과정|코스|프로그램)/g;

function durationFromSnippets(snippets) {
  const votes = {};
  for (const s of snippets) {
    // 해커톤 표기 관용구 — 숫자 규칙으로는 안 잡힌다.
    if (/무박|\d+박\s*\d+일|\d+\s*시간\s*(?:동안|안에)/.test(s)) { votes['1개월 미만'] = (votes['1개월 미만'] || 0) + 1; continue; }

    for (const m of s.matchAll(DURATION_CONTEXT)) {
      const n = parseFloat(m[1] ?? m[3]);
      const unit = m[2] ?? m[4];
      if (!n || n > 60) continue;                       // 연도·과장된 숫자 제외
      const months = unit === '년' ? n * 12
                   : unit === '주' ? n / 4.3
                   : unit === '일' ? n / 30
                   : unit === '시간' ? 0
                   : n;
      const bucket = months < 1 ? '1개월 미만'
                   : months < 3 ? '1~3개월'
                   : months < 6 ? '3개월~6개월'
                   : months < 12 ? '6개월~1년' : '1년이상';
      votes[bucket] = (votes[bucket] || 0) + 1;
    }
  }
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  // 한 번만 등장한 값은 노이즈일 확률이 높다 → 통상 기간에 맡긴다.
  return ranked.length && ranked[0][1] >= 2 ? ranked[0][0] : null;
}

/* 유형이 잡혔는데 기간이 없을 때의 통상 기간.
   웹 검색이 실패하거나(오프라인) 검색으로도 못 알아낼 때의 마지막 근거다. */
const TYPICAL_DURATION = {
  internship: '1~3개월',        // 대기업 하계/동계 인턴 표준
  competition: '1~3개월',       // 접수~본선
  project: '3개월~6개월',       // 팀 프로젝트·캡스톤 한 학기
  research: '6개월~1년',
  extracurricular: '3개월~6개월',
  club: '6개월~1년',
  exchange: '6개월~1년',
  other: '1~3개월',
};

/* 유형보다 활동명이 더 많은 걸 말해줄 때가 있다(해커톤은 프로젝트지만 며칠짜리다).
   활동명 키워드가 맞으면 유형 기본값보다 이쪽을 우선한다. */
const TYPICAL_BY_KEYWORD = [
  [/해커톤|무박|아이디어톤/, '1개월 미만'],
  [/하계|동계|방학\s*인턴|체험형/, '1~3개월'],
  [/채용\s*연계|전환형/, '3개월~6개월'],
  [/캡스톤|졸업\s*작품/, '6개월~1년'],
  [/석사|박사/, '1년이상'],
];

const typicalDuration = a =>
  (TYPICAL_BY_KEYWORD.find(([re]) => re.test(a.name || '')) || [])[1]
  || TYPICAL_DURATION[a.type] || '1~3개월';

/* 활동명: 줄에서 기간·역할·성과처럼 다른 칸으로 들어갈 정보를 걷어낸 나머지.
   "삼성전자 하계인턴 1~3개월 팀원" → "삼성전자 하계인턴".
   범위 표기("1~3개월")를 앞 숫자만 지우면 "1~" 같은 찌꺼기가 남으므로 범위를 통째로 지운다. */
const NAME_NOISE_DURATION = [
  /\d+\s*(?:년|개월|달|주|일)?\s*~\s*\d+\s*(?:년|개월|달|주|일)/g,   // 1~3개월, 3개월~6개월
  /\d+\s*(?:년|개월|달|주|일)\s*(?:이상|미만|이내|간|동안|정도)?/g,   // 3개월, 1년이상
  /\d+\s*년\s*차/g,
];
const NAME_NOISE_WORDS =
  /팀장|팀원|임원진|운영진|회장|부회장|조장|동아리원|일반학회원|개인|단독|혼자|참가|참여|수상|입상|대상|최우수상|우수상|장려상|금상|은상|동상|특별상|논문\s*게재|깃헙|깃허브|github|오픈\s*소스|산출물|공개|발표|배포|출시|시연|포스터|결과물\s*없음|정규직\s*합격/gi;

/* '/' 도 구분자로 본다 — "카카오 인턴 / 6개월 / 팀원" 에서 기간·역할을 걷어내면
   "카카오 인턴 / /" 처럼 슬래시만 남는다. */
const tidy = s => s.replace(/[,·~\-–/]+/g, ' ').replace(/\s+/g, ' ').trim();

/* 목록 머리말 — "1)", "1.", "대표활동1)", "활동 2." 등. 활동명이 아니다. */
const LIST_PREFIX = /^\s*(?:대표\s*)?(?:활동)?\s*\d+\s*[.)]\s*/;

function extractName(line) {
  let s = line.replace(LIST_PREFIX, '');
  for (const re of NAME_NOISE_DURATION) s = s.replace(re, ' ');
  const withoutDuration = tidy(s);

  // 역할·성과 단어까지 지우면 이름이 통째로 사라지는 줄이 있다(예: "학부연구생").
  // 그럴 땐 한 단계 되돌린다 — 빈 이름으로 저장되는 것보다 낫다.
  const stripped = tidy(withoutDuration.replace(NAME_NOISE_WORDS, ' '));
  return stripped || withoutDuration || line.trim();
}

/* 한 줄 → 활동 1건. 유형을 못 찾으면 null(AI 에게 맡긴다). */
function parseLine(line) {
  const type = firstMatch(TYPE_RULES, line);
  if (!type) return null;

  const roleKind = (CAS.ACTIVITY_TYPES.find(t => t.id === type) || {}).roleKind;
  const duration = parseDuration(line);

  return {
    type,
    name: extractName(line),
    duration,                                   // null 이면 호출부가 웹/AI 로 보완
    role:  normalizeRole(roleKind, firstMatch(ROLE_RULES, line)),
    stage: roleKind === 'stage'
             ? (firstMatch(STAGE_RULES, line) || DEFAULT_STAGE) : null,
    outcome: firstMatch(OUTCOME_RULES, line) || DEFAULT_OUTCOME,
    assumed: !duration || !firstMatch(ROLE_RULES, line) || !firstMatch(OUTCOME_RULES, line),
    reason: '입력한 문장에서 직접 인식했습니다.',
    source: 'rule',
  };
}

/* 정량 스펙도 표기가 정형적이라 규칙으로 잡힌다. AI 결과보다 이 값을 우선한다. */
function parseQuant(text) {
  const gpaM   = text.match(/(\d\.\d{1,2})\s*\/\s*(\d\.\d{1,2})/)
              || text.match(/학점\s*[:은는]?\s*(\d\.\d{1,2})()/);
  const toeic  = text.match(/토익\s*(?:점수)?\s*[:은는]?\s*(\d{3,4})|TOEIC\s*(\d{3,4})/i);
  const toefl  = text.match(/토플\s*(\d{2,3})|TOEFL\s*(\d{2,3})/i);
  const opic   = text.match(/오픽\s*[:은는]?\s*(AL|IH|IM[123]?|IL|NH|NM|NL)|OPIc?\s*[:은는]?\s*(AL|IH|IM[123]?|IL|NH|NM|NL)/i);
  /* 토익스피킹 폼은 OPIc 과 같은 등급(NL~AL) 셀렉트다. 사람들은 "토스 Lv6"처럼
     레벨로 적는 일이 많아 등급으로 환산해 넣는다(공식 환산표 기준 근사). */
  const TS_BY_LEVEL = { 1: 'NL', 2: 'NL', 3: 'NM', 4: 'NH', 5: 'IL', 6: 'IM', 7: 'IH', 8: 'AL' };
  const tsGrade = text.match(/(?:토스|토익\s*스피킹|TOEIC\s*Speaking)\s*[:은는]?\s*(AL|IH|IM|IL|NH|NM|NL)/i);
  const tsLevel = text.match(/(?:토스|토익\s*스피킹)\s*(?:레벨)?\s*(?:Lv\.?)?\s*([1-8])\b/i);

  const num = m => (m ? Number(m[1] ?? m[2]) : null);
  const str = m => (m ? String(m[1] ?? m[2]).toUpperCase() : null);

  const lang = {
    opic: str(opic),
    toeic: num(toeic),
    toeicSpeaking: tsGrade ? str(tsGrade) : (tsLevel ? TS_BY_LEVEL[tsLevel[1]] : null),
    toefl: num(toefl),
  };
  const hasLang = Object.values(lang).some(v => v != null);

  return {
    gpa: gpaM ? Number(gpaM[1]) : null,
    gpaMax: gpaM && gpaM[2] ? Number(gpaM[2]) : null,
    certs: [],                                  // 자격증 명칭은 자유도가 커서 AI 결과를 쓴다
    lang: hasLang ? lang : null,
  };
}

/* ── 한 줄에 활동이 여러 개 들어 있는 경우 ──────────────────────────
   입력을 '\n' 로만 자르므로 줄글 한 문단은 통째로 한 줄이다. parseLine 은 그 줄에서
   먼저 맞는 유형 하나로 활동 1건을 만들어 버리는데, 그러면 이런 일이 벌어진다:

     "카카오에서 6개월 인턴 … 공모전에서 대상 … 2년 동안 동아리 스터디장"
       → 인턴십 1건 / 기간 '1년이상'(동아리 것) / 성과 '수상'(공모전 것)

   활동 3건이 1건으로 합쳐지고, 남의 기간·성과가 인턴 점수에 붙는다. 게다가
   unparsedLines 가 비어서 AI 는 호출되지도 않았다 — 못 읽었는데 "다 읽었다"고
   보고하는 셈이라, 에러 없이 조용히 틀린 점수가 나갔다.

   그래서 유형 신호가 2개 이상인 줄은 규칙이 단정하지 않고 AI 에게 넘긴다.
   다만 규칙 결과를 버리지는 않는다(fallbackActivities) — AI 키가 없거나 오프라인일 때
   그 줄이 통째로 사라지면 지금보다 나빠지기 때문이다. 호출부가 AI 성공 시에는 버리고
   실패 시에만 쓴다. */
function countTypeSignals(line) {
  return TYPE_RULES.filter(([, re]) => re.test(line)).length;
}

/* 텍스트 전체 → { activities, quant, unparsedLines, fallbackActivities }
   activities        — 규칙이 확신하는 것(줄 하나에 활동 하나)
   unparsedLines     — 규칙이 못 읽었거나 단정할 수 없는 줄. AI 가 맡을 몫이다.
   fallbackActivities— 단정하지 않기로 한 줄의 규칙 해석. AI 가 실패했을 때만 쓴다. */
function ruleParse(text) {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  const activities = [];
  const unparsedLines = [];
  const fallbackActivities = [];

  for (const line of lines) {
    const a = parseLine(line);
    if (a) {
      if (countTypeSignals(line) < 2) { activities.push(a); continue; }
      // 활동이 여러 개 섞인 줄 — 규칙 해석은 예비로만 남기고 AI 에게 맡긴다.
      fallbackActivities.push({ ...a, assumed: true });
      unparsedLines.push(line);
      continue;
    }

    /* "토익 920 오픽 IH 학점 4.1/4.5" 같은 정량 전용 줄을 AI 에 넘기면
       type='other' 짜리 가짜 활동을 만들어 낸다. 정량으로 읽힌 줄은 여기서 끝낸다. */
    const q = parseQuant(line);
    if (q.gpa != null || q.lang) continue;

    if (line.length > 3) unparsedLines.push(line);
  }
  return { activities, quant: parseQuant(text), unparsedLines, fallbackActivities };
}

module.exports = { ruleParse, countTypeSignals, parseDuration, outcomeFromText, durationFromSnippets, typicalDuration, normalizeRole, TYPICAL_DURATION, DEFAULT_ROLE, DEFAULT_STAGE, DEFAULT_OUTCOME };
