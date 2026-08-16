/* ══════════════════════════════════════════════════════════════
   직무 그룹 — 커리어 로드맵 1차 분류를 '취업 시장의 말'로 다시 묶는다

   ── 왜 바꾸나 (사용자 지시) ──
   1차 분류는 지금까지 한국고용직업분류(KECO)의 대분류 10개였다. 통계 분류라
   정확하지만 **구직자가 쓰는 말이 아니다.** '경영·사무·금융·보험직' 한 칸에 경영기획·
   인사·회계·무역·금융이 다 들어 있어서, 인사 직무를 찾는 학생이 어디를 눌러야 할지
   알 수 없다. 반대로 '농림어업직'·'미용·여행·숙박·음식·경비·청소직' 처럼 대졸 공채와
   먼 칸이 같은 무게로 앞에 놓인다.

   채용 사이트(잡코리아·사람인)의 '희망 직무' 칩이 그 문제를 이미 풀어 뒀다.
   그 결을 그대로 가져와 16개 그룹으로 묶는다.

   ── KECO 를 버리지 않는다 (중요) ──
   그룹은 **화면의 첫 칸일 뿐**이고, 그 아래 2차 분류·직업·임금·선배 스펙 집계는
   전부 KECO 그대로다. 바꿨다면 이런 것들이 한꺼번에 무너진다:
     · 직업별 평균임금(임금직업정보시스템이 KECO 코드로 준다)
     · 선배 스펙 집계·CAS 벤치마크(2차 분류 단위 · wage-jobs.js OVERLAY 의 legacy 매핑)
     · 회사 찾기 계열 매핑(company-sectors.js SECTORS_BY_MIDDLE · SECTIONS_BY_JOB)
     · 이미 저장된 사용자의 목표 직무(roadmap 의 major/middle/job)
   그래서 **덧붙이는 층**으로 만들었다. 그룹을 지우면 예전 화면으로 그대로 돌아간다.

   ── '그 외 직무' 칸을 반드시 남긴다 ──
   16개 그룹은 대졸 공채 중심이라 461개 직업의 절반쯤이 어디에도 안 들어간다
   (교육·보건의료·법률·예술·미용·음식·운전·농림어업·군인…). 그 직업들을 목록에서
   빼는 것은 **이 저장소가 한 번 했다가 되돌린 일이다** — job-filter.js 로 걸렀다가
   "특성화고 출신·전과 준비생처럼 그 칸을 실제로 고르는 사람이 자기 직업이 목록에
   없는 화면을 보게 된다"는 이유로 되돌렸다(catalog-db.js jobCatalog 주석, 2026-08-11
   사용자 결정). 같은 실수를 반복하지 않도록 남는 직업은 전부 마지막 칸에 담는다.

   ── 이름으로 적고 코드로 푼다 ──
   직업을 코드(K000001079)로 적으면 읽는 사람이 무엇을 묶었는지 알 수 없고, 손으로
   적다 틀리기 쉽다(실측: company-sectors 에서 코드 7개를 지어 적어 전부 틀렸다).
   여기서는 **직업 이름 그대로** 적고 카탈로그에서 코드를 찾는다. 이름이 바뀌거나
   오타가 나면 test/job-groups.test.js 가 잡는다 — 조용히 빠지면 안 된다.
   ══════════════════════════════════════════════════════════════ */

/* 각 그룹은 둘 중 하나(또는 둘 다)로 담는다.
     middles : 2차 분류를 통째로 (그 분류 전체가 이 그룹인 경우)
     jobs    : 직업 이름으로 골라서 (한 분류가 여러 그룹으로 갈리는 경우)
   순서가 화면 순서다 — 지원자가 많은 사무직군을 앞에, 기술직군을 뒤에 둔다. */
const GROUPS = [
  {
    id: 'plan', label: '기획/전략/경영', emoji: '🧭',
    desc: '사업 방향을 정하고 조직을 움직이는 자리',
    /* 관리직(01)을 통째로 넣었다가 뺐다 — 그 칸에는 교장·유치원 원장·정부 고위공무원이
       같이 들어 있어서 '기획/전략/경영' 밑에 학교가 뜬다. 관리자는 **업종을 따라**
       흩어 놓고(금융관리자→금융권, 정보통신 관리자→IT …), 여기에는 업종을 안 가리는
       경영 관리자만 남긴다. 나머지는 '그 외 직무' 로 간다. */
    jobs: ['기업 대표 및 기업 고위 임원', '경영 지원 관리자',
           '경영 기획 사무원', '경영 및 진단 전문가', '조사전문가', '정부·공공행정전문가'],
  },
  {
    id: 'hr', label: '인사/총무', emoji: '👥',
    desc: '사람을 뽑고 키우고, 조직이 돌아가게 하는 자리',
    jobs: ['인사·교육·훈련사무원', '인적자원전문가', '노무사', '총무사무원',
           '비서', '전산자료입력원 및 사무보조원'],
  },
  {
    id: 'finance-office', label: '재무/회계', emoji: '📊',
    desc: '돈의 흐름을 기록하고 검증하는 자리',
    jobs: ['회계사', '회계사무원', '경리사무원', '감사사무원', '세무사', '조세행정사무원', '감정평가사'],
  },
  {
    id: 'marketing', label: '마케팅/운영/홍보', emoji: '📣',
    desc: '알리고 팔리게 만드는 자리',
    jobs: ['광고 및 홍보 전문가', '광고·홍보·마케팅사무원', '마케팅 및 광고·홍보 관리자'],
  },
  {
    id: 'event', label: '전시/컨벤션', emoji: '🎪',
    desc: '행사·전시를 기획하고 운영하는 자리',
    jobs: ['행사·전시 및 회의 기획자', '학예사(큐레이터)', '공연·영화 및 음반 기획자'],
  },
  {
    id: 'sales', label: '영업/고객상담', emoji: '🤝',
    desc: '고객을 만나 계약과 관계를 만드는 자리',
    middles: ['61'],                       // 영업·판매직
    jobs: ['영업기획·관리·지원사무원', '고객상담원', '영업 및 판매 관련 관리자'],
  },
  {
    id: 'md', label: '상품기획/MD', emoji: '🏷️',
    desc: '무엇을 팔지 정하고 상품을 만드는 자리',
    jobs: ['상품 기획 전문가'],
  },
  {
    id: 'scm', label: '구매/자재/재고', emoji: '📦',
    desc: '물건을 사고 재고를 관리하는 자리',
    jobs: ['자재관리 사무원(물류사무원)'],
  },
  {
    id: 'trade', label: '무역사무/수출입', emoji: '🚢',
    desc: '국경을 넘는 거래와 통관을 다루는 자리',
    jobs: ['무역 사무원', '해외영업원', '관세사', '관세 행정 사무원',
           '수상 및 항공운송 사무원', '도로 및 철도운송 사무원', '운송 관련 관리자'],
  },
  {
    id: 'design', label: '디자인', emoji: '🎨',
    desc: '화면·제품·공간을 보이게 만드는 자리',
    jobs: ['UX/UI디자이너', '웹디자이너', '시각 디자이너', '영상그래픽디자이너',
           '게임그래픽디자이너', '제품 디자이너', '실내장식디자이너',
           '의상디자이너', '패션소품디자이너(의상제외)'],
  },
  {
    id: 'production', label: '생산/제조', emoji: '🏭',
    desc: '현장에서 만들고 정비하는 자리',
    middles: ['81', '82', '83', '84', '85', '86', '87', '88', '89'],
    jobs: ['생산 및 품질관리 사무원', '제품 생산 관련 관리자'],
  },
  {
    id: 'mechanical', label: '자동차/조선/기계', emoji: '🚗',
    desc: '기계·수송장비를 설계하고 만드는 자리',
    jobs: ['자동차공학기술자', '조선·해양공학기술자', '항공공학기술자',
           '건설기계공학기술자 및 연구원', '플랜트기계공학기술자',
           '로봇공학기술자 및 연구원', '기계 및 로봇공학 시험원', '제도사(캐드원)'],
  },
  {
    id: 'semicon', label: '반도체/디스플레이', emoji: '💾',
    desc: '반도체·디스플레이·전자부품을 개발하는 자리',
    jobs: ['반도체공학 기술자 및 연구원', '디스플레이연구 및 개발자',
           '전자제품 및 부품 개발기술자', '전기 및 전자공학 시험원',
           '전자계측제어기술자', '컴퓨터 하드웨어 기술자 및 연구원'],
  },
  {
    id: 'rnd', label: '연구개발/설계', emoji: '🔬',
    desc: '소재·화학·바이오·환경·건설을 연구하고 설계하는 자리',
    middles: ['12', '14'],                 // 자연·생명과학 연구직 · 건설·채굴 공학기술직
    jobs: ['석유화학공학기술자 및 연구원', '고무 및 플라스틱 화학공학기술자 및 연구원',
           '도료 및 농약품 화학공학기술자 및 연구원', '비누 및 화장품 화학공학기술자 및 연구원',
           '의약품공학기술자 및 연구원', '식품공학 기술자 및 연구원', '식품공학 시험원',
           '섬유공학 기술자 및 연구원', '섬유공학 시험원(섬유·염료)',
           '금속·재료공학 기술자 및 연구원', '금속 및 재료공학 시험원',
           '가스·에너지공학 기술자 및 연구원', '가스·에너지시험원 및 진단전문가',
           '발전설비기술자', '송·배전설비기술자', '전기기기·제품개발기술자 및 연구원',
           '전기계측제어기술자(전기패널, 계장, 공정자동화전기 등)', '전기감리기술자', '전기안전기술자',
           '대기환경기술자', '수질환경기술자', '토양환경기술자 및 연구원', '폐기물처리기술자',
           '소음진동기술자 및 연구원', '환경공학 시험원', '환경영향평가원',
           '화학공학 시험원', '보건위생·환경검사원',
           '소방공학 기술자 및 연구원', '산업안전원 및 위험관리원', '비파괴검사원',
           '연구관리자'],
  },
  {
    id: 'it', label: 'IT/개발/데이터', emoji: '💻',
    desc: '소프트웨어·데이터·인프라를 만드는 자리',
    middles: ['13'],                       // 정보통신 연구개발직 및 공학기술직
    jobs: ['정보 통신 관련 관리자'],
  },
  {
    id: 'bank', label: '금융권', emoji: '🏦',
    desc: '은행·증권·보험에서 돈을 다루는 자리',
    middles: ['03'],                       // 금융·보험직
    jobs: ['금융관리자', '보험관리자'],
  },
];

/* 어느 그룹에도 안 들어간 직업이 가는 칸. **지우지 않는다** — 머리주석의
   '그 외 직무 칸을 반드시 남긴다' 참고. */
const REST = {
  id: 'etc', label: '그 외 직무', emoji: '🗂️',
  desc: '교육·보건의료·법률·예술·서비스 등 위 분류에 담기지 않는 직업',
};

/* ── 카탈로그에 그룹을 얹는다 ────────────────────────────────────
   tree 는 /api/jobs 가 주는 모양({ majors: [{ code, name, middles: [{ code, jobs }] }] }).
   원본을 건드리지 않고 **그룹별로 어떤 2차 분류·직업이 들어가는지**만 계산해 돌려준다.

   돌려주는 그룹 하나:
     { id, label, emoji, desc, middles: [{ major, code, name, jobCodes: [...] }], jobCount }
   화면은 이걸로 2차 분류 칸과 직업 카드를 그린다. 원본 트리를 그대로 두는 이유는
   임금·legacy 매핑이 전부 거기 붙어 있어서다. */
function build(tree) {
  const middles = [];                       // 평평하게 펴 둔다
  for (const M of tree?.majors || []) {
    for (const m of M.middles || []) {
      middles.push({ major: M.code, code: m.code, name: m.name, jobs: m.jobs || [] });
    }
  }

  /* 이름 → 직업. 같은 이름이 두 분류에 있으면 먼저 나온 것을 쓴다(실측상 없다). */
  const byName = new Map();
  for (const m of middles) {
    for (const j of m.jobs) if (!byName.has(j.name)) byName.set(j.name, { job: j, mid: m });
  }

  const taken = new Set();                  // 이미 어느 그룹이 가져간 직업 코드
  const missing = [];                       // 카탈로그에서 못 찾은 이름 — 점검용
  const out = [];

  for (const g of GROUPS) {
    const picked = new Map();               // 2차 분류 코드 → 직업 코드 목록

    const add = (mid, job) => {
      if (taken.has(job.code)) return;      // 앞 그룹이 이미 가져갔다
      taken.add(job.code);
      const key = `${mid.major}:${mid.code}`;
      if (!picked.has(key)) picked.set(key, { major: mid.major, code: mid.code, name: mid.name, jobCodes: [] });
      picked.get(key).jobCodes.push(job.code);
    };

    for (const code of g.middles || []) {
      const mid = middles.find(m => m.code === code);
      if (!mid) { missing.push(`중분류 ${code}`); continue; }
      for (const j of mid.jobs) add(mid, j);
    }
    for (const name of g.jobs || []) {
      const hit = byName.get(name);
      if (!hit) { missing.push(name); continue; }
      add(hit.mid, hit.job);
    }

    const list = [...picked.values()];
    out.push({
      id: g.id, label: g.label, emoji: g.emoji, desc: g.desc,
      middles: list,
      jobCount: list.reduce((n, m) => n + m.jobCodes.length, 0),
    });
  }

  /* 남은 직업 전부를 마지막 칸에 담는다. */
  const rest = new Map();
  for (const m of middles) {
    for (const j of m.jobs) {
      if (taken.has(j.code)) continue;
      const key = `${m.major}:${m.code}`;
      if (!rest.has(key)) rest.set(key, { major: m.major, code: m.code, name: m.name, jobCodes: [] });
      rest.get(key).jobCodes.push(j.code);
    }
  }
  const restList = [...rest.values()];
  if (restList.length) {
    out.push({
      ...REST,
      middles: restList,
      jobCount: restList.reduce((n, m) => n + m.jobCodes.length, 0),
    });
  }

  return { groups: out, missing };
}

module.exports = { GROUPS, REST, build };
