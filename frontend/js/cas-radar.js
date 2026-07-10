// ════════════════════════════════════════════════════════════
//  CAREERLY — CAS 직무역량 레이더
//
//  "이 직무가 요구하는 역량"(합격자 데이터)과 "내가 채운 정도"를 한 다각형
//  위에 겹쳐 보여준다. 요구 수준은 직무마다 다르므로(합격자 분포가 다름)
//  직무를 바꾸면 바깥 다각형의 모양이 달라진다.
//
//  6개 축
//    정량 : 학점 · 어학 · 자격증        (js/cas.js 의 환산·채점 재사용)
//    정성 : 프로젝트 · 인턴십 · 대외활동  (합격자 보유율 vs 내 보유 여부)
//
//  각 축은 0~100. me(내 수준)와 req(합격자/요구 수준)를 같은 척도로 둔다.
// ════════════════════════════════════════════════════════════
window.CASRadar = (() => {

  const AXES = [
    { key: 'gpa',    label: '학점',    kind: 'quant' },
    { key: 'lang',   label: '어학',    kind: 'quant' },
    { key: 'cert',   label: '자격증',  kind: 'quant' },
    { key: 'projects',       label: '프로젝트', kind: 'qual' },
    { key: 'internship',     label: '인턴십',   kind: 'qual' },
    { key: 'extracurricular', label: '대외활동', kind: 'qual' },
  ];

  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

  /* 벤치마크(Aggregator 결과)의 어학 평균을 langIndex 가 먹는 형태로 */
  function benchLangScores(agg) {
    const s = agg?.scores; if (!s) return null;
    return {
      toeic: s.toeic?.avg, toefl: s.toefl?.avg,
      opic: s.opic?.avg, toeicSpeaking: s.toeicSpeaking?.avg,
    };
  }
  const qualPct = (agg, id) => agg?.qual?.find(q => q.id === id)?.pct ?? 0;

  /* 내 스펙 + 벤치마크 → 축별 { me, req } (0~100) */
  function buildValues(spec, agg, catalogIds) {
    const myGpa = (spec.gpa != null && spec.gpaMax) ? (spec.gpa / spec.gpaMax) * 4.5 : null;
    const benchGpa = agg?.gpa?.avg ?? null;

    const myLang = CAS.langIndex(spec.scores);
    const benchLang = CAS.langIndex(benchLangScores(agg));

    const values = {};
    for (const ax of AXES) {
      let me = null, req = null;
      switch (ax.key) {
        case 'gpa':
          me = myGpa != null ? clamp(myGpa / 4.5 * 100) : null;
          req = benchGpa != null ? clamp(benchGpa / 4.5 * 100) : null;
          break;
        case 'lang':
          me = myLang; req = benchLang;
          break;
        case 'cert':
          me = clamp(CAS.certScore(spec.certs, agg, catalogIds) * 100);
          req = 100;   // 이 직무 핵심 자격증을 모두 갖춘 상태를 100 으로 본다
          break;
        default:        // qual: projects / internship / extracurricular
          me = spec.qual?.[ax.key] ? 100 : 0;
          req = qualPct(agg, ax.key);
      }
      values[ax.key] = { me, req };
    }
    return values;
  }

  // ── SVG 렌더 ────────────────────────────────────────────────
  function polygon(cx, cy, R, ratios) {
    return AXES.map((_, i) => {
      const a = (Math.PI / 180) * (i * (360 / AXES.length) - 90);
      const r = R * clamp(ratios[i], 0, 100) / 100;
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    }).join(' ');
  }

  function svg(values) {
    const size = 300, cx = size / 2, cy = size / 2, R = 108;
    const rings = [0.25, 0.5, 0.75, 1];

    // 격자
    let grid = rings.map(r =>
      `<polygon points="${polygon(cx, cy, R, AXES.map(() => r * 100))}"
        fill="none" stroke="var(--c-border, #e5e5e8)" stroke-width="1"/>`).join('');
    // 축선 + 라벨
    let axes = '', labels = '';
    AXES.forEach((ax, i) => {
      const a = (Math.PI / 180) * (i * (360 / AXES.length) - 90);
      const ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
      axes += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"
        stroke="var(--c-border, #e5e5e8)" stroke-width="1"/>`;
      const lx = cx + Math.cos(a) * (R + 22), ly = cy + Math.sin(a) * (R + 22);
      const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
      const req = Math.round(values[ax.key].req ?? 0);
      labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}"
        dominant-baseline="middle" font-size="12" font-weight="600"
        fill="var(--c-ink, #080808)">${ax.label}</text>
        <text x="${lx.toFixed(1)}" y="${(ly + 13).toFixed(1)}" text-anchor="${anchor}"
        dominant-baseline="middle" font-size="10"
        fill="var(--c-ink3, #8a8a8a)">요구 ${req}</text>`;
    });

    const reqPts = polygon(cx, cy, R, AXES.map(ax => values[ax.key].req ?? 0));
    const mePts  = polygon(cx, cy, R, AXES.map(ax => values[ax.key].me  ?? 0));

    // 라벨이 원(300×300) 밖으로 나가므로 좌우 위아래 여백을 둔 viewBox 를 쓴다.
    const pad = 54;
    return `
      <svg viewBox="${-pad} ${-20} ${size + pad * 2} ${size + 36}" width="100%"
        style="max-width:420px;display:block;margin:0 auto">
        ${grid}${axes}
        <polygon points="${reqPts}" fill="rgba(109,58,255,0.06)"
          stroke="var(--brand, #6d3aff)" stroke-width="1.5" stroke-dasharray="4 3"/>
        <polygon points="${mePts}" fill="rgba(0,168,58,0.16)"
          stroke="#00a83a" stroke-width="2"
          style="transition:none">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" fill="freeze"/>
        </polygon>
        ${labels}
      </svg>`;
  }

  function legendAndGaps(values) {
    // 요구 대비 가장 부족한 축을 짚어준다
    const gaps = AXES
      .map(ax => ({ label: ax.label, gap: (values[ax.key].req ?? 0) - (values[ax.key].me ?? 0) }))
      .filter(g => g.gap > 8)
      .sort((a, b) => b.gap - a.gap);
    const tip = gaps.length
      ? `가장 부족한 역량: <b>${gaps.slice(0, 2).map(g => g.label).join(', ')}</b> — 이 부분을 채우면 CAS 가 오릅니다.`
      : `요구 수준을 대부분 충족했어요. 정성 스펙의 깊이(성과·기간)로 차별화해 보세요.`;
    return `
      <div class="radar-legend">
        <span class="rl"><span class="rl-sw me"></span>내 역량</span>
        <span class="rl"><span class="rl-sw req"></span>이 직무 요구 수준 (합격자 기준)</span>
      </div>
      <div class="radar-tip">${tip}</div>`;
  }

  // ── 진입점 ──────────────────────────────────────────────────
  function render() {
    const card = document.getElementById('cas-radar-card');
    if (!card) return;

    const user = DB.currentUser();
    const spec = user ? DB.getSpec(user.username) : null;

    const head = `<div class="radar-head"><i class="ti ti-radar-2"></i>직무역량 레이더</div>`;

    if (!user) {
      card.innerHTML = head + emptyState('로그인하고 스펙을 입력하면',
        '희망 직무가 요구하는 역량과 내가 채운 정도를 한눈에 볼 수 있어요.', 'login', '로그인하기');
      return;
    }
    if (!spec || !spec.dept) {
      card.innerHTML = head + emptyState('아직 스펙을 입력하지 않았어요',
        '학점·어학·자격증과 경험을 입력하면 직무역량 레이더가 그려집니다.', 'mypage', '스펙 입력하기');
      return;
    }

    // 저장된 스펙의 직무(dept/field/job)로 같은 직무 합격자 벤치마크를 낸다.
    // 좁게 시작해 데이터가 없으면 넓힌다.
    let agg = Aggregator.compute({ dept: spec.dept, field: spec.field, job: spec.job });
    if (agg.empty) agg = Aggregator.compute({ dept: spec.dept, field: spec.field });
    if (agg.empty) agg = Aggregator.compute({ dept: spec.dept });

    if (agg.empty) {
      card.innerHTML = head + emptyState('비교할 선배 데이터가 아직 없어요',
        '같은 직무 합격자 데이터가 쌓이면 요구 역량이 표시됩니다.', 'career', '커리어 로드맵 보기');
      return;
    }

    const catalogIds = (Aggregator.CERT_CATALOG[spec.dept] || []).map(c => c.id);
    const values = buildValues(spec, agg, catalogIds);

    card.innerHTML = `
      ${head}
      <div class="radar-scope">같은 직무 합격자 <b>${agg.count}명</b> 기준${agg.count < CAS.MIN_N_FOR_RATE ? ' · <span class="radar-warn">표본이 적어 참고용</span>' : ''}</div>
      ${svg(values)}
      ${legendAndGaps(values)}`;
  }

  function emptyState(title, desc, page, cta) {
    return `
      <div class="radar-empty">
        <div class="radar-empty-ic">📊</div>
        <div class="radar-empty-title">${title}</div>
        <div class="radar-empty-desc">${desc}</div>
        <button class="radar-empty-cta" onclick="navigate('${page}')">${cta} →</button>
      </div>`;
  }

  return { render, AXES };
})();
