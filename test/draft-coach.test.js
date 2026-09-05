/* AI 초안 프롬프트 틀(P.C.R.O) 검사.

   모델 호출은 하지 않는다. 검사할 것은 "모델에 무엇을 시키는가"와 "모델 답을 어떻게
   믿는가" 두 가지이고, 둘 다 순수 함수라 외부 호출 없이 확인할 수 있다.
   프롬프트가 무너지면(지어내지 말라는 제약이 빠지면) 화면에는 멀쩡해 보이는 거짓
   문장이 나가므로, 이 검사가 그 회귀를 막는다. */
const DRAFT = require('../backend/src/draft-coach.js');
const GUIDE = require('../backend/src/cover-guide.js');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const base = {
  company: '삼성전자',
  jobTitle: 'DX 데이터 마케팅',
  competency: '데이터 분석',
  reads: '숫자를 다룰 줄 아는지가 아니라 무엇을 문제로 봤는지를 봅니다.',
  quotes: ['데이터를 근거로 문제를 정의하고 개선안을 제안할 수 있는 분'],
  frame: '어떤 데이터를 왜 봤는지 → 문제 정의 → 개선안 기준 → 숫자로 확인된 변화',
  question: '직무 수행에 필요한 역량을 갖추기 위해 노력한 경험을 서술해 주십시오.',
  activities: [
    { name: '교내 마케팅 공모전', typeLabel: '대외활동', duration: '3개월', role: '팀장', outcome: '최우수상' },
    { name: '학생회 회계', typeLabel: '교내활동', duration: '6개월', role: '회계', outcome: '결과물 없음' },
  ],
  limit: 700,
};

/* ── P.C.R.O 네 조각이 다 들어가야 한다 ─────────────────────── */
/* p 는 정성스펙을 안 고른(0개) 프롬프트다 — 이제 STAR 를 강요하지 않는다(2026-08-31).
   STAR 규칙(4·10~14·starRules)은 경험을 고른 pS 에서만 검사한다. */
const p = DRAFT.buildPrompt(base);
const pS = DRAFT.buildPrompt({ ...base, star: { S: '상황을 적음', T: '과제를 적음', A: '행동을 적음', R: '결과 수치를 적음' } });
ok('Context / Restriction / Output 세 구획을 만든다',
   p.includes('# Context') && p.includes('# Restriction') && p.includes('# Output'));
ok('Persona 는 시스템 프롬프트가 맡는다 (인사담당자 + 현업)',
   /인사담당자/.test(DRAFT.SYSTEM) && /현업/.test(DRAFT.SYSTEM));

ok('회사·직무·문항·역량을 Context 에 넣는다',
   p.includes('삼성전자') && p.includes('DX 데이터 마케팅')
   && p.includes('데이터 분석') && p.includes('노력한 경험'));
ok('공고 원문 근거를 그대로 넘긴다 (역량의 출처가 프롬프트에도 남는다)',
   p.includes('데이터를 근거로 문제를 정의'));

/* ── 지어내기 금지는 이 기능의 존재 조건이다 ───────────────── */
ok('모르는 값만 대괄호로 비우라고 지시한다', /대괄호로 비운다/.test(p));
/* 실측: '지어내지 마라'만 강하게 걸었더니 **아는 값까지** 대괄호로 비워서 한 문단에
   빈칸이 13개 나왔다(기간·역할·성과가 주어졌는데도). 아는 것은 쓰라고 같이 말해야 한다. */
ok('아는 값은 그대로 쓰라고 같이 지시한다', /그대로 써라/.test(p));
ok('빈칸 개수에 상한을 준다', /최대 4개/.test(p));
/* 실측: 안내 문구를 '[대괄호]로 남겨라'라고 썼더니 모델이 그 말을 그대로 베껴
   '[대괄호]명의 팀원' 같은 문장을 냈다. 무엇을 채울지 알 수 없는 빈칸은 쓸모가 없다. */
ok('대괄호 안에 채울 항목 이름을 적으라고 예시까지 준다',
   /\[팀원 수\]/.test(p) && /\[팀원 수\]/.test(DRAFT.SYSTEM));
ok('안내어를 그대로 쓰지 말라고 못 박는다', /그대로 쓰면 안 된다/.test(DRAFT.SYSTEM));
ok('시스템 프롬프트도 지어내기를 막는다',
   /지어내지 마라/.test(DRAFT.SYSTEM) && /하나도 없는 답은 틀린 답/.test(DRAFT.SYSTEM));

/* ── 사전을 프롬프트에 다시 쓰지 않고 읽어 온다 ─────────────── */
ok('상투어 금지 목록을 cover-guide 사전에서 가져온다',
   p.includes(GUIDE.CLICHES[0].term) && p.includes(GUIDE.CLICHES[1].term));
ok('AI 흔적 표현도 같은 사전에서 가져온다', p.includes(GUIDE.AI_TELLS[0].term));
ok('STAR 네 단계를 제약으로 넣는다 (경험을 고른 경우)',
   GUIDE.STAR.every(s => pS.includes(s.label)));
ok('역량 이름을 문장에 그대로 쓰지 말라고 막는다', /역량 이름/.test(p));
ok('글자수 제한을 넘긴다', p.includes('700자'));
/* 실측으로 대괄호 안에 일본어가 섞여 나온 적이 있다(‘[どこ에서]’). 그대로 제출되면 사고다. */
ok('한국어로만 쓰라는 제약이 있다', /한국어로만/.test(p));

/* ── 정성스펙을 안 고르면(0개) 활동을 끌어들이지 않는다 (사용자 지적 2026-09-01) ──
   예전에는 안 골라도 활동 전체를 프롬프트에 실어, 모델이 그 활동으로 [과제명]·[개선 기간]
   빈칸을 지어내 성취담을 만들었다(지원동기·포부에 안 고른 스펙이 섞임). 안 골랐으면 활동을
   아예 주지 않고 골격으로 쓴다. base 는 picks·star 가 없으므로 p 가 곧 '안 고른' 경우다. */
ok('정성스펙을 안 고르면 활동 목록을 넣지 않는다',
   !p.includes('교내 마케팅 공모전') && !p.includes('지원자가 실제로 한 활동'));
ok('정성스펙을 안 고르면 골격에 맞춰 쓰고 비우라고 한다',
   /정성스펙\)을 고르지 않았다/.test(p) && /지어내지 말고 대괄호로 비운다/.test(p));

ok('빈 필드는 아예 넣지 않는다 (모델이 "없음"을 문장에 쓰지 않게)',
   !DRAFT.buildPrompt({ ...base, jobTitle: '', question: '' }).includes('지원 직무:'));
/* 실측: 가운뎃점으로만 이으면 모델이 어느 조각이 활동 '이름'인지 몰라서
   "3개월에서…", "대외활동 프로젝트에서…" 로 문단을 시작했다(3회 중 3회).
   항목 이름을 붙여 넘기면 이름을 정확히 집어 쓴다. */
ok('활동은 항목 이름을 붙여 넘긴다',
   DRAFT.activityLine(base.activities[0])
     === '이름: 교내 마케팅 공모전 / 종류: 대외활동 / 기간: 3개월 / 역할: 팀장 / 성과: 최우수상',
   `→ ${DRAFT.activityLine(base.activities[0])}`);
ok('결과물이 비어 있는 활동은 그 항목만 빠진다',
   DRAFT.activityLine(base.activities[1]) === '이름: 학생회 회계 / 종류: 교내활동 / 기간: 6개월 / 역할: 회계');
/* 경험을 고르면(pS 는 star 가 있어 hasStar) 그 활동 이름을 문단에 그대로 쓰라고 못 박는다. */
ok('고른 경험이 있으면 활동 이름을 그대로 쓰라고 못 박는다', /"교내 마케팅 공모전"/.test(pS));

/* ── 응답 정리 ──────────────────────────────────────────────── */
const good = DRAFT.parseDraft(`설명입니다.
\`\`\`json
{"draft":"교내 마케팅 공모전에서 [기간] 동안 팀장을 맡아 열정을 가지고 분석했습니다. 그 결과 [수치]를 통해 개선했고 이를 통해 배웠으며 이를 통해 성장했습니다.",
 "blanks":["기간을 채우세요","수치를 채우세요"],
 "review":["결과가 숫자로 없다"]}
\`\`\``);
ok('코드펜스와 앞말이 붙어도 JSON 만 뽑아낸다', good.draft.startsWith('교내 마케팅'));
ok('빈칸 수는 모델 말이 아니라 문장에서 직접 센다', good.blankCount === 2, `→ ${good.blankCount}`);
ok('생성된 초안도 상투어 검사를 통과시킨다',
   good.cliches.some(c => c.term === '열정을 가지고'));
/* '통해' 는 repeat:2 라 세 번부터 걸린다 — 사전의 문턱을 그대로 따른다는 확인이다 */
ok('생성된 초안의 AI 흔적도 센다 (사전의 반복 문턱을 그대로 쓴다)',
   good.aiTells.some(t => t.term === '통해'));
ok('blanks·review 는 배열로 정리된다',
   Array.isArray(good.blanks) && good.blanks.length === 2 && good.review.length === 1);

/* ── 한국어가 아닌 글자 감지 ────────────────────────────────
   실측(8회 반복): 일본어 '[どこ에서]', 베트남어 'cụ thể', 중국어 '活动' 이 1회꼴로
   섞였다. 자소서에 다른 언어가 들어가면 그대로 제출되어 사고가 되므로 서버가 잡는다. */
ok('일본어가 섞이면 잡는다', DRAFT.hasForeign({ draft: '[どこ에서] 분석했습니다.' }));
ok('중국어가 섞이면 잡는다', DRAFT.hasForeign({ draft: '活动을 수행했습니다.' }));
ok('베트남어가 섞이면 잡는다', DRAFT.hasForeign({ draft: '숫자로 cụ thể하게 썼습니다.' }));
ok('review·blanks 에 섞여도 잡는다',
   DRAFT.hasForeign({ draft: '정상입니다.', review: ['结果가 없습니다'] }));
ok('한글만 있으면 통과', !DRAFT.hasForeign({ draft: '교내 마케팅 공모전에서 팀장을 맡았습니다.' }));
/* 영문 약어는 자소서에도 정상적으로 들어간다 — 막으면 안 된다. */
ok('영문 약어는 통과시킨다',
   !DRAFT.hasForeign({ draft: 'SQL 과 AI 도구를 써서 MOU 성과를 냈습니다.', blanks: ['[전환율 %]'] }));

let threw = null;
try { DRAFT.parseDraft('JSON 이 아닌 답'); } catch (e) { threw = e; }
ok('JSON 이 아니면 초안을 주지 않고 실패한다', threw !== null);

threw = null;
try { DRAFT.parseDraft('{"draft":"  ","blanks":[]}'); } catch (e) { threw = e; }
ok('draft 가 비어 있으면 실패로 본다', threw !== null);

ok('review 가 없어도 깨지지 않는다',
   DRAFT.parseDraft('{"draft":"한 문장입니다."}').review.length === 0);


// ── STAR 입력 · 되짚기 · 예시 베낌 검사 ──────────────────────────
console.log('\n── STAR 입력을 프롬프트에 싣는다 ──');

const STAR_IN = {
  S: '기획과 개발이 정렬 기준을 다르게 알고 있었습니다.',
  T: '화면 정의서를 제가 맡고 있었습니다.',
  A: '회의로 맞췄는데 또 어긋나서 정의서 형식을 바꿨습니다.',
  R: '재작업이 한 번으로 줄었습니다.',
};

const pStar = DRAFT.buildPrompt({ ...base, star: STAR_IN });

ok('STAR 에 적은 문장이 프롬프트에 그대로 들어간다',
   pStar.includes('기획과 개발이 정렬 기준을 다르게 알고 있었습니다.'));
ok('칸 이름을 붙여서 넘긴다 (어느 칸인지 모르면 순서를 못 지킨다)',
   pStar.includes('S(상황):') && pStar.includes('A(행동):'));
/* 활동 목록(이름·기간·역할)만으로는 '무슨 일이 있었는지' 를 알 수 없다.
   STAR 가 있으면 그쪽이 본문이라고 못 박아야 모델이 활동 분류로 문단을 만들지 않는다. */
ok('STAR 가 있으면 그것이 유일한 사실이라고 못 박는다',
   pStar.includes('유일한 사실'));
ok('STAR 가 있으면 활동 목록은 참고로 내린다',
   pStar.includes('활동 이름을 정확히 쓰기 위한 참고'));

const pEmpty = DRAFT.buildPrompt({ ...base, star: { S: '   ', T: '', A: '', R: '' } });
ok('빈 칸만 있는 STAR 는 없는 것으로 본다', !pEmpty.includes('유일한 사실'));

/* 정성스펙을 안 고른(0개) 문항은 STAR 를 강요하지 않는다(사용자 지시 2026-08-31) —
   지원동기·포부에 성취담 STAR 가 나오던 문제를 여기서 끊는다. */
ok('정성스펙을 안 고르면 STAR 를 강요하지 않는다',
   p.includes('특정 경험(STAR)을 고르지 않았다') && p.includes('성취담으로 억지로 만들지 마라'));

console.log('\n── 두루뭉술한 문단을 막는 규칙 ──');
/* 사용자 지적: "노력했고 잘 마무리했습니다" 류가 나왔다. 막으려는 것은 문체가 아니라
   정보의 부재라, 셀 수 있는 조건으로 적어야 모델이 지켰는지 스스로 판정할 수 있다. */
ok('행동에 시도를 두 가지 이상 쓰라고 못 박는다', pS.includes('시도를 두 가지 이상'));
ok('첫 시도가 왜 막혔는지를 요구한다', pS.includes('통하지 않았는지'));
ok('문제의 "왜" 까지 요구한다', pS.includes('어떻게 됐는지'));
ok('결과가 성공이 아니어도 된다고 알려준다', pS.includes('성공이 아니어도'));
ok('"노력했습니다" 류를 금지한다',
   p.includes('노력했습니다') && p.includes('잘 마무리했습니다'));
ok('실제로 나왔던 나쁜 문단을 예로 박아 둔다', pS.includes('소통을 하려고 노력했고'));

console.log('\n── 고친 예(good)는 프롬프트에 넣지 않는다 ──');
/* 실측: good 을 넣었더니 모델이 그것을 양식이 아니라 내용으로 읽고 통째로 베꼈다.
   사용자가 겪지 않은 사건('화면 정의서'·'2주차 중간 점검')이 자소서에 사실처럼 적혔다. */
const goodS = GUIDE.starWrite('S').good;
ok('good 문장이 프롬프트에 없다', !p.includes(goodS),
   '넣으면 모델이 베껴서 없는 사건을 지어낸다');
ok('대신 bad 는 넣는다 (베껴도 다른 규칙에 걸린다)', pS.includes(GUIDE.starWrite('S').bad));
ok('must(갖춰야 할 조건)를 넣는다', pS.includes(GUIDE.starWrite('A').must[0]));

console.log('\n── 예시를 베꼈는지 검사 ──');
ok('예시를 그대로 베끼면 잡는다', DRAFT.copiedFromExample(goodS) !== null);
ok('어느 칸에서 베꼈는지 알려준다', DRAFT.copiedFromExample(goodS).key === 'S');
ok('예시 일부만 섞여도 잡는다',
   DRAFT.copiedFromExample(`저는 ${goodS.slice(10, 40)} 그렇게 했습니다.`) !== null);
ok('내가 쓴 문장은 통과한다',
   DRAFT.copiedFromExample('교내 마케팅 공모전에서 팀장을 맡아 일정표를 다시 짰습니다.') === null);
/* ── 사용자가 직접 쓴 것은 베낌이 아니다 (실측으로 잡은 오탐) ──
   화면이 예시를 보여주고 "이렇게 쓰세요" 라고 시키므로, 비슷한 경험을 가진 사람은
   비슷하게 적는다. 그걸 베낌으로 보면 **멀쩡한 초안이 통째로 버려진다** —
   실제로 브라우저 확인에서 그렇게 됐다. 막으려는 건 지어내기지 닮음이 아니다. */
ok('사용자가 STAR 에 적은 대목은 베낌으로 치지 않는다',
   DRAFT.copiedFromExample(goodS, { S: goodS }) === null,
   '예시를 보고 자기 경험을 비슷하게 적은 사람의 초안을 버리면 안 된다');
ok('STAR 에 없는 대목만 걸러낸다',
   DRAFT.copiedFromExample(goodS, { S: '전혀 다른 이야기를 적었습니다.' }) !== null);
ok('빈 초안은 통과한다', DRAFT.copiedFromExample('') === null);
/* 문턱을 짧게 잡으면 흔한 표현이 걸린다. '프로젝트를 진행하면서' 가 11자다. */
ok('겹침 문턱이 12자 이상이다', DRAFT.COPY_MIN >= 12);

console.log('\n── 칸별 되짚기(coach) ──');
const withCoach = DRAFT.parseDraft(JSON.stringify({
  draft: '한 문단입니다.',
  coach: [
    { key: 'S', missing: '어떤 의견 차이였는지', ask: '무엇이 갈렸는지 적어 주세요' },
    { key: 'A', missing: '첫 방법이 왜 막혔는지', ask: '왜 안 통했나요' },
  ],
}));
ok('coach 를 읽어 온다', withCoach.coach.length === 2);
ok('키와 내용을 그대로 담는다',
   withCoach.coach[0].key === 'S' && withCoach.coach[1].key === 'A');

/* 화면이 key 로 STAR 입력칸을 찾아 붙인다. 엉뚱한 키는 어디에도 안 붙고 조용히 사라진다. */
const dirty = DRAFT.parseDraft(JSON.stringify({
  draft: '한 문단입니다.',
  coach: [
    { key: 'X', missing: '없는 칸' },
    { key: 's', missing: '소문자도 받는다' },
    { key: 'S', missing: '같은 칸 중복' },
    { key: 'T' },
  ],
}));
ok('S·T·A·R 가 아닌 키는 버린다', !dirty.coach.some(c => c.key === 'X'));
ok('소문자도 받는다', dirty.coach.some(c => c.key === 'S'));
ok('같은 칸은 한 번만 남긴다', dirty.coach.filter(c => c.key === 'S').length === 1);
ok('내용이 비면 버린다', !dirty.coach.some(c => c.key === 'T'));
ok('coach 가 없어도 깨지지 않는다',
   DRAFT.parseDraft('{"draft":"한 문장입니다."}').coach.length === 0);

/* 지어내기와 비워두기가 부딪히면 비워두기가 이긴다 — 겪지 않은 일을 자소서에 적는 것이
   두루뭉술한 문단보다 나쁘다. */
ok('STAR 에 없는 것을 지어내지 말라고 못 박는다',
   pStar.includes('언제나 비워두기가 맞다'));

/* ══ 지원동기 문단 ══════════════════════════════════════════
   STAR 초안과 축이 다르다 — 증명 대상이 내 경험이 아니라 "왜 이 회사인가" 이고,
   지어내기의 위험도 하나 더 있다: **회사가 하지 않은 일**. */
console.log('\n── 지원동기 프롬프트 ──');
const EV = [
  { kind: 'biz',  text: '도료 및 관련제품을 생산·판매하고 있습니다', source: '사업보고서 「1. 사업의 개요」' },
  { kind: 'fact', text: '매출액 5,986억원 · 전년비 −6.9%', source: '2025년 사업보고서' },
  { kind: 'news', text: '항균 도료 신제품 출시', source: '2026-05-12 · example.com' },
];
/* 지원동기도 '고른 정성스펙(0~3개)' 을 재료로 받는다(2026-09-01). 안 고르면 회사 근거만으로 쓴다. */
const PICKS = [{ name: '커머스 데이터 인턴', star: { S: '상황을 적음', T: '과제를 적음', A: '행동을 적음', R: '결과 수치를 적음' } }];
const pM = DRAFT.buildMotivePrompt({
  company: '강남제비스코', jobTitle: '백엔드 개발자',
  question: '지원 동기와 입사 후 포부를 기술해 주십시오.',
  evidence: EV, picks: PICKS, limit: 600,
});

ok('회사와 문항이 들어간다', pM.includes('강남제비스코') && pM.includes('입사 후 포부'));
ok('담아 온 근거가 전부 들어간다', EV.every(e => pM.includes(e.text)));
ok('출처까지 같이 넣는다', pM.includes('사업보고서 「1. 사업의 개요」'),
   '출처 없이 나온 문단은 면접에서 되물으면 답할 수 없다');
ok('근거 종류를 이름으로 적는다', pM.includes('사업 내용 —') && pM.includes('최근 기사 —'));
/* ── 실측으로 잡은 것 ────────────────────────────────────────
   종류 이름을 `[사업 내용]` 으로 감쌌더니 모델이 그 대괄호를 **빈칸 표기로 읽고**
   초안에 "귀사는 현재 [사업 내용]을 진행하고 있으며" 라고 썼다. 담아 온 사실을
   쓰라고 준 재료가 도리어 빈칸이 된 것이다.
   이 프롬프트에서 대괄호는 "여기를 비워라" 하나만 뜻해야 한다. */
ok('근거 목록에 대괄호를 쓰지 않는다',
   !pM.split('# Restriction')[0].split('\n').filter(l => l.trim().startsWith('- ')).some(l => l.includes('[')),
   '대괄호가 두 가지 뜻을 가지면 모델이 재료를 빈칸으로 읽는다');
ok('근거를 그대로 녹이라고 못 박는다', pM.includes('대괄호로 비우지 말고 그대로 문장에 녹여라'));
/* 최대만 걸어 뒀더니 빈칸 0개인 문단이 나왔다 — 그건 초안이 아니라 그대로 낼 수
   있는 대필이다. 대괄호가 이 기능의 대필 방지 장치라 최소도 걸어야 한다(16-2). */
ok('빈칸 최소 한 개를 요구한다', pM.includes('최소 한 곳을 반드시 대괄호로 비운다'));
ok('빈칸 상한도 그대로 있다', pM.includes('최대 4개'));
ok('근거 밖의 회사 사실을 금지한다', pM.includes('유일한 사실') && pM.includes('한 줄도 만들지 마라'));
ok('고른 경험(STAR)을 재료로 넣는다', pM.includes('커머스 데이터 인턴') && pM.includes('결과 수치를 적음'));

/* 지원동기가 무너지는 자리는 늘 같다 — 어느 회사에나 붙는 문장이다. */
ok('일반론으로 시작하지 말라고 적는다', pM.includes('어느 회사에나'));
ok('네 덩이 순서를 지시한다', pM.includes('입사 후 맡고 싶은 일'));
ok('상투 표현 목록을 넘긴다', pM.includes('비전에 공감'));
ok('한국어만 쓰게 한다', pM.includes('한국어로만'));
ok('coach 는 비운다', pM.includes('"coach": []'),
   'STAR 칸이 없는 문항이라 되짚기가 붙을 자리가 없다');
/* 규칙 번호가 어긋나면 모델이 "4번 규칙" 을 못 찾는다 — 조립할 때 다시 매긴다. */
ok('규칙 번호가 1부터 이어진다',
   pM.split('# Restriction')[1].split('# Output')[0].trim().split('\n')
     .filter(l => /^\d+\./.test(l)).map(l => parseInt(l, 10))
     .every((n, i) => n === i + 1));

/* 근거가 없으면 프롬프트 안에서도 '지어내지 말라' 가 유지돼야 한다. 라우트가
   400 으로 막지만, 프롬프트 자체가 안전한 편이 낫다. */
const pMEmpty = DRAFT.buildMotivePrompt({ company: '카카오', evidence: [], picks: [], limit: 600 });
ok('근거가 없으면 전부 비우라고 한다', pMEmpty.includes('전부 대괄호로 비워라'));
/* 정성스펙을 안 고르면 활동 이름을 지어내지 말고 [관련 경험]으로 비우라고 한다. */
ok('정성스펙을 안 고르면 경험을 지어내지 말라고 한다',
   pMEmpty.includes('지어내지 마라') && pMEmpty.includes('[관련 경험]'));
/* 안 고른 활동이 지원동기에 섞여 나오던 문제 — 고른 경험 블록이 없어야 한다. */
const pMNoPick = DRAFT.buildMotivePrompt({
  company: '강남제비스코', evidence: EV, picks: [], limit: 600,
});
ok('안 골랐으면 고른 경험 블록을 넣지 않는다', !pMNoPick.includes('고른 경험(STAR)'));

/* 사업보고서 문단은 수천 자다. 프롬프트가 길어지면 뒤쪽 Restriction 이 밀려서
   지어내기 금지 규칙이 잘린다 — 자르는 것은 라우트의 일이지만, 잘린 값이 들어와도
   프롬프트 모양이 깨지지 않아야 한다. */
const pLong = DRAFT.buildMotivePrompt({
  company: 'A', evidence: [{ kind: 'biz', text: '가'.repeat(700), source: 'x' }], activities: [], limit: 600,
});
ok('긴 근거가 와도 규칙이 뒤에 온다',
   pLong.indexOf('# Restriction') < pLong.indexOf('# Output')
   && pLong.includes('한국어로만'));

ok('근거 종류 이름이 4가지 다 있다',
   ['job', 'biz', 'fact', 'news'].every(k => DRAFT.KIND_LABEL[k]),
   'frontend/js/roadmap.js EVIDENCE_KINDS 의 label 과 같은 말이어야 한다');

console.log('\n── 내 AI 프롬프트 (사용자 지시 2026-09-05) ──');
/* 켜 두면 기본 규칙 대신 사용자 규칙이 들어간다. 바뀌는 것은 Restriction 뿐이고
   Context(사실)와 Output(JSON 계약)은 코드가 늘 붙인다 — 그 둘까지 사용자가 바꾸면
   각각 '다음 호출에서 덮여 무의미' 하거나 '파싱이 깨져 기능이 죽는다'. */
const cpBase = {
  company: '테스트', jobTitle: '개발', competencies: ['협업'],
  quotes: ['협업 경험 우대'], question: '협업 경험을 쓰시오', limit: 500,
  picks: [{ name: '프로젝트', star: { S: '상황', T: '과제', A: '행동', R: '결과' } }],
};
const pDefault = DRAFT.buildPrompt(cpBase);
const pCustom = DRAFT.buildPrompt({ ...cpBase, customRules: '1. 개조식으로 쓴다.' });

ok('customRules 가 규칙 자리에 들어간다', pCustom.includes('1. 개조식으로 쓴다.'));
ok('기본 규칙은 밀려난다', !pCustom.includes('아래 표현은 쓰지 마라'));
ok('Context 는 그대로 붙는다', pCustom.includes('지원 회사: 테스트') && pCustom.includes('S(상황): 상황'));
ok('Output(JSON 계약) 은 그대로 붙는다', pCustom.includes('"draft"') && pCustom.includes('"blanks"'));
ok('빈 customRules 면 기본 규칙', DRAFT.buildPrompt({ ...cpBase, customRules: '   ' }) === pDefault);
ok('안 주면 기본 규칙', DRAFT.buildPrompt(cpBase) === pDefault);

/* 모달이 출발점으로 보여줄 기본 규칙 전문. 빈 칸에서 시작하면 무엇을 지우는지도 모른다. */
const tpl = DRAFT.defaultRules({ limit: 1000 });
ok('defaultRules 가 규칙을 돌려준다', tpl.length > 500, `→ ${tpl.length}자`);
ok('규칙 번호가 붙어 있다', /^1\./m.test(tpl));
ok('Context·Output 은 안 들어간다', !tpl.includes('# Output') && !tpl.includes('지원 회사:'));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
