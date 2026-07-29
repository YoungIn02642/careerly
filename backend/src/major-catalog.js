/* 학과 카탈로그 — 스펙 입력 화면의 '학과' 검색 목록.

   ── 왜 손으로 들고 있나 (임시) ──
   커리어넷 학과정보 API(교육부)가 표준 학과와 계열을 함께 주는 제대로 된 소스인데,
   **커리어넷 자체 키가 따로 필요하고 관리자 수동 발급**이라 아직 못 받았다.
   (data.go.kr 15057878 은 LINK 타입이라 기존 서비스키로는 호출되지 않는다 — 실측 500.)
   키가 나오면 scripts/fetch-majors.js 로 교체하고 이 목록은 지운다.

   ── dept 를 왜 같이 들고 있나 (이게 핵심) ──
   careerly 의 선배 통계는 dept 로 묶인다(aggregation.js·cas.js·wage-jobs.js 등 10곳).
   학과명을 자유 검색으로 바꾸면서 dept 를 없애면, 스펙 1,188건이 수천 개 학과명으로
   흩어져 합격자 평균이 전부 n=1 이 된다. 화면에는 에러가 아니라 '데이터 없음'으로
   나와서 발견되지도 않는다.
   그래서 **학과명(major)은 자유롭게, 집계 키(dept)는 8분류 그대로** 둔다.
   회사명+기업유형, 자격증명+자격구분 과 같은 구조다.

   dept 가 null 인 학과는 careerly 가 아직 통계를 내지 않는 계열이다. 저장은 되지만
   화면에서 계열을 직접 고르게 안내한다(빈 통계를 그럴듯하게 보여주지 않기 위해). */

/* 학과명 → careerly 집계 분류.
   실제 대학 개설 학과명을 기준으로 골랐다. 같은 전공이라도 학교마다 이름이 달라서
   (경영학과 / 경영학부 / 경영정보학과) 대표형을 넣고, 나머지는 아래 규칙이 잡는다. */
const MAJORS = [
  // ── 경영 (business)
  ['경영학과', 'business'], ['경영학부', 'business'], ['경영정보학과', 'business'],
  ['글로벌경영학과', 'business'], ['국제경영학과', 'business'], ['벤처중소기업학과', 'business'],
  ['기술경영학과', 'business'], ['서비스경영학과', 'business'], ['호텔경영학과', 'business'],
  ['관광경영학과', 'business'], ['외식경영학과', 'business'], ['스포츠경영학과', 'business'],
  ['무역학과', 'business'], ['국제통상학과', 'business'], ['물류학과', 'business'],
  ['유통학과', 'business'], ['e-비즈니스학과', 'business'], ['마케팅학과', 'business'],
  ['광고홍보학과', 'media'], ['인사조직학과', 'business'], ['경영공학과', 'business'],
  ['산업경영공학과', 'business'], ['보험학과', 'business'], ['부동산학과', 'business'],

  // ── 경제 (economics)
  ['경제학과', 'economics'], ['경제학부', 'economics'], ['응용경제학과', 'economics'],
  ['금융경제학과', 'economics'], ['국제경제학과', 'economics'], ['농업경제학과', 'economics'],
  ['자원경제학과', 'economics'], ['경제금융학과', 'economics'], ['글로벌경제학과', 'economics'],
  ['정치경제학과', 'economics'], ['소비자경제학과', 'economics'],

  // ── 회계·세무 (accounting)
  ['회계학과', 'accounting'], ['세무학과', 'accounting'], ['회계세무학과', 'accounting'],
  ['세무회계학과', 'accounting'], ['재무금융학과', 'accounting'],

  // ── 컴퓨터·SW (cs)
  ['컴퓨터공학과', 'cs'], ['컴퓨터공학부', 'cs'], ['컴퓨터과학과', 'cs'],
  ['소프트웨어학과', 'cs'], ['소프트웨어공학과', 'cs'], ['소프트웨어융합학과', 'cs'],
  ['컴퓨터소프트웨어학과', 'cs'], ['정보통신공학과', 'cs'], ['정보보호학과', 'cs'],
  ['사이버보안학과', 'cs'], ['정보보안학과', 'cs'], ['인공지능학과', 'cs'],
  ['AI학과', 'cs'], ['인공지능융합학과', 'cs'], ['게임공학과', 'cs'],
  ['게임소프트웨어학과', 'cs'], ['멀티미디어학과', 'cs'], ['컴퓨터정보공학과', 'cs'],
  ['임베디드시스템학과', 'cs'], ['스마트ICT융합학과', 'cs'], ['IT융합학과', 'cs'],
  ['컴퓨터융합학부', 'cs'], ['디지털콘텐츠학과', 'media'],

  // ── 통계·수학·데이터 (stat)
  ['통계학과', 'stat'], ['응용통계학과', 'stat'], ['정보통계학과', 'stat'],
  ['데이터사이언스학과', 'stat'], ['데이터과학과', 'stat'], ['빅데이터학과', 'stat'],
  ['수학과', 'stat'], ['응용수학과', 'stat'], ['수리통계학과', 'stat'],
  ['금융수학과', 'stat'], ['산업수학과', 'stat'],

  // ── 법 (law)
  ['법학과', 'law'], ['법학부', 'law'], ['공법학과', 'law'], ['사법학과', 'law'],
  ['국제법무학과', 'law'], ['지식재산학과', 'law'], ['경찰법학과', 'law'],

  // ── 심리 (psych)
  ['심리학과', 'psych'], ['상담심리학과', 'psych'], ['임상심리학과', 'psych'],
  ['산업심리학과', 'psych'], ['아동심리학과', 'psych'], ['심리상담학과', 'psych'],
  ['상담학과', 'psych'],

  // ── 미디어 (media)
  ['미디어커뮤니케이션학과', 'media'], ['신문방송학과', 'media'], ['언론정보학과', 'media'],
  ['방송영상학과', 'media'], ['영상학과', 'media'], ['커뮤니케이션학과', 'media'],
  ['미디어학부', 'media'], ['광고학과', 'media'], ['홍보학과', 'media'],
  ['영화영상학과', 'media'], ['콘텐츠학과', 'media'],

  /* ── 아래부터는 careerly 가 아직 통계를 내지 않는 계열 ──
     검색은 되어야 한다. 학생이 자기 학과를 못 찾으면 그 자리에서 막힌다.
     dept 는 null 로 두고 화면에서 계열을 직접 고르게 한다. */
  // 공학
  ['기계공학과', null], ['전기공학과', null], ['전자공학과', null], ['전기전자공학부', null],
  ['화학공학과', null], ['신소재공학과', null], ['재료공학과', null], ['건축학과', null],
  ['건축공학과', null], ['토목공학과', null], ['도시공학과', null], ['환경공학과', null],
  ['산업공학과', null], ['조선해양공학과', null], ['항공우주공학과', null],
  ['원자력공학과', null], ['에너지공학과', null], ['반도체공학과', null],
  ['로봇공학과', null], ['자동차공학과', null], ['바이오공학과', null],
  // 자연
  ['물리학과', null], ['화학과', null], ['생명과학과', null], ['생물학과', null],
  ['지구환경과학과', null], ['천문우주학과', null], ['식품영양학과', null],
  ['농생물학과', null], ['원예학과', null], ['산림학과', null], ['수산생명의학과', null],
  // 의약·보건
  ['의예과', null], ['치의예과', null], ['한의예과', null], ['약학과', null],
  ['간호학과', null], ['물리치료학과', null], ['작업치료학과', null],
  ['임상병리학과', null], ['방사선학과', null], ['치위생학과', null],
  ['응급구조학과', null], ['보건행정학과', null], ['보건관리학과', null],
  // 사회
  ['행정학과', null], ['정치외교학과', null], ['사회학과', null], ['사회복지학과', null],
  ['국제학부', null], ['문헌정보학과', null], ['도시행정학과', null],
  ['경찰행정학과', null], ['군사학과', null], ['소방행정학과', null],
  ['부동산금융학과', 'business'], ['공공인재학부', 'law'],
  // 인문
  ['국어국문학과', null], ['영어영문학과', null], ['중어중문학과', null],
  ['일어일문학과', null], ['불어불문학과', null], ['독어독문학과', null],
  ['노어노문학과', null], ['서어서문학과', null], ['사학과', null],
  ['철학과', null], ['고고학과', null], ['종교학과', null],
  ['영어통번역학과', null], ['한국어교육과', null],
  // 교육
  ['교육학과', null], ['유아교육과', null], ['초등교육과', null],
  ['특수교육과', null], ['체육교육과', null], ['수학교육과', null],
  ['국어교육과', null], ['영어교육과', null], ['역사교육과', null],
  // 예체능
  ['시각디자인학과', 'media'], ['산업디자인학과', 'media'], ['패션디자인학과', null],
  ['실내건축디자인학과', null], ['회화과', null], ['조소과', null],
  ['음악학과', null], ['실용음악과', null], ['무용학과', null],
  ['연극영화학과', 'media'], ['체육학과', null], ['스포츠과학과', null],
  ['만화애니메이션학과', 'media'], ['사진학과', 'media'],
];

/* 목록에 없는 학과명을 직접 적었을 때 쓰는 규칙.
   긴 열쇠말부터 검사한다 — '경영정보' 가 '경영' 보다 먼저 걸려야 한다. */
const RULES = [
  [/데이터사이언스|데이터과학|빅데이터/, 'stat'],
  [/통계/, 'stat'],
  [/컴퓨터|소프트웨어|정보통신|인공지능|사이버보안|정보보호|정보보안|게임|SW|ICT/i, 'cs'],
  [/회계|세무/, 'accounting'],
  [/경제/, 'economics'],
  [/경영|무역|통상|물류|유통|마케팅/, 'business'],
  [/법학|법무|지식재산/, 'law'],
  [/심리|상담/, 'psych'],
  [/미디어|신문방송|언론|광고|홍보|영상|커뮤니케이션|콘텐츠|디자인/, 'media'],
];

/* 학과명 → 집계 분류. 못 맞추면 null 을 돌려주고 화면이 직접 고르게 한다.
   억지로 아무 데나 넣으면 '간호학과 학생에게 컴공 합격자 평균'이 보인다. */
function deptOf(majorName) {
  const name = String(majorName || '').trim();
  if (!name) return null;

  const exact = MAJORS.find(([n]) => n === name);
  if (exact) return exact[1];

  for (const [re, dept] of RULES) if (re.test(name)) return dept;
  return null;
}

let cache = null;

function catalog() {
  if (cache) return cache;
  const majors = MAJORS
    .map(([name, dept]) => ({ name, dept }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  cache = { count: majors.length, majors };
  return cache;
}

module.exports = { catalog, deptOf, MAJORS, RULES };
