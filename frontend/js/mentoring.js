/* ════════════════════════════════════════════════════════════
   CAREERLY · Mentoring app — data + interactions
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

/* ── NCS 24 분야별 데이터 풀 ─────────────────────────────── */
const NCS = {
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
  m.topic = m.topic || (NCS[m.cat]?.topics||['커리어 상담'])[0];
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
    const F = NCS[cat]; if (!F) return;
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
const SEED = {
  ongoing: [
    { mentor:'김민준', sub:'20학번 카카오', pal:'purple', topic:'프론트엔드 취업 준비 · 화상 30분',
      status:'진행 예정', badge:'blue', when:'2026.06.25 (목) 19:00' },
    { mentor:'이서연', sub:'19학번 토스', pal:'green', topic:'데이터 분석가 커리어 상담 · 대면 60분',
      status:'일정 조율 중', badge:'amber', when:'멘토 응답 대기' },
  ],
  completed: [
    { id:'c1', mentor:'박지훈', sub:'18학번 맥킨지', pal:'orange',
      topic:'컨설팅 직무 자기소개서 첨삭 · 텍스트 멘토링', date:'2026.05.28', casPlus:3,
      rating:5, review:'케이스 면접 프레임워크를 정말 친절하게 짚어주셨다.',
      memo:'· STAR 기법으로 경험 재구성 (상황-과제-행동-결과)\n· 자소서 두괄식: 결론 → 근거 순서로 작성\n· 케이스 면접은 MECE 프레임 먼저 그리고 시작\n· 추천 도서: 『맥킨지식 문제해결』' },
    { id:'c2', mentor:'정태윤', sub:'19학번 삼성전자', pal:'blue',
      topic:'백엔드 포트폴리오 리뷰 · 화상 30분', date:'2026.05.14', casPlus:2,
      rating:4, review:'프로젝트 구조에 대한 구체적 피드백을 받았다.',
      memo:'· README에 아키텍처 다이어그램 추가하기\n· 트래픽 처리 경험을 수치로 표현 (RPS, 응답시간)\n· 테스트 커버리지 80% 이상 목표' },
    { id:'c3', mentor:'한소희', sub:'18학번 배민', pal:'teal',
      topic:'브랜드 마케팅 직무 탐색 상담 · 화상 30분', date:'2026.04.30', casPlus:2,
      rating:null,  // 평점 미작성
      review:null,
      memo:'· 마케팅 직무도 데이터 역량이 점점 중요해지는 추세\n· 공모전 수상 경험을 포트폴리오로 정리\n· GA4, 앰플리튜드 등 분석 툴 익혀두기' },
    { id:'c4', mentor:'최유진', sub:'17학번 스타트업', pal:'pink',
      topic:'커리어 방향성 코칭 · 대면 60분', date:'2026.04.12', casPlus:3,
      rating:4,
      review:'스타트업 vs 대기업 선택 기준을 명확히 잡아주셨다.',
      memo:null },  // 메모 미작성
    { id:'c5', mentor:'정태윤', sub:'19학번 삼성전자', pal:'blue',
      topic:'CS 전공지식 모의 면접 · 화상 30분', date:'2026.03.20', casPlus:2,
      rating:null,  // 평점 미작성
      review:null,
      memo:null },  // 메모 미작성
  ],
  received: [
    { mentee:'이도현', sub:'21학번 컴퓨터공학과', pal:'green',
      topic:'프론트엔드 신입 포트폴리오 리뷰 요청', want:'화상 30분', when:'요청일 2026.06.18' },
  ],
};

/* ── persisted state ────────────────────────────────────── */
const LS_KEY = 'careerly_mentoring_v1';
let STATE = loadState();
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved && saved.completed) return saved;
  } catch(e) {}
  return JSON.parse(JSON.stringify(SEED));
}
function saveState() { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); }

/* ── helpers ────────────────────────────────────────────── */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
function initial(name){ return name.charAt(0); }
function avatarStyle(pal){ const p = PALETTE[pal]||PALETTE.purple; return `background:${p.bg};color:${p.ink};`; }
function tagStyle(tag){ const c = TAGCOLOR[tag]||TAGCOLOR['IT·개발']; return `background:${c.bg};color:${c.ink};`; }
function starsHTML(n){
  let h = '<span class="stars">';
  for (let i=1;i<=5;i++) h += `<i class="ti ti-star-filled ${i<=Math.round(n)?'fill':''}"></i>`;
  return h+'</span>';
}
function toast(msg){
  const t = $('#toast'); t.innerHTML = `<i class="ti ti-circle-check-filled"></i>${msg}`;
  t.classList.add('on'); clearTimeout(t._tm);
  t._tm = setTimeout(()=>t.classList.remove('on'), 2600);
}

/* ── navigation ─────────────────────────────────────────── */
function goCareerlyHome(){ parentNav('main'); }
function inFrame(){ return window.parent && window.parent !== window; }
function parentNav(page){
  if (inFrame() && typeof window.parent.navigate === 'function') window.parent.navigate(page);
  else window.location.href = 'careerly.html#' + page;
}
function parentLogout(){
  if (inFrame() && typeof window.parent.handleLogout === 'function') window.parent.handleLogout();
  else window.location.href = 'careerly.html';
}
function currentParentUser(){
  try { return inFrame() && window.parent.DB ? window.parent.DB.currentUser() : null; }
  catch(e){ return null; }
}
function renderTopAuth(){
  const box = $('#tn-auth'); if(!box) return;
  const u = currentParentUser();
  if (u) {
    const name = (u.nickname || u.name || u.username) + '님';
    box.innerHTML = `<span class="tn-username" onclick="parentNav('mypage')">${name}</span>` +
                    `<button class="tn-btn" onclick="parentLogout()">로그아웃</button>`;
  } else {
    box.innerHTML = `<button class="tn-btn solid" onclick="parentNav('login')">회원가입 / 로그인</button>`;
  }
}
function navigate(page){
  $$('.page').forEach(p=>p.classList.remove('on'));
  $('#page-'+page).classList.add('on');
  $$('.tn-link').forEach(l=>l.classList.toggle('on', l.dataset.page===page));
  window.scrollTo({top:0});
  if (page==='dashboard') animateDashboard();
  if (page==='search')    renderSearch();
  if (page==='mentoring') renderMentoring();
}

/* ════════════ DASHBOARD ════════════ */
function animateDashboard(){
  requestAnimationFrame(()=>{
    setTimeout(()=>{
      $('.cas-bar-fill').style.width = '87%';
      $('.cas-bar-marker').style.left = '87%';
      $$('.cmp-me').forEach(el=>{ el.style.width = el.dataset.w+'%'; });
    }, 80);
  });
}

const GAP_DATA = {
  cert: [
    { ic:'📜', name:'정보처리기사', pill:'high', pillT:'필수', desc:'선배 92%가 보유 · 나는 미취득', pct:'미보유', lack:true },
    { ic:'🗄️', name:'SQLD', pill:'mid', pillT:'권장', desc:'선배 74%가 보유 · 데이터 직무 가산점', pct:'미보유', lack:true },
    { ic:'☁️', name:'AWS SAA', pill:'mid', pillT:'권장', desc:'선배 41%가 보유 · 클라우드 역량 입증', pct:'미보유', lack:true },
  ],
  activity: [
    { ic:'💼', name:'현업 인턴십 경험', pill:'high', pillT:'중요', desc:'선배 71% 보유 · 나는 1회 (평균 2.1회)', pct:'-1회', lack:true },
    { ic:'🌍', name:'교환학생·글로벌', pill:'mid', pillT:'선택', desc:'선배 28% 보유 · 어학+글로벌 경험 부족', pct:'미보유', lack:true },
    { ic:'🤝', name:'장기 대외활동', pill:'mid', pillT:'권장', desc:'선배 평균 5건 · 나는 3건', pct:'-2건', lack:true },
  ],
  award: [
    { ic:'🏆', name:'공모전·해커톤 수상', pill:'high', pillT:'중요', desc:'선배 평균 2.3회 · 나는 0회', pct:'-2.3회', lack:true },
    { ic:'🎓', name:'성적 우수 장학', pill:'mid', pillT:'선택', desc:'선배 38% 보유 · 학업 성취 입증', pct:'미보유', lack:true },
    { ic:'📈', name:'직무 프로젝트 성과', pill:'mid', pillT:'권장', desc:'정량 성과 지표가 있는 수상 1건 권장', pct:'미보유', lack:true },
  ],
};
function renderGap(type){
  $$('.gap-tab').forEach(t=>t.classList.toggle('on', t.dataset.gap===type));
  const list = GAP_DATA[type];
  $('#gap-list').innerHTML = list.map(g=>`
    <div class="gap-item">
      <div class="gap-item-ic">${g.ic}</div>
      <div class="gap-item-body">
        <div class="gap-item-name">${g.name} <span class="gap-pill ${g.pill}">${g.pillT}</span></div>
        <div class="gap-item-desc">${g.desc}</div>
      </div>
      <div class="gap-item-stat">
        <div class="pct ${g.lack?'lack':''}">${g.pct}</div>
        <div class="lab">선배 평균 대비</div>
      </div>
    </div>`).join('');
}

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
          <div class="mc-name">${m.name} · ${m.cohort}</div>
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

/* ════════════ MENTOR PROFILE ════════════ */
let currentMentor = null;
let selectedFormat = 0;
const FORMATS = [
  { ic:'ti-video', name:'화상 30분', price:'20,000원', cost:20000 },
  { ic:'ti-users', name:'대면 60분', price:'45,000원', cost:45000 },
  { ic:'ti-message-2', name:'텍스트', price:'12,000원', cost:12000 },
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
            <span class="ph-name">${m.name} · ${m.cohort}</span>
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
              <div class="tl-title">${t.t}</div>
              <div class="tl-date">${t.d}</div>
              ${t.s?`<div class="tl-desc">${t.s}</div>`:''}
            </div>`).join('')}
        </div>
      </div>
      <div class="card pp-card">
        <div class="pp-title">멘토링 신청</div>
        <div class="field">
          <div class="field-lab">희망 분야</div>
          <div class="field-select"><span>${m.role} 취업 준비</span><i class="ti ti-chevron-down"></i></div>
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
                <span class="rv-name">${r.name} · ${r.cohort}</span>
                <span class="rv-stars-mini">${ratingStarsMini(r.rating)}</span>
              </div>
              <div class="rv-text">${r.text}</div>
              <div class="rv-date">${r.date}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  navigate('profile');
}
function selectFormat(i){
  selectedFormat = i;
  $$('#format-opts .format-opt').forEach(o=>o.classList.toggle('on', +o.dataset.i===i));
  $('#req-cost').textContent = FORMATS[i].price;
}
function submitRequest(){
  toast(`${currentMentor.name} 멘토에게 신청을 보냈어요`);
  setTimeout(()=>navigate('mentoring'), 800);
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
  $$('#mentoring-tabs .tab').forEach(t=>t.classList.toggle('on', t.dataset.tab===mentoringTab));
  const body = $('#mentoring-body');
  if (mentoringTab==='ongoing')   body.innerHTML = renderOngoing();
  if (mentoringTab==='completed') body.innerHTML = renderCompleted();
  if (mentoringTab==='received')  body.innerHTML = renderReceived();
}
function switchTab(tab){ mentoringTab = tab; renderMentoring(); }

function renderOngoing(){
  if (!STATE.ongoing.length) return emptyState('ti-calendar','진행 중인 멘토링이 없어요','멘토를 찾아 새로운 멘토링을 신청해 보세요');
  return `<div class="session-list">${STATE.ongoing.map(o=>`
    <div class="session-item">
      <div class="avatar si-avatar" style="${avatarStyle(o.pal)}">${initial(o.mentor)}</div>
      <div class="si-body">
        <div class="si-name-row"><span class="si-name">${o.mentor} 멘토</span><span class="si-sub">· ${o.sub}</span></div>
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
            <div class="si-name-row"><span class="si-name">${c.mentor} 멘토</span><span class="si-sub">· ${c.sub}</span></div>
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

function renderReceived(){
  if (!STATE.received.length) return emptyState('ti-inbox','받은 멘토링 요청이 없어요','');
  return STATE.received.map((r,i)=>`
    <div class="req-card">
      <div class="done-main" style="padding:0">
        <div class="avatar si-avatar" style="${avatarStyle(r.pal)}">${initial(r.mentee)}</div>
        <div class="dm-body">
          <div class="si-name-row"><span class="si-name">${r.mentee} 멘티</span><span class="si-sub">· ${r.sub}</span></div>
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
function acceptReq(i){ const r=STATE.received[i]; toast(`${r.mentee} 멘티의 요청을 수락했어요`); STATE.received.splice(i,1); saveState(); renderMentoring(); }
function rejectReq(i){ STATE.received.splice(i,1); saveState(); renderMentoring(); toast('요청을 거절했어요'); }

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
  $('#rate-name').textContent = `${c.mentor} 멘토`;
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
  if (!rateValue){ toast('별점을 선택해 주세요'); return; }
  const c = STATE.completed.find(x=>x.id===rateTargetId);
  c.rating = rateValue; c.review = $('#rate-review').value;
  saveState(); closeModal('rate-modal'); renderMentoring();
  toast(`${c.mentor} 멘토에게 평점을 남겼어요`);
}

/* ── modal helpers ──────────────────────────────────────── */
function openModal(id){ $('#'+id).classList.add('on'); }
function closeModal(id){ $('#'+id).classList.remove('on'); }

/* ══════ NOTIFICATIONS (localStorage 공유) ══════ */
const NOTI_KEY = 'careerly_notifications_read';
const NOTIFICATIONS = [
  { ic:'🤝', title:'멘토링 신청이 승인되었습니다.', time:'10분 전', go:'mentoring' },
  { ic:'✨', title:'새로운 추천 멘토가 도착했습니다.', time:'1시간 전', go:'search' },
  { ic:'✍️', title:'작성하지 않은 멘토링 후기가 있습니다.', time:'어제', go:'mentoring' },
  { ic:'🗺️', title:'커리어 로드맵이 업데이트되었습니다.', time:'2일 전', go:'dashboard' },
];
function notiIsRead(){ return localStorage.getItem(NOTI_KEY)==='true'; }
function syncNotiDot(){ const d=$('#tn-noti-dot'); if(d) d.classList.toggle('on', !notiIsRead()); }
function buildNotiPanel(){
  const panel=$('#noti-panel'); if(!panel) return;
  panel.innerHTML = `
    <div class="noti-head">
      <span class="noti-head-title">알림</span>
      <span class="noti-head-clear" onclick="markNotiRead()">모두 읽음</span>
    </div>
    <div class="noti-list">
      ${NOTIFICATIONS.map((n,i)=>`
        <div class="noti-item ${notiIsRead()?'':'unread'}" onclick="notiClick(${i})">
          <div class="noti-item-ic">${n.ic}</div>
          <div class="noti-item-body">
            <div class="noti-item-title">${n.title}</div>
            <div class="noti-item-time">${n.time}</div>
          </div>
        </div>`).join('')}
    </div>`;
}
function toggleNoti(e){
  if(e) e.stopPropagation();
  const panel=$('#noti-panel'); if(!panel) return;
  const willOpen=!panel.classList.contains('on');
  if(willOpen){ buildNotiPanel(); markNotiRead(); }
  panel.classList.toggle('on', willOpen);
}
function markNotiRead(){
  localStorage.setItem(NOTI_KEY,'true');
  syncNotiDot();
  $$('#noti-panel .noti-item').forEach(el=>el.classList.remove('unread'));
}
function notiClick(i){
  $('#noti-panel').classList.remove('on');
  const n=NOTIFICATIONS[i]; if(n&&n.go) navigate(n.go);
}

/* ── init ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', ()=>{
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
  renderTopAuth();
  syncNotiDot();
  document.addEventListener('click', e=>{
    const panel=$('#noti-panel');
    if(panel && panel.classList.contains('on') && !e.target.closest('.tn-noti-wrap')) panel.classList.remove('on');
  });
  const sub = (location.hash || '').replace('#', '');
  navigate(['dashboard','search','mentoring','profile'].includes(sub) ? sub : 'dashboard');
});

/* react to deep-link hash changes from the parent (quick-links) */
window.addEventListener('hashchange', () => {
  const sub = (location.hash || '').replace('#', '');
  if (['dashboard','search','mentoring','profile'].includes(sub)) navigate(sub);
});
