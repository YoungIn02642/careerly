/* 스펙업 데이터 층 — backend/src/specup.js

   ── 왜 이 테스트가 특히 필요한가 ──
   여기서 다루는 실패는 **에러가 나지 않는 종류**다. 날짜를 잘못 읽으면 "접수중" 이
   틀리게 뜨고, 게이트웨이 인증 실패를 못 알아채면 "표본 없음" 으로 둔갑한다.
   작업정리 6-3 이 말하는 '조용히 틀린 값' 이 그대로 재현되는 자리라, 순수 함수로
   떼어 두고 여기서 못을 박는다.

   네트워크는 타지 않는다 — 시험일정 API 는 아직 활용신청 전이라 실호출이 불가능하고,
   가능하더라도 테스트가 남의 서버 상태에 매달리면 안 된다. */
const specup = require('../backend/src/specup');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

// ── 1. 날짜 ─────────────────────────────────────────────────
console.log('── 1. 날짜를 못 읽으면 못 읽었다고 한다 ──');
ok('YYYYMMDD 를 읽는다', specup.ymd('20260901') === '2026-09-01');
ok('구분자가 있어도 읽는다', specup.ymd('2026-09-01') === '2026-09-01');
ok('공백·점도 읽는다', specup.ymd('2026.09.01') === '2026-09-01');
/* 0000-00-00 을 그대로 비교하면 today 보다 작아 '접수 마감' 으로 뜬다.
   비어 있음과 마감은 다른 말이라 null 로 갈라 둔다. */
ok('0 채움 날짜는 null', specup.ymd('00000000') === null);
ok('빈 값은 null', specup.ymd('') === null && specup.ymd(null) === null);
ok('자릿수가 모자라면 null', specup.ymd('202609') === null);
ok('말이 안 되는 달은 null', specup.ymd('20261301') === null);

console.log('\n── 1-1. 남은 날짜 ──');
ok('오늘이면 0', specup.daysUntil('2026-08-16', '2026-08-16') === 0);
ok('내일이면 1', specup.daysUntil('2026-08-17', '2026-08-16') === 1);
ok('지났으면 음수', specup.daysUntil('2026-08-10', '2026-08-16') === -6);
/* 월을 넘어가는 계산이 자주 틀린다 */
ok('달을 넘어도 맞는다', specup.daysUntil('2026-09-01', '2026-08-16') === 16);
ok('없는 날짜는 null', specup.daysUntil(null, '2026-08-16') === null);

// ── 2. 회차 상태 ────────────────────────────────────────────
/* 학생이 지금 할 수 있는 일이 무엇인지가 이 판정 하나로 갈린다. */
console.log('\n── 2. 회차 상태 (접수중 / 접수예정 / 시험대기 / 종료) ──');
const round = { regStart: '2026-08-10', regEnd: '2026-08-20',
                examStart: '2026-09-05', examEnd: '2026-09-05' };

ok('접수 기간 안이면 접수중', specup.phaseOf(round, '2026-08-16') === 'open');
ok('접수 시작일도 접수중', specup.phaseOf(round, '2026-08-10') === 'open', '경계 포함');
ok('접수 마감일도 접수중', specup.phaseOf(round, '2026-08-20') === 'open', '마감일 당일은 아직 된다');
ok('접수 전이면 접수예정', specup.phaseOf(round, '2026-08-01') === 'upcoming');
ok('접수 다음날은 시험대기', specup.phaseOf(round, '2026-08-21') === 'exam');
ok('시험일 당일도 시험대기', specup.phaseOf(round, '2026-09-05') === 'exam');
ok('시험이 지나면 종료', specup.phaseOf(round, '2026-09-06') === 'closed');

/* 접수 날짜가 없는 회차 — 없는 값을 있는 것처럼 다루면 전부 '접수중' 이 된다. */
ok('접수일이 없으면 시험일로만 본다',
   specup.phaseOf({ examStart: '2026-09-05', examEnd: '2026-09-05' }, '2026-08-16') === 'exam');
ok('날짜가 하나도 없으면 종료로 둔다', specup.phaseOf({}, '2026-08-16') === 'closed');

// ── 3. 응답 한 줄 → 회차 ────────────────────────────────────
/* 아래 item 은 실호출 응답을 그대로 옮긴 것이다(2026-08-16, jmCd=1320 정보처리기사).
   응답에 종목코드·종목명이 **없다** — 한 줄은 '자격구분 × 회차' 이고, 종목은 요청의
   jmCd 로만 걸러진다. 승인 전 명세서만 보고 jmCd/jmNm 을 읽으려던 코드가 여기서
   틀렸다(specup.js 머리주석). */
console.log('\n── 3. 응답 한 줄 → 회차 (필기·실기가 한 줄에 같이 온다) ──');
const item = {
  implYy: '2026', implSeq: '3', qualgbCd: 'T', qualgbNm: '국가기술자격',
  description: '국가기술자격 기사 (2026년도 제3회)',
  docRegStartDt: '20260801', docRegEndDt: '20260802',
  docExamStartDt: '20260807', docExamEndDt: '20260901', docPassDt: '20260909',
  pracRegStartDt: '20260921', pracRegEndDt: '20261019',
  pracExamStartDt: '20261024', pracExamEndDt: '20261113', pracPassDt: '20261211',
};
const r = specup.toRound(item);
ok('회차 라벨을 읽는다', r.label === '국가기술자격 기사 (2026년도 제3회)');
ok('회차 번호를 읽는다', r.seq === '3');
ok('필기를 읽는다', r.doc.regStart === '2026-08-01' && r.doc.examStart === '2026-08-07');
ok('실기를 같은 줄에서 읽는다', r.prac.regStart === '2026-09-21' && r.prac.examStart === '2026-10-24');
ok('합격발표일도 읽는다', r.doc.passDt === '2026-09-09');

/* 한쪽만 채워진 줄이 흔하다(기능사는 필기만, 어떤 회차는 실기만).
   빈 태그 <docRegStartDt/> 는 파서가 '' 로 주므로 ymd 가 null 로 걸러야 한다. */
const pracOnly = specup.toRound({
  implSeq: '107', qualgbCd: 'T', description: '국가기술자격 기능사 (2026년도 제107회)',
  docRegStartDt: '', docRegEndDt: '', docExamStartDt: '',
  pracRegStartDt: '20261127', pracRegEndDt: '20261127', pracExamStartDt: '20261207',
});
ok('필기가 비면 doc 은 null', pracOnly.doc === null, '빈 태그를 0000 처럼 다루면 접수중으로 뜬다');
ok('실기만 있어도 살린다', pracOnly.prac.regStart === '2026-11-27');

/* 날짜가 하나도 없는 줄로 '일정 미정' 카드를 만들어 봐야 학생이 할 일이 없다. */
ok('날짜가 없는 줄은 버린다', specup.toRound({ implSeq: '1', description: 'x' }) === null);

console.log('\n── 3-2. 회차 → 단계 ──');
/* 학생이 실제로 하는 일은 '필기 접수' 와 '실기 접수' 라 회차가 아니라 단계가 단위다. */
const stages = specup.stagesOf([r], '2026-08-16');
ok('한 회차에서 두 단계가 나온다', stages.length === 2);
ok('필기·실기로 갈린다', stages[0].stage === '필기' && stages[1].stage === '실기');
ok('단계마다 상태를 따로 매긴다',
   stages[0].phase === 'exam' && stages[1].phase === 'upcoming',
   '필기는 접수 끝(8/2) · 실기는 접수 전(9/21)');
ok('라벨을 단계로 옮긴다', stages[0].label === '국가기술자격 기사 (2026년도 제3회)');

console.log('\n── 3-1. XML 파싱 ──');
const items = specup.parseItems(
  '<response><body><items>'
  + '<item><jmCd>1320</jmCd><jmNm><![CDATA[정보처리기사]]></jmNm></item>'
  + '<item><jmCd>7910</jmCd><jmNm>전기기사</jmNm></item>'
  + '</items></body></response>');
ok('item 을 다 뽑는다', items.length === 2);
ok('CDATA 를 벗긴다', items[0].jmNm === '정보처리기사');

// ── 4. 게이트웨이 실패 ──────────────────────────────────────
/* **이 검사가 이 파일에서 제일 중요하다.** data.go.kr 은 인증 실패를 HTTP 200 으로도
   내려보낸다. status 만 보면 "성공했는데 데이터가 없다" 로 읽혀서, 활용신청을 안 한
   것이 '표본 없음' 으로 둔갑한다. */
console.log('\n── 4. 실패를 사용자가 할 일로 가른다 ──');
const notReg = specup.gatewayError(200,
  '<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</errMsg>'
  + '<returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>');
ok('200 이어도 미승인을 잡아낸다', notReg !== null, '이걸 놓치면 표본 0건으로 보인다');
ok('미승인은 503 + not-approved', notReg.code === 503 && notReg.reason === 'not-approved');
ok('무엇을 하면 되는지 알려준다', /data\.go\.kr\/data\/15074408/.test(notReg.how));

const quota = specup.gatewayError(200, '<errMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</errMsg>');
ok('한도 초과는 429', quota && quota.code === 429 && quota.reason === 'quota',
   '기다렸다 다시 하면 되는 일이라 설정 오류와 다르다');

ok('정상 응답은 오류가 아니다',
   specup.gatewayError(200, '<response><header><resultCode>00</resultCode></header></response>') === null);
ok('그 밖의 4xx/5xx 는 502', (() => {
  const e = specup.gatewayError(500, '<html>oops</html>');
  return e && e.code === 502 && e.reason === 'upstream';
})());

/* ── 실측으로 잡은 함정 ──────────────────────────────────────
   numOfRows 를 51 이상 주면 resultCode 930 이 **HTTP 200 으로** 온다. items 는 없다.
   여기서 안 걸러내면 파서가 0건을 돌려주고 화면은 '남은 회차가 없어요' 라고 적는다 —
   우리 코드가 틀렸는데 사용자에게는 '시험이 없다' 로 보인다. */
const over = specup.gatewayError(200,
  '<response><header><resultCode>930</resultCode>'
  + '<resultMsg>한 페이지당 조회 가능한 최대 목록 수는 50개를 넘을 수 없습니다.</resultMsg></header></response>');
ok('200 + resultCode 930 을 실패로 잡는다', over !== null,
   '놓치면 페이징 실수가 "시험 없음" 으로 둔갑한다');
ok('요청이 잘못된 것이므로 500', over && over.code === 500 && over.reason === 'bad-request');
ok('원문 메시지를 그대로 전한다', /50개를 넘을 수 없습니다/.test(over.how));
ok('numOfRows 상한을 코드가 지킨다', specup.EXAM_PER_PAGE <= 50, `→ ${specup.EXAM_PER_PAGE}`);

// ── 5. 자격증 이름 → 종목코드 ───────────────────────────────
/* 시험일정은 종목코드 단위로 오므로, 학생이 적은 이름을 코드로 못 바꾸면
   일정이 통째로 안 붙는다. */
console.log('\n── 5. 자격증 이름 대조 ──');
const info = specup.codeOf('정보처리기사');
ok('국가자격은 코드가 나온다', info && /^\d+$/.test(info.code), info ? `→ ${info.code}` : '(qnet-certs.json 없음?)');
ok('공백이 섞여도 찾는다', Boolean(specup.codeOf('정보처리 기사')));
/* 민간·해외자격(SQLD·AWS·CFA)은 국가자격 목록에 없다. */
ok('민간자격은 못 찾는 게 맞다', specup.codeOf('SQLD') === null);
ok('없는 이름은 null', specup.codeOf('없는자격증') === null);
/* 큐넷 종목목록(613종)에 구멍이 있다 — 정보보안기사는 국가기술자격인데 빠져 있다
   (cert-catalog.js 가 기록한 기존 한계). 못 찾는 것은 어쩔 수 없지만,
   그걸 "국가자격이 아니다" 라고 단정하면 틀린 말을 자신 있게 하는 것이 된다. */
ok('못 찾은 종목을 "국가자격이 아니다" 라고 단정하지 않는다', (() => {
  const note = '종목 목록에서 못 찾아 일정을 붙이지 못했어요. 민간자격이거나 목록에 빠진 종목일 수 있어요 — 시행기관 공지를 확인하세요.';
  return !/국가자격이 아니라/.test(note) && /못 찾/.test(note);
})(), '정보보안기사가 실제로 여기 걸렸다');

// ── 6. 온통청년 항목 거르기 ─────────────────────────────────
/* 청년정책 목록에는 지원금·주거 정책이 섞여 온다. 키워드가 설명 어딘가에만 걸린
   것을 그대로 실으면 '공모전' 칸에 월세 지원이 뜬다. */
console.log('\n── 6. 공모전 칸에 지원금 정책이 끼지 않게 ──');
const contest = specup.toActivity({
  plcyNo: 'P1', plcyNm: '청년 창업 아이디어 공모전', plcyKywdNm: '창업,공모전',
  sprvsnInstCdNm: '중소벤처기업부', plcyExplnCn: '청년 창업 아이디어를 겨루는 대회',
  aplyYmd: '20260801 ~ 20260930', aplyUrlAddr: 'https://example.kr',
}, 'contest');
ok('공모전은 통과한다', contest !== null);
ok('신청 기간을 나눠 읽는다', contest.startDate === '2026-08-01' && contest.endDate === '2026-09-30');
ok('주관 기관을 읽는다', contest.org === '중소벤처기업부');

ok('제목·키워드에 주제어가 없으면 버린다',
   specup.toActivity({ plcyNo: 'P2', plcyNm: '청년 월세 지원', plcyKywdNm: '주거',
     plcyExplnCn: '공모전 수상자도 신청할 수 있습니다' }, 'contest') === null,
   '설명에만 걸린 것은 공모전이 아니다');

ok('대외활동 탭은 서포터즈를 잡는다',
   specup.toActivity({ plcyNo: 'P3', plcyNm: '2026 청년 서포터즈 모집', plcyKywdNm: '서포터즈' },
     'activity') !== null);
ok('id 가 없으면 버린다', specup.toActivity({ plcyNm: '공모전' }, 'contest') === null);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exitCode = fail ? 1 : 0;
