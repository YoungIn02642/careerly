// ════════════════════════════════════════════════════════════
//  CAREERLY — Career Roadmap (임금직업정보 · 한국고용직업분류 KECO 2018 기반)
//   • 사이드바      : 1차 분류 10개 (js/keco.js · 임금직업정보시스템)
//   • STEP 01       : 2차 분류 선택    (미용·여행…경비·청소직 → 경호·경비직)
//   • STEP 02       : 직업 선택        (경호·경비직 → 경호원) · 9개씩 페이지로 나눈다
//   • STEP 03       : 커리어 로드맵 — 기업 유형 → 정량/정성 스펙
//   • 정량/정성 스펙 섹션은 Aggregator.compute() 결과로 동적 생성
//   • 데이터가 없으면 "데이터 없음" 빈 상태 표시
//
//   ── NCS 에서 갈아탄 이유 ──
//   NCS 는 '직무능력 표준' 이라 훈련 과정 단위로 쪼개져 있어서 학생이 아는 직업 이름
//   ('경호원')이 나오지 않는다. KECO 는 통계·고용 행정의 직업 분류라 실제 직업명으로
//   끝나고, 무엇보다 **직업마다 평균임금이 붙어 있다**.
//
//   ── 분류 트리는 비동기로 받는다 ──
//   200KB 라서 모든 페이지에 얹지 않는다(keco.js 머리주석). 로드맵을 처음 열 때
//   받아오므로 render() 가 '아직 안 왔음' 상태를 다룰 수 있어야 한다.
// ════════════════════════════════════════════════════════════
window.CareerPage = (() => {
  let currentMajor = null; // 1차 분류 **공식 코드** ('0'~'9'). 화면 번호(1~10)는 m.no 로 따로 있다
  let currentMiddle = null; // 2차 분류 코드 ('54' 등)
  let currentJob = null; // 직업 코드 ('K000007549' 등)
  let currentCorp = 'all'; // 기업 유형 ('all' | Aggregator.CORP_TYPES 의 id)
  let specTab = 'quant';
  let loadError = null;
  let jobPage = 1; // 직업 목록 페이지 (2차 분류를 바꾸면 1로 되돌린다)

  /* 분류를 아직 안 받았으면 받아오고, 받고 나면 사이드바와 본문을 다시 그린다.
     페이지 부팅이 아니라 **로드맵에 처음 들어올 때** 호출된다. */
  function ensureLoaded() {
    if (KECO.ready() || loadError) return;
    KECO.load()
      .then(() => {
        loadError = null;
        paintSidebar();
        render();
      })
      .catch((e) => {
        loadError = e.message || '직업 분류를 불러오지 못했습니다.';
        render();
      });
  }

  function paintSidebar() {
    const list = document.getElementById('job-major-list');
    if (!list) return;
    /* data-id 에는 공식 코드(m.code)를, 눈에 보이는 번호는 m.no 를 쓴다.
       둘을 섞으면 클릭했을 때 조회가 깨진다 — wage-jobs.js 의 no 주석 참고. */
    list.innerHTML = KECO.MAJORS()
      .map(
        (m) => `
      <div class="dept-item job-major-item ${currentMajor === m.code ? 'active' : ''}" data-id="${m.code}">
        <span class="jm-code">${m.no}</span>
        <span class="dept-emoji">${m.emoji}</span>
        <div><div class="dept-label">${esc(m.name)}</div></div>
      </div>`,
      )
      .join('');

    list.querySelectorAll('.job-major-item').forEach((el) => {
      el.addEventListener('click', () => {
        list
          .querySelectorAll('.job-major-item')
          .forEach((d) => d.classList.remove('active'));
        el.classList.add('active');
        currentMajor = el.dataset.id;
        currentMiddle = null;
        currentJob = null;
        jobPage = 1;
        render();
      });
    });
  }

  /* 부팅 시에는 아무것도 받지 않는다 — 로드맵을 안 여는 사용자가 대부분이다. */
  function init() {
    /* 분류 로딩은 render() → ensureLoaded() 로 미룬다 */
  }

  function refreshUser() {
    const user = DB.currentUser();
    const nameEl = document.getElementById('career-username');
    const avatarEl = document.getElementById('career-avatar');
    if (user) {
      const name = user.nickname || user.name || user.username;
      nameEl.innerHTML = `${esc(name)} <span class="up-level">Lv.1</span>`;
      avatarEl.textContent = name.slice(0, 1);
    } else {
      nameEl.innerHTML = `게스트 <span class="up-level">Lv.0</span>`;
      avatarEl.textContent = '👤';
    }
  }

  function render() {
    const main = document.getElementById('career-main');
    if (!main) return;

    // 분류가 아직 없으면 받아오고, 그동안은 상태를 보여준다
    if (!KECO.ready()) {
      ensureLoaded();
      main.innerHTML = loadError ? loadErrorBlock() : loadingBlock();
      return;
    }
    if (!document.querySelector('#job-major-list .job-major-item'))
      paintSidebar();

    if (!currentMajor) {
      main.innerHTML = welcomeBlock();
      return;
    }

    const major = KECO.byId(currentMajor);
    if (!major) {
      main.innerHTML = placeholderBlock();
      return;
    }
    const middle = currentMiddle
      ? KECO.middleById(currentMajor, currentMiddle)
      : null;
    const job =
      middle && currentJob
        ? KECO.jobById(currentMajor, currentMiddle, currentJob)
        : null;

    main.innerHTML = `
      <div class="topbar">
        <div class="breadcrumb">
          <span>${major.emoji} ${esc(major.name)}</span>
          ${middle ? `<span class="sep">›</span><span class="${job ? '' : 'active'}">${esc(middle.name)}</span>` : ''}
          ${job ? `<span class="sep">›</span><span class="active">${esc(job.name)}</span>` : ''}
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <span class="topbar-link" onclick="navigate('main')">← 홈으로</span>
        </div>
      </div>
      <div class="content">
        ${phaseBar()}
        ${majorHero(major)}
        ${middleSelect(major)}
        ${middle ? jobSelect(middle) : ''}
        ${job ? renderRoadmap(major, middle) : ''}
      </div>
    `;
    animateBars();
    syncTopbarCompact(main);
    bindTopbarScroll(main);
  }

  /* 스크롤해서 breadcrumb 가 상단에 붙어 있을 때는 작게 접는다 — 맨 위에 있을 때와
     똑같은 크기면 본문을 계속 가리는 느낌이 든다. render() 가 innerHTML 로 매번
     새로 그리므로, 다시 그릴 때마다 지금 스크롤 위치를 그대로 반영해 맞춰 둔다. */
  function syncTopbarCompact(main) {
    const topbar = main.querySelector('.topbar');
    if (topbar) topbar.classList.toggle('is-compact', main.scrollTop > 4);
  }

  /* 리스너는 한 번만 붙인다 — render() 는 #career-main 의 자식(innerHTML)만
     바꾸고 main 자체는 그대로 두므로, 매번 다시 붙이면 스크롤할 때마다
     같은 처리가 여러 번 겹쳐 불린다. */
  function bindTopbarScroll(main) {
    if (main.dataset.topbarScrollBound) return;
    main.dataset.topbarScrollBound = '1';
    main.addEventListener('scroll', () => syncTopbarCompact(main));
  }

  function phaseBar() {
    return `
      <div class="phase-bar">
        <div class="phase-tab ${!currentMiddle ? 'active' : ''}" onclick="CareerPage.gotoPhase(1)">
          <div class="pt-num">STEP 01</div><div class="pt-label">2차 분류</div>
        </div>
        <div class="phase-tab ${currentMiddle && !currentJob ? 'active' : ''}" onclick="CareerPage.gotoPhase(2)">
          <div class="pt-num">STEP 02</div><div class="pt-label">직업</div>
        </div>
        <div class="phase-tab ${currentJob ? 'active' : ''}" onclick="CareerPage.gotoPhase(3)">
          <div class="pt-num">STEP 03</div><div class="pt-label">커리어 로드맵</div>
        </div>
      </div>`;
  }

  function majorHero(major) {
    const jobs = major.middles.reduce((n, m) => n + m.jobs.length, 0);
    return `
      <div class="job-hero">
        <div class="job-hero-icon">${major.emoji}</div>
        <div class="job-hero-body">
          <div class="job-hero-top">
            <h2>${esc(major.name)}</h2>
            <span class="job-hero-badge">직업 ${jobs}개</span>
          </div>
          <p>${esc(major.desc)}</p>
        </div>
      </div>`;
  }

  /* 2차 분류 카드에 임금 범위를 같이 보여준다. 직업을 고르기 전에도 "이 갈래가 대충
     얼마나 버는가"가 보여야 어느 갈래로 들어갈지 정할 수 있다. */
  function middleSelect(major) {
    return `
      <div class="section-title">2차 분류 선택</div>
      <div class="fields-grid">
        ${major.middles
          .map((m) => {
            const w = m.wageRange;
            return `
          <div class="field-card ${currentMiddle === m.code ? 'active' : ''}" onclick="CareerPage.selectMiddle('${m.code}')">
            <div class="fc-name">${esc(m.name)}</div>
            <div class="fc-desc">
              직업 ${m.jobs.length}개
              ${w ? ` · 평균 ${KECO.wageText(w.avg)}` : ''}
            </div>
          </div>`;
          })
          .join('')}
      </div>`;
  }

  /* STEP 02 — 직업 선택. 연봉 높은 순으로 세운다.
     '이 갈래에 어떤 직업이 있나'를 보는 화면이라 이름만 나열하면 고를 근거가 없다.
     하는 일과 평균연봉을 카드에 같이 실어 비교해서 고르게 한다.

     2차 분류 하나에 직업이 50개까지 들어간다(예술·디자인·방송직). 한 화면에 다 깔면
     스크롤만 길어지고 아래쪽 카드는 아무도 안 본다. 멘토 찾기와 같은 카드 격자에
     페이지를 나눠 담는다. */
  const JOBS_PER_PAGE = 9;

  function jobSelect(middle) {
    if (!middle.jobs.length) {
      return `<div class="section-title">직업 선택</div>
        <div class="empty-block"><div class="empty-icon">📭</div>
          <div class="empty-title">등록된 직업이 없습니다</div>
          <div class="empty-desc">이 2차 분류는 임금직업정보에 세부 직업이 올라와 있지 않아요.</div>
        </div>`;
    }

    const jobs = [...middle.jobs].sort(
      (a, b) => (b.avgWage ?? 0) - (a.avgWage ?? 0),
    );
    const pages = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
    /* 2차 분류를 바꾸면 페이지 수가 줄어 현재 페이지가 범위를 벗어날 수 있다 */
    const page = Math.min(jobPage, pages);
    const slice = jobs.slice((page - 1) * JOBS_PER_PAGE, page * JOBS_PER_PAGE);

    return `
      <div class="section-title">직업 선택
        <span class="scope-tag">연봉 높은 순 · ${jobs.length}개</span>
      </div>
      <div class="job-grid">
        ${slice
          .map(
            (j) => `
          <div class="job-card ${currentJob === j.code ? 'active' : ''}" onclick="CareerPage.selectJob('${j.code}')">
            <div class="jc-name">${esc(j.name)}</div>
            <div class="jc-summary">${esc(j.summary || '')}</div>
            <div class="jc-foot">
              <span class="jc-foot-label">평균연봉</span>
              <span class="jc-wage">${KECO.wageText(j.avgWage)}</span>
            </div>
          </div>`,
          )
          .join('')}
      </div>
      ${pager(page, pages)}`;
  }

  /* 페이지 번호 줄. 페이지가 많아지면 현재 위치 주변만 보여주고 양끝을 남긴다
     (1 … 4 5 6 … 12 형태) — 번호를 다 깔면 줄이 넘친다. */
  function pager(page, pages) {
    if (pages <= 1) return '';

    const nums = [];
    const push = (n) => {
      if (!nums.includes(n)) nums.push(n);
    };
    push(1);
    for (let n = page - 1; n <= page + 1; n++) if (n > 1 && n < pages) push(n);
    push(pages);
    nums.sort((a, b) => a - b);

    let html = '';
    let prev = 0;
    for (const n of nums) {
      if (n - prev > 1) html += `<span class="pg-gap">…</span>`;
      html += `<button class="pg-num ${n === page ? 'on' : ''}" onclick="CareerPage.goJobPage(${n})">${n}</button>`;
      prev = n;
    }

    return `
      <div class="pager">
        <button class="pg-arrow" ${page === 1 ? 'disabled' : ''} onclick="CareerPage.goJobPage(${page - 1})">
          <i class="ti ti-chevron-left"></i> 이전
        </button>
        ${html}
        <button class="pg-arrow" ${page === pages ? 'disabled' : ''} onclick="CareerPage.goJobPage(${page + 1})">
          다음 <i class="ti ti-chevron-right"></i>
        </button>
      </div>`;
  }

  // ── STEP 03 · 커리어 로드맵 ───────────────────────────────
  function renderRoadmap(major, middle) {
    /* 스펙 레코드는 아직 학과(dept) 스키마다. 2차 분류에 얹힌 legacy 조건으로 집계한다.
       집계 범위는 좁은 것부터 넓은 순으로 시도한다:
         2차 분류+기업유형 → 2차 분류 전체 → 1차 분류 전체
       4분류로 쪼개면 표본이 크게 줄어 빈 유형이 흔하다. 그때 빈 화면을 주는 대신
       2차 분류 전체 통계로 물러서고, 무엇을 보고 있는지 scope 태그로 밝힌다.

       ── 집계 단위는 '직업'이 아니라 '2차 분류'다 ──
       직업 461개 단위로 선배 스펙을 나누면 표본이 한 자릿수로 쪼개져 평균이 의미를
       잃는다. 스펙 통계는 2차 분류 단위로 낸다.
       화면에도 그렇게 적어 둔다 — 무엇의 평균인지 헷갈리면 안 된다. */
    const midFn = KECO.middleMatcher(currentMajor, currentMiddle);
    const majFn = KECO.majorMatcher(currentMajor);
    const certKey = `keco:${major.code}:${middle.code}`;

    /* 유형별 실제 표본 수 — 폴백 전 숫자여야 어디에 데이터가 있는지 보인다 */
    const corpCounts = {};
    Aggregator.CORP_TYPES.forEach((c) => {
      corpCounts[c.id] = midFn
        ? Aggregator.compute({ where: midFn, corpType: c.id, certKey }).count
        : 0;
    });

    let agg = { empty: true },
      scope = '';
    if (midFn) {
      if (currentCorp === 'all') {
        agg = Aggregator.compute({ where: midFn, certKey });
        scope = '선배 데이터';
      } else {
        agg = Aggregator.compute({
          where: midFn,
          corpType: currentCorp,
          certKey,
        });
        scope = `${corpLabel(currentCorp)} 선배 데이터`;
        if (agg.empty) {
          agg = Aggregator.compute({ where: midFn, certKey });
          scope = '2차 분류 전체 (기업유형 미일치)';
        }
      }
    }
    if (agg.empty && majFn) {
      agg = Aggregator.compute({ where: majFn, certKey });
      scope = `${major.name} 전체 (2차 분류 미일치)`;
    }

    const head = `
      ${corpTabBar(corpCounts)}
      <div class="section-title">${esc(middle.name)} 선배 스펙
        ${agg.empty ? '' : `<span class="scope-tag">${esc(scope)} · n = ${agg.count}명</span>`}
      </div>
      <div class="roadmap-grid">
        <div class="roadmap-card">
          <div class="roadmap-card-title">관련 전공</div>
          <div class="roadmap-chips">
            ${
              middle.majors.length
                ? middle.majors
                    .map(
                      (m) => `<span class="chip chip--major">${esc(m)}</span>`,
                    )
                    .join('')
                : `<span class="chip chip--empty">전공 무관</span>`
            }
          </div>
        </div>
      </div>`;

    if (agg.empty) return `<div class="roadmap-section">${head}${emptySpecBlock(middle)}</div>`;

    return `
      <div class="roadmap-section">
        ${head}
        ${tabBar()}
        <div id="spec-quant" class="spec-tab-content ${specTab === 'quant' ? 'active' : ''}">${renderQuant(agg)}</div>
        <div id="spec-qual"  class="spec-tab-content ${specTab === 'qual' ? 'active' : ''}">${renderQual(agg)}</div>
      </div>
    `;
  }

  function emptySpecBlock(middle) {
    return `
      ${tabBar()}
      <div class="empty-block">
        <div class="empty-icon">📭</div>
        <div class="empty-title">아직 데이터가 없습니다</div>
        <div class="empty-desc">
          ${esc(middle.name)} 직무의 스펙 데이터를 입력한 회원이 없어요.<br>
          <a class="empty-cta" onclick="navigate('mypage')">스펙 입력하기 →</a>
          <span class="empty-or">또는</span>
          <a class="empty-cta" onclick="navigate('backoffice')">백오피스에서 데모 시드 추가 →</a>
        </div>
      </div>`;
  }

  /* 기업 유형 선택 줄. '전체' 는 유형을 나누기 전 2차 분류 통계 — 기본값이다.
     각 유형 옆 숫자는 폴백 전 실제 표본 수라 0 이면 0 이라고 그대로 보여준다. */
  function corpTabBar(corpCounts) {
    const tab = (id, label, icon, n) => `
      <div class="corp-tab ${currentCorp === id ? 'active' : ''}" onclick="CareerPage.switchCorp('${id}')">
        <span class="ct-icon">${icon}</span>
        <span class="ct-label">${esc(label)}</span>
        ${n == null ? '' : `<span class="ct-count ${n === 0 ? 'zero' : ''}">${n}</span>`}
      </div>`;
    return `
      <div class="section-title">기업 유형</div>
      <div class="corp-tab-bar">
        ${tab('all', '전체', '📊', null)}
        ${Aggregator.CORP_TYPES.map((c) => tab(c.id, c.label, c.icon, corpCounts[c.id])).join('')}
      </div>`;
  }

  function corpLabel(id) {
    return (Aggregator.CORP_TYPES.find((c) => c.id === id) || {}).label || id;
  }

  function tabBar() {
    return `
      <div class="spec-tab-bar">
        <div class="spec-tab ${specTab === 'quant' ? 'active' : ''}" onclick="CareerPage.switchTab('quant')">
          <div class="st-icon"><i class="ti ti-chart-bar"></i></div><div class="st-label">정량 스펙</div>
        </div>
        <div class="spec-tab ${specTab === 'qual' ? 'active' : ''}" onclick="CareerPage.switchTab('qual')">
          <div class="st-icon"><i class="ti ti-medal"></i></div><div class="st-label">정성 스펙</div>
        </div>
      </div>`;
  }

  // ── 정량 ─────────────────────────────────────────────────
  function renderQuant(agg) {
    return `
      <div class="spec-panel">
        <div class="spec-card">
          <div class="spec-card-header"><i class="ti ti-school"></i><div class="spec-card-title">학점 (GPA / 4.5 환산)</div></div>
          <div class="spec-card-body">
            ${
              agg.gpa
                ? `
              <div class="gpa-display"><span class="gpa-num">${agg.gpa.avg}</span><span class="gpa-max">/ 4.5</span></div>
              <div class="gpa-label">합격자 평균 학점 (n=${agg.gpa.n})</div>
              <div class="gpa-bar-bg"><div class="gpa-bar-fill" data-target="${((agg.gpa.avg / 4.5) * 100).toFixed(1)}%" style="width:0%"></div></div>
              <div class="gpa-range"><span>최저 ${agg.gpa.min}</span><span>최고 ${agg.gpa.max}</span></div>
            `
                : noDataInline('학점 데이터 없음')
            }
          </div>
        </div>

        <div class="spec-card">
          <div class="spec-card-header"><i class="ti ti-certificate"></i><div class="spec-card-title">자격증 보유율</div></div>
          <div class="spec-card-body">
            ${
              agg.certs.length
                ? `
              <div class="cert-list">
                ${agg.certs
                  .map(
                    (c, i) => `
                  <div class="cert-item" style="animation-delay:${i * 0.06}s">
                    <div class="cert-bar-wrap">
                      <div class="cert-name">${esc(c.name)} ${c.desc ? `<span class="cert-desc">— ${esc(c.desc)}</span>` : ''}</div>
                      <div class="cert-track"><div class="cert-fill" data-target="${c.pct}%" style="width:0%;background:#1a1814"></div></div>
                    </div>
                    <div class="cert-pct">${c.pct}%</div>
                  </div>`,
                  )
                  .join('')}
              </div>
            `
                : noDataInline('자격증 데이터 없음')
            }
          </div>
        </div>

        <div class="spec-card full">
          <div class="spec-card-header"><i class="ti ti-language"></i><div class="spec-card-title">어학 성적</div></div>
          <div class="spec-card-body">
            <div class="lang-list">
              ${langRow('TOEIC', agg.scores.toeic, '점')}
              ${langRow('TOEFL', agg.scores.toefl, '점')}
              ${langRow('TOEIC Speaking', agg.scores.toeicSpeaking, '레벨')}
              ${langRow('OPIc', agg.scores.opic, '레벨')}
            </div>
          </div>
        </div>
      </div>`;
  }

  function langRow(name, data, unit) {
    if (!data) {
      return `
        <div class="lang-item lang-item--empty">
          <div class="lang-name">${name}</div>
          <div class="lang-score-wrap"><div class="lang-avg lang-avg--empty">데이터 없음</div></div>
        </div>`;
    }
    const avg = data.avg + (typeof data.avg === 'number' ? unit : '');
    const range =
      data.min != null
        ? `합격자 범위 ${data.min} ~ ${data.max}`
        : `n = ${data.n}명`;
    return `
      <div class="lang-item">
        <div class="lang-name">${name}</div>
        <div class="lang-score-wrap">
          <div class="lang-avg">${avg}</div>
          <div class="lang-range">${range}</div>
        </div>
        <span class="lang-badge opt">n=${data.n}</span>
      </div>`;
  }

  // ── 정성 ─────────────────────────────────────────────────
  /* 정성 스펙은 CAS 가중치가 큰 유형(인턴십 → 공모전·대외활동 → …)부터 보여준다.
     각 유형 옆의 '가중치' 칩은 CAS 정성 점수에서 그 활동이 갖는 비중(tier)을 뜻한다. */
  const QUAL_TIER = {
    1: { label: '최상', cls: 't1' },
    2: { label: '높음', cls: 't2' },
    3: { label: '중상', cls: 't3' },
    4: { label: '보통', cls: 't4' },
    5: { label: '보조', cls: 't5' },
  };
  function renderQual(agg) {
    const rows = [...agg.qual].sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9));
    const benchNote = agg.qualBenchRaw
      ? `합격자 평균 정성 원점수 <b>${agg.qualBenchRaw}점</b> 기준 · 인턴십 &gt; 공모전·대외활동 순으로 가중`
      : `CAS 정성 점수는 인턴십 &gt; 공모전·대외활동 순으로 가중됩니다`;
    return `
      <div class="qual-grid">
        <div class="qual-card full">
          <div class="qual-card-header"><i class="ti ti-medal"></i><div class="qual-card-title">정성 스펙 보유율 — 합격자 기준</div></div>
          <div class="qual-weight-note">${benchNote}</div>
          <div class="qual-card-body">
            <div class="activity-list">
              ${rows
                .map((q) => {
                  const t = QUAL_TIER[q.tier] || QUAL_TIER[5];
                  return `
                <div class="activity-item">
                  <div class="activity-icon">${q.icon}</div>
                  <div class="activity-body">
                    <div class="activity-name">${esc(q.label)}
                      <span class="qual-tier ${t.cls}">가중치 ${t.label}</span>
                    </div>
                    <div class="activity-desc">${esc(q.help)}</div>
                  </div>
                  <div class="activity-right">
                    <div class="activity-pct">${q.pct}%</div>
                    <div class="activity-n">${q.n}명</div>
                  </div>
                </div>`;
                })
                .join('')}
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── helpers ───────────────────────────────────────────────
  function welcomeBlock() {
    const c = KECO.counts();
    return `
      <div class="welcome">
        <div class="welcome-icon">🗺️</div>
        <h2>직업 분류를 선택해 주세요</h2>
        <p>왼쪽에서 1차 분류 ${c.majors}개 중 하나를 고르면<br>
          2차 분류 → 직업 순으로 좁혀 가며 <b>평균 연봉</b>과 선배 스펙을 볼 수 있어요.<br>
          <span class="welcome-sub">직업 ${c.jobs}개 · 한국고용직업분류(KECO) 기준</span></p>
      </div>`;
  }

  function loadingBlock() {
    return `
      <div class="welcome">
        <div class="welcome-icon">⏳</div>
        <h2>직업 분류를 불러오는 중…</h2>
        <p>직업 461개의 임금 정보를 받아오고 있어요. 처음 한 번만 걸립니다.</p>
      </div>`;
  }

  function loadErrorBlock() {
    return `
      <div class="welcome">
        <div class="welcome-icon">⚠️</div>
        <h2>직업 분류를 불러오지 못했어요</h2>
        <p>${esc(loadError)}<br>
          백엔드가 켜져 있는지 확인한 뒤 다시 시도해 주세요.</p>
        <p><a class="empty-cta" onclick="CareerPage.retry()">다시 시도 →</a></p>
      </div>`;
  }
  function placeholderBlock() {
    return `<div class="welcome"><div class="welcome-icon">🚧</div><h2>준비 중</h2><p>이 분류는 곧 추가될 예정이에요.</p></div>`;
  }
  function noDataInline(msg) {
    return `<div class="inline-empty">${msg}</div>`;
  }
  function esc(s) {
    return String(s ?? '').replace(
      /[&<>"']/g,
      (m) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[m],
    );
  }
  function animateBars() {
    requestAnimationFrame(() => {
      document.querySelectorAll('.gpa-bar-fill').forEach((el) =>
        setTimeout(() => {
          el.style.width = el.dataset.target;
        }, 100),
      );
      document.querySelectorAll('.cert-fill').forEach((el, i) =>
        setTimeout(
          () => {
            el.style.width = el.dataset.target;
          },
          150 + i * 60,
        ),
      );
    });
  }

  // ── 외부 인터페이스 ──────────────────────────────────────
  return {
    init,
    refreshUser,
    render,
    /* 2차 분류를 바꾸면 고른 직업은 그 분류에 없는 코드가 되므로 반드시 같이 비운다.
       안 비우면 breadcrumb 에 남의 갈래 직업 이름이 남는다. */
    selectMiddle(code) {
      currentMiddle = code;
      currentJob = null;
      jobPage = 1;
      specTab = 'quant';
      render();
    },
    selectJob(code) {
      currentJob = code;
      specTab = 'quant';
      render();
    },
    goJobPage(n) {
      jobPage = Math.max(1, n);
      render();
    },
    gotoPhase(n) {
      if (n === 1) {
        currentMiddle = null;
        currentJob = null;
      }
      if (n === 2) {
        currentJob = null;
      }
      render();
    },
    switchTab(t) {
      specTab = t;
      render();
    },
    switchCorp(id) {
      currentCorp = id;
      render();
    },
    retry() {
      loadError = null;
      render();
    },
  };
})();
