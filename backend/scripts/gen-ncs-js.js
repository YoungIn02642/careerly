/* ncs-taxonomy.json(공식) + overlay(이모지·설명·전공·legacy) → frontend/js/ncs.js 생성 */
const fs = require('fs'), path = require('path');
const tree = require('../data/ncs-taxonomy.json');

// 대분류별 이모지·설명 (기존 유지, 공식이 제공 안 함)
const DECOR = {
  '01':['📋','프로젝트·사업 기획과 관리 전반을 다루는 직무군입니다.'],
  '02':['🗂️','기획·인사·재무·총무 등 기업 내부 관리 직무를 아우르는 가장 큰 직무군입니다.'],
  '03':['🏦','은행·증권·자산운용·보험 등 자본과 리스크를 다루는 금융 직무군입니다.'],
  '04':['🔬','교육과 연구, 자연·사회과학 기반의 직무군입니다.'],
  '05':['⚖️','법률 서비스와 공공 안전·국방을 담당하는 직무군입니다.'],
  '06':['🩺','진료·간호·의료기술과 보건행정을 포괄하는 직무군입니다.'],
  '07':['🤝','복지 서비스 제공과 상담·돌봄을 담당하는 직무군입니다.'],
  '08':['🎨','콘텐츠 기획·제작과 디자인, 방송 직무군입니다.'],
  '09':['🚚','육상·항공·해상 운송과 물류 운영 직무군입니다.'],
  '10':['🛒','고객 대상 영업과 판매·유통 관리 직무군입니다.'],
  '11':['🧹','시설 경비와 환경 미화 직무군입니다.'],
  '12':['🏨','호텔·여행·레저·스포츠 서비스 직무군입니다.'],
  '13':['🍳','조리와 외식업 운영 직무군입니다.'],
  '14':['🏗️','건축·토목 설계와 시공·관리 직무군입니다.'],
  '15':['⚙️','기계 설계·생산·정비 직무군입니다.'],
  '16':['🧱','금속·비금속 재료의 가공과 품질 직무군입니다.'],
  '17':['🧪','화학 공정과 바이오·제약 연구개발 직무군입니다.'],
  '18':['🧵','섬유 제조와 패션 기획·생산 직무군입니다.'],
  '19':['🔌','전기 설비와 반도체·전자기기 개발 직무군입니다.'],
  '20':['💻','IT 서비스 개발과 통신·방송 기술 직무군입니다.'],
  '21':['🥫','식품 제조·가공과 품질·위생 관리 직무군입니다.'],
  '22':['🪵','인쇄와 목재·가구·공예 제조 직무군입니다.'],
  '23':['♻️','환경 관리와 에너지, 산업안전 직무군입니다.'],
  '24':['🌾','작물·축산·임업·수산 생산과 관리 직무군입니다.'],
};

// 중분류별 overlay: 'Lcode:Mcode' → { majors, legacy }
// legacy: 옛 dept/field 스펙을 이 공식 중분류로 집계 (데모/실사용 스펙 스키마 유지)
const OVERLAY = {
  '20:01': { majors:['컴퓨터공학','소프트웨어학','통계학'], legacy:{ dept:['cs','stat'] } },              // 정보기술 (cs+stat)
  '03:01': { majors:['경영학','경제학','통계학'],           legacy:{ dept:['business','economics'], field:['finance'] } }, // 금융
  '02:01': { majors:['경영학','경제학','미디어학'],         legacy:{ dept:['business','media'], field:['corp','consulting','marketing'] } }, // 기획사무 (경영기획·마케팅)
  '02:02': { majors:['경영학','심리학'],                    legacy:{ dept:['psych'], field:['hr'] } },     // 총무·인사
  '02:03': { majors:['회계학','경영학'],                    legacy:{ dept:['accounting'] } },              // 재무·회계
  '05:01': { majors:['법학'],                               legacy:{ dept:['law'] } },                     // 법률
  '06:01': { majors:['보건학','심리학','간호학'],           legacy:{ dept:['psych'], field:['clinical'] } }, // 보건
  '08:03': { majors:['미디어학','신문방송학'],              legacy:{ dept:['media'], field:['media'] } },  // 문화콘텐츠
};

const majors = tree.map(L => {
  const [emoji, desc] = DECOR[L.code] || ['🗂️',''];
  return {
    id: L.code, name: L.name, emoji, desc,
    middles: L.middles.map(M => {
      const ov = OVERLAY[`${L.code}:${M.code}`];
      const m = { id: 'm' + M.code, name: M.name,
        majors: ov?.majors || [],
        smalls: M.smalls.map(s => s.name) };
      if (ov?.legacy) m.legacy = ov.legacy;
      return m;
    }),
  };
});

const banner = `// ════════════════════════════════════════════════════════════
//  CAREERLY — NCS 직업 분류 카탈로그  (자동 생성 · 손수정 금지)
//   출처: 공공데이터포털 15128213 NCS 기준정보 조회 (한국산업인력공단)
//   생성: backend/scripts/gen-ncs-js.js  (원본: backend/data/ncs-taxonomy.json)
//
//   공식 대분류→중분류→소분류 이름은 API 에서 가져오고, 아래 overlay 만 손유지한다:
//     · 대분류 이모지/설명 (DECOR)   · 중분류 관련전공/legacy (OVERLAY, gen 스크립트)
//   legacy: 옛 { dept, field, job } 스펙을 공식 중분류로 집계하기 위한 매핑.
//           legacy 없는 중분류는 매칭 스펙이 없어 빈 상태로 표시된다(정상).
// ════════════════════════════════════════════════════════════
window.NCS = (() => {

  const MAJORS = ${JSON.stringify(majors, null, 2).replace(/\n/g, '\n  ')};

  const byId = id => MAJORS.find(m => m.id === id) || null;
  const middleById = (majorId, middleId) =>
    (byId(majorId)?.middles || []).find(m => m.id === middleId) || null;

  function matcher(legacy) {
    if (!legacy || !legacy.dept?.length) return null;
    return s =>
      legacy.dept.includes(s.dept) &&
      (!legacy.field?.length || legacy.field.includes(s.field));
  }
  function middleMatcher(majorId, middleId) {
    return matcher(middleById(majorId, middleId)?.legacy);
  }
  function majorMatcher(majorId) {
    const fns = (byId(majorId)?.middles || []).map(m => matcher(m.legacy)).filter(Boolean);
    if (!fns.length) return null;
    return s => fns.some(fn => fn(s));
  }

  return { MAJORS, byId, middleById, middleMatcher, majorMatcher };
})();
`;

const out = path.join(__dirname, '..', '..', 'frontend', 'js', 'ncs.js');
fs.writeFileSync(out, banner);
console.log('생성:', out);
console.log('대분류', majors.length, '| 중분류', majors.reduce((a,m)=>a+m.middles.length,0),
  '| legacy 붙은 중분류', majors.reduce((a,m)=>a+m.middles.filter(x=>x.legacy).length,0));
