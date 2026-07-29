/* 임금직업정보 직업 분류 카탈로그 — 커리어 로드맵의 분류 원천.

   원본은 scripts/fetch-wage-jobs.js 가 받아 둔 data/wage-jobs.json
   (한국고용직업분류 KECO 2018 · 대분류 10 → 중분류 35 → 직업 461, 임금·전망 포함).

   원본에 없어서 여기서 얹는 것이 두 가지다.

   1) DECOR — 대분류 이모지·설명. 화면용이고 원본에 그런 필드가 없다.
   2) LEGACY — 옛 스펙({dept, field})을 KECO 중분류로 집계하기 위한 매핑.
      careerly 스펙 레코드는 아직 '학과(dept)' 스키마라 직업코드로 이어지지 않는다.
      **매핑이 없는 중분류는 선배 데이터가 빈 상태로 나온다. 그게 정상이다** —
      careerly 가 실제로 다루는 8개 학과가 461개 직업 전부를 덮을 수 없다.
      (ncs.js 의 legacy overlay 와 같은 개념·같은 한계를 그대로 옮겼다.)

   매핑은 **서로 겹치지 않게** 짠다. 같은 스펙이 두 중분류에 동시에 잡히면
   합격자 평균이 두 군데서 다르게 보이고, 어느 쪽이 맞는지 알 수 없게 된다. */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'data', 'wage-jobs.json');

const DECOR = {
  '0': { emoji: '🗂️', desc: '기획·인사·회계·금융 등 기업과 기관을 움직이는 사무 직군입니다.' },
  '1': { emoji: '🔬', desc: '연구개발과 공학 기술 — 이공계 전공이 가장 넓게 진출하는 직군입니다.' },
  '2': { emoji: '⚖️', desc: '교육·법률·복지·공공안전 — 자격과 시험이 진입 경로인 직업이 많습니다.' },
  '3': { emoji: '🩺', desc: '의료·보건 — 대부분 면허가 필요한 전문 직군입니다.' },
  '4': { emoji: '🎨', desc: '예술·디자인·방송·스포츠 — 포트폴리오와 실적이 이력서를 대신하는 직군입니다.' },
  '5': { emoji: '✂️', desc: '미용·여행·숙박·음식·경비·청소 — 대인 서비스 중심 직군입니다.' },
  '6': { emoji: '🚚', desc: '영업·판매·운전·운송 — 성과와 자격(면허)이 함께 요구되는 직군입니다.' },
  '7': { emoji: '🏗️', desc: '건설·채굴 — 기사 등 국가기술자격이 승진과 직결되는 직군입니다.' },
  '8': { emoji: '🔧', desc: '설치·정비·생산 — 제조업의 현장 기술 직군입니다.' },
  '9': { emoji: '🌾', desc: '농림어업 — 1차 산업과 그 기술 직군입니다.' },
};

/* KECO 중분류 코드 → { majors: 관련 전공, legacy: 옛 스펙 매칭 조건 } */
const OVERLAY = {
  /* field 목록은 실제 저장된 스펙 값에서 뽑았다(db 실측 13개 조합).
     'audit'(회계법인 감사)을 빠뜨렸다가 회계 전공 98명이 통째로 집계에서 샜었다 —
     매핑을 손으로 짜면 이런 누락이 조용히 생기므로, 바꾼 뒤엔 아래 확인을 돌릴 것:
       node -e "…" 로 legacy 커버율과 중복 매칭을 센다(README 참고) */
  '02': { majors: ['경영학', '경제학', '회계학', '심리학'],
          legacy: { dept: ['business', 'economics', 'accounting', 'psych', 'media'],
                    field: ['corp', 'consulting', 'marketing', 'hr', 'audit'] } },
  '03': { majors: ['경영학', '경제학', '통계학'],
          legacy: { dept: ['business', 'economics'], field: ['finance'] } },
  '13': { majors: ['컴퓨터공학', '소프트웨어학', '통계학'],
          legacy: { dept: ['cs', 'stat'] } },
  '22': { majors: ['법학'],
          legacy: { dept: ['law'] } },
  '30': { majors: ['보건학', '심리학', '간호학'],
          legacy: { dept: ['psych'], field: ['clinical'] } },
  '41': { majors: ['미디어학', '신문방송학', '디자인학'],
          legacy: { dept: ['media'], field: ['media'] } },
  // 전공만 안내하고 선배 데이터는 아직 없는 중분류들
  '01': { majors: ['경영학', '경제학'] },
  '11': { majors: ['인문학', '사회과학'] },
  '12': { majors: ['생명과학', '화학', '물리학'] },
  '21': { majors: ['교육학'] },
  '23': { majors: ['사회복지학', '심리학'] },
  '61': { majors: ['경영학', '마케팅'] },
};

let cache = null;

function catalog() {
  if (cache) return cache;

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  } catch {
    /* 캐시가 없어도 서버는 떠야 한다. 로드맵만 빈 화면이 되고 나머지는 정상 동작한다. */
    console.warn('[wage-jobs] data/wage-jobs.json 이 없습니다. '
      + '`node scripts/fetch-wage-jobs.js` 로 직업 분류를 받아주세요. (커리어 로드맵 비활성)');
    return (cache = { empty: true, counts: { majors: 0, middles: 0, jobs: 0 }, majors: [] });
  }

  const majors = (raw.majors || []).map(M => ({
    ...M,
    /* 화면에 보여줄 번호. 공식 코드(code)는 '0'~'9' 로 시작하는데 사람이 읽는 목록은
       1번부터인 게 자연스러워서 +1 한 값을 따로 둔다.

       ── code 를 직접 1~10 으로 바꾸면 안 된다 ──
       code 는 우리가 붙인 일련번호가 아니라 **한국고용직업분류(KECO)의 공식 코드**이고,
       2차 분류 코드가 그 위에 얹혀 있다: '54' = 5번(미용·여행…) 대분류의 4번째.
       1차를 1~10 으로 바꾸면 '경영·사무'(공식 0 → 1)인데 그 아래 2차가 01·02·03 으로
       남아 앞자리가 어긋난다. 조회 키(byId·middleById)와 저장된 값도 전부 깨진다.
       그래서 **식별자는 code, 표시는 no** 로 나눈다.

       index 가 아니라 code 에서 뽑는 이유: 배열 순서가 바뀌어도 번호가 흔들리지 않는다. */
    no: Number(M.code) + 1,
    emoji: DECOR[M.code]?.emoji || '💼',
    desc: DECOR[M.code]?.desc || '',
    middles: (M.middles || []).map(S => {
      const ov = OVERLAY[S.code] || {};
      return {
        code: S.code,
        name: S.name,
        majors: ov.majors || [],
        ...(ov.legacy ? { legacy: ov.legacy } : {}),
        /* 중분류 카드에 바로 보여줄 임금 요약 — 직업을 고르기 전에도
           "이 갈래가 대충 얼마나 버는가"를 알 수 있어야 고를 수 있다. */
        wageRange: wageRange(S.jobs),
        jobs: S.jobs,
      };
    }),
  }));

  cache = {
    empty: false,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    fetchedAt: raw.fetchedAt,
    wageUnit: raw.wageUnit || '만원',
    counts: raw.counts,
    majors,
  };
  return cache;
}

/* 중분류 안 직업들의 임금 분포. 평균 하나만 주면 편차가 큰 갈래(예: 예술·디자인·방송직)를
   대표하지 못해서 최저~최고를 같이 준다. */
function wageRange(jobs) {
  const w = (jobs || []).map(j => j.avgWage).filter(n => typeof n === 'number' && n > 0);
  if (!w.length) return null;
  return {
    min: Math.min(...w),
    max: Math.max(...w),
    avg: Math.round(w.reduce((a, b) => a + b, 0) / w.length),
    n: w.length,
  };
}

module.exports = { catalog, DECOR, OVERLAY };
