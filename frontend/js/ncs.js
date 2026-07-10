// ════════════════════════════════════════════════════════════
//  CAREERLY — NCS 직업 분류 카탈로그
//   국가직무능력표준(NCS, ncs.go.kr) 의 24개 직업 "대분류" 를 최상위로 두고,
//   각 대분류 아래 중분류 → 소분류(세부 직무) 로 나눈다.
//
//   legacy 필드
//   ────────────
//   스펙 레코드(DB.getAllSpecs())는 이 화면이 학과 기반이던 시절의
//   { dept, field, job } 스키마를 그대로 쓴다. 기존에 입력된 스펙을 버리지 않기 위해,
//   중분류마다 "이 중분류로 취업한 것으로 볼 수 있는 옛 스펙"의 조건을 legacy 로 적어둔다.
//   legacy 가 없는 중분류는 아직 매칭되는 스펙이 없어 빈 상태로 표시된다. (정상)
// ════════════════════════════════════════════════════════════
window.NCS = (() => {

  const MAJORS = [
    {
      id: '01', name: '사업관리', emoji: '📋',
      desc: '프로젝트·사업 기획과 관리 전반을 다루는 직무군입니다.',
      middles: [
        { id: 'proj', name: '프로젝트관리',
          majors: ['경영학', '산업공학'],
          smalls: ['프로젝트 기획', '프로젝트 실행관리', '사업평가'],
          legacy: { dept: ['business'], field: ['corp'] } },
        { id: 'global', name: '해외 사업관리',
          majors: ['국제통상학', '경영학'],
          smalls: ['해외사업 기획', '해외사업 운영'] },
      ],
    },
    {
      id: '02', name: '경영·회계·사무', emoji: '🗂️',
      desc: '기획·인사·재무·총무 등 기업 내부 관리 직무를 아우르는 가장 큰 직무군입니다.',
      middles: [
        { id: 'plan', name: '기획사무',
          majors: ['경영학', '경제학'],
          smalls: ['경영기획', '마케팅 전략', '홍보·광고', '사무행정'],
          legacy: { dept: ['business'], field: ['corp', 'consulting'] } },
        { id: 'hr', name: '인사·조직',
          majors: ['경영학', '심리학'],
          smalls: ['인사', '노무관리', '인재개발'],
          legacy: { dept: ['psych'], field: ['hr'] } },
        { id: 'fin', name: '재무·회계',
          majors: ['회계학', '경영학'],
          smalls: ['재무', '회계', '세무'],
          legacy: { dept: ['accounting'] } },
        { id: 'prod', name: '생산·품질관리',
          majors: ['산업공학'],
          smalls: ['생산관리', '품질관리'] },
      ],
    },
    {
      id: '03', name: '금융·보험', emoji: '🏦',
      desc: '은행·증권·자산운용·보험 등 자본과 리스크를 다루는 금융 직무군입니다.',
      middles: [
        { id: 'finance', name: '금융',
          majors: ['경영학', '경제학', '통계학'],
          smalls: ['은행·수신·여신', '증권·외환', '자산운용', '신용분석'],
          legacy: { dept: ['business', 'economics'], field: ['finance'] } },
        { id: 'insurance', name: '보험',
          majors: ['통계학', '경영학'],
          smalls: ['보험상품개발', '손해사정', '언더라이팅'] },
      ],
    },
    {
      id: '04', name: '교육·자연·사회과학', emoji: '🔬',
      desc: '교육과 연구, 자연·사회과학 기반의 분석 직무군입니다.',
      middles: [
        { id: 'edu', name: '교육',
          majors: ['교육학', '사범계열'],
          smalls: ['유·초·중등 교육', '평생교육', '이러닝'] },
        { id: 'natural', name: '자연과학',
          majors: ['통계학', '수학', '물리학'],
          smalls: ['통계·데이터분석', '수리연구', '자연과학 연구'],
          legacy: { dept: ['stat'] } },
        { id: 'social', name: '사회과학',
          majors: ['사회학', '행정학'],
          smalls: ['사회조사', '정책연구'] },
      ],
    },
    {
      id: '05', name: '법률·경찰·소방·교도·국방', emoji: '⚖️',
      desc: '법률 서비스와 공공 안전·국방을 담당하는 직무군입니다.',
      middles: [
        { id: 'law', name: '법률',
          majors: ['법학'],
          smalls: ['법무', '법률 사무', '지식재산 관리'],
          legacy: { dept: ['law'] } },
        { id: 'safety', name: '경찰·소방·교도',
          majors: ['경찰행정학'],
          smalls: ['경찰', '소방', '교정'] },
        { id: 'defense', name: '국방',
          majors: ['군사학'],
          smalls: ['국방 기획', '군수'] },
      ],
    },
    {
      id: '06', name: '보건·의료', emoji: '🩺',
      desc: '진료·간호·의료기술과 보건행정을 포괄하는 직무군입니다.',
      middles: [
        { id: 'medical', name: '의료',
          majors: ['의학', '간호학'],
          smalls: ['의료진료', '간호', '의료기술'] },
        { id: 'health', name: '보건·의료지원',
          majors: ['보건학', '심리학'],
          smalls: ['보건행정', '의료정보관리', '임상심리'],
          legacy: { dept: ['psych'], field: ['clinical'] } },
      ],
    },
    {
      id: '07', name: '사회복지·종교', emoji: '🤝',
      desc: '복지 서비스 제공과 상담·돌봄을 담당하는 직무군입니다.',
      middles: [
        { id: 'welfare', name: '사회복지',
          majors: ['사회복지학'],
          smalls: ['사회복지 실천', '복지행정'] },
        { id: 'counsel', name: '상담',
          majors: ['심리학', '상담학'],
          smalls: ['청소년 상담', '직업 상담'] },
      ],
    },
    {
      id: '08', name: '문화·예술·디자인·방송', emoji: '🎨',
      desc: '콘텐츠 기획·제작과 디자인, 광고·방송 직무군입니다.',
      middles: [
        { id: 'design', name: '디자인',
          majors: ['시각디자인', '산업디자인'],
          smalls: ['시각디자인', 'UI/UX 디자인', '제품디자인'] },
        { id: 'broadcast', name: '방송·연예',
          majors: ['미디어학', '신문방송학'],
          smalls: ['방송 PD', '방송 제작', '영상편집'],
          legacy: { dept: ['media'], field: ['media'] } },
        { id: 'ad', name: '광고·홍보',
          majors: ['미디어학', '경영학'],
          smalls: ['브랜드 마케팅', '디지털 마케팅', '광고기획(AE)'],
          legacy: { dept: ['media', 'business'], field: ['marketing'] } },
      ],
    },
    {
      id: '09', name: '운전·운송', emoji: '🚚',
      desc: '육상·항공·해상 운송과 물류 운영 직무군입니다.',
      middles: [
        { id: 'road', name: '육상운전·운송',
          majors: ['물류학'], smalls: ['화물운송', '운송관리'] },
        { id: 'air', name: '항공운전·운송',
          majors: ['항공운항학'], smalls: ['운항관리', '객실승무'] },
      ],
    },
    {
      id: '10', name: '영업판매', emoji: '🛒',
      desc: '고객 대상 영업과 판매·유통 관리 직무군입니다.',
      middles: [
        { id: 'sales', name: '영업',
          majors: ['경영학'], smalls: ['B2B 영업', '기술영업', '해외영업'] },
        { id: 'retail', name: '판매',
          majors: ['유통학'], smalls: ['매장 판매', '상품기획(MD)'] },
      ],
    },
    {
      id: '11', name: '경비·청소', emoji: '🧹',
      desc: '시설 경비와 환경 미화 직무군입니다.',
      middles: [
        { id: 'guard', name: '경비', majors: [], smalls: ['시설경비', '특수경비'] },
        { id: 'clean', name: '청소', majors: [], smalls: ['건물 청소', '방역'] },
      ],
    },
    {
      id: '12', name: '이용·숙박·여행·오락·스포츠', emoji: '🏨',
      desc: '호텔·여행·레저·스포츠 서비스 직무군입니다.',
      middles: [
        { id: 'hotel', name: '숙박·여행',
          majors: ['호텔경영학', '관광학'], smalls: ['호텔 운영', '여행상품 기획'] },
        { id: 'sports', name: '스포츠',
          majors: ['체육학'], smalls: ['스포츠 지도', '스포츠 마케팅'] },
      ],
    },
    {
      id: '13', name: '음식서비스', emoji: '🍳',
      desc: '조리와 외식업 운영 직무군입니다.',
      middles: [
        { id: 'cook', name: '조리', majors: ['조리학', '식품영양학'], smalls: ['한식조리', '양식조리', '제과제빵'] },
        { id: 'fnb', name: '외식경영', majors: ['외식경영학'], smalls: ['매장 운영', '메뉴 개발'] },
      ],
    },
    {
      id: '14', name: '건설', emoji: '🏗️',
      desc: '건축·토목 설계와 시공·관리 직무군입니다.',
      middles: [
        { id: 'arch', name: '건축', majors: ['건축학', '건축공학'], smalls: ['건축설계', '건축시공', '건축설비'] },
        { id: 'civil', name: '토목', majors: ['토목공학'], smalls: ['토목설계', '토목시공'] },
        { id: 'plant', name: '플랜트', majors: ['기계공학', '화학공학'], smalls: ['플랜트 설계', '플랜트 시공'] },
      ],
    },
    {
      id: '15', name: '기계', emoji: '⚙️',
      desc: '기계 설계·생산·정비 직무군입니다.',
      middles: [
        { id: 'design', name: '기계설계', majors: ['기계공학'], smalls: ['기구설계', '금형설계', 'CAE 해석'] },
        { id: 'auto', name: '자동차', majors: ['기계공학', '자동차공학'], smalls: ['자동차 설계', '자동차 생산'] },
        { id: 'maint', name: '기계장비 설치·정비', majors: ['기계공학'], smalls: ['설비 보전', '장비 정비'] },
      ],
    },
    {
      id: '16', name: '재료', emoji: '🧱',
      desc: '금속·비금속 재료의 가공과 품질 직무군입니다.',
      middles: [
        { id: 'metal', name: '금속·재료', majors: ['신소재공학', '금속공학'], smalls: ['금속가공', '열처리', '재료시험'] },
        { id: 'ceramic', name: '세라믹', majors: ['신소재공학'], smalls: ['세라믹 제조'] },
      ],
    },
    {
      id: '17', name: '화학·바이오', emoji: '🧪',
      desc: '화학 공정과 바이오·제약 연구개발 직무군입니다.',
      middles: [
        { id: 'chem', name: '화학공업', majors: ['화학공학', '화학'], smalls: ['화학공정 운전', '화학제품 개발', '품질관리(QC)'] },
        { id: 'bio', name: '바이오·제약', majors: ['생명공학', '약학'], smalls: ['바이오 연구', '제약 생산', '임상시험(CRA)'] },
      ],
    },
    {
      id: '18', name: '섬유·의복', emoji: '🧵',
      desc: '섬유 제조와 패션 기획·생산 직무군입니다.',
      middles: [
        { id: 'textile', name: '섬유', majors: ['섬유공학'], smalls: ['섬유 제조', '염색·가공'] },
        { id: 'fashion', name: '의복', majors: ['의류학'], smalls: ['패션 디자인', '패션 MD', '패턴'] },
      ],
    },
    {
      id: '19', name: '전기·전자', emoji: '🔌',
      desc: '전기 설비와 반도체·전자기기 개발 직무군입니다.',
      middles: [
        { id: 'electric', name: '전기', majors: ['전기공학'], smalls: ['전기설비 설계', '전기 시공·감리'] },
        { id: 'semi', name: '반도체', majors: ['전자공학', '신소재공학'], smalls: ['반도체 공정', '반도체 회로설계', '반도체 장비'] },
        { id: 'elec', name: '전자기기', majors: ['전자공학'], smalls: ['회로설계', '임베디드 개발', '디스플레이 개발'] },
      ],
    },
    {
      id: '20', name: '정보통신', emoji: '💻',
      desc: 'IT 서비스 개발과 통신·방송 기술 직무군입니다.',
      middles: [
        { id: 'it', name: '정보기술',
          majors: ['컴퓨터공학', '소프트웨어학', '통계학'],
          smalls: ['백엔드 개발', '프론트엔드 개발', '모바일 개발', 'AI/ML', '데이터 엔지니어링', '정보보안'],
          legacy: { dept: ['cs'] } },
        { id: 'comm', name: '통신기술', majors: ['정보통신공학'], smalls: ['유무선 통신망 설계', '네트워크 운용'] },
        { id: 'bcast', name: '방송기술', majors: ['전자공학'], smalls: ['방송 송출', '방송 장비 운용'] },
      ],
    },
    {
      id: '21', name: '식품가공', emoji: '🥫',
      desc: '식품 제조·가공과 품질·위생 관리 직무군입니다.',
      middles: [
        { id: 'process', name: '식품가공', majors: ['식품공학', '식품영양학'], smalls: ['식품 제조', '식품 개발'] },
        { id: 'qc', name: '식품품질관리', majors: ['식품공학'], smalls: ['품질관리', '위생관리(HACCP)'] },
      ],
    },
    {
      id: '22', name: '인쇄·목재·가구·공예', emoji: '🪵',
      desc: '인쇄와 목재·가구·공예 제조 직무군입니다.',
      middles: [
        { id: 'print', name: '인쇄·출판', majors: ['시각디자인'], smalls: ['인쇄 제작', '출판 편집'] },
        { id: 'wood', name: '목재·가구·공예', majors: ['가구디자인'], smalls: ['가구 제작', '공예 제작'] },
      ],
    },
    {
      id: '23', name: '환경·에너지·안전', emoji: '♻️',
      desc: '환경 관리와 에너지, 산업안전 직무군입니다.',
      middles: [
        { id: 'env', name: '환경', majors: ['환경공학'], smalls: ['수질 관리', '대기 관리', '폐기물 관리'] },
        { id: 'energy', name: '에너지·자원', majors: ['에너지공학'], smalls: ['에너지 관리', '신재생에너지'] },
        { id: 'safety', name: '산업안전', majors: ['안전공학'], smalls: ['산업안전 관리', '위험성 평가'] },
      ],
    },
    {
      id: '24', name: '농림어업', emoji: '🌾',
      desc: '작물·축산·임업·수산 생산과 관리 직무군입니다.',
      middles: [
        { id: 'agri', name: '농업', majors: ['농학', '원예학'], smalls: ['작물 재배', '스마트팜 운영'] },
        { id: 'livestock', name: '축산', majors: ['축산학'], smalls: ['가축 사육', '축산물 위생'] },
        { id: 'forest', name: '임업·수산', majors: ['산림학', '수산학'], smalls: ['산림 관리', '수산 양식'] },
      ],
    },
  ];

  const byId = id => MAJORS.find(m => m.id === id) || null;
  const middleById = (majorId, middleId) =>
    (byId(majorId)?.middles || []).find(m => m.id === middleId) || null;

  /* legacy 조건 → 스펙 레코드 판별 함수.
     dept 는 반드시 일치해야 하고, field 가 지정된 경우 field 까지 일치해야 한다. */
  function matcher(legacy) {
    if (!legacy || !legacy.dept?.length) return null;
    return s =>
      legacy.dept.includes(s.dept) &&
      (!legacy.field?.length || legacy.field.includes(s.field));
  }

  /* 중분류 하나에 대응하는 스펙 판별 함수 (없으면 null) */
  function middleMatcher(majorId, middleId) {
    return matcher(middleById(majorId, middleId)?.legacy);
  }

  /* 대분류 전체 = 소속 중분류들의 합집합 (하나도 없으면 null) */
  function majorMatcher(majorId) {
    const fns = (byId(majorId)?.middles || []).map(m => matcher(m.legacy)).filter(Boolean);
    if (!fns.length) return null;
    return s => fns.some(fn => fn(s));
  }

  return { MAJORS, byId, middleById, middleMatcher, majorMatcher };
})();
