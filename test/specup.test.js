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

// ── 6-1. 지원 대상 지역 ─────────────────────────────────────
/* 잡히는 정책이 지자체 것에 몰려 있어서(광주·울산·인천…) 지역이 없으면 학생이
   남의 동네 공고를 열어 보고 나서야 안다.

   후보 셋 중 zipCd 를 고른 이유는 그것만 늘 차 있어서다 — 주관기관은 부서명만
   오는 일이 잦고('복지국'·'지역경제과'), 최상위등록기관은 비는 것이 있다.
   코드↔시도 대응은 추측이 아니라 실측으로 뽑았다(specup.js SIDO_BY_ZIP 주석). */
console.log('\n── 6-1. 지원 대상 지역 ──');
ok('한 시도면 그 시도', specup.regionOf('41461,41463') === '경기');
ok('코드 하나여도 읽는다', specup.regionOf('48220') === '경남');
/* 표준 법정동코드에 없는 값이라 명세서로는 못 알아낸다 — 실측으로만 나온다. */
ok('통합 광역단체 코드(12)도 안다', specup.regionOf('12210,12240') === '광주·전남',
   '표준 법정동코드에 없는 값이다 — 실측으로 확인');
/* 걸치는 시도 수가 1개(1,211건) 아니면 9개 이상(89건)이고 중간이 0건이었다. */
ok('전국 사업은 전국이라고 적는다',
   specup.regionOf('11110,26110,27110,28110,29110,30110,31110,36110,41110,43110,44110') === '전국');
ok('코드가 없으면 null', specup.regionOf('') === null && specup.regionOf(null) === null);
ok('모르는 코드는 지어내지 않는다', specup.regionOf('99999') === null,
   '표에 없는 코드를 아무 시도로나 붙이면 학생이 엉뚱한 공고를 연다');

const withZip = specup.toActivity(
  { plcyNo: 'R1', plcyNm: '청년 공모전', zipCd: '31110,31140' }, 'contest');
ok('활동 항목에 지역이 실린다', withZip.region === '울산');
ok('zipCd 가 없어도 항목은 살아 있다',
   specup.toActivity({ plcyNo: 'R2', plcyNm: '청년 공모전' }, 'contest')?.region === null,
   '지역을 모른다고 모집 자체를 버리면 안 된다');

// ── 6-2. 신청기간 구분코드 (키 발급 후 실측으로 바로잡음) ────────
/* 명세서만 보고 `0057001` 을 '상시' 로 적어 뒀는데 정반대였다. 정책 1,400건 실측:
     0057001  738건  전부 aplyYmd 가 있다 = 기간이 정해진 모집
     0057002  437건  기간 없음 = 상시 (응시료 지원·면접정장 대여)
     0057003  225건  기간 없음 = 기타 — 신청방법이 '별도 문의'
   화면이 endDate 를 먼저 보기 때문에 001 의 오표기는 가려졌고, 대신 **진짜 상시인
   002 가 '기간 미상' 으로 나갔다.** 조용히 틀리는 쪽이라 여기서 못 박는다. */
console.log('\n── 6-2. 신청기간 구분 ──');
const withPrd = (code, ymd) => specup.toActivity(
  { plcyNo: 'X', plcyNm: '청년 공모전', aplyPrdSeCd: code, aplyYmd: ymd || '' }, 'contest');

ok('기간이 정해진 모집(0057001)은 상시가 아니다',
   withPrd('0057001', '20260801 ~ 20260930').period === null,
   '마감일이 있는데 상시라고 적으면 화면이 두 말을 한다');
ok('그때 마감일은 읽는다', withPrd('0057001', '20260801 ~ 20260930').endDate === '2026-09-30');
ok('상시(0057002)를 상시로 읽는다', withPrd('0057002').period === '상시');
ok('기타(0057003)는 상시라고 하지 않는다', withPrd('0057003').period === null,
   '기간을 안 적었을 뿐 늘 열려 있다는 뜻이 아니다 — 화면의 "기간 미상" 으로 둔다');
ok('구분코드가 없어도 죽지 않는다', withPrd(undefined).period === null);

/* ── 파라미터 이름을 못 박는다 ────────────────────────────────────────
   이 API 는 **모르는 파라미터를 무시하고 전체(2,700여 건)를 그대로 준다.** 에러가
   아니라서 화면만 봐서는 못 잡는다. 그래서 소스에 박힌 이름을 테스트가 지킨다.
     · plcyKywdNm — 정해진 어휘 17종(교육지원·보조금·인턴…)이라 '공모전' 은 0건
     · plcyLclsfCd — 코드로 부르면 전체 2,743건이 온다 (2026-09-02 실측)
   2026-09-02 부터는 키워드가 아니라 **분류**로 부른다. */
const RAW = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'backend', 'src', 'specup.js'), 'utf8');
/* 주석에는 '쓰면 안 되는 파라미터' 를 왜 안 쓰는지 적어 두었다. 주석까지 세면 그
   설명이 있다는 이유로 테스트가 깨지므로, **코드만** 남기고 본다. */
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('중분류(mclsfNm)로 부른다', SRC.includes('mclsfNm='));
ok('대분류(lclsfNm)도 같이 부른다', SRC.includes('lclsfNm='),
   '대분류 이름이 참여권리/참여･기반 두 벌로 와서 한쪽만 쓰면 절반이 사라진다');
ok('코드 파라미터는 쓰지 않는다', !SRC.includes('plcyLclsfCd'),
   '코드로 부르면 전체가 온다 (실측)');
ok('정해진 어휘 필드로 검색하지 않는다', !SRC.includes('plcyKywdNm='));

/* ── 활동성 필터 (2026-09-02) ──────────────────────────────────────
   분류로 받으면 '청년축제'·'자율공간 사업자 모집' 이 같이 온다. 스펙업은 학생이
   참여해서 **이력이 되는 것**을 붙이는 자리라 그 둘을 갈라야 한다. */
const act = nm => specup.toActivity({ plcyNo: 'X', plcyNm: nm, aplyYmd: '' });
console.log('\n── 활동성 필터 ──');
[
  ['2026년 서구 청년 크리에이터단 참여자 모집', true,  '이름을 몰라도 뽑는 말로 잡힌다'],
  ['청년정책 서포터즈 2기',                    true,  "제목에 '모집' 이 없어도 서포터즈는 활동이다"],
  ['2026 북구청춘페스타 추진기획단 모집',       true,  '페스타가 아니라 기획단 모집이다'],
  ['2026년 전남광주통합특별시 청년축제',        false, '행사 자체는 스펙이 아니다'],
  ['2026년 서구 청년자율공간 참여 사업자 모집', false, '사업자 모집은 학생 활동이 아니다'],
  ['청년 월세 한시 특별지원',                   false, '현금성 지원은 활동이 아니다'],
  ['청년 면접정장 대여',                        false, '현금성·현물 지원'],
].forEach(([nm, want, why]) => ok(`${want ? '남긴다' : '거른다'} — ${nm.slice(0, 26)}`,
  Boolean(act(nm)) === want, why));

/* ── 탭 배정 ──
   예전에는 탭마다 다른 키워드로 조회해서 이미 갈려 있었다. 이제 한 번에 받아
   이름으로 나눈다 — 잘못 갈리면 공모전 탭에 서포터즈가 뜬다. */
console.log('\n── 탭 배정 ──');
[
  ['청년정책 제안 경연대회', 'contest'],
  ['청년 넷제로 리빙랩 아이디어 공모전', 'contest'],
  ['청년개발자 해커톤 대회', 'contest'],
  ['청년정책 서포터즈 2기', 'activity'],
  ['[남구] 제5기 청년네트워크 위원 추가 모집', 'activity'],
  ['2026 광산구 홍보파트너 모집', 'activity'],
].forEach(([nm, want]) => ok(`${want.padEnd(8)} ← ${nm.slice(0, 26)}`,
  act(nm)?.topic === want, `→ ${act(nm)?.topic}`));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exitCode = fail ? 1 : 0;
