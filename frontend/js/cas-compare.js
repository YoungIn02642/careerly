// ════════════════════════════════════════════════════════════
//  C:road — 스펙 비교 (나 vs 같은 길을 간 선배 평균)
//
//  careerly.html 에 8행이 하드코딩돼 있던 자리(학점 3.82, 토익 870 …)를
//  실제 스펙과 선배 평균으로 채운다.
//
//  ── 막대의 의미 ──
//    세로 선(.cmp-peer) = 선배 평균, 색 막대(.cmp-me) = 나.
//    폭은 CAS.relativeScore() 를 그대로 쓴다 — 평균과 같으면 80%,
//    평균의 1.25배면 100%. CAS 점수를 매기는 규칙과 같은 자를 쓰는 것이라
//    "막대는 긴데 점수는 낮다" 같은 어긋남이 생기지 않는다.
//    그래서 선배 평균 선은 늘 80% 자리에 선다.
//
//  ── 없앤 행 ──
//    목업에 있던 '전공 핵심 과목(A0)' 은 뺐다. 스펙에 과목 성적을 받는
//    칸이 없어 채울 데이터가 아예 없다. 빈 행을 남겨두면 또 하드코딩이 된다.
// ════════════════════════════════════════════════════════════
window.CASCompare = (() => {

  const PEER_MARK = 80;              // 평균 = 만점의 80% (CAS.relativeScore 규칙)
  const QUAL_GROUPS = ['volunteer', 'internal', 'external'];

  const $ = id => document.getElementById(id);
  const pct = r => Math.round(Math.max(0, Math.min(1, r ?? 0)) * 100);
  const round1 = n => Math.round(n * 10) / 10;
  const round2 = n => Math.round(n * 100) / 100;

  /* 활동 유형별 내 보유 횟수 */
  function countByType(spec, typeId) {
    return CAS.normalizeActivities(spec).filter(a => a.type === typeId).length;
  }

  /* 선배들의 평균 보유 횟수 — Aggregator 는 '보유율(%)' 만 주므로 여기서 센다.
     "평균 2.1회" 처럼 횟수로 보여줘야 몇 번 더 하면 되는지 감이 온다. */
  function peerAvgCount(specs, typeId) {
    if (!specs?.length) return null;
    const total = specs.reduce((sum, s) => sum + countByType(s, typeId), 0);
    return total / specs.length;
  }

  function peerAvgCerts(specs) {
    if (!specs?.length) return null;
    return specs.reduce((sum, s) => sum + (s.certs?.length || 0), 0) / specs.length;
  }

  function peerAvgGroup(specs, key) {
    if (!specs?.length) return null;
    return specs.reduce((sum, s) => sum + CASProfile.activityCount(s, key), 0) / specs.length;
  }

  /* 격차 뱃지 — 평균 대비 얼마나 앞/뒤인지 */
  function gapBadge(diff, unit, digits = 1) {
    if (diff == null) return '';
    const v = digits === 2 ? round2(diff) : digits ? round1(diff) : Math.round(diff);
    /* 학점 0.01 차이를 '+0.01' 로 띄우면 의미 없는 격차가 강조된다 */
    const eps = digits === 2 ? 0.05 : digits ? 0.05 : 0.5;
    if (Math.abs(v) < eps) return `<span class="gap pos">평균과 동일</span>`;
    const cls = v > 0 ? 'pos' : 'neg';
    return `<span class="gap ${cls}">${v > 0 ? '+' : ''}${v}${unit}</span>`;
  }

  /* 한 행. ratio(0~1)로 막대 폭을 정하고, 평균 미만이면 색을 바꿔 눈에 띄게 한다. */
  function row(label, valueHtml, ratio, kind) {
    const w = pct(ratio);
    const lacking = w < PEER_MARK;
    return `
      <div class="cmp-row">
        <div class="cmp-row-top">
          <span class="cmp-label">${label}</span>
          <span class="cmp-nums">${valueHtml}</span>
        </div>
        <div class="cmp-track">
          <div class="cmp-peer" style="left:${PEER_MARK}%"></div>
          <div class="cmp-me ${lacking ? 'lacking' : kind}" data-w="${w}" style="width:${w}%"></div>
        </div>
      </div>`;
  }

  const empty = msg => `<div class="cmp-empty">${msg}</div>`;

  /* ── 숫자 스펙 ─────────────────────────────────────────────
     학점·어학은 각자 다른 단위라, 값 표시는 원래 단위로 하고
     막대만 상대점수로 통일한다. */
  function quantRows(spec, agg) {
    const rows = [];

    // 학점 — 4.5 만점으로 환산해 비교 (스펙마다 만점이 다르다)
    const myGpa = CASProfile.gpa45(spec);
    const benchGpa = agg.gpa?.avg ?? null;
    if (myGpa != null && benchGpa) {
      rows.push(row('학점 (4.5 환산)',
        `<b>${round2(myGpa)}</b> / 4.5 · 선배 평균 ${benchGpa} ${gapBadge(myGpa - benchGpa, '', 2)}`,
        CAS.relativeScore(myGpa, benchGpa), 'quant'));
    } else {
      rows.push(row('학점 (4.5 환산)', `<span class="cmp-none">미입력</span>`, 0, 'quant'));
    }

    // 어학 — 내가 가진 시험을 우선 보여준다. 비교는 환산 지수로 (시험이 서로 달라도 비교되도록)
    const myLang = CASProfile.languageValue(spec);
    const benchLang = CASProfile.peerAverage(agg.specs, 'language');
    const shown = spec.scores?.toeic ? `TOEIC <b>${spec.scores.toeic}</b>`
      : spec.scores?.opic ? `OPIc <b>${spec.scores.opic}</b>`
      : spec.scores?.toeicSpeaking ? `TOEIC Speaking <b>${spec.scores.toeicSpeaking}</b>`
      : spec.scores?.toefl ? `TOEFL <b>${spec.scores.toefl}</b>`
      : spec.scores?.topik ? `TOPIK <b>${spec.scores.topik}</b>` : null;
    const benchToeic = agg.scores?.toeic?.avg;
    /* 격차는 같은 시험끼리만 보여준다 — OPIc IH 와 TOEIC 843 의 차이는 숫자로 못 쓴다 */
    const toeicGap = (spec.scores?.toeic && benchToeic) ? gapBadge(spec.scores.toeic - benchToeic, '', 0) : '';
    const exchangeCount = CASProfile.activityCount(spec, 'language');
    rows.push(row('어학·글로벌 경험',
      shown ? `${shown}${benchToeic ? ` · 선배 평균 TOEIC ${benchToeic}` : ''} ${toeicGap}`
            : exchangeCount ? `<b>교환학생·어학연수 ${exchangeCount}회</b>` : `<span class="cmp-none">미입력</span>`,
      myLang != null && benchLang ? CAS.relativeScore(myLang, benchLang) : 0, 'quant'));

    // 자격증 — 개수로 비교하고, 어떤 걸 따야 하는지는 아래 '부족한 항목' 이 다룬다
    const myCerts = spec.certs?.length || 0;
    const benchCerts = peerAvgCerts(agg.specs);
    rows.push(row('자격증',
      `<b>${myCerts}</b>개${benchCerts != null ? ` · 선배 평균 ${round1(benchCerts)}개` : ''} ${gapBadge(benchCerts != null ? myCerts - benchCerts : null, '개')}`,
      benchCerts ? CAS.relativeScore(myCerts, benchCerts) : (myCerts ? 1 : 0), 'quant'));

    return rows.join('');
  }

  /* ── 경험 스펙 ─────────────────────────────────────────────
     보유 여부가 아니라 횟수로 비교한다. 인턴 1회와 3회는 전혀 다른 스펙이다. */
  function qualRows(spec, agg) {
    return QUAL_GROUPS.map(key => {
      const group = CASProfile.GROUPS.find(g => g.key === key);
      const mine = CASProfile.activityCount(spec, key);
      const bench = peerAvgGroup(agg.specs, key);
      return row(group?.label || key,
        `<b>${mine}</b>회${bench != null ? ` · 선배 평균 ${round1(bench)}회` : ''} ${gapBadge(bench != null ? mine - bench : null, '회')}`,
        bench ? CAS.relativeScore(mine, bench) : (mine ? 1 : 0), 'qual');
    }).join('');
  }

  // ── 진입점 ──────────────────────────────────────────────────
  //   agg 는 CASHero 가 고른 것과 같은 벤치마크를 받는다. 두 영역이 서로 다른
  //   모집단을 쓰면 "상위 30% 인데 전 항목이 평균 이하" 같은 모순이 생긴다.
  function render(spec, agg) {
    const q = $('cmp-quant-rows'), l = $('cmp-qual-rows');
    if (!q || !l) return;

    if (!spec || !agg || agg.empty) {
      const msg = !spec ? '스펙을 입력하면 선배 평균과 비교해 드려요.'
                        : '비교할 선배 데이터가 아직 없어요.';
      q.innerHTML = empty(msg);
      l.innerHTML = empty(msg);
      return;
    }

    q.innerHTML = quantRows(spec, agg);
    l.innerHTML = qualRows(spec, agg);
  }

  return { render };
})();
