/* ════════════════════════════════════════════════════════════
   C:road · Mentoring app — data + interactions
   ════════════════════════════════════════════════════════════ */

/* ── avatar palette ─────────────────────────────────────── */
const PALETTE = {
  purple: { bg:'#EEEDFE', ink:'#3C3489' },
  green:  { bg:'#E1F5EE', ink:'#085041' },
  orange: { bg:'#FAECE7', ink:'#712B13' },
  pink:   { bg:'#FBEAF0', ink:'#72243E' },
  blue:   { bg:'#E6F1FB', ink:'#0C447C' },
  teal:   { bg:'#E0F2F1', ink:'#0F5C57' },
};
const TAGCOLOR = {
  'IT·개발':   { bg:'#EEEDFE', ink:'#3C3489' },
  '핀테크':    { bg:'#E1F5EE', ink:'#085041' },
  '컨설팅':    { bg:'#FAECE7', ink:'#712B13' },
  '창업':      { bg:'#FBEAF0', ink:'#72243E' },
  '대기업':    { bg:'#E6F1FB', ink:'#0C447C' },
  '마케팅':    { bg:'#FBF1DF', ink:'#8A5A12' },
};

/* ── mentors (search + profile) ─────────────────────────── */
const MENTORS = [
  {
    id:'kim', name:'김민준', cohort:'20학번', tag:'IT·개발', cat:'IT·개발', pal:'purple',
    company:'카카오', role:'프론트엔드 엔지니어', cas:94, sessions:12, rating:4.8, similarity:78,
    path:'멋사 11기 → 네이버 인턴 → 카카오 FE',
    years:2, modes:['온라인'],
    specialties:['프론트엔드','React','비전공 취업','포트폴리오'],
    intro:'부트츠칔프로 시작해 네이버 인턴을 거쳐 카카오 FE로 합격했어요. 비전공·신입 포트폴리오 준비를 도와드려요.',
    timeline:[
      { c:'#534AB7', t:'카카오 FE 엔지니어',    d:'2024.03 ~ 현재', s:'커머스 플랫폼 프론트엔드 개발' },
      { c:'#AFA9EC', t:'네이버 인턴십',         d:'2023.07 ~ 2023.08', s:'사내 디자인 시스템 컴포넌트 구축' },
      { c:'#CECBF6', t:'멋쟁이사자처럼 11기',   d:'2022.03 ~ 2022.12', s:'웹 서비스 2건 출시, 해커톤 수상' },
      { c:'#E0DCF7', t:'컴퓨터공학과 입학',     d:'2020.03', s:'' },
    ],
  },
  {
    id:'lee', name:'이서연', cohort:'19학번', tag:'핀테크', cat:'금융', pal:'green',
    company:'토스', role:'데이터 분석가', cas:91, sessions:9, rating:4.9, similarity:71,
    path:'통계학회 → 신한 인턴 → 토스 DA',
    years:3, modes:['온라인','오프라인'],
    specialties:['데이터분석','SQL','A/B테스트','통계'],
    intro:'통계학과에서 데이터 직무로 진로를 잡았어요. 분석 포트폴리오와 면접 준비를 함께 준비해요.',
    timeline:[
      { c:'#16855f', t:'토스 데이터 분석가',    d:'2023.09 ~ 현재', s:'결제 퍼널 분석 및 A/B 테스트 설계' },
      { c:'#7FCBB3', t:'신한은행 인턴십',       d:'2022.12 ~ 2023.02', s:'리테일 고객 세그먼트 분석' },
      { c:'#CDE9DE', t:'통계분석 학회',         d:'2021.03 ~ 2022.06', s:'학회장, 캐글 대회 입상' },
      { c:'#E3F2EC', t:'통계학과 입학',         d:'2019.03', s:'' },
    ],
  },
  {
    id:'park', name:'박지훈', cohort:'18학번', tag:'컨설팅', cat:'컨설팅', pal:'orange',
    company:'맥킨지', role:'전략 컨설턴트', cas:96, sessions:21, rating:4.7, similarity:64,
    path:'경영학회 → BCG 인턴 → 맥킨지',
    years:4, modes:['오프라인','온라인'],
    specialties:['전략컨설팅','케이스면접','자소서첨삭','문제해결'],
    intro:'경영학회에서 케이스 스터디를 운영하며 컨설팅 커리어를 준비했어요. 케이스 면접과 자소서 프레임을 집어드려요.',
    timeline:[
      { c:'#B85C2E', t:'맥킨지 전략 컨설턴트',  d:'2022.07 ~ 현재', s:'대기업 신사업 전략 프로젝트 다수' },
      { c:'#D99B73', t:'BCG 인턴십',           d:'2021.06 ~ 2021.08', s:'리테일 디지털 전환 케이스' },
      { c:'#EBC8B0', t:'경영전략 학회',         d:'2019.03 ~ 2021.05', s:'케이스 스터디 운영, 공모전 대상' },
      { c:'#F4E2D5', t:'경영학과 입학',         d:'2018.03', s:'' },
    ],
  },
  {
    id:'choi', name:'최유진', cohort:'17학번', tag:'창업', cat:'창업', pal:'pink',
    company:'스타트업', role:'대표 · CEO', cas:89, sessions:7, rating:4.6, similarity:52,
    path:'창업동아리 → 시드 투자 → 시리즈 A',
    years:5, modes:['온라인'],
    specialties:['창업','IR·투자유치','B2B SaaS','팀빌딩'],
    intro:'교내 창업동아리에서 시작해 시리즈 A까지 왜어냈어요. 창업 아이디어 검증과 투자 유치 경험을 나눠요.',
    timeline:[
      { c:'#B23A5E', t:'스타트업 창업 · CEO',   d:'2021.01 ~ 현재', s:'B2B SaaS, 시리즈 A 60억 유치' },
      { c:'#D98FA9', t:'시드 투자 유치',        d:'2020.09', s:'엔젤 라운드 5억 원' },
      { c:'#EFC8D5', t:'교내 창업동아리',       d:'2018.03 ~ 2020.08', s:'대표, 창업경진대회 우승' },
      { c:'#F7E2EA', t:'경영학과 입학',         d:'2017.03', s:'' },
    ],
  },
  {
    id:'jung', name:'정태윤', cohort:'19학번', tag:'대기업', cat:'대기업', pal:'blue',
    company:'삼성전자', role:'백엔드 엔지니어', cas:90, sessions:11, rating:4.8, similarity:69,
    path:'알고리즘 동아리 → 삼성 인턴 → 정직원',
    years:3, modes:['온라인'],
    specialties:['백엔드','대용량 트래픽','CS 전공지식','코딩테스트'],
    intro:'알고리즘 동아리를 거쳐 삼성전자 백엔드로 입사했어요. 코딩테스트와 CS 면접을 집중 코칭해드려요.',
    timeline:[
      { c:'#1F5C99', t:'삼성전자 백엔드',       d:'2023.06 ~ 현재', s:'대용량 트래픽 서버 개발' },
      { c:'#6FA3CC', t:'삼성 SW 인턴십',        d:'2022.07 ~ 2022.08', s:'사내 플랫폼 API 개발' },
      { c:'#B6D3E8', t:'알고리즘 동아리',       d:'2020.03 ~ 2022.06', s:'ICPC 본선 진출' },
      { c:'#DCEAF4', t:'컴퓨터공학과 입학',     d:'2019.03', s:'' },
    ],
  },
  {
    id:'han', name:'한소희', cohort:'18학번', tag:'마케팅', cat:'마케팅', pal:'teal',
    company:'배달의민족', role:'브랜드 마케터', cas:88, sessions:8, rating:4.7, similarity:58,
    path:'마케팅 학회 → CJ 인턴 → 우아한형제들',
    years:4, modes:['온라인','오프라인'],
    specialties:['브랜드마케팅','캐페인기획','SNS마케팅','공모전'],
    intro:'마케팅 학회와 CJ 인턴을 거쳐 배민 브랜드 마케터가 됐어요. 직무 탐색과 공모전 포트폴리오를 도와드려요.',
    timeline:[
      { c:'#0F6B63', t:'우아한형제들 마케터',   d:'2022.09 ~ 현재', s:'브랜드 캠페인 기획 및 운영' },
      { c:'#5FAEA4', t:'CJ제일제당 인턴십',     d:'2021.07 ~ 2021.09', s:'신제품 SNS 마케팅' },
      { c:'#AED9D2', t:'마케팅 연합 학회',      d:'2019.03 ~ 2021.06', s:'공모전 3회 수상' },
      { c:'#DBEFEC', t:'미디어학과 입학',       d:'2018.03', s:'' },
    ],
  },
];

const CATEGORIES = ['사업관리','경영·회계·사무','금융·보험','교육·자연·사회과학','법률·경찰·소방·교도·국방','보건·의료','사회복지·종교','문화·예술·디자인·방송','운전·운송','영업판매','경비·청소','이용·숙박·여행·오락·스포츠','음식서비스','건설','기계','재료','화학·바이오','섬유·의복','전기·전자','정보통신','식품가공','인쇄·목재·가구·공예','환경·에너지·안전','농림어업'];
const CAT_NO = {}; CATEGORIES.forEach((c,i)=>{ CAT_NO[c] = String(i+1).padStart(2,'0'); });

/* ── NCS 24 분야별 멘토 데이터 풀 ────────────────────────────
   이름을 NCS 로 두면 js/ncs.js 의 window.NCS(직업 분류 카탈로그)를 가린다.
   최상위 const 는 window 에 붙지 않으면서 전역 스코프를 차지하기 때문. */
const MENTOR_POOL = {
  '사업관리':{roles:['사업기획 담당','PMO','경영기획','사업개발'],cos:['대기업 전략실','종합상사','공기업 기획처','IT기업 기획실','스타트업 사업팀'],specs:[['사업기획','사업계획서','예산관리','KPI설계'],['PMO','프로젝트관리','일정관리','리스크관리'],['경영기획','전략수립','시장분석','IR']],topics:['사업기획 직무 취업 준비 상담','경영기획 자소서·직무 이해','PMO·프로젝트관리 커리어 상담']},
  '경영·회계·사무':{roles:['재무회계 담당','인사(HR) 담당','경영관리','총무','전략 컨설턴트'],cos:['회계법인','대기업 재무팀','컨설팅펌','중견기업 경영지원','공공기관'],specs:[['재무회계','결산','세무','ERP'],['관리회계','원가','예산','엑셀모델링'],['인사','채용','노무','급여'],['전략컨설팅','케이스면접','자소서첨삭','문제해결']],topics:['회계·재무 직무 취업 상담','인사(HR) 직무 준비','컨설팅 케이스 면접 코칭']},
  '금융·보험':{roles:['데이터 분석가','은행원','IB 애널리스트','퀀트','핀테크 PM','보험계리사'],cos:['시중은행','증권사','자산운용사','보험사','핀테크','카카오뱅크'],specs:[['데이터분석','SQL','통계','태블로'],['퀀트','파이썬','금융공학','리스크'],['IB','재무모델링','밸류에이션','엑셀'],['계리','보험수리','리스크','통계']],topics:['금융권 취업 자소서·직무 상담','데이터 분석가 커리어·포폴 첨삭','IB·자산운용 취업 준비']},
  '교육·자연·사회과학':{roles:['교사','교육기획','연구원','에듀테크 기획'],cos:['학교','교육기업','연구소','에듀테크 스타트업','공공연구원'],specs:[['교직','임용','수업설계','교육과정'],['교육기획','콘텐츠','커리큘럼','LMS'],['연구','논문','데이터분석','실험설계']],topics:['임용·교직 진로 상담','교육기업(에듀테크) 취업 준비','대학원·연구직 진로 상담']},
  '법률·경찰·소방·교도·국방':{roles:['법무 담당','공무원','경찰관','컴플라이언스'],cos:['로펌','기업 법무팀','공공기관','정부부처'],specs:[['법무','계약검토','컴플라이언스','계약서'],['공무원시험','행정법','PSAT','면접'],['경찰·소방','체력','형사법','면접']],topics:['법무 직무·로스쿨 진로 상담','공무원·공공기관 취업 준비','경찰·소방 채용 준비']},
  '보건·의료':{roles:['간호사','제약 MR','의료기기 RA','병원행정','임상연구'],cos:['대학병원','제약사','의료기기사','바이오기업','CRO'],specs:[['간호','국가고시','병원실무','케이스'],['제약영업','MR','디테일링','제품지식'],['의료기기','RA','인허가','품질'],['임상','QA','GMP','밸리데이션']],topics:['간호·보건 국가고시·취업 상담','제약·바이오 취업 준비','의료기기 인허가(RA) 직무 상담']},
  '사회복지·종교':{roles:['사회복지사','상담사','NGO 활동가','복지기획'],cos:['복지관','공공기관','NGO','재단','상담센터'],specs:[['사회복지','자격증','사례관리','실습'],['상담','심리','케이스','코칭'],['NGO','모금','캠페인','기획']],topics:['사회복지사 취업·실습 상담','상담·심리 진로 상담','NGO·비영리 취업 준비']},
  '문화·예술·디자인·방송':{roles:['UX 디자이너','브랜드 디자이너','방송 PD','콘텐츠 기획','영상 편집'],cos:['디자인 에이전시','방송사','콘텐츠 기업','게임사','미디어 스타트업'],specs:[['UX/UI','피그마','포트폴리오','프로토타입'],['브랜드디자인','BX','그래픽','아이덴티티'],['영상','편집','촬영','기획'],['콘텐츠기획','SNS','카피','유튜브']],topics:['디자인 포트폴리오 리뷰·취업 상담','방송·콘텐츠 PD 취업 준비','영상·크리에이터 커리어 상담']},
  '운전·운송':{roles:['물류기획','운송관리','항공운항','모빌리티 PM'],cos:['물류기업','항공사','택배사','모빌리티 스타트업','해운사'],specs:[['물류','SCM','운송','재고관리'],['항공','운항','지상직','서비스'],['모빌리티','운영','기획','데이터']],topics:['물류·SCM 직무 취업 상담','항공사 취업 준비','모빌리티 스타트업 커리어']},
  '영업판매':{roles:['B2B 영업','MD','영업기획','세일즈'],cos:['제조기업','유통기업','커머스','IT기업','FMCG'],specs:[['B2B영업','제안','고객관리','협상'],['MD','상품기획','소싱','매입'],['세일즈','영업기획','실적관리','CRM']],topics:['영업·세일즈 직무 취업 상담','MD·상품기획 취업 준비','B2B 영업 커리어 상담']},
  '경비·청소':{roles:['시설관리','안전관리','경비운영','환경관리'],cos:['시설관리기업','빌딩관리','공공기관','제조현장'],specs:[['시설관리','전기','설비','안전'],['산업안전','위험성평가','자격증','점검'],['경비·보안','관제','운영','대응']],topics:['시설·안전관리 직무 취업 상담','산업안전 자격·취업 준비','시설관리 커리어 상담']},
  '이용·숙박·여행·오락·스포츠':{roles:['호텔리어','여행상품 기획','스포츠 마케팅','레저 운영'],cos:['호텔','여행사','스포츠구단','레저기업','리조트'],specs:[['호텔','객실','F&B','서비스'],['여행','상품기획','OP','인솔'],['스포츠마케팅','이벤트','스폰서','운영']],topics:['호텔·서비스직 취업 상담','여행·항공 서비스 취업 준비','스포츠 마케팅 커리어']},
  '음식서비스':{roles:['F&B 매니저','외식기획','조리·셰프','프랜차이즈 SV'],cos:['외식기업','프랜차이즈','호텔 F&B','식품기업','카페 브랜드'],specs:[['F&B','매장운영','서비스','관리'],['외식기획','메뉴','브랜드','운영'],['조리','위생','메뉴개발','자격증']],topics:['외식·F&B 직무 취업 상담','프랜차이즈 운영 커리어','조리·셰프 진로 상담']},
  '건설':{roles:['건축설계','시공관리','토목엔지니어','건설안전'],cos:['건설사','설계사무소','엔지니어링','공기업','디벨로퍼'],specs:[['건축설계','CAD','BIM','인허가'],['시공','공정관리','현장','안전'],['토목','구조','측량','적산'],['건설안전','산업안전','자격증','점검']],topics:['건설·시공관리 직무 취업 상담','건축설계 포트폴리오 상담','건설안전기사·취업 준비']},
  '기계':{roles:['기계설계','생산기술','품질엔지니어','설비엔지니어'],cos:['자동차사','중공업','기계제조','부품사','로봇기업'],specs:[['기계설계','CATIA','공차','도면'],['생산기술','공정','자동화','라인'],['품질','측정','SPC','불량분석']],topics:['기계설계 직무 취업 상담','생산기술·설비 취업 준비','품질엔지니어 커리어 상담']},
  '재료':{roles:['재료연구원','금속엔지니어','소재개발','품질분석'],cos:['철강사','소재기업','배터리사','반도체소재','세라믹기업'],specs:[['금속','열처리','물성','분석'],['소재개발','실험','평가','특성'],['품질','신뢰성','분석','불량']],topics:['소재·재료 연구직 취업 상담','금속·신소재 취업 준비','배터리 소재 커리어 상담']},
  '화학·바이오':{roles:['공정엔지니어','연구원','QA/QC','바이오 생산'],cos:['화학사','제약사','바이오기업','정유사','배터리사'],specs:[['화공','공정','플랜트','안전'],['바이오','세포배양','생산','GMP'],['QA/QC','분석','밸리데이션','인허가']],topics:['화학·화공 직무 취업 상담','바이오·제약 생산직 준비','QA/QC 직무 커리어 상담']},
  '섬유·의복':{roles:['패션 MD','생산·패턴','소재기획','리테일 MD'],cos:['패션기업','의류 브랜드','섬유기업','리테일','SPA브랜드'],specs:[['패션MD','상품기획','소싱','트렌드'],['생산','패턴','QC','공장관리'],['소재','원단','기획','개발']],topics:['패션 MD 취업 상담','의류 생산·소싱 직무 준비','패션 브랜드 커리어 상담']},
  '전기·전자':{roles:['반도체 엔지니어','회로설계','하드웨어','공정엔지니어'],cos:['삼성전자','SK하이닉스','LG전자','전장부품사','디스플레이사'],specs:[['반도체','공정','소자','수율'],['회로설계','PCB','아날로그','디지털'],['하드웨어','임베디드','펌웨어','테스트']],topics:['반도체 공정·소자 직무 취업 상담','회로·하드웨어 설계 취업 준비','전기전자 대기업 인적성·면접']},
  '정보통신':{roles:['백엔드 엔지니어','프론트엔드 엔지니어','데이터 엔지니어','보안 엔지니어','네트워크'],cos:['네이버','카카오','라인','토스','통신사','쿠팡'],specs:[['백엔드','Spring','JPA','대용량'],['프론트엔드','TypeScript','React','포트폴리오'],['데이터','파이프라인','SQL','클라우드'],['보안','네트워크','침해대응','자격증']],topics:['개발자 취업 모의면접·포폴 리뷰','코딩테스트·CS 전공지식 코칭','비전공 개발 취업 로드맵']},
  '식품가공':{roles:['식품연구원','품질관리','생산관리','식품 MD'],cos:['식품기업','유가공사','제과사','급식기업','음료기업'],specs:[['식품개발','관능','배합','공정'],['QA/QC','HACCP','위생','분석'],['생산관리','공정','라인','수율']],topics:['식품 연구개발 직무 취업 상담','식품 품질관리(HACCP) 준비','식품기업 취업 커리어 상담']},
  '인쇄·목재·가구·공예':{roles:['가구디자인','제품기획','생산관리','공예작가'],cos:['가구기업','인테리어사','제조사','공방','리빙 브랜드'],specs:[['가구디자인','3D','도면','목공'],['제품기획','소재','생산','QC'],['공예','핸드메이드','브랜딩','공방운영']],topics:['가구·제품 디자인 취업 상담','제조·생산관리 직무 준비','공예·창작 커리어 상담']},
  '환경·에너지·안전':{roles:['환경엔지니어','안전관리자','에너지 기획','ESG 담당'],cos:['환경기업','발전사','엔지니어링','대기업 ESG','신재생기업'],specs:[['환경','수질','대기','폐기물'],['산업안전','위험성평가','자격증','점검'],['에너지','신재생','플랜트','효율'],['ESG','탄소','보고서','평가']],topics:['환경·안전 직무 취업 상담','산업안전기사·안전관리자 준비','에너지·ESG 커리어 상담']},
  '농림어업':{roles:['스마트팜 기획','농식품 MD','산림기사','수산기획'],cos:['농식품기업','스마트팜','농어촌공사','협동조합','애그테크 스타트업'],specs:[['스마트팜','ICT','재배','데이터'],['농식품유통','MD','물류','수출'],['산림','조경','측량','자격증']],topics:['스마트팜·애그테크 취업 상담','농식품 유통·MD 직무 준비','산림·수산 공기업 취업 준비']},
};

/* 기존 6명을 NCS 분야로 재태깅 */
const CAT_REMAP = {'IT·개발':'정보통신','금융':'금융·보험','컨설팅':'경영·회계·사무','마케팅':'문화·예술·디자인·방송','대기업':'전기·전자','창업':'사업관리'};
MENTORS.forEach((m,i)=>{
  if (CAT_REMAP[m.cat]) { m.cat = CAT_REMAP[m.cat]; m.tag = m.cat; }
  m.topic = m.topic || (MENTOR_POOL[m.cat]?.topics||['커리어 상담'])[0];
  m.reviews = m.reviews || Math.max(6, Math.round(m.sessions*1.6 + (i*3)%11));
});

/* NCS 24개 분야 × 4명 멘토 자동 생성 */
(function expandMentorPool(){
  const FIRST = ['서준','도윤','하은','지아','시우','예린','우진','수아','건우','다은','현우','유나','재원','소연','민서','지호','채원','승현','가은','태호','수빈','동현','예은','준서','하린','시윤','로운','지안','서아','유준'];
  const LAST  = ['강','조','윤','장','임','한','오','서','신','권','황','안','송','류','전','홍','고','문','양','손','배','백','허','유','남','심'];
  const PALS = ['purple','green','orange','pink','blue','teal'];
  const MODES = [['온라인'],['온라인','오프라인'],['오프라인','온라인']];
  let seed = 7;
  const rnd = (n)=>{ seed = (seed*9301 + 49297) % 233280; return Math.floor((seed/233280)*n); };
  let idx = 0;
  CATEGORIES.forEach(cat=>{
    const F = MENTOR_POOL[cat]; if (!F) return;
    for (let k=0; k<4; k++){
      idx++;
      const name = LAST[rnd(LAST.length)] + FIRST[rnd(FIRST.length)];
      const role = F.roles[k % F.roles.length];
      const company = F.cos[(k+idx) % F.cos.length];
      const specialties = F.specs[k % F.specs.length];
      const years = 1 + rnd(6);
      const sessions = 5 + rnd(30);
      const rating = Math.round((42 + rnd(8)))/10;
      const cohort = (15 + rnd(7)) + '학번';
      MENTORS.push({
        id: 'g'+idx, name, cohort, tag: cat, cat, pal: PALS[idx % PALS.length],
        company, role, cas: 80+rnd(18), sessions, rating,
        similarity: 45+rnd(45), years, modes: MODES[rnd(MODES.length)],
        reviews: 5 + rnd(120), specialties,
        topic: F.topics[k % F.topics.length],
        path: `${specialties[0]} 준비 → ${company} ${role}`,
        intro: `${company}에서 ${role}로 일하고 있어요. ${specialties[0]}·${specialties[1]} 중심으로 취업 준비를 도와드려요.`,
        timeline: [
          { c:'#534AB7', t:`${company} ${role}`, d:`${2026-years}.03 ~ 현재`, s:`${specialties[0]} 실무 담당` },
          { c:'#AFA9EC', t:'현직 전 인턴십', d:`${2025-years}.07 ~ ${2025-years}.08`, s:`${specialties[1]} 관련 인턴` },
          { c:'#CECBF6', t:'학회 · 동아리 활동', d:`${2023-years}.03 ~ ${2025-years}.02`, s:`${specialties[2]||specialties[0]} 프로젝트 수행` },
          { c:'#E0DCF7', t:`${cohort} 입학`, d:`20${cohort.slice(0,2)}.03`, s:'' },
        ],
      });
    }
  });
})();

/* ── 멘토 후기(리뷰) 생성 ────────────────────────────────── */
const REVIEW_TEMPLATES = [
  '{spec} 관련 질문에 정말 구체적으로 답해주셨어요. 준비 방향이 명확해졌습니다.',
  '{company} 합격까지의 과정을 솔직하게 들려주셔서 큰 도움이 됐어요.',
  '포트폴리오 피드백이 날카로웠어요. 바로 수정해서 서류 합격했습니다!',
  '면접에서 자주 나오는 질문을 짚어주셔서 실전에서 당황하지 않았어요.',
  '막연했던 {role} 직무가 이제 확실히 그려져요. 감사합니다.',
  '현직자 시선의 조언이라 인터넷 정보와는 차원이 달랐습니다.',
  '자소서 첨삭 덕분에 지원 동기가 훨씬 설득력 있어졌어요.',
  '실무에서 쓰는 툴과 공부 우선순위를 알려주셔서 시간을 아꼈어요.',
  '30분이 짧게 느껴질 만큼 알찬 상담이었어요. 재신청하고 싶어요.',
  '{spec} 공부를 어디서부터 시작할지 막막했는데 로드맵을 잡아주셨어요.',
];
const REVIEW_FIRST = ['민지','서현','준영','지우','현서','예나','도현','수민','태민','하윤','지훈','유진','시원','채은','건희','나연'];
function reviewsFor(m){
  let h = 0; for (const ch of m.id) h = (h*31 + ch.charCodeAt(0)) % 100000;
  const rnd = (n)=>{ h = (h*9301 + 49297) % 233280; return Math.floor((h/233280)*n); };
  const count = 3 + rnd(4); // 3~6개
  const spec = (m.specialties&&m.specialties[0])||'직무';
  const out = [];
  for (let i=0;i<count;i++){
    const name = REVIEW_FIRST[rnd(REVIEW_FIRST.length)];
    const cohort = (18 + rnd(6)) + '학번';
    const tmpl = REVIEW_TEMPLATES[(rnd(REVIEW_TEMPLATES.length))];
    const text = tmpl.replace('{spec}', spec).replace('{company}', m.company).replace('{role}', m.role);
    const rating = rnd(10) < 7 ? 5 : 4;
    const mo = 1 + rnd(6), dy = 1 + rnd(27);
    out.push({ name, cohort, rating, text, date: `2026.${String(mo).padStart(2,'0')}.${String(dy).padStart(2,'0')}` });
  }
  return out;
}

/* ── my mentoring (seed) ────────────────────────────────── */
/* 시작 상태는 비어 있다.
   예전에는 예시 멘토링 내역(진행 2건·완료 5건·받은 요청 1건)을 넣어 뒀는데,
   내 것이 아닌 기록이 '내 멘토링' 에 남는 게 실제 데이터처럼 보였다.
   신청은 서버(mentoring_requests)에서 syncApplied() 가 받아 채운다. */
const SEED = {
  ongoing: [],
  completed: [],
  received: [],
  /* 내가 보낸 신청 — 멘토가 아직 수락/거절하지 않은 것. 서버가 원본이다. */
  applied: [],
};

/* ── persisted state ────────────────────────────────────── */
/* v1 → v2: 예시 데이터를 비우면서 키를 올린다.
   **키를 그대로 두면 아무 것도 안 바뀐다** — 이미 브라우저에 저장된 v1 에는
   옛 예시(진행 2건·완료 5건)가 들어 있어서, SEED 를 비워도 그쪽이 그대로 실린다. */
const LS_KEY = 'careerly_mentoring_v2';
let STATE = loadState();
/* 저장분에 목록 하나가 없으면 renderMentoring 이 STATE.received.length 에서 죽는다.
   예전 가드는 completed 만 봐서, received 가 생기기 전에 저장된 상태가 남아 있으면
   멘토링 페이지가 통째로 흰 화면이 됐다. 빠진 목록은 SEED 로 메운다. */
function loadState() {
  const seed = JSON.parse(JSON.stringify(SEED));
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved && typeof saved === 'object') {
      return {
        ongoing:   Array.isArray(saved.ongoing)   ? saved.ongoing   : seed.ongoing,
        completed: Array.isArray(saved.completed) ? saved.completed : seed.completed,
        received:  Array.isArray(saved.received)  ? saved.received  : seed.received,
        applied:   Array.isArray(saved.applied)   ? saved.applied   : seed.applied,
      };
    }
  } catch(e) {}
  return seed;
}
function saveState() { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); }

/* ── helpers ────────────────────────────────────────────── */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
function initial(name){ return name.charAt(0); }
/* 이름 가운데를 * 로 가린다: 황수아 → 황*아, 남궁도윤 → 남**윤, 김준 → 김* */
function maskName(name){
  if (!name) return '';
  if (name.length <= 2) return name.charAt(0) + '*';
  return name.charAt(0) + '*'.repeat(name.length-2) + name.charAt(name.length-1);
}
/* 경력 타임라인의 세부내용.
   주요내용(소속·직함 + 기간)과 세부내용(거기서 무엇을 했는가)이 예전에는 같은 굵기로
   세 줄 쌓여 있어서, 훑어볼 때 어디가 회사고 어디가 한 일인지 구분되지 않았다.
   세부내용은 목록으로 내린다.

   한 칸에 여러 건이 쉼표로 들어오는 경우가 있다("웹 서비스 2건 출시, 해커톤 수상").
   그건 항목을 나눠 각각 한 줄로 보여준다 — 나열된 성과는 세로로 읽어야 눈에 들어온다. */
function tlDetails(s){
  if (!s || !s.trim()) return '';
  const items = s.split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);
  return `<ul class="tl-detail">${items.map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ul>`;
}
function avatarStyle(pal){ const p = PALETTE[pal]||PALETTE.purple; return `background:${p.bg};color:${p.ink};`; }
function tagStyle(tag){ const c = TAGCOLOR[tag]||TAGCOLOR['IT·개발']; return `background:${c.bg};color:${c.ink};`; }
function starsHTML(n){
  let h = '<span class="stars">';
  for (let i=1;i<=5;i++) h += `<i class="ti ti-star-filled ${i<=Math.round(n)?'fill':''}"></i>`;
  return h+'</span>';
}
/* 기본 아이콘이 체크(성공) 표시다. **실패·취소·입력 안내에는 { icon: false } 를 줄 것** —
   "결제를 취소했어요" 옆에 초록 체크가 붙으면 결제가 된 것처럼 읽힌다. */
function toast(msg, opts){
  const icon = (opts && opts.icon === false) ? '' : '<i class="ti ti-circle-check-filled"></i>';
  const t = $('#toast'); t.innerHTML = `${icon}${msg}`;
  t.classList.add('on'); clearTimeout(t._tm);
  t._tm = setTimeout(()=>t.classList.remove('on'), 2600);
}

/* ── navigation ─────────────────────────────────────────────
   라우팅은 app.js 의 전역 navigate() 하나가 담당한다. 이 파일은 화면을
   그리는 훅(onEnter)만 제공하고, 링크는 그대로 navigate('search') 처럼 부른다. */
function onEnterMentoringPage(page){
  // #profile 로 직접 진입/새로고침하면 그릴 멘토가 없다 → 목록으로 되돌린다.
  if (page==='profile' && !currentMentor) { navigate('search'); return; }
  if (page==='dashboard') {
    /* 스텝바는 로그인 게이트보다 먼저 건다. 게이트는 .wrap 만 가리므로 그 위의
       스텝바는 그대로 보이는데, CASHero.render() 안에서만 그리면 로그아웃 상태에서
       2단계 화면만 스텝바가 없는 화면이 된다. (CASHero 쪽 mount 는 직무를 바꿀 때
       목표 칩을 다시 그리기 위한 것이라 둘 다 필요하다 — 통째로 교체라 겹쳐도 된다.) */
    Roadmap.mount('rm-bar-dashboard', 'me');
    // 내 CAS 점수·비교·부족항목은 전부 '내 스펙' 기반이라 로그인이 없으면 보여줄 게 없다.
    if (!ensureLoginGate('page-dashboard', {
      title: '로그인하고 내 CAS 점수를 확인하세요',
      desc:  '스펙을 입력하면 같은 길을 간 선배 데이터와 비교해 역량 점수와 백분위를 계산해 드려요.',
    })) return;
    if (window.CASHero)  CASHero.render();     // 점수·백분위 (막대도 여기서 채운다)
    if (window.CASRadar) CASRadar.render();
    animateDashboard();
  }
  if (page==='search')    renderSearch();
  if (page==='mentoring') {
    // 내 멘토링 내역·메모·평점은 개인 데이터다. 비로그인 상태에서 예시(SEED)가
    // 마치 내 기록처럼 보이던 문제 → 로그인 게이트로 가린다.
    if (!ensureLoginGate('page-mentoring', {
      title: '로그인하고 내 멘토링 내역을 확인하세요',
      desc:  '신청한 멘토링과 메모·평점은 로그인 후 내 계정에서 볼 수 있어요.',
    })) return;
    renderMentoring();
    /* 먼저 그리고 나서 서버 것으로 덮는다. 기다렸다 그리면 페이지가 잠깐 비어
       깜빡인다. 실패해도 화면은 이미 떠 있다. */
    syncApplied();
  }
}

/* '내가 신청' 목록을 서버에서 가져온다.
   신청은 POST /api/mentoring/requests 로 DB 에 잘 들어가는데, 화면은
   localStorage 만 보고 있어서 방금 보낸 신청이 목록에 안 뜨는 문제가 있었다.
   기기를 바꾸면 아예 사라지기도 했다. 이 목록의 진실은 서버다 — 결제·상태가
   서버에서 바뀌기 때문이다. 받아온 것으로 통째로 교체한다. */
async function syncApplied(){
  try {
    const { requests } = await api('GET', '/api/mentoring/requests');
    STATE.applied = requests.filter(r => OPEN_ON_SCREEN.includes(r.status)).map(toCard);
    saveState();
    renderMentoring();
  } catch (e) {
    /* 로그인이 풀렸거나 네트워크가 끊긴 경우다. 마지막으로 받아 둔 목록을
       그대로 두는 편이 빈 화면보다 낫다. */
    console.warn('[mentoring] 신청 목록을 가져오지 못했습니다:', e.message);
  }
}

/* 멘토 응답을 기다리는 동안만 이 목록에 있다. 완료·취소된 것은 빼야
   '신청 취소' 버튼이 이미 끝난 건에도 붙지 않는다. */
const OPEN_ON_SCREEN = ['pending', 'paid'];
const PAL_KEYS = Object.keys(PALETTE);

function toCard(r){
  return {
    id:     r.id,
    status: r.status,
    mentor: r.mentorName || '멘토',
    /* 이름마다 색을 고정한다. 매번 랜덤이면 새로고침할 때 아바타 색이 바뀐다. */
    pal:    PAL_KEYS[[...(r.mentorName || '')].reduce((a,c)=>a+c.charCodeAt(0),0) % PAL_KEYS.length],
    sub:    r.formatName || '',
    topic:  r.message ? '' : '멘토링 신청',
    want:   r.formatName || '',
    cost:   r.amount ? `${Number(r.amount).toLocaleString()}원` : '',
    when:   (r.createdAt || '').slice(0, 10),
    msg:    r.message || '',
  };
}

/* 로그인 게이트 — 개인 데이터 페이지(내 CAS·내 멘토링)를 비로그인 시 블러 처리하고
   가운데에 로그인 버튼을 띄운다. 로그인 상태면 블러·오버레이를 걷어내고 true 를 준다.
   showPage 가 진입할 때마다 부르므로 상태가 바뀌면 스스로 정리된다. */
function ensureLoginGate(pageId, opts){
  const page = document.getElementById(pageId);
  if (!page) return true;
  const wrap = page.querySelector('.wrap');
  const loggedIn = !!(window.DB && DB.currentUser());

  if (loggedIn){
    if (wrap) wrap.classList.remove('login-locked');
    const ov = page.querySelector('.login-gate');
    if (ov) ov.remove();
    return true;
  }

  if (wrap) wrap.classList.add('login-locked');
  if (!page.querySelector('.login-gate')){
    const ov = document.createElement('div');
    ov.className = 'login-gate';
    ov.innerHTML = `
      <div class="login-gate-card">
        <div class="login-gate-ic"><i class="ti ti-lock"></i></div>
        <div class="login-gate-title">${opts.title}</div>
        <div class="login-gate-desc">${opts.desc}</div>
        <button class="login-gate-btn" onclick="navigate('login')"><i class="ti ti-login"></i>로그인하러 가기</button>
      </div>`;
    page.appendChild(ov);
  }
  return false;
}

/* ════════════ DASHBOARD ════════════ */
/* 백분위 막대는 CASHero 가 실제 점수로 채운다 — 여기서 건드리면 덮어써진다.
   아래 비교 막대(.cmp-me)는 아직 careerly.html 의 하드코딩 값(data-w)이다. */
function animateDashboard(){
  requestAnimationFrame(()=>{
    setTimeout(()=>{
      $$('.cmp-me').forEach(el=>{ el.style.width = el.dataset.w+'%'; });
    }, 80);
  });
}

/* ════════════════════════════════════════════════════════════
   GAP — 목표 직무까지 나에게 부족한 항목

   ── 목업이었다 ──
   여기는 원래 하드코딩 배열이라 **누가 로그인하든 정보처리기사·SQLD·AWS SAA** 가
   떴다. 취업 준비 순서를 이 목록을 보고 정하는 학생에게는 단순 미완성이 아니라
   틀린 정보였다(8장 CEO 공개 선행조건 1번 · B4).

   ── 무엇을 '부족' 이라 부르는가 (사용자 결정) ──
   선배 데이터로만 판정한다. 우리가 중요하다고 생각하는 것이 아니라
   **같은 직무로 간 선배들이 실제로 갖고 있는 것** 중 내게 없는 것이다.

   | 탭 | 부족 판정 |
   |---|---|
   | 자격증 | 선배 보유율 ≥ 40% 인데 내 목록에 없다 |
   | 활동·경험 | 선배 보유율 ≥ 40% 인 활동 유형인데 내 활동에 한 건도 없다 |
   | 수상 경력 | 선배 보유율 ≥ 25% 인 성과 종류인데 내 활동 어디에도 그 성과가 없다 |

   ── 표본이 적으면 판정하지 않는다 ──
   3명 중 2명이 가졌다고 '67% 필수' 라고 적으면 실제보다 단단한 숫자로 읽힌다.
   CAS 백분위(5명)·직무 트렌드(30건) 와 같은 원칙으로 **5명 미만이면 판정을 접고
   왜 접었는지 적는다.** 성과는 문턱을 25% 로 낮추는데, 수상은 보유율 자체가
   낮아서 40% 를 걸면 어느 직무에서도 아무것도 안 뜬다(그러면 '부족 없음' 으로
   잘못 읽힌다).
   ════════════════════════════════════════════════════════════ */
const GAP_MIN_PEERS = 5;
const GAP_RATE = { cert: 40, activity: 40, award: 25 };
const GAP_MAX_ROWS = 6;

/* 성과(outcome)는 활동에 붙는 배수라 유형별 보유율과 축이 다르다 — 따로 센다.
   라벨은 CAS.OUTCOME_MULT 의 키와 1:1 이어야 한다(설문 선택지와 같은 말). */
const GAP_OUTCOMES = [
  { ic: '🏆', name: '공모전·대회 수상',      match: ['수상'],                                       help: '수상 이력은 CAS 성과 배수 ×1.3' },
  { ic: '📄', name: '논문·연구 성과',        match: ['논문'],                                       help: '연구 경험의 결과물' },
  { ic: '💼', name: '인턴 정규직 전환',      match: ['전환, 정규직 합격'],                          help: '가장 강한 성과 배수 ×1.4' },
  { ic: '📦', name: '산출물 공개(깃헙 등)',  match: ['발표 또는 산출물 공개(깃헙 등)', '산출물 공개(깃헙 등)'], help: '결과를 남긴 활동' },
];

let currentGapType = 'cert';
window.currentGapType = currentGapType;

const gapEsc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* 내 활동 목록 — 옛 boolean qual 스펙도 CAS 가 환산해 준다(단일 출처). */
const myActivities = spec => (typeof CAS !== 'undefined' ? CAS.normalizeActivities(spec) : (spec?.activities || []));

/* 한 스펙이 그 성과를 하나라도 가졌는가 */
const hasOutcome = (spec, labels) =>
  myActivities(spec).some(a => labels.includes(a.outcome));

/* 중요도 칩 — 선배 보유율이 곧 중요도다. 우리가 '필수' 라고 정하는 게 아니라
   "선배 몇 %가 갖고 있는가" 를 말로 바꾼 것뿐이다. */
function gapPill(pct) {
  if (pct >= 70) return { cls: 'high', text: '대부분 보유' };
  if (pct >= 40) return { cls: 'mid',  text: '절반 이상' };
  return { cls: 'mid', text: '일부 보유' };
}

/* ── 탭별 부족 항목 계산 ────────────────────────────────────── */
function computeGaps(type, ctx) {
  const { spec, agg } = ctx;
  const min = GAP_RATE[type] ?? 40;

  if (type === 'cert') {
    const mine = new Set(spec?.certs || []);
    return (agg.certs || [])
      .filter(c => c.pct >= min && !mine.has(c.id))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, GAP_MAX_ROWS)
      .map(c => ({
        ic: '📜', name: c.name, pct: c.pct,
        desc: `선배 ${c.pct}%가 보유 (${c.n}명)${c.desc ? ` · ${c.desc}` : ''} · 나는 미보유`,
        stat: '미보유',
      }));
  }

  if (type === 'activity') {
    const mineCount = {};
    myActivities(spec).forEach(a => { mineCount[a.type] = (mineCount[a.type] || 0) + 1; });
    return (agg.qual || [])
      .filter(q => q.pct >= min && !mineCount[q.id])
      .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || b.pct - a.pct)
      .slice(0, GAP_MAX_ROWS)
      .map(q => ({
        ic: q.icon || '✨', name: q.label, pct: q.pct,
        desc: `선배 ${q.pct}%가 경험 (${q.n}명) · ${q.help || ''} · 나는 없음`,
        stat: '없음',
      }));
  }

  // award — 성과 종류별
  const peers = agg.specs || [];
  return GAP_OUTCOMES
    .map(o => {
      const have = peers.filter(s => hasOutcome(s, o.match)).length;
      return { ...o, pct: Math.round((have / peers.length) * 100), n: have };
    })
    .filter(o => o.pct >= min && !hasOutcome(spec, o.match))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, GAP_MAX_ROWS)
    .map(o => ({
      ic: o.ic, name: o.name, pct: o.pct,
      desc: `선배 ${o.pct}%가 보유 (${o.n}명) · ${o.help} · 나는 없음`,
      stat: '없음',
    }));
}

/* 판정을 할 수 있는 상태인가. 못 하면 '왜 못 하는지' 를 돌려준다 —
   빈 목록만 보여주면 '부족한 게 없다' 로 읽힌다(정반대 뜻이다).

   ctx 를 받는 이유: 스펙업 화면(#specup)은 CAS 화면을 거치지 않고 바로 들어올 수
   있어서 window.CASDashboardContext 가 비어 있거나 직전 사용자의 것일 수 있다.
   그쪽은 CASHero.resolveContext() 로 자기 문맥을 직접 만들어 넘긴다. */
function gapContext(explicit) {
  const ctx = explicit || window.CASDashboardContext;
  if (!ctx || !ctx.agg) {
    return { ok: false, icon: '🔒', title: '아직 판정할 수 없어요',
             desc: DB.currentUser()
               ? '스펙을 입력하면 같은 직무 선배와 비교해 부족한 항목을 찾아드려요.'
               : '로그인하고 스펙을 입력하면 부족한 항목을 찾아드려요.' };
  }
  if (ctx.agg.count < GAP_MIN_PEERS) {
    return { ok: false, icon: '📉', title: `선배 표본이 ${ctx.agg.count}명뿐이에요`,
             desc: `${GAP_MIN_PEERS}명은 모여야 '몇 %가 갖고 있다'가 뜻을 가집니다. `
                 + '표본이 적을 때 비율을 보여주면 실제보다 단단한 숫자로 읽혀서, 판정을 접어 뒀어요.' };
  }
  return { ok: true, ctx };
}

function renderGap(type) {
  currentGapType = type;
  window.currentGapType = type;
  $$('.gap-tab').forEach(t => t.classList.toggle('on', t.dataset.gap === type));

  const host = $('#gap-list');
  const summary = $('#gap-summary');
  if (!host) return;

  const state = gapContext();
  if (!state.ok) {
    if (summary) summary.textContent = state.desc;
    host.innerHTML = `
      <div class="gap-empty">
        <div class="gap-empty-ic">${state.icon}</div>
        <div class="gap-empty-title">${gapEsc(state.title)}</div>
        <div class="gap-empty-desc">${gapEsc(state.desc)}</div>
      </div>`;
    return;
  }

  const { ctx } = state;
  const scope = ctx.scopeLabel || '내 직무';
  const rows = computeGaps(type, ctx);

  if (summary) {
    summary.innerHTML = `<b>${gapEsc(scope)}</b> 선배 ${ctx.agg.count}명과 비교했어요. `
      + `선배 보유율 ${GAP_RATE[type]}% 이상인 항목 중 내게 없는 것만 보여드립니다.`;
  }

  if (!rows.length) {
    host.innerHTML = `
      <div class="gap-empty gap-empty--ok">
        <div class="gap-empty-ic">✅</div>
        <div class="gap-empty-title">이 항목은 선배 평균만큼 채웠어요</div>
        <div class="gap-empty-desc">${gapEsc(scope)} 선배 ${ctx.agg.count}명 중
          ${GAP_RATE[type]}% 이상이 가진 것 가운데 빠진 게 없습니다.</div>
      </div>`;
    return;
  }

  host.innerHTML = rows.map(g => {
    const p = gapPill(g.pct);
    return `
    <div class="gap-item">
      <div class="gap-item-ic">${g.ic}</div>
      <div class="gap-item-body">
        <div class="gap-item-name">${gapEsc(g.name)} <span class="gap-pill ${p.cls}">${p.text}</span></div>
        <div class="gap-item-desc">${gapEsc(g.desc)}</div>
      </div>
      <div class="gap-item-stat">
        <div class="pct lack">${gapEsc(g.stat)}</div>
        <div class="lab">선배 ${g.pct}%</div>
      </div>
    </div>`;
  }).join('');
}

/* 세 탭을 통틀어 부족한 항목이 몇 개인지 — 아래 갈림길이 어느 쪽을 권할지 정한다. */
function totalGapCount(explicit) {
  const state = gapContext(explicit);
  if (!state.ok) return null;                       // 판정 불가 — '없다'와 구분한다
  return ['cert', 'activity', 'award']
    .reduce((n, t) => n + computeGaps(t, state.ctx).length, 0);
}

/* 스펙업 화면(js/specup.js)이 같은 판정을 다시 짜지 않게 내보낸다.
   '무엇이 부족한가' 의 기준이 두 벌이 되면 CAS 에서 3개라던 것이 스펙업에서 5개가
   되는 식으로 갈린다 — 판정 규칙은 여기가 단일 출처다. */
window.Gap = {
  computeGaps, gapContext, totalGapCount,
  TYPES: ['cert', 'activity', 'award'],
  RATE: GAP_RATE, MIN_PEERS: GAP_MIN_PEERS, OUTCOMES: GAP_OUTCOMES,
};

/* ════════════════════════════════════════════════════════════
   로드맵 2단계의 갈림길 — 스펙을 더 채울까, 지원할 회사를 찾을까

   ── 어느 쪽도 막지 않는다 ──
   부족한 항목이 있으면 '스펙 채우기' 를 주 버튼으로 두지만, '지원할 회사' 도
   같이 보여준다. 스펙이 완벽해질 때까지 지원하지 말라는 말이 되면 안 된다 —
   공고에는 마감일이 있고, 그 판단은 학생이 한다.
   ════════════════════════════════════════════════════════════ */
function renderRoadmapNext(mine, pct) {
  const host = $('#cas-next');
  if (!host) return;

  const rm = Roadmap.get();
  if (!rm) {
    host.innerHTML = `
      <div class="rm-next rm-next--muted">
        <div class="rm-next-body">
          <div class="rm-next-eyebrow">커리어 로드맵 1단계</div>
          <h3>목표 직무를 먼저 골라 주세요</h3>
          <p>직무를 고르면 그 직무 선배와 비교해 점수를 다시 계산하고,
             부족한 항목과 지원할 회사까지 이어서 안내해 드려요.</p>
        </div>
        <button type="button" class="rm-next-btn" onclick="navigate('career')">
          직무 찾기 <i class="ti ti-arrow-right"></i>
        </button>
      </div>`;
    return;
  }

  const gaps = totalGapCount();
  const goal = rm.jobName || rm.middleName;

  /* 판정 불가(로그인 전·스펙 없음·표본 부족)는 '부족 없음'과 다르다.
     그때는 무엇을 하면 판정이 되는지를 말하고, 지원 쪽 길도 열어 둔다. */
  const lacking = gaps == null ? null : gaps > 0;

  const headline = lacking === null
    ? '스펙을 입력하면 부족한 항목을 짚어드려요'
    : lacking
      ? `채우면 좋을 항목이 ${gaps}개 있어요`
      : '선배 평균만큼 채웠어요 — 지원해 볼 때예요';

  const desc = lacking === null
    ? `${gapEsc(goal)} 기준으로 무엇이 부족한지 알려면 내 스펙이 필요해요. 지금 바로 지원 준비로 넘어가도 됩니다.`
    : lacking
      ? `${gapEsc(goal)} 선배들이 갖고 있는데 내게 없는 항목이에요. 다만 준비가 끝나야 지원할 수 있는 건 아니니, 공고를 먼저 봐도 좋아요.`
      : `${gapEsc(goal)} 선배들이 가진 것 중 빠진 게 없어요. 이제 어느 회사에 쓸지 정할 차례입니다.`;

  /* ── '스펙 채우기' 의 목적지가 바뀌었다 ──────────────────────
     예전에는 마이페이지 스펙 입력 폼(navigateTo('mypage','spec'))으로 갔다.
     그런데 거기는 **이미 한 것을 적는 곳**이다. 방금 "채우면 좋을 항목이 3개 있어요"
     를 읽고 누른 사람에게 빈 입력 폼을 주면 흐름이 거기서 끊긴다.
     이제는 #specup 으로 간다 — 부족한 항목마다 지금 접수 중인 시험·모집 공고를
     붙여 보여주는 화면이다(js/specup.js). */
  const fillBtn = `
    <button type="button" class="rm-next-btn ${lacking ? '' : 'rm-next-btn--ghost'}"
            onclick="navigate('specup')">
      <i class="ti ti-pencil-plus"></i> 스펙 채우기
    </button>`;
  const applyBtn = `
    <button type="button" class="rm-next-btn ${lacking ? 'rm-next-btn--ghost' : ''}"
            onclick="Roadmap.goNext('me')">
      ${Roadmap.withJosa(goal, '로')} 지원하기 <i class="ti ti-arrow-right"></i>
    </button>`;

  host.innerHTML = `
    <div class="rm-next rm-next--fork">
      <div class="rm-next-body">
        <div class="rm-next-eyebrow">커리어 로드맵 · 다음 단계</div>
        <h3>${gapEsc(headline)}</h3>
        <p>${desc}</p>
      </div>
      <div class="rm-next-actions">
        ${lacking ? fillBtn + applyBtn : applyBtn + fillBtn}
      </div>
    </div>`;
}
window.renderRoadmapNext = renderRoadmapNext;

/* ════════════ MENTOR SEARCH ════════════ */
let searchFilter = '전체';
let searchQuery = '';

function initSearchFilters(){
  const chipBox = $('#filter-chips');
  if (chipBox){
    chipBox.innerHTML = `<span class="chip on" data-cat="전체" onclick="setFilter('전체')">전체</span>` +
      CATEGORIES.map(c=>`<span class="chip" data-cat="${c}" onclick="setFilter('${c}')"><span class="chip-no">${CAT_NO[c]}</span>${c}</span>`).join('');
    chipBox.addEventListener('scroll', updateChipsArrows);
    initChipsDrag();
    setTimeout(updateChipsArrows, 0);
  }
  const companies = [...new Set(MENTORS.map(m=>m.company))];
  const cSel = $('#f-company');
  if (cSel) cSel.innerHTML = `<option value="all">전체</option>` + companies.map(c=>`<option value="${c}">${c}</option>`).join('');
  const specs = [...new Set(MENTORS.flatMap(m=>m.specialties||[]))];
  const sSel = $('#f-spec');
  if (sSel) sSel.innerHTML = `<option value="all">전체</option>` + specs.map(s=>`<option value="${s}">${s}</option>`).join('');
}
let searchPage = 1;
const PER_PAGE = 9;

function onSearchInput(v){ searchQuery = (v||'').trim().toLowerCase(); searchPage = 1; renderSearch(); }
function expBucket(years){ if (years>=5) return 5; if (years>=3) return 3; return 1; }

function getFilteredMentors(){
  const fCompany = $('#f-company') ? $('#f-company').value : 'all';
  const fExp     = $('#f-exp') ? $('#f-exp').value : 'all';
  const fMode    = $('#f-mode') ? $('#f-mode').value : 'all';
  const fSpec    = $('#f-spec') ? $('#f-spec').value : 'all';
  const sortBy   = $('#sort-by') ? $('#sort-by').value : 'recommend';

  let list = MENTORS.filter(m=>{
    if (searchFilter!=='전체' && m.cat!==searchFilter) return false;
    if (fCompany!=='all' && m.company!==fCompany) return false;
    if (fExp!=='all' && String(expBucket(m.years||1))!==fExp) return false;
    if (fMode!=='all' && !(m.modes||[]).includes(fMode)) return false;
    if (fSpec!=='all' && !(m.specialties||[]).includes(fSpec)) return false;
    if (searchQuery){
      const hay = [m.name, m.company, m.role, m.tag, m.cat, m.topic, ...(m.specialties||[]), m.intro].join(' ').toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  });
  list = list.slice().sort((a,b)=>{
    if (sortBy==='rating')   return b.rating - a.rating;
    if (sortBy==='sessions') return b.sessions - a.sessions;
    if (sortBy==='career')   return (b.years||0) - (a.years||0);
    return (b.rating*10 + b.sessions) - (a.rating*10 + a.sessions); // 추천순
  });
  return list;
}

function ratingStarsMini(n){
  const full = Math.round(n);
  let h = '';
  for (let i=0;i<5;i++) h += `<i class="ti ti-star-filled" style="color:${i<full?'#FFB020':'#E3E3E6'}"></i>`;
  return h;
}

function renderSearch(){
  const list = getFilteredMentors();
  $('#search-count').textContent = list.length;

  const grid = $('#mentor-grid');
  if (!list.length){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="ic"><i class="ti ti-search-off"></i></div><div class="t">조건에 맞는 멘토가 없어요</div><div class="d">필터를 바꿔 다시 시도해 보세요</div></div>`;
    $('#mentor-pager').innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(list.length / PER_PAGE);
  if (searchPage > totalPages) searchPage = totalPages;
  const start = (searchPage-1)*PER_PAGE;
  const pageItems = list.slice(start, start+PER_PAGE);

  grid.innerHTML = pageItems.map(m=>`
    <div class="mentor-card" onclick="openProfile('${m.id}')">
      <div class="mc-topic">${m.topic}</div>
      <div class="mc-body">
        <div class="mc-info">
          <div class="mc-name">${maskName(m.name)} · ${m.cohort}</div>
          <div class="mc-line"><i class="ti ti-briefcase"></i>${m.role}</div>
          <div class="mc-line"><i class="ti ti-stairs-up"></i>경력 ${m.years}년차</div>
          <div class="mc-line mc-company"><i class="ti ti-building-skyscraper"></i>${m.company}</div>
        </div>
        <div class="avatar mc-avatar" style="${avatarStyle(m.pal)}">${initial(m.name)}</div>
      </div>
      <div class="mc-rating">
        <span class="mc-stars">${ratingStarsMini(m.rating)}</span>
        <b>${m.rating.toFixed(1)}</b>
        <span class="mc-count">(${m.reviews})</span>
        <span class="mc-dot">·</span>
        <span class="mc-mem"><i class="ti ti-users"></i>${m.sessions}명</span>
      </div>
      <div class="mc-tagbox">
        ${(m.specialties||[]).slice(0,4).map(s=>`<span class="mc-hashtag"># ${s}</span>`).join('')}
      </div>
    </div>`).join('');

  renderPager(totalPages);
}

function renderPager(totalPages){
  const pager = $('#mentor-pager');
  if (!pager) return;
  if (totalPages <= 1){ pager.innerHTML = ''; return; }
  let btns = '';
  btns += `<button class="pg-btn nav" ${searchPage===1?'disabled':''} onclick="gotoPage(${searchPage-1})"><i class="ti ti-chevron-left"></i></button>`;
  for (let p=1; p<=totalPages; p++){
    btns += `<button class="pg-btn ${p===searchPage?'on':''}" onclick="gotoPage(${p})">${p}</button>`;
  }
  btns += `<button class="pg-btn nav" ${searchPage===totalPages?'disabled':''} onclick="gotoPage(${searchPage+1})"><i class="ti ti-chevron-right"></i></button>`;
  pager.innerHTML = btns;
}
function gotoPage(p){
  searchPage = p;
  renderSearch();
  const el = $('#page-search'); if (el) el.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setFilter(cat){ searchFilter = cat; searchPage = 1; $$('#filter-chips .chip').forEach(c=>c.classList.toggle('on', c.dataset.cat===cat)); renderSearch(); }

function updateChipsArrows(){
  const box = document.getElementById('filter-chips');
  const rail = document.getElementById('chips-rail');
  if (!box || !rail) return;
  const l = rail.querySelector('.chips-arrow--l');
  const r = rail.querySelector('.chips-arrow--r');
  if (l) l.classList.toggle('is-hidden', box.scrollLeft <= 2);
  if (r) r.classList.toggle('is-hidden', box.scrollLeft + box.clientWidth >= box.scrollWidth - 2);
}
function scrollChips(dir){
  const box = document.getElementById('filter-chips');
  if (!box) return;
  box.scrollBy({ left: dir * Math.max(220, box.clientWidth * 0.7), behavior: 'smooth' });
}
/* drag(그랩)으로 한 줄 직무 목록 좌우 이동 */
function initChipsDrag(){
  const box = document.getElementById('filter-chips');
  if (!box || box.__dragInit) return;
  box.__dragInit = true;
  box.style.cursor = 'grab';
  box.style.userSelect = 'none';
  let down = false, moved = false, startX = 0, startScroll = 0;
  box.addEventListener('pointerdown', e => {
    down = true; moved = false; startX = e.clientX; startScroll = box.scrollLeft;
    box.style.cursor = 'grabbing';
    /* 주의: setPointerCapture 를 쓰면 이어지는 click 이 칩이 아니라 컨테이너로
       전달돼 onclick="setFilter(...)" 가 실행되지 않는다. 캡처하지 않는다. */
  });
  box.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    box.scrollLeft = startScroll - dx;
  });
  const end = () => { if (!down) return; down = false; box.style.cursor = 'grab'; box.__justDragged = moved; };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  /* 포인터가 컨테이너 밖에서 떼어져도 드래그 상태가 풀리도록 window 에서도 처리 */
  window.addEventListener('pointerup', end);
  /* 드래그로 끝난 클릭은 필터 선택으로 이어지지 않도록 차단 */
  box.addEventListener('click', e => {
    if (box.__justDragged) { e.stopPropagation(); e.preventDefault(); box.__justDragged = false; }
  }, true);
}

/* ── 멘토 예약 가능 일정 ──────────────────────────────────────
   진짜 출처는 멘토 페이지에서 저장하는 profiles.availability 다.
   **그런데 지금 MENTORS 는 전부 시드 목업이라 프로필이 없다**(파일 머리주석 참고).
   그래서 후기(reviewsFor)와 같은 방식으로 멘토 id 에서 결정론적으로 만든다 —
   같은 멘토는 언제 봐도 같은 일정이라 화면이 흔들리지 않는다.

   목업을 실제 회원으로 바꿀 때 이 함수만 API 호출로 갈아끼우면 된다. */
const SLOT_HOURS = ['10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '19:00', '20:00'];

function availabilityFor(m) {
  let h = 0; for (const ch of m.id) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  const rnd = n => { h = (h * 9301 + 49297) % 233280; return Math.floor((h / 233280) * n); };

  const out = new Map();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  /* 앞으로 6주. 멘토 페이지에서 3개월까지 열 수 있지만, 목업은 6주면 충분하다. */
  for (let i = 1; i <= 42; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    if (d.getDay() === 0) continue;                 // 일요일은 비운다
    if (rnd(10) < 5) continue;                      // 절반쯤만 연다
    const times = SLOT_HOURS.filter(() => rnd(10) < 4);
    if (!times.length) continue;
    out.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            times);
  }
  return out;
}

/* ════════════ MENTOR PROFILE ════════════ */
let currentMentor = null;
let selectedFormat = 0;
let reqAvail = new Map();      // 이 멘토가 연 일정 'YYYY-MM-DD' → [시간]
let reqCal = null;             // 달력이 보고 있는 달
let reqDate = null;            // 고른 날짜
let reqTime = null;            // 고른 시간
/* 화면 표시용. **청구 금액의 단일 출처는 서버**(routes/mentoring.js FORMATS)다.
   id 가 서버와 맞아야 신청이 만들어진다 — 여기 값을 바꿔도 결제 금액은 안 바뀐다. */
const FORMATS = [
  { id:'video30',  ic:'ti-video',     name:'화상 30분', price:'20,000원', cost:20000 },
  { id:'onsite60', ic:'ti-users',     name:'대면 60분', price:'45,000원', cost:45000 },
  { id:'text',     ic:'ti-message-2', name:'텍스트',    price:'12,000원', cost:12000 },
];
function openProfile(id){
  currentMentor = MENTORS.find(m=>m.id===id);
  selectedFormat = 0;
  const m = currentMentor;
  const reviews = reviewsFor(m);
  const rvAvg = reviews.reduce((a,r)=>a+r.rating,0)/reviews.length;
  $('#profile-body').innerHTML = `
    <div class="back-bar" onclick="navigate('search')"><i class="ti ti-arrow-left"></i>멘토 찾기로 돌아가기</div>
    <div class="card profile-hero">
      <div class="ph-top">
        <div class="avatar ph-avatar" style="${avatarStyle(m.pal)}">${initial(m.name)}</div>
        <div class="ph-id">
          <div class="ph-name-row">
            <span class="ph-name">${maskName(m.name)} · ${m.cohort}</span>
            <span class="mc-tag" style="${tagStyle(m.tag)}">${m.tag}</span>
          </div>
          <div class="ph-job">${m.company} · ${m.role} · 경력 ${m.years}년차</div>
          <div class="ph-stats">
            <span><b>${m.sessions}</b>회 멘토링</span>
            <span class="ph-stars">${starsHTML(m.rating)} <b>${m.rating}</b> / 5.0</span>
          </div>
          <div class="ph-specs">${(m.specialties||[]).map(s=>`<span class="mc-spec">${s}</span>`).join('')}</div>
        </div>
      </div>
    </div>
    <div class="profile-grid">
      <div class="card pp-card">
        <div class="pp-title">경력 타임라인</div>
        <div class="timeline">
          ${m.timeline.map(t=>`
            <div class="tl-item">
              <div class="tl-dot" style="background:${t.c}"></div>
              <div class="tl-main">
                <span class="tl-title">${t.t}</span>
                <span class="tl-date">${t.d}</span>
              </div>
              ${tlDetails(t.s)}
            </div>`).join('')}
        </div>

        <!-- 소개글은 경력 아래에 둔다. 후배가 읽는 순서가 그렇다 —
             어떤 경력인지 먼저 보고, 그 사람이 하는 말을 읽는다.
             멘토 페이지(#mypage/mentor)의 입력 순서와도 같다.
             안 적은 멘토도 있으므로 있을 때만 그린다. -->
        ${m.intro ? `
        <div class="pp-intro">
          <div class="pp-title">멘토 소개</div>
          <p class="pp-intro-text">${escapeHTML(m.intro)}</p>
        </div>` : ''}
      </div>
      <div class="card pp-card">
        <div class="pp-title">멘토링 신청</div>
        <div class="field">
          <div class="field-lab">희망 분야</div>
          <div class="field-select"><span>${m.role} 취업 준비</span><i class="ti ti-chevron-down"></i></div>
        </div>
        <!-- ① 날짜 → ② 시간 → ③ 형식 → ④ 하고 싶은 말 순서다.
             멘토가 연 날짜만 고를 수 있고, 날짜를 골라야 그 날의 시간이 나온다. -->
        <div class="field">
          <div class="field-lab">날짜 선택</div>
          <div class="mp-cal req-cal" id="req-cal"></div>
        </div>
        <div class="field" id="req-time-field" hidden>
          <div class="field-lab" id="req-time-lab">시간 선택</div>
          <div class="mp-time-grid" id="req-times"></div>
        </div>
        <div class="field">
          <div class="field-lab">멘토링 형식 선택</div>
          <div class="format-opts" id="format-opts">
            ${FORMATS.map((f,i)=>`
              <div class="format-opt ${i===0?'on':''}" data-i="${i}" onclick="selectFormat(${i})">
                <div class="fo-ic"><i class="ti ${f.ic}"></i></div>
                <div class="fo-name">${f.name}</div>
                <div class="fo-price">${f.price}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="field">
          <div class="field-lab">하고 싶은 말</div>
          <textarea id="req-msg" placeholder="${m.role} 직무로 ${m.company}에 어떻게 합격하셨는지, 준비 과정에서 가장 도움이 된 경험이 무엇인지 듣고 싶습니다."></textarea>
        </div>
        <div class="cost-row">
          <span class="lab">예상 비용</span>
          <span class="val" id="req-cost">${FORMATS[0].price}</span>
        </div>
        <button class="btn-brand btn-submit-req" onclick="submitRequest()"><i class="ti ti-send"></i>멘토 신청 보내기</button>
      </div>
    </div>
    <div class="card pp-card reviews-card">
      <div class="rv-head">
        <div class="pp-title" style="margin:0">멘토링 후기 <span class="rv-count">${reviews.length}</span></div>
        <div class="rv-avg">${starsHTML(rvAvg)} <b>${rvAvg.toFixed(1)}</b><span>/ 5.0</span></div>
      </div>
      <div class="rv-list">
        ${reviews.map(r=>`
          <div class="rv-item">
            <div class="rv-avatar">${initial(r.name)}</div>
            <div class="rv-body">
              <div class="rv-top">
                <span class="rv-name">${maskName(r.name)} · ${r.cohort}</span>
                <span class="rv-stars-mini">${ratingStarsMini(r.rating)}</span>
              </div>
              <div class="rv-text">${r.text}</div>
              <div class="rv-date">${r.date}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  /* innerHTML 을 넣은 뒤에 달력을 채운다 — 먼저 부르면 그릴 자리가 아직 없다. */
  initRequestPicker(m);
  navigate('profile');
}
function selectFormat(i){
  selectedFormat = i;
  $$('#format-opts .format-opt').forEach(o=>o.classList.toggle('on', +o.dataset.i===i));
  $('#req-cost').textContent = FORMATS[i].price;
}

/* ── 신청 달력 ────────────────────────────────────────────────
   멘토 페이지의 달력과 같은 클래스(.mp-cal*)를 쓴다. 다른 점은 **멘토가 연 날만
   고를 수 있다**는 것 — 나머지는 눌리지 않게 막는다. */
const REQ_WD = ['일','월','화','수','목','금','토'];
const reqYmd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

function initRequestPicker(m){
  reqAvail = availabilityFor(m);
  reqDate = null; reqTime = null;
  /* 열린 날이 있는 첫 달을 보여준다. 이번 달에 아무것도 없으면 빈 달력만 보고
     '신청을 못 하는구나' 하고 나가 버린다. */
  const first = [...reqAvail.keys()].sort()[0];
  const base = first ? new Date(first) : new Date();
  reqCal = new Date(base.getFullYear(), base.getMonth(), 1);
  paintReqCal();
  paintReqTimes();
}

function paintReqCal(){
  const host = $('#req-cal');
  if (!host) return;

  const y = reqCal.getFullYear(), mo = reqCal.getMonth();
  const daysInMonth = new Date(y, mo+1, 0).getDate();
  const openDates = [...reqAvail.keys()].sort();
  /* 열린 날이 있는 달 사이에서만 이동한다 — 빈 달을 계속 넘기게 두지 않는다. */
  const minM = openDates.length ? new Date(openDates[0]) : new Date();
  const maxM = openDates.length ? new Date(openDates[openDates.length-1]) : new Date();
  const minMonth = new Date(minM.getFullYear(), minM.getMonth(), 1);
  const maxMonth = new Date(maxM.getFullYear(), maxM.getMonth(), 1);

  const cells = [];
  for (let i=0; i<new Date(y,mo,1).getDay(); i++) cells.push('<span class="mp-cal-pad"></span>');
  for (let d=1; d<=daysInMonth; d++){
    const date = reqYmd(new Date(y,mo,d));
    const open = reqAvail.has(date);
    const cls = ['mp-cal-day'];
    if (!open) cls.push('past');                 // 멘토가 안 연 날은 고를 수 없다
    if (open) cls.push('has');
    if (date === reqDate) cls.push('on');
    cells.push(`<button type="button" class="${cls.join(' ')}" data-reqdate="${date}"
      ${open?'':'disabled'}>${d}${open?'<i class="mp-cal-dot"></i>':''}</button>`);
  }

  host.innerHTML = `
    <div class="mp-cal-head">
      <button type="button" class="mp-cal-nav" data-reqnav="-1"
        ${reqCal<=minMonth?'disabled':''} aria-label="이전 달"><i class="ti ti-chevron-left"></i></button>
      <span class="mp-cal-title">${y}년 <b>${mo+1}월</b></span>
      <button type="button" class="mp-cal-nav" data-reqnav="1"
        ${reqCal>=maxMonth?'disabled':''} aria-label="다음 달"><i class="ti ti-chevron-right"></i></button>
    </div>
    <div class="mp-cal-grid">
      ${REQ_WD.map((w,i)=>`<span class="mp-cal-wd${i===0?' sun':i===6?' sat':''}">${w}</span>`).join('')}
      ${cells.join('')}
    </div>
    ${openDates.length ? '' : '<div class="sf-hint-inline">멘토가 아직 일정을 열지 않았어요.</div>'}`;
}

function paintReqTimes(){
  const field = $('#req-time-field');
  const host = $('#req-times');
  const lab = $('#req-time-lab');
  if (!field || !host) return;

  /* 날짜를 안 골랐으면 칸 자체를 감춘다 — 빈 자리가 있으면 뭘 해야 할지 모른다. */
  if (!reqDate){ field.hidden = true; host.innerHTML = ''; return; }

  const d = new Date(reqDate);
  lab.textContent = `${d.getMonth()+1}월 ${d.getDate()}일 (${REQ_WD[d.getDay()]}) 시간 선택`;
  field.hidden = false;
  /* 시간은 24시간 표기 그대로 보여준다. 12시간으로 바꾸면 '10:00 · 11:00 · 8:00'
     처럼 작은 수가 뒤에 와서 오전인지 오후인지 매번 되짚어야 한다. */
  host.innerHTML = (reqAvail.get(reqDate)||[]).map(t=>`
    <button type="button" class="mp-time${reqTime===t?' on':''}" data-reqtime="${t}">${t}</button>
  `).join('');
}

/* 달력·시간은 다시 그려지므로 문서에 한 번만 위임한다. */
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-reqnav]');
  if (nav && !nav.disabled){
    reqCal = new Date(reqCal.getFullYear(), reqCal.getMonth() + Number(nav.dataset.reqnav), 1);
    paintReqCal();
    return;
  }
  const day = e.target.closest('[data-reqdate]');
  if (day && !day.disabled){
    /* 날짜를 바꾸면 고른 시간은 뜻이 없어진다 — 다른 날의 시간이 남으면
       화면과 저장값이 어긋난다. */
    if (reqDate !== day.dataset.reqdate) reqTime = null;
    reqDate = day.dataset.reqdate;
    paintReqCal(); paintReqTimes();
    return;
  }
  const time = e.target.closest('[data-reqtime]');
  if (time){
    reqTime = time.dataset.reqtime;
    paintReqTimes();
  }
});
function submitRequest(){
  // 멘토 신청은 내 계정으로 남는 개인 행동이라 로그인이 필요하다.
  // 비로그인 상태에서 눌러도 그냥 신청돼 버리던 문제 → 로그인 페이지로 보낸다.
  if (!(window.DB && DB.currentUser())){
    toast('로그인 후 멘토링을 신청할 수 있어요', { icon: false });
    setTimeout(()=>navigate('login'), 700);
    return;
  }
  /* 날짜·시간을 안 고르고 보내면 서버가 400 으로 막는다. 그 전에 여기서 알려주고
     해당 칸으로 스크롤해 준다 — 카드가 길어서 어디가 비었는지 안 보인다. */
  if (!reqDate){
    toast('멘토링 날짜를 선택해주세요', { icon: false });
    $('#req-cal')?.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  if (!reqTime){
    toast('멘토링 시간을 선택해주세요', { icon: false });
    $('#req-time-field')?.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  payAndApply();
}

/* ── 신청 → 결제 ──────────────────────────────────────────────
   신청은 서버에 만들고(금액도 서버가 정한다), 결제창은 토스페이먼츠 SDK 가 띄운다.
   결제창이 성공해도 **그때는 아직 결제가 끝난 게 아니다** — 서버가 승인 API 를
   호출해야 돈이 움직인다. 그래서 성공 콜백에서 곧바로 서버 승인을 부른다.

   결제가 꺼져 있으면(키 미설정) 결제 없이 신청만 남긴다. 개발 중에 결제 키가 없다고
   멘토링 흐름 전체를 못 써 보면 곤란하다. */
async function payAndApply(){
  const m = currentMentor;
  const f = FORMATS[selectedFormat] || FORMATS[0];
  const msg = ($('#req-msg')?.value || '').trim();
  const btn = $('.btn-submit-req');
  if (btn) btn.disabled = true;

  try {
    const { request } = await api('POST', '/api/mentoring/requests', {
      mentorId: m.id, mentorName: m.name, format: f.id, message: msg,
      slotDate: reqDate, slotTime: reqTime,
    });

    const cfg = await api('GET', '/api/payments/config');
    if (!cfg.enabled) {
      toast(`${maskName(m.name)} 멘토에게 신청을 보냈어요 (결제 미설정)`);
      return goApplied();
    }
    if (!window.TossPayments) {
      toast('결제 모듈을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.', { icon: false });
      return;
    }

    const order = await api('POST', '/api/payments/prepare', { requestId: request.id });

    /* successUrl/failUrl 대신 Promise 방식을 쓴다. 리다이렉트로 돌아오면 SPA 가
       상태를 잃어서 어느 신청의 결제였는지 다시 찾아야 한다. */
    const toss = TossPayments(cfg.clientKey);
    await toss.requestPayment('카드', {
      amount: order.amount,               // 서버가 정한 금액
      orderId: order.orderId,
      orderName: order.orderName,
      customerName: order.customerName,
      successUrl: location.origin + '/#mentoring',
      failUrl: location.origin + '/#mentoring',
    });
    /* 여기까지 왔다는 건 결제창이 닫혔다는 뜻이다. 승인은 successUrl 로 돌아온 뒤
       app.js 의 결제 복귀 처리(handlePaymentReturn)가 이어서 한다. */
  } catch (e) {
    /* 사용자가 결제창을 닫은 것은 오류가 아니다 — 에러 메시지를 띄우면 놀란다. */
    if (e?.code === 'USER_CANCEL') toast('결제를 취소했어요', { icon: false });
    else toast(e.message || '신청에 실패했어요', { icon: false });
  } finally {
    if (btn) btn.disabled = false;
  }
}

function goApplied(){
  mentoringTab = 'applied';           // 신청 직후엔 그 목록을 보여준다
  setTimeout(()=>navigate('mentoring'), 600);
}

/* mentoring.js 는 DB 를 거치지 않고 직접 부른다 — 이 화면만 쓰는 엔드포인트라
   데이터 레이어에 올리면 db.js 가 화면별 함수로 불어난다. */
async function api(method, path, body){
  const res = await fetch(path, {
    method, credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(()=>null);
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data;
}

/* ════════════ MY MENTORING ════════════ */
let mentoringTab = 'completed';
function totalCount(){ return STATE.ongoing.length + STATE.completed.length; }
function avgRating(){
  const rated = STATE.completed.filter(c=>c.rating);
  if (!rated.length) return '—';
  return (rated.reduce((a,c)=>a+c.rating,0)/rated.length).toFixed(1);
}
function totalCas(){ return STATE.completed.reduce((a,c)=>a+(c.casPlus||0),0); }

function renderMentoring(){
  // stats
  $('#stat-total').innerHTML = `${totalCount()}<small>회</small>`;
  const so = $('#stat-ongoing'); if (so) so.innerHTML = `${STATE.ongoing.length}<small>회</small>`;
  $('#stat-rating').innerHTML = `${avgRating()}<small> / 5.0</small>`;
  // tab counts
  $('#tabcnt-ongoing').textContent = STATE.ongoing.length;
  $('#tabcnt-completed').textContent = STATE.completed.length;
  $('#tabcnt-received').textContent = STATE.received.length;
  $('#tabcnt-applied').textContent = STATE.applied.length;

  /* 역할에 따라 탭이 다르다.
       멘티 — 진행 중 · 완료 · 보낸 요청   (남에게 신청하는 쪽)
       멘토 — 진행 중 · 완료 · 받은 요청   (신청을 받는 쪽)
     양쪽 다 보여주면 자기와 상관없는 빈 탭이 하나씩 남는다.
     역할을 모르면(비로그인·온보딩 전) 멘티 기준으로 둔다 — 대부분이 멘티다. */
  const role = (window.DB && DB.currentUser()?.role) || 'mentee';
  const allowed = role === 'mentor'
    ? ['ongoing', 'completed', 'received']
    : ['ongoing', 'completed', 'applied'];

  $$('#mentoring-tabs .tab').forEach(t => {
    t.hidden = !allowed.includes(t.dataset.tab);
    t.classList.toggle('on', t.dataset.tab === mentoringTab);
  });
  /* 숨긴 탭을 보고 있었으면(역할이 바뀌었거나 링크로 들어온 경우) 첫 탭으로 돌린다.
     안 그러면 탭은 하나도 안 눌린 채 남의 목록이 보인다. */
  if (!allowed.includes(mentoringTab)) {
    mentoringTab = allowed[0];
    $$('#mentoring-tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === mentoringTab));
  }

  const body = $('#mentoring-body');
  if (mentoringTab==='ongoing')   body.innerHTML = renderOngoing();
  if (mentoringTab==='completed') body.innerHTML = renderCompleted();
  if (mentoringTab==='applied')   body.innerHTML = renderApplied();
  if (mentoringTab==='received')  body.innerHTML = renderReceived();
}
function switchTab(tab){ mentoringTab = tab; renderMentoring(); }

function renderOngoing(){
  if (!STATE.ongoing.length) return emptyState('ti-calendar','진행 중인 멘토링이 없어요','멘토를 찾아 새로운 멘토링을 신청해 보세요');
  return `<div class="session-list">${STATE.ongoing.map(o=>`
    <div class="session-item">
      <div class="avatar si-avatar" style="${avatarStyle(o.pal)}">${initial(o.mentor)}</div>
      <div class="si-body">
        <div class="si-name-row"><span class="si-name">${maskName(o.mentor)} 멘토</span><span class="si-sub">· ${o.sub}</span></div>
        <div class="si-topic">${o.topic}</div>
      </div>
      <div class="si-right">
        <div class="badge ${o.badge}">${o.status}</div>
        <div class="si-when">${o.when}</div>
      </div>
    </div>`).join('')}</div>`;
}

function renderCompleted(){
  if (!STATE.completed.length) return emptyState('ti-check','완료된 멘토링이 없어요','');
  return `<div>${STATE.completed.map(c=>{
    const hasRating = !!c.rating;
    const hasMemo = !!(c.memo && c.memo.trim());
    return `
    <div class="done-card" data-id="${c.id}">
      <div class="done-main">
        <div class="avatar si-avatar" style="${avatarStyle(c.pal)}">${initial(c.mentor)}</div>
        <div class="dm-body">
          <div class="dm-head">
            <div class="si-name-row"><span class="si-name">${maskName(c.mentor)} 멘토</span><span class="si-sub">· ${c.sub}</span></div>
            <span class="si-when">${c.date} 완료</span>
          </div>
          <div class="dm-topic">${c.topic}</div>
          <div class="dm-actions">
            ${hasMemo
              ? `<button class="dm-link" onclick="toggleMemo('${c.id}')"><i class="ti ti-notes"></i>멘토 내역 · 메모 보기<i class="ti ti-chevron-down" id="chev-${c.id}"></i></button>`
              : `<button class="dm-link neutral" onclick="openMemo('${c.id}')"><i class="ti ti-pencil-plus"></i>메모 작성하기</button>`}
            ${hasRating
              ? `<span class="dm-rating-shown">${starsHTML(c.rating)} <b style="color:var(--gold);font-weight:700">${c.rating.toFixed(1)}</b></span>`
              : `<button class="dm-link gold" onclick="openRating('${c.id}')"><i class="ti ti-star"></i>평점 남기기</button>`}
          </div>
        </div>
      </div>
      <div class="memo-panel" id="memo-${c.id}">
        <div class="memo-inner">
          <div class="memo-box">
            <div class="memo-box-head">
              <span class="memo-box-title"><i class="ti ti-notes"></i>내가 작성한 메모</span>
              <span class="memo-edit-link" onclick="openMemo('${c.id}')">수정</span>
            </div>
            <div class="memo-text">${hasMemo?escapeHTML(c.memo):''}</div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/* 내가 보낸 신청 — 멘토 응답 대기 상태. 받은 요청과 같은 카드 모양을 쓰되
   내가 할 수 있는 행동은 '신청 취소' 하나뿐이라 버튼도 하나만 둔다. */
function renderApplied(){
  if (!STATE.applied.length) {
    return emptyState('ti-send','보낸 멘토링 신청이 없어요','멘토를 찾아 신청하면 여기에서 진행 상태를 볼 수 있어요');
  }
  return STATE.applied.map((a,i)=>`
    <div class="req-card">
      <div class="done-main" style="padding:0">
        <div class="avatar si-avatar" style="${avatarStyle(a.pal)}">${initial(a.mentor)}</div>
        <div class="dm-body">
          <div class="si-name-row">
            <span class="si-name">${maskName(a.mentor)} 멘토</span><span class="si-sub">· ${a.sub}</span>
          </div>
          <div class="dm-topic">${escapeHTML(a.topic)}</div>
          <div class="si-topic" style="margin-top:6px;color:var(--color-text-tertiary)">
            ${escapeHTML(a.want)} · ${escapeHTML(a.cost)} · ${escapeHTML(a.when)}
          </div>
          ${a.msg ? `<div class="dm-topic" style="margin-top:6px">“${escapeHTML(a.msg)}”</div>` : ''}
          <div class="req-actions">
            <div class="badge amber">멘토 응답 대기</div>
            <button class="btn-reject" onclick="cancelApplied(${i})">신청 취소</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}
/* 서버에도 알려야 한다. 화면에서만 지우면 새로고침할 때 syncApplied 가 다시
   받아 와 되살아나고, 멘토 쪽에는 여전히 요청이 남는다. */
async function cancelApplied(i){
  const a = STATE.applied[i];
  if (!a) return;

  if (a.id) {
    try {
      await api('POST', `/api/mentoring/requests/${a.id}/cancel`);
    } catch (e) {
      /* 결제까지 끝난 건은 서버가 막는다(409). 그 사유를 그대로 보여준다 —
         화면에서만 지워 놓고 취소된 척하면 안 된다. */
      toast(e.message || '신청을 취소하지 못했어요', { icon: false });
      return;
    }
  }

  STATE.applied.splice(i,1);
  saveState(); renderMentoring();
  toast(`${maskName(a.mentor)} 멘토 신청을 취소했어요`, { icon: false });
}

function renderReceived(){
  if (!STATE.received.length) return emptyState('ti-inbox','받은 멘토링 요청이 없어요','');
  return STATE.received.map((r,i)=>`
    <div class="req-card">
      <div class="done-main" style="padding:0">
        <div class="avatar si-avatar" style="${avatarStyle(r.pal)}">${initial(r.mentee)}</div>
        <div class="dm-body">
          <div class="si-name-row"><span class="si-name">${maskName(r.mentee)} 멘티</span><span class="si-sub">· ${r.sub}</span></div>
          <div class="dm-topic">${r.topic}</div>
          <div class="si-topic" style="margin-top:6px;color:var(--color-text-tertiary)">희망 형식 ${r.want} · ${r.when}</div>
          <div class="req-actions">
            <button class="btn-brand btn-sm" onclick="acceptReq(${i})">수락하기</button>
            <button class="btn-reject" onclick="rejectReq(${i})">정중히 거절</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}
/* 수락은 '받은 요청' 에서 빼고 **'진행 중' 으로 옮긴다**.
   예전에는 splice 만 해서, 수락을 누르면 요청이 어느 목록에도 남지 않고
   통째로 사라졌다. 토스트만 뜨고 흔적이 없어서 거절과 구분이 안 됐다. */
function acceptReq(i){
  const r = STATE.received[i];
  if (!r) return;
  STATE.received.splice(i,1);
  STATE.ongoing.unshift({
    mentor: r.mentee, sub: r.sub, pal: r.pal, topic: r.topic,
    status: '일정 조율 중', badge: 'amber', when: r.when,
  });
  saveState(); renderMentoring();
  toast(`${maskName(r.mentee)} 멘티의 요청을 수락했어요`);
}
function rejectReq(i){
  const r = STATE.received[i];
  if (!r) return;
  STATE.received.splice(i,1);
  saveState(); renderMentoring();
  toast('요청을 거절했어요');
}

function emptyState(ic,t,d){ return `<div class="empty-state"><div class="ic"><i class="ti ${ic}"></i></div><div class="t">${t}</div>${d?`<div class="d">${d}</div>`:''}</div>`; }
function escapeHTML(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* memo expand/collapse */
function toggleMemo(id){
  const panel = $('#memo-'+id); const chev = $('#chev-'+id);
  const open = panel.classList.toggle('open');
  if (chev) chev.style.transform = open?'rotate(180deg)':'';
}

/* ════════════ MEMO MODAL ════════════ */
let memoTargetId = null;
function openMemo(id){
  memoTargetId = id;
  const c = STATE.completed.find(x=>x.id===id);
  $('#memo-modal-sub').textContent = `${c.mentor} 멘토 · ${c.topic.split(' · ')[0]}`;
  $('#memo-textarea').value = c.memo || '';
  $('#memo-modal-title').textContent = (c.memo&&c.memo.trim()) ? '메모 수정' : '멘토링 메모 작성';
  openModal('memo-modal');
  setTimeout(()=>$('#memo-textarea').focus(), 200);
}
function saveMemo(){
  const c = STATE.completed.find(x=>x.id===memoTargetId);
  c.memo = $('#memo-textarea').value;
  saveState(); closeModal('memo-modal'); renderMentoring();
  setTimeout(()=>{ const p=$('#memo-'+c.id); if(p && c.memo.trim()) p.classList.add('open'); }, 50);
  toast('메모를 저장했어요');
}

/* ════════════ RATING MODAL ════════════ */
let rateTargetId = null;
let rateValue = 0;
const RATE_CAPTIONS = ['','별로예요','아쉬워요','괜찮아요','좋았어요','최고예요!'];
function openRating(id){
  rateTargetId = id; rateValue = 0;
  const c = STATE.completed.find(x=>x.id===id);
  $('#rate-avatar').style.cssText = avatarStyle(c.pal);
  $('#rate-avatar').textContent = initial(c.mentor);
  $('#rate-name').textContent = `${maskName(c.mentor)} 멘토`;
  $('#rate-sub').textContent = `${c.sub} · ${c.topic.split(' · ')[0]}`;
  $('#rate-review').value = c.review || '';
  setStarUI(0); $('#star-caption').textContent = '별점을 선택해 주세요';
  openModal('rate-modal');
}
function setStarUI(n){
  $$('#star-input i').forEach((s,i)=>s.classList.toggle('fill', i<n));
}
function hoverStar(n){ setStarUI(n); $('#star-caption').textContent = RATE_CAPTIONS[n]; }
function leaveStar(){ setStarUI(rateValue); $('#star-caption').textContent = rateValue?RATE_CAPTIONS[rateValue]:'별점을 선택해 주세요'; }
function pickStar(n){ rateValue = n; setStarUI(n); $('#star-caption').textContent = RATE_CAPTIONS[n]; }
function saveRating(){
  if (!rateValue){ toast('별점을 선택해 주세요', { icon: false }); return; }
  const c = STATE.completed.find(x=>x.id===rateTargetId);
  c.rating = rateValue; c.review = $('#rate-review').value;
  saveState(); closeModal('rate-modal'); renderMentoring();
  toast(`${c.mentor} 멘토에게 평점을 남겼어요`);
}

/* ── modal helpers ──────────────────────────────────────── */
function openModal(id){ $('#'+id).classList.add('on'); }
function closeModal(id){ $('#'+id).classList.remove('on'); }

/* 알림(종 아이콘)은 전역 navbar 의 기능이므로 home.js 한 곳에서만 정의한다.
   여기에 다시 선언하면 같은 전역 스코프에서 const 가 중복돼 스크립트가 죽는다. */

/* ── init (app.js 부팅 시 1회 호출) ─────────────────────── */
function initMentoring(){
  // star input listeners
  $$('#star-input i').forEach((s,i)=>{
    s.addEventListener('mouseenter', ()=>hoverStar(i+1));
    s.addEventListener('click', ()=>pickStar(i+1));
  });
  $('#star-input').addEventListener('mouseleave', leaveStar);
  // close modal on overlay click
  $$('.modal-overlay').forEach(ov=>ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('on'); }));
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') $$('.modal-overlay').forEach(m=>m.classList.remove('on')); });
  renderGap('cert');
  initSearchFilters();
}

window.Mentoring = { init: initMentoring, onEnter: onEnterMentoringPage };
