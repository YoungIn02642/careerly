// ════════════════════════════════════════════════════════════
//  C:road — CAS 히어로 (내 CAS 점수 / 백분위 / 등급)
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

  let selectedJob = null;

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
    if (window.CASCompare) CASCompare.render(null, null);
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
    /* 점수를 못 내도 갈림길은 남는다 — 로그인·스펙 입력이 곧 '스펙 채우기' 쪽
       가지이고, 그 안내가 사라지면 여기서 흐름이 끊긴다.
       GAP 도 같이 비운다. 안 비우면 직전 사용자의 부족 항목이 남는다. */
    if (typeof window.renderGap === 'function') window.renderGap(window.currentGapType || 'cert');
    if (typeof window.renderRoadmapNext === 'function') window.renderRoadmapNext(null);
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

  function paintJobSelect(spec) {
    const select = $('cas-job-select');
    if (!select) return;
    const jobs = (window.SpecForm?.JOB_OPTIONS || {})[spec.field] || [];
    if (!jobs.length) {
      select.innerHTML = `<option value="${spec.job || ''}">${labelOf(spec).replace(' 기준', '')}</option>`;
      select.disabled = true;
      return;
    }
    select.disabled = false;
    if (!selectedJob || !jobs.some(([id]) => id === selectedJob)) selectedJob = spec.job || jobs[0][0];
    select.innerHTML = jobs.map(([id, label]) =>
      `<option value="${id}" ${id === selectedJob ? 'selected' : ''}>${label}</option>`).join('');
  }

  /* 로드맵으로 들어왔을 때의 '비교 직무' — 같은 1차 분류의 2차 분류들을 담는다.
     고른 것 하나만 박아 두면 셀렉트가 아니라 라벨이 되고, 옛 학과 기반 목록을
     그대로 두면 화면이 로드맵과 다른 직무를 말하게 된다. */
  function paintRoadmapJobSelect(rm) {
    const select = $('cas-job-select');
    if (!select) return;
    const sibs = Roadmap.siblings();
    select.disabled = sibs.length <= 1;
    select.innerHTML = (sibs.length ? sibs : [{ code: rm.middle, name: rm.middleName }])
      .map(s => `<option value="${s.code}" ${s.code === rm.middle ? 'selected' : ''}>${s.name}</option>`)
      .join('');
  }

  /* ── 로드맵 직무 기준 벤치마크 ────────────────────────────────
     career.js STEP 03 과 **같은 matcher·같은 certKey** 를 쓴다(Roadmap.bench()).
     로드맵에서 "선배 n명" 을 보고 넘어왔는데 여기서 다른 n 이 뜨면, 학생은 어느
     숫자를 믿어야 할지 알 수 없다.

     표본이 0이면 넓히지 않고 null 을 돌려준다 — 옛 학과 기준으로 조용히 물러서면
     화면은 '이 직무 점수' 라고 적힌 채 다른 모집단의 점수를 보여주게 된다. */
  function roadmapBenchmark() {
    const b = Roadmap.bench();
    if (!b) return null;
    const agg = Aggregator.compute({ where: b.where, certKey: b.certKey });
    return { ...b, agg: agg.empty ? null : agg };
  }

  // ── 진입점 ──────────────────────────────────────────────────
  function render() {
    if (!$('cas-hero')) return;
    window.CASDashboardContext = null;
    Roadmap.mount('rm-bar-dashboard', 'me');

    /* 로드맵에서 넘어왔으면 그 직무로 채점해야 하는데, 직무 분류(200KB)는 로드맵을
       열 때만 받는다. #dashboard 로 바로 들어온 경우 여기서 받아 다시 그린다. */
    if (Roadmap.hasJob() && !KECO.ready() && !window.__casKecoTried) {
      window.__casKecoTried = true;
      KECO.load().then(render).catch(() => { /* 옛 학과 기준으로 계속 간다 */ });
    }

    const user = DB.currentUser();
    if (!user) return showEmpty('로그인하면 내 CAS 점수를 볼 수 있어요.',
      '로그인 후 스펙을 입력하면 선배 데이터와 비교해 점수를 계산해 드려요.');

    const savedSpec = DB.getSpec(user.username);
    if (!savedSpec || !savedSpec.dept) return showEmpty('아직 스펙을 입력하지 않았어요.',
      '마이페이지에서 학점·어학·경험을 입력하면 점수가 계산됩니다.');

    /* ── 어느 직무로 채점할 것인가 ────────────────────────────
       로드맵에서 직무를 고르고 왔으면 그 직무가 이긴다. 그러지 않으면 화면은
       "○○ 직무 기준" 이라고 적어 놓고 스펙에 저장된 옛 직무로 계산하게 된다. */
    const rmBench = roadmapBenchmark();
    const rm = Roadmap.get();

    let spec, agg, scopeLabel, catalogIds;

    if (rmBench && rmBench.agg) {
      paintRoadmapJobSelect(rm);
      spec = savedSpec;
      agg = rmBench.agg;
      scopeLabel = rmBench.label;                       // '○○ 직무군'
      catalogIds = (Aggregator.CERT_CATALOG[rmBench.certKey] || []).map(c => c.id);
      window.CASDashboardContext = { spec, agg, scopeLabel, roadmap: rm, source: 'roadmap' };
    } else {
      paintJobSelect(savedSpec);
      spec = { ...savedSpec, job: selectedJob || savedSpec.job };

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
      if (!aggs.length) {
        renderNext(null);
        return showEmpty('비교할 선배 데이터가 아직 없어요.',
          rmBench
            ? `${rmBench.label} 선배 데이터가 아직 없어요. 쌓이면 이 직무 기준으로 계산해 드립니다.`
            : '같은 학과·직무 선배 데이터가 쌓이면 점수와 백분위가 표시됩니다.');
      }
      /* 선택한 직무 데이터가 한 명이라도 있으면 그 직무를 그대로 쓴다.
         예전처럼 5명을 채우려고 분야·학과로 넓히면 직무를 바꿔도 점수가 같아진다. */
      agg = aggs[0];
      scopeLabel = labelOf(spec).replace(' 기준', '');
      catalogIds = (Aggregator.CERT_CATALOG[spec.dept] || []).map(c => c.id);
      window.CASDashboardContext = { spec, agg, scopeLabel, roadmap: rm, source: 'spec' };
    }

    const mine = scoreOf(spec, agg, catalogIds);

    /* 아래 비교 카드도 같은 벤치마크로 그린다 — 모집단이 다르면
       "상위 30% 인데 전 항목이 평균 이하" 같은 모순이 생긴다. */
    if (window.CASCompare) CASCompare.render(spec, agg);
    if (typeof window.renderGap === 'function') window.renderGap(window.currentGapType || 'cert');

    // 점수 + 구성
    $('cas-score-num').textContent = mine.total;
    $('cas-split').innerHTML =
      `숫자 스펙 <b>${mine.quant}</b> + 경험 스펙 <b>${mine.qual}</b><br>${splitText(mine)}`;

    /* 백분위 — 조건에 걸린 스펙 전체를 모집단으로 둔다.
       /api/specs 는 익명화돼 userId 가 없어서 내 스펙만 골라 빼낼 수단이 없다.
       분포에 자기 자신을 포함하는 건 백분위의 표준 정의이기도 하다. */
    const peerTotals = (agg.specs || []).map(s => scoreOf(s, agg, catalogIds).total);
    $('cas-dist-label').textContent = scopeLabel + ' 백분위 분포';

    if (peerTotals.length < MIN_PEERS) {
      $('cas-rank').innerHTML = '';
      $('cas-grade').textContent = '—';
      $('cas-dist-label').textContent = scopeLabel + ' CAS 점수';
      $('cas-dist-help').textContent = '';
      document.querySelector('.cas-bar-fill').style.width = '0%';
      document.querySelector('.cas-bar-marker').style.left = '0%';
      renderNext(mine);
      return;
    }

    const pct = percentileOf(mine.total, peerTotals);
    const top = Math.max(1, 100 - pct);
    $('cas-rank').innerHTML = `<i class="ti ti-trophy"></i>${scopeLabel} 상위 ${top}%`;
    $('cas-grade').textContent = gradeOf(pct) + ' 등급';
    $('cas-dist-help').innerHTML =
      `나와 같은 길을 준비한 선배 <b>${peerTotals.length}명</b>을 점수 낮은 순으로 줄 세웠을 때 내 위치예요.`;

    renderNext(mine, pct);

    requestAnimationFrame(() => setTimeout(() => {
      document.querySelector('.cas-bar-fill').style.width = pct + '%';
      document.querySelector('.cas-bar-marker').style.left = pct + '%';
    }, 80));
  }

  /* 2단계의 갈림길은 mentoring.js 가 그린다(GAP 계산과 같은 자리에 있어야
     '무엇이 부족한지' 와 '그래서 어디로 갈지' 가 어긋나지 않는다). */
  function renderNext(mine, pct) {
    if (typeof window.renderRoadmapNext === 'function') window.renderRoadmapNext(mine, pct);
  }

  /* 로드맵 모드에서는 셀렉트 값이 KECO 2차 분류 코드다 — 흐름 상태를 바꿔야
     회사 찾기·자소서 코치까지 같이 따라온다. 아니면 옛 학과 기반 직무 id 다. */
  function selectJob(value) {
    if (Roadmap.hasJob() && KECO.ready() && KECO.middleById(Roadmap.get().major, value)) {
      Roadmap.switchMiddle(value);
    } else {
      selectedJob = value || null;
    }
    render();
    if (window.CASRadar) CASRadar.render();
    if (typeof window.animateDashboard === 'function') window.animateDashboard();
  }

  return { render, selectJob, scoreOf, percentileOf };
})();
