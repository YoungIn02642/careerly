/* 규칙 파서 — 특히 "한 줄에 활동이 여러 개" 케이스.

   이 테스트가 생긴 이유: 줄글 한 문단을 넣으면 활동 3건이 인턴십 1건으로 합쳐지고
   동아리의 기간('2년')과 공모전의 성과('대상')가 인턴 점수에 붙었다. 게다가
   unparsedLines 가 비어서 AI 호출조차 되지 않아, 에러 없이 조용히 틀린 점수가 나갔다. */
const { ruleParse, countTypeSignals, parseDuration, outcomeFromText } = require('../backend/src/spec-parse.js');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

console.log('── 1. 유형 신호 세기 ──');
ok('단일 활동 = 1', countTypeSignals('삼성전자 하계인턴 3개월 팀원') === 1);
ok('인턴+공모전+동아리 = 3', countTypeSignals('카카오 인턴을 했고 공모전에 나갔고 동아리 스터디장') === 3,
   `→ ${countTypeSignals('카카오 인턴을 했고 공모전에 나갔고 동아리 스터디장')}`);
ok('활동 없는 줄 = 0', countTypeSignals('학점 4.1 / 4.5, 토익 875') === 0);

console.log('\n── 2. 줄 단위 구조화 입력 (기존 동작 유지) ──');
const lines = ruleParse('카카오 인턴 / 6개월 / 팀원\n교내 창업 공모전 대상 / 3개월 / 팀장\n코딩 동아리 스터디장 / 2년 / 임원진\n학점 4.1 / 4.5, 토익 875');
ok('활동 3건을 규칙이 확정', lines.activities.length === 3, `→ ${lines.activities.length}건`);
ok('AI 호출 불필요', lines.unparsedLines.length === 0);
ok('예비 해석 없음', lines.fallbackActivities.length === 0);
ok('유형 순서 정확', lines.activities.map(a => a.type).join(',') === 'internship,competition,club',
   `→ ${lines.activities.map(a => a.type).join(',')}`);
ok('인턴 기간이 자기 줄의 값', lines.activities[0].duration === '3개월~6개월', `→ ${lines.activities[0].duration}`);
ok('인턴 성과가 옆줄 수상에 오염되지 않음', lines.activities[0].outcome === '결과물 없음', `→ ${lines.activities[0].outcome}`);
ok('정량은 전체 텍스트에서 파싱', lines.quant.gpa === 4.1 && lines.quant.lang.toeic === 875,
   `→ gpa ${lines.quant.gpa}, toeic ${lines.quant.lang && lines.quant.lang.toeic}`);

console.log('\n── 3. 줄글 한 문단 (회귀 방지) ──');
const prose = ruleParse('저는 3학년 여름방학에 카카오에서 6개월간 인턴을 하며 백엔드 개발을 했고, '
  + '교내 창업 공모전에 나가서 대상을 받았습니다. 그리고 2년 동안 코딩 동아리에서 스터디장을 맡았습니다. '
  + '학점은 4.1이고 토익은 875점입니다.');
ok('규칙이 단정하지 않음', prose.activities.length === 0, `→ ${prose.activities.length}건`);
ok('AI 에게 넘긴다', prose.unparsedLines.length === 1, `→ unparsedLines ${prose.unparsedLines.length}`);
ok('예비 해석은 남겨둔다(AI 실패 대비)', prose.fallbackActivities.length === 1);
ok('예비 해석은 추정 표시', prose.fallbackActivities[0].assumed === true);
ok('정량은 줄글에서도 정상', prose.quant.gpa === 4.1 && prose.quant.lang.toeic === 875,
   `→ gpa ${prose.quant.gpa}, toeic ${prose.quant.lang && prose.quant.lang.toeic}`);

console.log('\n── 4. 한 문장에 활동 둘 ──');
const two = ruleParse('삼성전자 하계인턴 3개월과 캡스톤 프로젝트 팀장');
ok('규칙이 단정하지 않음', two.activities.length === 0);
ok('AI 에게 넘긴다', two.unparsedLines.length === 1);

console.log('\n── 5. 정량 전용 줄은 활동을 만들지 않는다 ──');
const q = ruleParse('토익 920 오픽 IH\n학점 4.1/4.5');
ok('활동 0건', q.activities.length === 0);
ok('AI 호출 없음', q.unparsedLines.length === 0);
ok('어학 파싱됨', q.quant.lang.toeic === 920 && q.quant.lang.opic === 'IH');

console.log('\n── 6. 목록 머리말이 활동명·역할을 오염시키지 않는다 ──');
/* "대표활동1)" 의 '대표'가 ROLE_RULES 의 팀장 규칙에 걸려, 팀원이라 적어도 팀장이 됐다.
   활동명에는 구분자 '/' 가 찌꺼기로 남았다("카카오 인턴 / /"). */
const listed = ruleParse('대표활동1) 카카오 인턴 / 6개월 / 팀원');
ok('머리말이 활동명에서 제거됨', listed.activities[0].name === '카카오 인턴', `→ "${listed.activities[0].name}"`);
ok('슬래시 찌꺼기 없음', !listed.activities[0].name.includes('/'), `→ "${listed.activities[0].name}"`);
ok('적어 준 역할이 유지됨(팀원)', listed.activities[0].role === '팀원', `→ ${listed.activities[0].role}`);
ok('진짜 팀장은 여전히 잡힌다', ruleParse('1) 캡스톤 프로젝트 6개월 팀장').activities[0].role === '팀장');
ok('학생 대표도 팀장', ruleParse('1) 학과 프로젝트 대표 3개월').activities[0].role === '팀장');
ok('"활동 2." 머리말도 처리', ruleParse('활동 2. 교내 창업 공모전 대상').activities[0].name === '교내 창업 공모전',
   `→ "${ruleParse('활동 2. 교내 창업 공모전 대상').activities[0].name}"`);

console.log('\n── 7. 기간 경계는 위쪽 포함 (라벨이 겹치는 구간) ──');
/* '3개월~6개월'과 '6개월~1년' 이 둘 다 "6개월"을 포함해 모델이 구간을 갈라 골랐다.
   구간 선택은 모델이 아니라 이 함수가 한다(casAnalyze 가 durationText 를 여기로 넘긴다). */
ok('"6개월간" → 3개월~6개월', parseDuration('6개월간') === '3개월~6개월', `→ ${parseDuration('6개월간')}`);
ok('"3개월"   → 1~3개월',     parseDuration('3개월') === '1~3개월', `→ ${parseDuration('3개월')}`);
ok('"1년"     → 1년이상',     parseDuration('1년') === '1년이상', `→ ${parseDuration('1년')}`);
ok('"2년"     → 1년이상',     parseDuration('2년') === '1년이상');
ok('"8개월"   → 6개월~1년',   parseDuration('8개월') === '6개월~1년', `→ ${parseDuration('8개월')}`);
ok('기간 표현이 없으면 null',  parseDuration('카카오 인턴') === null);

console.log('\n── 8. 성과는 원문 근거가 있을 때만 (점수 배수를 직접 올린다) ──');
/* 모델이 근거 없이 "전환, 정규직 합격"을 붙여 인턴 점수를 144 → 168 로 부풀렸다(5회 중 3회).
   casAnalyze 가 이 함수로 원문 근거를 검증한다. */
ok('"대상을 받았습니다" → 수상', outcomeFromText('대상을 받았습니다') === '수상');
ok('"정규직 전환됐습니다" → 전환', outcomeFromText('정규직 전환됐습니다') === '전환, 정규직 합격');
ok('"백엔드 개발을 했고" → 근거 아님', outcomeFromText('백엔드 개발을 했고') === null);
ok('빈 근거 → null', outcomeFromText('') === null && outcomeFromText(null) === null);
ok('논문 게재 → 논문', outcomeFromText('SCI 학술지에 게재') === '논문');

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
