// ════════════════════════════════════════════════════════════
//  CAREERLY  —  Spec Aggregation Engine
//   • computeAggregate(filter)  : { count, gpa, certs, scores, qual }
//     filter: { dept?, field?, job? } 모두 옵션. 미지정 시 전체.
//   • OPIc / TOEIC Speaking 레벨은 ordinal scale 로 평균 후 다시 레벨로 환산
// ════════════════════════════════════════════════════════════
window.Aggregator = (() => {
  const OPIC_LEVELS = ['NL','NM','NH','IL','IM1','IM2','IM3','IH','AL'];
  const TS_LEVELS   = ['NL','NM','NH','IL','IM','IH','AL'];

  // 자격증/정성 스펙 카탈로그 — 화면에 정렬해 보여줄 때 사용
  const CERT_CATALOG = {
    cs: [
      { id: '정보처리기사',     desc: 'IT 직무 가산점' },
      { id: 'SQLD',             desc: '데이터 관련 직무 필수급' },
      { id: 'ADsP',             desc: '데이터 분석 입문' },
      { id: 'AWS SAA',          desc: '클라우드 직무 강점' },
      { id: 'CKA',              desc: 'DevOps · 인프라' },
      { id: 'GTQ 1급',          desc: '디자인 협업 시 가산' },
    ],
    business: [
      { id: '금융투자분석사',   desc: 'IB · 증권' },
      { id: '투자자산운용사',   desc: '자산운용사 필수급' },
      { id: 'CFA Level 1',      desc: '글로벌 금융' },
      { id: '재무위험관리사(FRM)', desc: '리스크 관리' },
      { id: '재경관리사',       desc: '재무회계 입문' },
      { id: 'CPA',              desc: '회계법인 · 컨설팅' },
    ],
    economics:  [{ id: 'CFA Level 1' }, { id: '투자자산운용사' }, { id: '재경관리사' }],
    accounting: [{ id: 'CPA' }, { id: '재경관리사' }, { id: 'TAT' }],
    stat:       [{ id: 'ADsP' }, { id: 'SQLD' }, { id: '데이터분석 준전문가' }],
    law:        [{ id: '변호사 시험' }, { id: '공인노무사' }, { id: '법무사' }],
    psych:      [{ id: '청소년 상담사' }, { id: '임상심리사' }],
    media:      [{ id: 'GTQ 1급' }, { id: 'ADsP' }, { id: '구글애널리틱스' }],
  };

  const QUAL_FIELDS = [
    { id: 'extracurricular', label: '대외활동',          icon: '🌐',
      help: '학회·공모전·서포터즈 등 — 협업 역량과 분야 관심도 증명' },
    { id: 'projects',         label: '참여 프로젝트',     icon: '🛠️',
      help: '캡스톤·해커톤·팀 프로젝트 — 실무 역량 직접 증명' },
    { id: 'internship',       label: '인턴십',            icon: '💼',
      help: '대부분 직무에서 가장 강력한 차별화 — 전환·정규직 합격에 직결' },
    { id: 'oncampus',         label: '교내활동',          icon: '🏫',
      help: '동아리·총학·조교 — 리더십·꾸준함 등 인성 평가 자료' },
    { id: 'coreCourses',      label: '필수 이수교과목',    icon: '📚',
      help: '직무 적합성 1차 필터 — 전공 학점·관련 수업 이수 여부' },
    { id: 'langStudy',        label: '어학연수',          icon: '✈️',
      help: '글로벌 직무·해외 영업 가산점 — 단순 연수보다 성과가 중요' },
    { id: 'exchange',         label: '교환학생',          icon: '🌍',
      help: '문화 적응력·자기주도성 어필 — 외국계 기업 합격률 ↑' },
    { id: 'gradSchool',       label: '대학원 진학',       icon: '🎓',
      help: 'R&D·연구직 진출 핵심 경로 — 학사로 진입 어려운 직무 우회' },
  ];

  // ── score helpers ──────────────────────────────────────────
  const avg = arr => arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : null;
  const round = (n, d=2) => n == null ? null : Math.round(n * 10**d) / 10**d;

  function opicAvg(levels) {
    const idxs = levels.filter(l => OPIC_LEVELS.includes(l)).map(l => OPIC_LEVELS.indexOf(l));
    if (!idxs.length) return null;
    return OPIC_LEVELS[Math.round(avg(idxs))];
  }
  function tsAvg(levels) {
    const idxs = levels.filter(l => TS_LEVELS.includes(l)).map(l => TS_LEVELS.indexOf(l));
    if (!idxs.length) return null;
    return TS_LEVELS[Math.round(avg(idxs))];
  }

  // ── main entry ─────────────────────────────────────────────
  function compute({ dept, field, job } = {}) {
    let specs = DB.getAllSpecs();
    if (dept)  specs = specs.filter(s => s.dept  === dept);
    if (field) specs = specs.filter(s => s.field === field);
    if (job)   specs = specs.filter(s => s.job   === job);

    if (specs.length === 0) {
      return { count: 0, empty: true };
    }

    // GPA — 4.5 환산
    const gpas = specs
      .map(s => s.gpa != null && s.gpaMax ? (s.gpa / s.gpaMax) * 4.5 : null)
      .filter(x => x != null);
    const gpa = gpas.length ? {
      avg: round(avg(gpas)),
      min: round(Math.min(...gpas)),
      max: round(Math.max(...gpas)),
      n:   gpas.length,
    } : null;

    // 자격증 보유율 — 학과 카탈로그 + 회원이 실제 입력한 모든 자격증 합집합
    const deptCatalog = dept ? (CERT_CATALOG[dept] || []) : [];
    const observed = new Set();
    specs.forEach(s => (s.certs || []).forEach(c => observed.add(c)));
    const certIds = [
      ...deptCatalog.map(c => c.id),
      ...[...observed].filter(c => !deptCatalog.some(d => d.id === c)),
    ];
    const certs = certIds.map(id => {
      const have = specs.filter(s => (s.certs || []).includes(id)).length;
      const meta = deptCatalog.find(c => c.id === id) || {};
      return { id, name: id, desc: meta.desc, pct: Math.round(have / specs.length * 100), n: have };
    }).filter(c => c.pct > 0 || deptCatalog.some(d => d.id === c.id));

    // 어학 평균
    const toeic = specs.map(s => s.scores?.toeic).filter(n => typeof n === 'number');
    const toefl = specs.map(s => s.scores?.toefl).filter(n => typeof n === 'number');
    const opic  = specs.map(s => s.scores?.opic).filter(Boolean);
    const ts    = specs.map(s => s.scores?.toeicSpeaking).filter(Boolean);

    const scores = {
      toeic:         toeic.length ? { avg: Math.round(avg(toeic)), min: Math.min(...toeic), max: Math.max(...toeic), n: toeic.length } : null,
      toefl:         toefl.length ? { avg: Math.round(avg(toefl)), min: Math.min(...toefl), max: Math.max(...toefl), n: toefl.length } : null,
      opic:          opic.length  ? { avg: opicAvg(opic), n: opic.length } : null,
      toeicSpeaking: ts.length    ? { avg: tsAvg(ts),    n: ts.length    } : null,
    };

    // 정성스펙 보유율
    const qual = QUAL_FIELDS.map(q => {
      const have = specs.filter(s => s.qual?.[q.id]).length;
      return {
        id: q.id, label: q.label, icon: q.icon, help: q.help,
        pct: Math.round(have / specs.length * 100),
        n: have,
      };
    });

    return { count: specs.length, empty: false, gpa, certs, scores, qual };
  }

  return { compute, CERT_CATALOG, QUAL_FIELDS, OPIC_LEVELS, TS_LEVELS };
})();
