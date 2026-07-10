/* ════════════════════════════════════════════════════════════
   데모 시드 데이터 — 백오피스의 '데모 데이터 추가' 버튼에서 사용.
   개발/시연용이며 운영 환경에서는 /api/admin/* 자체가 막혀 있다.

   스펙의 dept/field/job 은 옛 학과 기반 스키마다.
   커리어 로드맵(NCS 분류)에서는 frontend/js/ncs.js 의 legacy 매핑을 통해
   해당 NCS 중분류로 집계된다.
   ════════════════════════════════════════════════════════════ */

const DEMO_SEED = [
  { u: { username: 'demo_kim', password: 'demo1234!', name: '김민준', email: 'kim@careerly.demo', role: 'mentor' },
    s: { dept: 'cs', field: 'service', job: 'backend',
         gpa: 3.85, gpaMax: 4.5,
         certs: ['정보처리기사', 'SQLD', 'AWS SAA'],
         scores: { toeic: 920, opic: 'IH', toeicSpeaking: 'IH' },
         qual: { extracurricular: true, projects: true, internship: true, oncampus: true,
                 coreCourses: true, langStudy: false, exchange: false, gradSchool: false },
         detail: { projectsText: '캡스톤 — 분산 채팅 백엔드 (3인, 팀장)',
                   internshipText: '카카오 백엔드 인턴 (2개월)',
                   activitiesText: '교내 알고리즘 학회 운영진 2년' } } },

  { u: { username: 'demo_lee', password: 'demo1234!', name: '이서연', email: 'lee@careerly.demo', role: 'mentor' },
    s: { dept: 'cs', field: 'service', job: 'frontend',
         gpa: 3.95, gpaMax: 4.5,
         certs: ['정보처리기사', 'GTQ 1급'],
         scores: { toeic: 880, opic: 'AL' },
         qual: { extracurricular: true, projects: true, internship: false, oncampus: true,
                 coreCourses: true, langStudy: false, exchange: true, gradSchool: false },
         detail: { exchangeText: '핀란드 알토대 1학기' } } },

  { u: { username: 'demo_park', password: 'demo1234!', name: '박지훈', email: 'park@careerly.demo', role: 'mentor' },
    s: { dept: 'business', field: 'finance', job: 'ib',
         gpa: 3.7, gpaMax: 4.5,
         certs: ['금융투자분석사', '투자자산운용사', 'CFA Level 1'],
         scores: { toeic: 950, toefl: 105, opic: 'AL' },
         qual: { extracurricular: true, projects: true, internship: true, oncampus: true,
                 coreCourses: true, langStudy: true, exchange: false, gradSchool: false },
         detail: { internshipText: '미래에셋증권 IB본부 인턴 (3개월)',
                   activitiesText: 'CFA 한국지부 학회 총무' } } },

  { u: { username: 'demo_choi', password: 'demo1234!', name: '최수아', email: 'choi@careerly.demo', role: 'mentor' },
    s: { dept: 'business', field: 'consulting', job: 'strategy',
         gpa: 4.1, gpaMax: 4.5,
         certs: [],
         scores: { toeic: 980, opic: 'AL', toeicSpeaking: 'AL' },
         qual: { extracurricular: true, projects: true, internship: true, oncampus: false,
                 coreCourses: true, langStudy: true, exchange: true, gradSchool: true },
         detail: { gradSchoolText: '서울대 경영전문대학원 (예정)' } } },

  { u: { username: 'demo_jung', password: 'demo1234!', name: '정도윤', email: 'jung@careerly.demo', role: 'mentor' },
    s: { dept: 'business', field: 'finance', job: 'ib',
         gpa: 3.5, gpaMax: 4.5,
         certs: ['금융투자분석사'],
         scores: { toeic: 905 },
         qual: { extracurricular: true, projects: false, internship: true, oncampus: true,
                 coreCourses: true, langStudy: false, exchange: false, gradSchool: false },
         detail: {} } },

  // 멘티 — 스펙 없이 회원만
  { u: { username: 'mentee_a', password: 'demo1234!', name: '강하늘', email: 'a@careerly.demo', role: 'mentee' }, s: null },
  { u: { username: 'mentee_b', password: 'demo1234!', name: '윤서윤', email: 'b@careerly.demo', role: 'mentee' }, s: null },
  { u: { username: 'mentee_c', password: 'demo1234!', name: '임시우', email: 'c@careerly.demo', role: 'mentee' }, s: null },
];

module.exports = { DEMO_SEED };
