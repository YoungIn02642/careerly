// ════════════════════════════════════════════════════════════
//  CAREERLY  —  Spec Aggregation Engine
//   • computeAggregate(filter)  : { count, gpa, certs, scores, qual }
//     filter: { dept?, field?, job?, corpType? } 모두 옵션. 미지정 시 전체.
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

    // NCS 중분류 키 — 커리어 로드맵(NCS 분류) 에서 사용. 'ncs:<대분류>:<중분류>'
    'ncs:02:plan': [{ id: '경영지도사' }, { id: 'ADsP', desc: '데이터 기반 기획' }, { id: '컴퓨터활용능력 1급' }],
    'ncs:02:hr':   [{ id: '공인노무사' }, { id: '경영지도사(인적자원)' }],
    'ncs:02:fin':  [{ id: 'CPA', desc: '회계법인 · 컨설팅' }, { id: '재경관리사' }, { id: '전산세무 1급' }],
    'ncs:03:finance': [
      { id: '금융투자분석사',       desc: 'IB · 증권' },
      { id: '투자자산운용사',       desc: '자산운용사 필수급' },
      { id: 'CFA Level 1',          desc: '글로벌 금융' },
      { id: '재무위험관리사(FRM)',  desc: '리스크 관리' },
      { id: '은행FP(AFPK)',         desc: '은행 창구·PB' },
    ],
    'ncs:03:insurance': [{ id: '손해사정사' }, { id: '보험계리사' }, { id: '언더라이터(AIU)' }],
    'ncs:04:natural':   [{ id: 'ADsP' }, { id: 'SQLD' }, { id: '사회조사분석사 2급' }],
    'ncs:05:law':       [{ id: '변호사 시험' }, { id: '법무사' }, { id: '변리사' }],
    'ncs:06:health':    [{ id: '임상심리사' }, { id: '보건교육사' }, { id: '의무기록사' }],
    'ncs:08:ad':        [{ id: '구글애널리틱스(GA4)' }, { id: 'ADsP' }, { id: 'GTQ 1급' }],
    'ncs:08:design':    [{ id: 'GTQ 1급' }, { id: '컬러리스트기사' }, { id: '웹디자인기능사' }],
    'ncs:14:arch':      [{ id: '건축기사' }, { id: '건축설비기사' }],
    'ncs:15:design':    [{ id: '일반기계기사' }, { id: '기계설계산업기사' }],
    'ncs:17:chem':      [{ id: '화공기사' }, { id: '위험물산업기사' }],
    'ncs:17:bio':       [{ id: '생물공학기사' }, { id: 'GMP 교육이수' }],
    'ncs:19:semi':      [{ id: '반도체설계기사' }, { id: '전자기사' }],
    'ncs:19:electric':  [{ id: '전기기사' }, { id: '전기공사기사' }],
    'ncs:20:it': [
      { id: '정보처리기사', desc: 'IT 직무 가산점' },
      { id: 'SQLD',         desc: '데이터 관련 직무 필수급' },
      { id: 'ADsP',         desc: '데이터 분석 입문' },
      { id: 'AWS SAA',      desc: '클라우드 직무 강점' },
      { id: 'CKA',          desc: 'DevOps · 인프라' },
      { id: '정보보안기사',  desc: '보안 직무' },
    ],
    'ncs:23:safety':    [{ id: '산업안전기사' }, { id: '위험물산업기사' }],
    'ncs:23:env':       [{ id: '환경기사' }, { id: '수질환경기사' }],
  };

  /* 기업 유형 4분류 — 커리어 로드맵 STEP 02 에서 중분류를 한 번 더 쪼갠다.
     스펙의 corpType 필드와 1:1. 옛 스펙에는 corpType 이 없어 어느 유형에도
     잡히지 않는다(중분류 전체 집계에만 포함).
     cas: CAS.TARGETS 의 지원처 키. 공기업은 학점 블라인드라 배점이 다르다. */
  const CORP_TYPES = [
    { id: 'large',  label: '대기업',   icon: '🏢', cas: 'private', desc: '대기업 · 계열사' },
    { id: 'mid',    label: '중견기업', icon: '🏬', cas: 'private', desc: '중견기업' },
    { id: 'small',  label: '중소기업', icon: '🏭', cas: 'startup', desc: '중소기업 · 스타트업' },
    { id: 'public', label: '공기업',   icon: '🏛️', cas: 'public',  desc: '공기업 · 공공기관' },
  ];

  /* 정성 활동 유형은 설문(구글폼) 구조와 CAS 채점 가중치의 단일 출처인
     CAS.ACTIVITY_TYPES 를 그대로 쓴다. (cas.js 가 이 파일보다 나중에 로드되므로
     로드 시점 상수로 잡지 않고, 집계가 호출되는 런타임에 읽는다.) */
  const activityTypes = () => (typeof CAS !== 'undefined' ? CAS.ACTIVITY_TYPES : []);

  /* 스펙이 특정 활동 유형을 보유했는가 (옛 boolean qual 도 CAS 가 환산해준다) */
  function hasActivityType(s, id) {
    const acts = (typeof CAS !== 'undefined')
      ? CAS.normalizeActivities(s)
      : (Array.isArray(s.activities) ? s.activities : []);
    return acts.some(a => a.type === id);
  }

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
  //   where  : 임의 조건 함수. NCS 분류처럼 dept/field/job 로 표현되지 않는
  //            묶음을 집계할 때 사용한다. dept/field/job 와 함께 쓸 수 있다.
  //   certKey: 자격증 카탈로그를 고를 키 (미지정 시 dept 사용)
  //   corpType: 기업 유형 4분류 ('large'|'mid'|'small'|'public'). 미지정 시 전체.
  function compute({ dept, field, job, corpType, where, certKey } = {}) {
    let specs = DB.getAllSpecs();
    if (dept)  specs = specs.filter(s => s.dept  === dept);
    if (field) specs = specs.filter(s => s.field === field);
    if (job)   specs = specs.filter(s => s.job   === job);
    if (corpType) specs = specs.filter(s => s.corpType === corpType);
    if (where) specs = specs.filter(where);

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
    const catalogKey = certKey || dept;
    const deptCatalog = catalogKey ? (CERT_CATALOG[catalogKey] || []) : [];
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

    // 정성스펙 — 활동 유형별 보유율 (CAS 가중치 tier 포함)
    const qual = activityTypes().map(t => {
      const have = specs.filter(s => hasActivityType(s, t.id)).length;
      return {
        id: t.id, label: t.label, icon: t.icon, help: t.help, tier: t.tier, base: t.base,
        pct: Math.round(have / specs.length * 100),
        n: have,
      };
    });

    // 합격자 평균 정성 원점수 — CAS 정성 채점의 벤치마크(benchRaw)로 쓰인다
    const qualRaws = (typeof CAS !== 'undefined')
      ? specs.map(s => CAS.qualRaw(CAS.normalizeActivities(s))).filter(x => x > 0)
      : [];
    const qualBenchRaw = qualRaws.length ? Math.round(avg(qualRaws)) : null;

    return { count: specs.length, empty: false, gpa, certs, scores, qual, qualBenchRaw };
  }

  return {
    compute, CERT_CATALOG, CORP_TYPES, OPIC_LEVELS, TS_LEVELS,
    hasActivityType,
    // 정성 활동 유형 — CAS.ACTIVITY_TYPES 를 런타임에 노출 (단일 출처)
    get ACTIVITY_TYPES() { return activityTypes(); },
    get QUAL_FIELDS()    { return activityTypes(); },   // 예전 이름 호환
  };
})();
