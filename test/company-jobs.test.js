/* 채용공고 경로(사람인·워크넷)가 공유하는 규칙 검사.

   네트워크는 부르지 않는다. 검사할 것은 "받아온 공고 중 무엇을 이 회사 것으로 볼
   것인가"와 "마감일을 어떻게 셀 것인가" 두 가지다. 앞의 것이 틀리면 **남의 회사 공고를
   자기 지원 회사 것으로 알고** 자소서에 붙여넣게 된다 — 두 API 모두 회사명 파라미터가
   없어서 이 대조가 유일한 방어선이다. */
const NAME = require('../backend/src/company-name.js');
const SARAMIN = require('../backend/src/saramin-jobs.js');
const WORKNET = require('../backend/src/worknet-jobs.js');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

console.log('── 1. 회사명 표기 흔들림 흡수 ──');
ok('(주) 를 떼고 본다', NAME.sameCompany('(주)토스', '토스'));
ok('주식회사 를 떼고 본다', NAME.sameCompany('토스 주식회사', '토스'));
ok('공백 차이를 무시한다', NAME.sameCompany('삼성 전자', '삼성전자'));
ok('유한회사도 뗀다', NAME.sameCompany('유한회사 카카오', '카카오'));
ok('대소문자를 무시한다', NAME.sameCompany('KAKAO', 'kakao'));

console.log('\n── 2. 남의 회사는 걸러낸다 ──');
/* 두 API 모두 keywords 로 공고제목·직무내용까지 뒤진다. 부분 일치를 허용하면
   '토스' 검색에 '대한토스트' 가, '삼성전자' 에 '삼성전자로지텍' 이 걸린다. */
ok('이름에 검색어가 들어 있을 뿐인 회사는 제외', !NAME.sameCompany('대한토스트', '토스'));
ok('앞부분만 같은 다른 법인도 제외', !NAME.sameCompany('삼성전자로지텍', '삼성전자'));
ok('아예 다른 회사는 제외', !NAME.sameCompany('현대자동차', '삼성전자'));
ok('빈 값은 제외', !NAME.sameCompany('', '삼성전자') && !NAME.sameCompany('삼성전자', ''));

console.log('\n── 3. 마감일 → D-day ──');
const ymd = d => {
  const t = new Date(Date.now() + d * 86400000);
  return `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`;
};
ok('오늘 마감이면 D-0 (D-1 로 밀리지 않는다)', NAME.dday(ymd(0)) === 0, `→ ${NAME.dday(ymd(0))}`);
ok('앞으로 남은 날을 센다', NAME.dday(ymd(5)) === 5);
ok('이미 지난 마감은 null', NAME.dday(ymd(-3)) === null);
/* 사람인은 ISO 로 준다: 2026-08-20T23:59:59+09:00 */
const iso = d => {
  const t = new Date(Date.now() + d * 86400000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}T23:59:59+09:00`;
};
ok('사람인 ISO 형식도 읽는다', NAME.dday(iso(7)) === 7, `→ ${NAME.dday(iso(7))}`);
ok('형식이 다르면 null', NAME.dday('상시채용') === null);
ok('없는 날짜는 null', NAME.dday('20261352') === null);

console.log('\n── 4. 사람인 응답 파싱 ──');
/* 값이 { name: '...' } 로 감싸여 오는 자리가 많다 — 그대로 쓰면 화면에 [object Object] 가 뜬다. */
const job = SARAMIN.normalizeJob({
  id: '12345',
  url: 'https://www.saramin.co.kr/job/12345',
  company: { detail: { name: '(주)토스' } },
  position: {
    title: { name: '데이터 마케터' },
    location: { name: '서울 강남구' },
    'experience-level': { name: '신입' },
    'required-education-level': { name: '대학교졸업(4년)이상' },
  },
  'expiration-date': iso(3),
});
ok('제목을 꺼낸다', job.title === '데이터 마케터', `→ ${job.title}`);
ok('회사명을 꺼낸다', job.company === '(주)토스', `→ ${job.company}`);
ok('근무지·경력·학력을 꺼낸다',
   job.region === '서울 강남구' && job.career === '신입' && job.edu.includes('대학교'));
ok('마감일을 D-day 로 바꾼다', job.dday === 3, `→ ${job.dday}`);
ok('(주)토스 공고는 토스 검색과 같은 회사로 본다', NAME.sameCompany(job.company, '토스'));

console.log('\n── 5. 키가 없을 때 ──');
Promise.all([SARAMIN.companyJobs('삼성전자'), WORKNET.companyJobs('삼성전자')]).then(([s, w]) => {
  /* 키가 없으면 조용히 빈 목록 + 사유. 예외를 던지면 리포트 전체가 죽는다. */
  ok('사람인: 빈 목록과 사유 (예외를 던지지 않는다)',
     Array.isArray(s.items) && typeof s.configured === 'boolean');
  ok('워크넷: 빈 목록과 사유 (예외를 던지지 않는다)',
     Array.isArray(w.items) && typeof w.configured === 'boolean');
  if (!SARAMIN.isConfigured()) {
    ok('사람인 키가 없으면 사유를 적는다', typeof s.reason === 'string' && s.reason.length > 0, `→ ${s.reason}`);
  }
  return SARAMIN.companyJobs('가');
}).then(r => {
  ok('회사명이 너무 짧으면 부르지 않는다', r.items.length === 0);
  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  process.exit(fail ? 1 : 0);
});
