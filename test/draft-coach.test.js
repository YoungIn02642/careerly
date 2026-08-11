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
const p = DRAFT.buildPrompt(base);
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
ok('STAR 네 단계를 제약으로 넣는다',
   GUIDE.STAR.every(s => p.includes(s.label)));
ok('역량 이름을 문장에 그대로 쓰지 말라고 막는다', /역량 이름/.test(p));
ok('글자수 제한을 넘긴다', p.includes('700자'));
/* 실측으로 대괄호 안에 일본어가 섞여 나온 적이 있다(‘[どこ에서]’). 그대로 제출되면 사고다. */
ok('한국어로만 쓰라는 제약이 있다', /한국어로만/.test(p));

/* 활동이 없으면 '없음'을 지어내는 대신 전부 빈칸으로 돌린다 */
const noAct = DRAFT.buildPrompt({ ...base, activities: [] });
ok('활동이 없으면 활동 자리까지 대괄호로 남기라고 한다',
   /활동 정보가 없다/.test(noAct) && /전부 대괄호/.test(noAct));

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
ok('활동 이름을 문단에 그대로 쓰라고 못 박는다', /"교내 마케팅 공모전"/.test(p));

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

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
