// ════════════════════════════════════════════════════════════
//  CAREERLY — CAS (Career Asset Score) 점수 엔진 · 정량 파트
//
//  설계 근거: docs/notes/2026.06.23 아이디어 회의(CAS점수내는법 개발).docx
//             docs/notes/2026년 7월 5일 회의.docx
//
//  CAS 총점 1,000점 = 정량 400점(40%) + 정성 600점(60%)
//  실무 역량(정성)을 더 높게 본다는 팀 결정에 따른 비율이다.
//  이 파일은 정량 400점만 다룬다. 정성은 아직 배점이 확정되지 않았다
//  (7/5 회의록의 '기본 참여 점수 + 역량 키워드 + 성과 가산점' 구조까지만 합의).
//
//  ── 정량 400점의 구성 ──
//  학점 40% · 어학 35% · 자격증 25%   (사기업 일반 기준)
//
//  가중치는 다음 두 조건에 따라 조정되고, 조정 후 항상 합이 1이 되도록
//  재정규화한다.
//    1) 지원처가 공기업·공공  → 학점을 보지 않으므로 학점 가중치 0
//    2) 전공과 직무가 무관    → 학점 가중치 ×0.5
//
//  ── 점수화 원칙 ──
//  절대 기준이 아니라 "같은 직무 합격자(선배) 대비 상대 위치"로 채점한다.
//  회의록의 "해당 직무 취업자 평균 학점은 3.85" 벤치마킹 방식을 따른다.
//  합격자 평균과 같으면 만점의 80%, 평균의 1.25배 이상이면 만점.
// ════════════════════════════════════════════════════════════
(function (root) {

  const TOTAL_QUANT = 400;           // 정량 만점 (CAS 1000점 중 40%)
  const PAR_RATIO   = 0.80;          // 합격자 평균과 동률일 때 받는 비율
  const CAP_RATIO   = 1.25;          // 평균의 몇 배부터 만점인지

  // ── 지원처별 기본 가중치 ────────────────────────────────────
  //  gpaBlind: 학점을 보지 않는 지원처 (공기업 블라인드 채용)
  const TARGETS = {
    private: { label: '사기업',      weights: { gpa: 0.40, lang: 0.35, cert: 0.25 } },
    public:  { label: '공기업·공공', weights: { gpa: 0.40, lang: 0.35, cert: 0.25 }, gpaBlind: true },
    startup: { label: '스타트업',    weights: { gpa: 0.30, lang: 0.30, cert: 0.40 } },
  };

  const OFF_MAJOR_GPA_FACTOR = 0.5;  // 전공-직무 무관 시 학점 가중치 배율

  // ── 어학 환산표 ─────────────────────────────────────────────
  //  회의록 기준점: OPIc IH ≈ TOEIC 850 ≈ 토익스피킹 IM3 ≈ '상(Upper-Intermediate)'
  //  이 셋이 모두 80 이 되도록 맞췄다. 서로 다른 시험을 하나의 0~100 지수로 환산한다.
  const TOEIC_CURVE = [[400, 20], [600, 45], [700, 60], [800, 75], [850, 80], [900, 88], [950, 94], [990, 100]];
  const TOEFL_CURVE = [[40, 30], [60, 55], [80, 75], [100, 88], [120, 100]];
  const OPIC_INDEX  = { NL: 20, NM: 30, NH: 40, IL: 50, IM1: 58, IM2: 64, IM3: 70, IH: 80, AL: 92 };
  const TS_INDEX    = { NL: 20, NM: 30, NH: 42, IL: 55, IM: 72, IH: 85, AL: 95 };

  function interpolate(curve, x) {
    if (x <= curve[0][0]) return curve[0][1];
    const last = curve[curve.length - 1];
    if (x >= last[0]) return last[1];
    for (let i = 0; i < curve.length - 1; i++) {
      const [x0, y0] = curve[i], [x1, y1] = curve[i + 1];
      if (x >= x0 && x <= x1) return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
    return 0;
  }

  /* 어학 성적 묶음 → 0~100 지수. 여러 시험을 냈다면 가장 높은 환산값을 쓴다.
     (합격자들은 보통 자기에게 유리한 시험 하나를 제출한다) */
  function langIndex(scores) {
    if (!scores) return null;
    const vals = [];
    if (typeof scores.toeic === 'number') vals.push(interpolate(TOEIC_CURVE, scores.toeic));
    if (typeof scores.toefl === 'number') vals.push(interpolate(TOEFL_CURVE, scores.toefl));
    if (scores.opic          && OPIC_INDEX[scores.opic]          != null) vals.push(OPIC_INDEX[scores.opic]);
    if (scores.toeicSpeaking && TS_INDEX[scores.toeicSpeaking]   != null) vals.push(TS_INDEX[scores.toeicSpeaking]);
    return vals.length ? Math.max(...vals) : null;
  }

  // ── 상대 채점 ───────────────────────────────────────────────
  /* 내 값과 합격자 평균의 비율로 0~1 을 낸다.
       평균과 같음        → 0.80
       평균의 1.25배 이상 → 1.00
       0                  → 0
     평균 미만 구간은 원점~평균을 0~0.8 로 선형 매핑한다. */
  function relativeScore(mine, benchmarkAvg) {
    if (mine == null || !benchmarkAvg) return null;
    const r = mine / benchmarkAvg;
    if (r >= CAP_RATIO) return 1;
    if (r >= 1) return PAR_RATIO + (1 - PAR_RATIO) * ((r - 1) / (CAP_RATIO - 1));
    return Math.max(0, PAR_RATIO * r);
  }

  // ── 자격증 ──────────────────────────────────────────────────
  /* 회의록: "단순 목록이 아니라 취업자 중 보유 비율을 파악해 우선순위를 준다"
     → 내가 가진 자격증의 '합격자 보유율' 합을, 상위 3개 보유율 합으로 나눈다.
       해당 직무 합격자가 잘 갖지 않는 자격증(= 직무 무관)은 보유율이 낮으므로
       점수에 거의 기여하지 못한다. 목록을 사람이 관리할 필요가 없다.

     다만 표본이 아주 적으면 보유율이 요동친다(1명이 가지면 100%).
     그래서 표본이 MIN_N 미만이면 자격증 카탈로그를 사전 확률로 쓴다. */
  const MIN_N_FOR_RATE = 5;
  const PRIOR_IN_CATALOG  = 60;   // 카탈로그에 있는 자격증의 가정 보유율(%)
  const PRIOR_OFF_CATALOG = 5;    // 카탈로그에 없는 자격증

  function certScore(myCerts, benchmark, catalogIds) {
    const mine = myCerts || [];
    if (!mine.length) return 0;

    const useRates = benchmark && benchmark.count >= MIN_N_FOR_RATE && benchmark.certs?.length;
    const rateOf = id => {
      if (useRates) return benchmark.certs.find(c => c.id === id)?.pct ?? PRIOR_OFF_CATALOG;
      return (catalogIds || []).includes(id) ? PRIOR_IN_CATALOG : PRIOR_OFF_CATALOG;
    };

    // 만점 기준: 이 직무에서 가장 흔한 자격증 3개를 모두 보유한 상태
    const pool = useRates
      ? benchmark.certs.map(c => c.pct)
      : (catalogIds || []).map(() => PRIOR_IN_CATALOG);
    const top3 = pool.sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    if (!top3) return 0;

    const earned = mine.map(rateOf).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    return Math.min(1, earned / top3);
  }

  // ── 가중치 결정 ─────────────────────────────────────────────
  /* gpaBlind 이면 학점을 빼고, 전공 무관이면 학점을 절반으로 깎는다.
     어느 경우든 남은 가중치를 어학·자격증에 원래 비율대로 재분배해 합을 1로 만든다. */
  function resolveWeights(targetKey, majorRelevant) {
    const target = TARGETS[targetKey] || TARGETS.private;
    const base = { ...target.weights };

    if (target.gpaBlind) base.gpa = 0;
    else if (!majorRelevant) base.gpa *= OFF_MAJOR_GPA_FACTOR;

    const sum = base.gpa + base.lang + base.cert;
    return {
      gpa:  base.gpa  / sum,
      lang: base.lang / sum,
      cert: base.cert / sum,
      gpaBlind: !!target.gpaBlind,
      majorRelevant,
    };
  }

  // ── 메인 ────────────────────────────────────────────────────
  /*  spec       : 내 스펙 { gpa, gpaMax, scores, certs }
      benchmark  : Aggregator.compute() 결과 (같은 NCS 중분류 합격자)
      target     : 'private' | 'public' | 'startup'
      majorRelevant : 전공이 이 직무와 관련 있는가 (boolean)
      catalogIds : 이 직무의 자격증 카탈로그 id 목록 (표본 부족 시 사용)

      반환: { total, max, parts: { gpa, lang, cert }, weights, sampleSize, reliable }
      각 part 는 { ratio, points, max, mine, benchmark } — 화면에서 근거를 보여주기 위함 */
  function computeQuant({ spec, benchmark, target = 'private', majorRelevant = true, catalogIds = [] }) {
    const w = resolveWeights(target, majorRelevant);
    const n = benchmark?.count || 0;

    // 학점 — 4.5 만점으로 환산해 비교
    const myGpa = (spec?.gpa != null && spec?.gpaMax) ? (spec.gpa / spec.gpaMax) * 4.5 : null;
    const benchGpa = benchmark?.gpa?.avg ?? null;
    const gpaRatio = w.gpa > 0 ? relativeScore(myGpa, benchGpa) : null;

    // 어학 — 환산 지수끼리 비교
    const myLang = langIndex(spec?.scores);
    const benchLang = langIndex(benchmarkScores(benchmark));
    const langRatio = relativeScore(myLang, benchLang);

    // 자격증 — 보유율 기반
    const certRatio = certScore(spec?.certs, benchmark, catalogIds);

    const part = (ratio, weight, mine, bench) => ({
      ratio,                                   // null = 채점 불가 (데이터 없음)
      max: Math.round(TOTAL_QUANT * weight),
      points: ratio == null ? 0 : Math.round(TOTAL_QUANT * weight * ratio),
      mine, benchmark: bench,
    });

    const parts = {
      gpa:  part(gpaRatio,  w.gpa,  round2(myGpa),  round2(benchGpa)),
      lang: part(langRatio, w.lang, round2(myLang), round2(benchLang)),
      cert: part(certRatio, w.cert, (spec?.certs || []).length, n),
    };

    return {
      total: parts.gpa.points + parts.lang.points + parts.cert.points,
      max: TOTAL_QUANT,
      parts,
      weights: w,
      sampleSize: n,
      // 표본이 적으면 점수는 내되 화면에서 신뢰도를 함께 알린다
      reliable: n >= MIN_N_FOR_RATE,
    };
  }

  /* 벤치마크의 어학 평균을 langIndex() 가 먹을 수 있는 형태로 되돌린다.
     Aggregator 는 시험별 평균을 따로 내주므로, 그중 가장 높은 환산값을 기준선으로 삼는다. */
  function benchmarkScores(benchmark) {
    if (!benchmark?.scores) return null;
    const s = benchmark.scores;
    return {
      toeic: s.toeic?.avg ?? undefined,
      toefl: s.toefl?.avg ?? undefined,
      opic: s.opic?.avg ?? undefined,
      toeicSpeaking: s.toeicSpeaking?.avg ?? undefined,
    };
  }

  const round2 = n => (n == null ? null : Math.round(n * 100) / 100);

  // ── 전공-직무 관련성 ────────────────────────────────────────
  /* 스펙의 학과(dept)를 전공명으로 바꾼 뒤, NCS 중분류의 '관련 전공' 목록과
     대조한다. ncs.js 는 '컴퓨터공학', '소프트웨어학' 처럼 학과의 '과'를 뗀
     이름을 쓰므로 부분 일치로 본다. 관련 전공이 비어 있는 중분류(전공 무관
     직무)는 학점을 깎을 이유가 없으므로 관련 있음으로 취급한다. */
  const DEPT_MAJOR = {
    business: '경영학', economics: '경제학', accounting: '회계학',
    cs: '컴퓨터공학', stat: '통계학', law: '법학',
    psych: '심리학', media: '미디어학',
  };

  function isMajorRelevant(dept, middleMajors) {
    if (!middleMajors || !middleMajors.length) return true;
    const mine = DEPT_MAJOR[dept];
    if (!mine) return true;               // 학과 정보가 없으면 불이익을 주지 않는다
    return middleMajors.some(m => m.includes(mine) || mine.includes(m));
  }

  const api = {
    computeQuant, resolveWeights, langIndex, relativeScore, certScore,
    isMajorRelevant, DEPT_MAJOR,
    TARGETS, TOTAL_QUANT, MIN_N_FOR_RATE,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;  // node 테스트용
  root.CAS = api;

})(typeof window !== 'undefined' ? window : globalThis);
