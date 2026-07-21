// ════════════════════════════════════════════════════════════
//  CAREERLY — CAS 히어로 (내 CAS 점수 / 백분위 / 등급)
//
//  cas.js 의 1000점 엔진을 화면에 처음으로 꽂는 자리다. 이전에는 careerly.html
//  에 87/100 이 하드코딩돼 있어 누가 로그인하든 같은 점수가 떴다.
//
//  ── 점수 ──
//    정량(400) + 정성(600) = 1000. 다만 두 축의 비중은 고정이 아니라
//    잘한 쪽에 더 실린다(4:6 기본, 3:7 ~ 5:5). CAS.computeTotal() 이 계산한다.
//
//  ── 백분위 ──
//    같은 조건 선배들에게 같은 채점을 돌려 나보다 낮은 사람의 비율을 센다.
//    "상위 12%" 는 그 여집합이다. 선배가 너무 적으면(MIN_PEERS 미만)
//    숫자가 요동쳐 오해를 부르므로 백분위를 아예 감춘다.
//
//  cas-radar.js 와 같은 벤치마크(좁게 → 넓게)를 쓴다. 두 화면이 다른 기준으로
//  계산되면 "레이더는 좋은데 점수는 낮다" 같은 설명 불가능한 상태가 된다.
// ════════════════════════════════════════════════════════════
window.CASHero = (() => {

  /* 이 인원 미만이면 백분위를 숨긴다. 3명 중 2등을 '상위 33%' 라고
     보여주는 건 정보가 아니라 착시다. */
  const MIN_PEERS = 5;

  const GRADES = [
    { min: 90, label: '탁월' },
    { min: 70, label: '우수' },
    { min: 40, label: '보통' },
    { min: 0,  label: '미흡' },
  ];

  const $ = id => document.getElementById(id);

  /* 스펙의 기업유형 → CAS 채점 타깃(private/startup/public).
     기업유형별로 무엇을 중시하는지가 달라 가중치가 갈린다. */
  function targetOf(spec) {
    const t = (Aggregator.CORP_TYPES || []).find(c => c.id === spec?.corpType);
    return t?.cas || 'private';
  }

  /* 한 스펙의 CAS 총점. 나와 선배 모두 같은 기준으로 매겨야 비교가 성립하므로
     벤치마크(agg)와 자격증 카탈로그를 공유한다. */
  function scoreOf(spec, agg, catalogIds) {
    const quant = CAS.computeQuant({
      spec,
      benchmark: agg,
      target: targetOf(spec),
      majorRelevant: true,   // 전공 적합성은 로드맵에서 따로 다룬다
      catalogIds,
    });
    const qual = CAS.computeQual({ spec, benchRaw: agg?.qualBenchRaw });
    return CAS.computeTotal({ quant, qual });
  }

  /* 나보다 점수가 낮은 선배의 비율(0~100). 동점은 절반만 센다 —
     같은 점수인데 한쪽이 일방적으로 앞선다고 보이지 않게. */
  function percentileOf(myTotal, peerTotals) {
    if (!peerTotals.length) return null;
    const below = peerTotals.filter(t => t < myTotal).length;
    const same  = peerTotals.filter(t => t === myTotal).length;
    return Math.round(((below + same / 2) / peerTotals.length) * 100);
  }

  const gradeOf = pct => (GRADES.find(g => pct >= g.min) || GRADES[GRADES.length - 1]).label;

  /* 적용된 비중을 사람 말로. computeTotal 이 이미 비중을 돌려주므로
     "왜 내 점수가 이렇게 나왔는지" 를 그대로 설명할 수 있다. */
  function splitText(t) {
    const q = Math.round(t.quantWeight * 10);
    const l = Math.round(t.qualWeight * 10);
    const ratio = `${q}:${l}`;
    if (q < 4) return `경험 스펙이 더 강해 <b>숫자 ${ratio} 경험</b> 비중이 적용됐어요.`;
    if (q > 4) return `숫자 스펙이 더 강해 <b>숫자 ${ratio} 경험</b> 비중이 적용됐어요.`;
    return `두 스펙이 고르게 있어 기본 비중 <b>숫자 ${ratio} 경험</b>이 적용됐어요.`;
  }

  /* 점수를 못 내는 상태(비로그인·스펙없음·선배없음)를 한 자리에서 처리한다.
     빈칸에 0 을 띄우면 "0점" 으로 오해하므로 무엇을 하면 되는지를 말해준다. */
  function showEmpty(msg, help) {
    $('cas-score-num').textContent = '—';
    $('cas-rank').innerHTML = `<i class="ti ti-info-circle"></i>${msg}`;
    $('cas-split').innerHTML = '';
    $('cas-dist-label').textContent = '백분위 분포';
    $('cas-grade').textContent = '—';
    $('cas-dist-help').textContent = help || '';
    const fill = document.querySelector('.cas-bar-fill');
    const mark = document.querySelector('.cas-bar-marker');
    if (fill) fill.style.width = '0%';
    if (mark) mark.style.left = '0%';
  }

  /* 저장된 값은 'cs' · 'backend' 같은 id 라 그대로 쓰면 화면에 영문이 노출된다.
     라벨은 스펙 입력 폼의 목록이 단일 출처다. */
  function labelOf(spec) {
    const SF = window.SpecForm || {};
    const dept = (SF.DEPTS || []).find(d => d.id === spec.dept)?.label || '내 전공';
    const jobPairs   = (SF.JOB_OPTIONS   || {})[spec.field] || [];
    const fieldPairs = (SF.FIELD_OPTIONS || {})[spec.dept]  || [];
    const job   = jobPairs.find(([id]) => id === spec.job)?.[1];
    const field = fieldPairs.find(([id]) => id === spec.field)?.[1];
    const sub = job || field;
    return sub ? `${dept} · ${sub} 기준` : `${dept} 기준`;
  }

  // ── 진입점 ──────────────────────────────────────────────────
  function render() {
    if (!$('cas-hero')) return;

    const user = DB.currentUser();
    if (!user) return showEmpty('로그인하면 내 CAS 점수를 볼 수 있어요.',
      '로그인 후 스펙을 입력하면 선배 데이터와 비교해 점수를 계산해 드려요.');

    const spec = DB.getSpec(user.username);
    if (!spec || !spec.dept) return showEmpty('아직 스펙을 입력하지 않았어요.',
      '마이페이지에서 학점·어학·경험을 입력하면 점수가 계산됩니다.');

    /* 벤치마크는 좁은 조건부터(직무 → 분야 → 학과) 넓혀 간다.
       레이더는 '비어 있을 때만' 넓히지만 여기서는 MIN_PEERS 를 채울 때까지 넓힌다 —
       백분위는 모집단이 곧 신뢰도라, 같은 직무 1명과 비교한 순위는 의미가 없다.
       끝까지 못 채우면 가장 넓은 집계를 쓴다 — 어차피 백분위를 못 낼 상황이면
       1명짜리 평균보다 학과 전체 평균이 점수 기준으로 덜 흔들린다. */
    const steps = [
      { dept: spec.dept, field: spec.field, job: spec.job },
      { dept: spec.dept, field: spec.field },
      { dept: spec.dept },
    ];
    const aggs = steps.map(q => Aggregator.compute(q)).filter(a => !a.empty);
    if (!aggs.length) return showEmpty('비교할 선배 데이터가 아직 없어요.',
      '같은 학과·직무 선배 데이터가 쌓이면 점수와 백분위가 표시됩니다.');
    const agg = aggs.find(a => a.count >= MIN_PEERS) || aggs[aggs.length - 1];

    const catalogIds = (Aggregator.CERT_CATALOG[spec.dept] || []).map(c => c.id);
    const mine = scoreOf(spec, agg, catalogIds);

    // 점수 + 구성
    $('cas-score-num').textContent = mine.total;
    $('cas-split').innerHTML =
      `숫자 스펙 <b>${mine.quant}</b> + 경험 스펙 <b>${mine.qual}</b><br>${splitText(mine)}`;

    /* 백분위 — 조건에 걸린 스펙 전체를 모집단으로 둔다.
       /api/specs 는 익명화돼 userId 가 없어서 내 스펙만 골라 빼낼 수단이 없다.
       분포에 자기 자신을 포함하는 건 백분위의 표준 정의이기도 하다. */
    const peerTotals = (agg.specs || []).map(s => scoreOf(s, agg, catalogIds).total);
    $('cas-dist-label').textContent = labelOf(spec) + ' 백분위 분포';

    if (peerTotals.length < MIN_PEERS) {
      $('cas-rank').innerHTML =
        `<i class="ti ti-trophy"></i>비교할 선배가 ${peerTotals.length}명뿐이라 순위는 아직 계산하지 않아요`;
      $('cas-grade').textContent = '—';
      $('cas-dist-help').textContent =
        `백분위는 선배 ${MIN_PEERS}명 이상부터 표시돼요. 지금은 점수만 참고해 주세요.`;
      document.querySelector('.cas-bar-fill').style.width = '0%';
      document.querySelector('.cas-bar-marker').style.left = '0%';
      return;
    }

    const pct = percentileOf(mine.total, peerTotals);
    const top = Math.max(1, 100 - pct);
    $('cas-rank').innerHTML = `<i class="ti ti-trophy"></i>${labelOf(spec)} 상위 ${top}%`;
    $('cas-grade').textContent = gradeOf(pct) + ' 등급';
    $('cas-dist-help').innerHTML =
      `나와 같은 길을 준비한 선배 <b>${peerTotals.length}명</b>을 점수 낮은 순으로 줄 세웠을 때 내 위치예요.`;

    requestAnimationFrame(() => setTimeout(() => {
      document.querySelector('.cas-bar-fill').style.width = pct + '%';
      document.querySelector('.cas-bar-marker').style.left = pct + '%';
    }, 80));
  }

  return { render, scoreOf, percentileOf };
})();
