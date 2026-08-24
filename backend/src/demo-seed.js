/* ════════════════════════════════════════════════════════════
   데모 시드 데이터 — 백오피스의 '데모 데이터 추가' 버튼에서 사용.
   개발/시연용이며 운영 환경에서는 /api/admin/* 자체가 막혀 있다.

   스펙의 dept/field/job 은 옛 학과 기반 스키마다.
   커리어 로드맵(NCS 분류)에서는 frontend/js/ncs.js 의 legacy 매핑을 통해
   해당 NCS 중분류로 집계된다.
   ════════════════════════════════════════════════════════════ */

// ── 무작위 시드 생성기 ───────────────────────────────────────
//  백오피스의 '무작위 N명 추가' 에서 사용. dept/field/job 은 ncs.js 의
//  legacy 매핑에 맞는 조합만 쓴다(그래야 NCS 커리어 로드맵에 집계된다).
//  각 원형(archetype)은 학과·직무와 어울리는 자격증 풀·어학 성향을 가진다.

/* corps: 이 원형이 주로 가는 기업 유형 풀. 같은 값을 여러 번 넣어 비중을 준다.
   (예: 컨설팅은 대기업 편중, 법무는 공기업 비중이 큼) */
const ARCHETYPES = [
  { dept: 'cs', field: 'service', jobs: ['backend', 'frontend', 'mobile', 'ai'],
    certs: ['정보처리기사', 'SQLD', 'ADsP', 'AWS SAA', 'CKA', '정보보안기사'],
    gpa: [3.2, 4.3], toeic: [780, 970], names: '개발',
    corps: ['large', 'large', 'mid', 'small', 'small', 'public'] },
  { dept: 'business', field: 'finance', jobs: ['ib', 'bank', 'am'],
    certs: ['금융투자분석사', '투자자산운용사', 'CFA Level 1', '재무위험관리사(FRM)', '은행FP(AFPK)'],
    gpa: [3.3, 4.2], toeic: [820, 980], names: '금융',
    corps: ['large', 'large', 'mid', 'public', 'public'] },
  { dept: 'business', field: 'consulting', jobs: ['strategy', 'operation'],
    certs: ['재경관리사', 'ADsP', '컴퓨터활용능력 1급'],
    gpa: [3.6, 4.4], toeic: [880, 990], names: '컨설팅',
    corps: ['large', 'large', 'large', 'mid'] },
  { dept: 'business', field: 'marketing', jobs: ['brand', 'digital', 'perf'],
    certs: ['구글애널리틱스', 'ADsP', 'GTQ 1급'],
    gpa: [3.0, 4.1], toeic: [750, 950], names: '마케팅',
    corps: ['large', 'mid', 'mid', 'small', 'small'] },
  { dept: 'business', field: 'corp', jobs: ['plan', 'hr', 'finance'],
    certs: ['경영지도사', '컴퓨터활용능력 1급', '재경관리사'],
    gpa: [3.2, 4.2], toeic: [800, 960], names: '경영',
    corps: ['large', 'large', 'mid', 'public'] },
  { dept: 'economics', field: 'finance', jobs: ['research', 'bank'],
    certs: ['CFA Level 1', '투자자산운용사', '재경관리사'],
    gpa: [3.4, 4.3], toeic: [830, 980], names: '경제',
    corps: ['large', 'mid', 'public', 'public'] },
  { dept: 'accounting', field: 'audit', jobs: ['cpa', 'tax'],
    certs: ['CPA', '재경관리사', 'TAT'],
    gpa: [3.5, 4.4], toeic: [780, 940], names: '회계',
    corps: ['large', 'mid', 'mid', 'small'] },
  { dept: 'stat', field: 'data', jobs: ['analyst', 'scientist'],
    certs: ['ADsP', 'SQLD', '데이터분석 준전문가'],
    gpa: [3.3, 4.3], toeic: [800, 970], names: '통계',
    corps: ['large', 'mid', 'small', 'public'] },
  { dept: 'psych', field: 'hr', jobs: ['hr', 'recruit'],
    certs: ['공인노무사', '경영지도사(인적자원)'],
    gpa: [3.2, 4.1], toeic: [770, 930], names: '인사',
    corps: ['large', 'mid', 'mid', 'small', 'public'] },
  { dept: 'psych', field: 'clinical', jobs: ['counsel'],
    certs: ['임상심리사', '청소년 상담사'],
    gpa: [3.4, 4.2], toeic: [720, 900], names: '상담',
    corps: ['small', 'small', 'mid', 'public', 'public'] },
  { dept: 'law', field: 'lawfirm', jobs: ['paralegal', 'legaltech'],
    certs: ['공인노무사', '법무사'],
    gpa: [3.5, 4.4], toeic: [820, 970], names: '법무',
    corps: ['large', 'mid', 'small', 'public', 'public'] },
  { dept: 'media', field: 'marketing', jobs: ['brand', 'content'],
    certs: ['GTQ 1급', 'ADsP', '구글애널리틱스'],
    gpa: [3.0, 4.0], toeic: [760, 940], names: '미디어',
    corps: ['mid', 'small', 'small', 'large'] },
  { dept: 'media', field: 'media', jobs: ['pd', 'editor'],
    certs: ['GTQ 1급', '웹디자인기능사'],
    gpa: [2.9, 3.9], toeic: [730, 910], names: '방송',
    corps: ['large', 'mid', 'small', 'small', 'public'] },
];

const OPIC_POOL = ['IM2', 'IM3', 'IH', 'IH', 'AL'];
const TS_POOL   = ['IM', 'IM', 'IH', 'AL'];
const SURNAMES  = '김이박최정강조윤장임한오서신권황안송류전홍고문양손배白'.replace('白','백').split('');
const GIVEN     = ['민준','서연','도윤','하은','지호','수아','예준','지우','시우','하윤','주원','서준','지아','유진','건우','채원','현우','다은','준서','예은','윤서','지훈','서现','민서','재윤'].map(s=>s.replace('現','현'));

function rint(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }
function pick(arr)    { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p)    { return Math.random() < p; }
function sampleN(arr, n) {
  const a = [...arr];
  const out = [];
  while (out.length < n && a.length) out.push(a.splice(rint(0, a.length - 1), 1)[0]);
  return out;
}

/* seq: 아이디 유일성을 위한 일련번호 */
function makeRandomEntry(seq) {
  const a = pick(ARCHETYPES);
  const gpa = Math.round((a.gpa[0] + Math.random() * (a.gpa[1] - a.gpa[0])) * 100) / 100;

  // 어학: 대부분 토익, 일부는 오픽/토스도 함께
  const scores = { toeic: rint(a.toeic[0], a.toeic[1]) - (rint(a.toeic[0], a.toeic[1]) % 5) };
  if (chance(0.5)) scores.opic = pick(OPIC_POOL);
  if (chance(0.25)) scores.toeicSpeaking = pick(TS_POOL);

  // 정성 스펙: 설문(구글폼)과 동일한 구조화된 대표 활동
  const activities = makeRandomActivities();

  const name = pick(SURNAMES) + pick(GIVEN);
  const corpType = pick(a.corps);
  return {
    u: {
      username: `rand_${Date.now().toString(36)}_${seq}`,
      password: 'demo1234!',
      name,
      /* 화면에는 실명이 아니라 이 닉네임이 나간다(CAS 순위·멘토 목록).
         시드에 닉네임이 없으면 순위가 '익명 선배' 로만 채워져 화면 확인이 안 된다.
         뒤에 번호를 붙이는 건 조합이 150개뿐이라 50명만 넣어도 겹치기 때문이다 —
         순위표에 같은 닉네임이 두 번 나오면 화면이 고장난 것으로 읽힌다. */
      nickname: pick(NICK_HEAD) + pick(NICK_TAIL) + rint(1, 99),
      email: `rand_${Date.now().toString(36)}_${seq}@careerly.demo`,
      role: chance(0.8) ? 'mentor' : 'mentee',
    },
    s: {
      dept: a.dept, field: a.field, job: pick(a.jobs),
      corpType,
      /* 중소기업은 회사명을 비워 둔다 — 실제로도 적지 않는 회원이 많고,
         있지도 않은 중소기업 이름을 지어내는 것보다 빈 값이 정직하다. */
      company: corpType === 'small' ? null : pick(COMPANY_POOL[corpType] || []),
      gpa, gpaMax: 4.5,
      certs: sampleN(a.certs, rint(0, Math.min(3, a.certs.length))),
      scores,
      activities,
    },
  };
}

/* 닉네임 조각 — 실명 대신 화면에 나가는 이름이다. 조합해서 쓴다(코드곰37 …). */
const NICK_HEAD = ['코드', '데이터', '기획', '숫자', '문서', '실험', '설계', '분석', '현장', '기록', '새벽', '주말', '구름', '바다', '노을'];
const NICK_TAIL = ['곰', '여우', '수달', '고래', '부엉이', '너구리', '펭귄', '두더지', '하마', '까치'];

/* 회사명 — 기업 유형별로 실제 존재하는 이름에서 고른다. '선배들이 간 회사' 집계가
   무엇을 세는지 눈으로 확인하려면 이름이 있어야 한다. */
const COMPANY_POOL = {
  large:  ['삼성전자', 'SK하이닉스', '현대자동차', 'LG전자', '네이버', '카카오', 'CJ제일제당', '포스코'],
  mid:    ['오뚜기', '한샘', '동원F&B', '코웨이', '휠라코리아', '한국콜마'],
  public: ['한국전력공사', '한국철도공사', '국민건강보험공단', '한국수자원공사', '한국공항공사'],
};

/* 대표 활동 1~4개를 그럴듯하게 생성 — CAS 정성 채점(유형·기간·역할·성과)의 입력.
   유형별 등장 확률은 CAS 가중치 우선순위(인턴십·공모전·대외활동)를 반영한다. */
const DURATIONS = ['1개월 미만', '1~3개월', '3개월~6개월', '6개월~1년', '1년이상'];
const OUTCOMES  = ['수상', '논문', '발표 또는 산출물 공개(깃헙 등)', '전환, 정규직 합격', '결과물 없음'];
const ACT_POOL = [
  { type: 'internship',     p: 0.6,  roleKind: 'team' },
  { type: 'competition',    p: 0.45, roleKind: 'team' },
  { type: 'extracurricular',p: 0.5,  roleKind: 'free' },
  { type: 'project',        p: 0.55, roleKind: 'team' },
  { type: 'research',       p: 0.15, roleKind: 'stage' },
  { type: 'club',           p: 0.4,  roleKind: 'exec' },
  { type: 'exchange',       p: 0.15, roleKind: 'none' },
  { type: 'volunteer',      p: 0.25, roleKind: 'none' },
];
function makeRandomActivities() {
  const out = [];
  for (const t of ACT_POOL) {
    if (out.length >= 4) break;
    if (!chance(t.p)) continue;
    const act = { type: t.type, duration: pick(DURATIONS), outcome: pick(OUTCOMES) };
    if (t.roleKind === 'team')  act.role  = pick(['팀장', '팀원', '개인']);
    if (t.roleKind === 'exec')  act.role  = pick(['임원진', '동아리원, 일반학회원']);
    if (t.roleKind === 'stage') act.stage = pick(['학부연구생', '석사', '박사']);
    if (t.roleKind === 'free')  act.role  = chance(0.5) ? '리더' : '';
    out.push(act);
  }
  if (!out.length) out.push({ type: 'project', duration: '3개월~6개월', role: '팀원', outcome: '결과물 없음' });
  return out;
}

/* 멘티(스펙 없음)는 s:null 로 만든다 */
function generateRandom(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const e = makeRandomEntry(i);
    if (e.u.role === 'mentee') e.s = null;   // 멘티는 스펙 미입력
    out.push(e);
  }
  return out;
}

const DEMO_SEED = [
  { u: { username: 'demo_kim', password: 'demo1234!', name: '김민준', nickname: '코드곰', email: 'kim@careerly.demo', role: 'mentor' },
    s: { dept: 'cs', field: 'service', job: 'backend',
         corpType: 'large', company: '카카오',
         gpa: 3.85, gpaMax: 4.5,
         certs: ['정보처리기사', 'SQLD', 'AWS SAA'],
         scores: { toeic: 920, opic: 'IH', toeicSpeaking: 'IH' },
         qual: { extracurricular: true, projects: true, internship: true, oncampus: true,
                 coreCourses: true, langStudy: false, exchange: false, gradSchool: false },
         detail: { projectsText: '캡스톤 — 분산 채팅 백엔드 (3인, 팀장)',
                   internshipText: '카카오 백엔드 인턴 (2개월)',
                   activitiesText: '교내 알고리즘 학회 운영진 2년' } } },

  { u: { username: 'demo_lee', password: 'demo1234!', name: '이서연', nickname: '픽셀여우', email: 'lee@careerly.demo', role: 'mentor' },
    s: { dept: 'cs', field: 'service', job: 'frontend',
         corpType: 'mid', company: '오뚜기',
         gpa: 3.95, gpaMax: 4.5,
         certs: ['정보처리기사', 'GTQ 1급'],
         scores: { toeic: 880, opic: 'AL' },
         qual: { extracurricular: true, projects: true, internship: false, oncampus: true,
                 coreCourses: true, langStudy: false, exchange: true, gradSchool: false },
         detail: { exchangeText: '핀란드 알토대 1학기' } } },

  { u: { username: 'demo_park', password: 'demo1234!', name: '박지훈', nickname: '숫자수달', email: 'park@careerly.demo', role: 'mentor' },
    s: { dept: 'business', field: 'finance', job: 'ib',
         corpType: 'large', company: '삼성전자',
         gpa: 3.7, gpaMax: 4.5,
         certs: ['금융투자분석사', '투자자산운용사', 'CFA Level 1'],
         scores: { toeic: 950, toefl: 105, opic: 'AL' },
         qual: { extracurricular: true, projects: true, internship: true, oncampus: true,
                 coreCourses: true, langStudy: true, exchange: false, gradSchool: false },
         detail: { internshipText: '미래에셋증권 IB본부 인턴 (3개월)',
                   activitiesText: 'CFA 한국지부 학회 총무' } } },

  { u: { username: 'demo_choi', password: 'demo1234!', name: '최수아', nickname: '전략고래', email: 'choi@careerly.demo', role: 'mentor' },
    s: { dept: 'business', field: 'consulting', job: 'strategy',
         corpType: 'large', company: '현대자동차',
         gpa: 4.1, gpaMax: 4.5,
         certs: [],
         scores: { toeic: 980, opic: 'AL', toeicSpeaking: 'AL' },
         qual: { extracurricular: true, projects: true, internship: true, oncampus: false,
                 coreCourses: true, langStudy: true, exchange: true, gradSchool: true },
         detail: { gradSchoolText: '서울대 경영전문대학원 (예정)' } } },

  { u: { username: 'demo_jung', password: 'demo1234!', name: '정도윤', nickname: '기록부엉이', email: 'jung@careerly.demo', role: 'mentor' },
    s: { dept: 'business', field: 'finance', job: 'ib',
         corpType: 'public', company: '한국전력공사',
         gpa: 3.5, gpaMax: 4.5,
         certs: ['금융투자분석사'],
         scores: { toeic: 905 },
         qual: { extracurricular: true, projects: false, internship: true, oncampus: true,
                 coreCourses: true, langStudy: false, exchange: false, gradSchool: false },
         detail: {} } },

  // 멘티 — 스펙 없이 회원만
  { u: { username: 'mentee_a', password: 'demo1234!', name: '강하늘', nickname: '새벽펭귄', email: 'a@careerly.demo', role: 'mentee' }, s: null },
  { u: { username: 'mentee_b', password: 'demo1234!', name: '윤서윤', nickname: '주말너구리', email: 'b@careerly.demo', role: 'mentee' }, s: null },
  { u: { username: 'mentee_c', password: 'demo1234!', name: '임시우', nickname: '문서까치', email: 'c@careerly.demo', role: 'mentee' }, s: null },
];

module.exports = { DEMO_SEED, generateRandom };
