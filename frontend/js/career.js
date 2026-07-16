// ════════════════════════════════════════════════════════════
//  CAREERLY — Career Roadmap (NCS 직업 분류 기반)
//   • 사이드바      : NCS 24개 직업 대분류 (js/ncs.js)
//   • STEP 01       : 중분류 선택
//   • STEP 02       : 커리어 로드맵 — 관련 전공 + 소분류(세부 직무) + 정량/정성 스펙
//   • 기업 유형     : 중분류를 대기업/중견/중소/공기업 4가지로 한 번 더 나눠 본다
//   • 정량/정성 스펙 섹션은 Aggregator.compute() 결과로 동적 생성
//   • 데이터가 없으면 "데이터 없음" 빈 상태 표시
// ════════════════════════════════════════════════════════════
window.CareerPage = (() => {

  let currentMajor = null;   // NCS 대분류 id ('01' ~ '24')
  let currentMiddle = null;  // 중분류 id
  let currentCorp = 'all';   // 기업 유형 ('all' | Aggregator.CORP_TYPES 의 id)
  let specTab = 'quant';

  function init() {
    const list = document.getElementById('ncs-list');
    list.innerHTML = NCS.MAJORS.map(m => `
      <div class="dept-item ncs-item" data-id="${m.id}">
        <span class="ncs-num">${m.id}</span>
        <span class="dept-emoji">${m.emoji}</span>
        <div><div class="dept-label">${esc(m.name)}</div></div>
      </div>`).join('');

    list.querySelectorAll('.ncs-item').forEach(el => {
      el.addEventListener('click', () => {
        list.querySelectorAll('.ncs-item').forEach(d => d.classList.remove('active'));
        el.classList.add('active');
        currentMajor = el.dataset.id;
        currentMiddle = null;
        render();
      });
    });
  }

  function refreshUser() {
    const user = DB.currentUser();
    const nameEl   = document.getElementById('career-username');
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
    if (!currentMajor) { main.innerHTML = welcomeBlock(); return; }

    const major = NCS.byId(currentMajor);
    if (!major) { main.innerHTML = placeholderBlock(); return; }
    const middle = currentMiddle ? NCS.middleById(currentMajor, currentMiddle) : null;

    main.innerHTML = `
      <div class="topbar">
        <div class="breadcrumb">
          <span>NCS ${major.id}</span>
          <span class="sep">›</span><span>${major.emoji} ${esc(major.name)}</span>
          ${middle ? `<span class="sep">›</span><span class="active">${esc(middle.name)}</span>` : ''}
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <span class="topbar-link" onclick="navigate('main')">← 홈으로</span>
        </div>
      </div>
      <div class="content">
        ${phaseBar()}
        ${majorHero(major)}
        ${middleSelect(major)}
        ${middle ? renderRoadmap(major, middle) : ''}
      </div>
    `;
    animateBars();
  }

  function phaseBar() {
    return `
      <div class="phase-bar">
        <div class="phase-tab ${!currentMiddle?'active':''}" onclick="CareerPage.gotoPhase(1)">
          <div class="pt-num">STEP 01</div><div class="pt-label">중분류</div>
        </div>
        <div class="phase-tab ${currentMiddle?'active':''}" onclick="CareerPage.gotoPhase(2)">
          <div class="pt-num">STEP 02</div><div class="pt-label">커리어 로드맵</div>
        </div>
      </div>`;
  }

  function majorHero(major) {
    return `
      <div class="ncs-hero">
        <div class="ncs-hero-icon">${major.emoji}</div>
        <div class="ncs-hero-body">
          <div class="ncs-hero-top">
            <h2>${esc(major.name)}</h2>
            <span class="ncs-hero-badge">NCS 대분류 ${major.id}</span>
          </div>
          <p>${esc(major.desc)}</p>
        </div>
      </div>`;
  }

  function middleSelect(major) {
    return `
      <div class="section-title">중분류 선택</div>
      <div class="fields-grid">
        ${major.middles.map(m => `
          <div class="field-card ${currentMiddle===m.id?'active':''}" onclick="CareerPage.selectMiddle('${m.id}')">
            <div class="fc-name">${esc(m.name)}</div>
            <div class="fc-desc">${esc(m.smalls.join(' · '))}</div>
          </div>`).join('')}
      </div>`;
  }

  // ── STEP 02 · 커리어 로드맵 ───────────────────────────────
  function renderRoadmap(major, middle) {
    /* 스펙 레코드는 아직 학과(dept) 스키마다. NCS 중분류 → 옛 스펙 매칭 함수로 집계한다.
       집계 범위는 좁은 것부터 넓은 순으로 시도한다:
         중분류+기업유형 → 중분류 전체 → 대분류 전체
       4분류로 쪼개면 표본이 크게 줄어 빈 유형이 흔하다. 그때 빈 화면을 주는 대신
       중분류 전체 통계로 물러서고, 무엇을 보고 있는지 scope 태그로 밝힌다. */
    const midFn = NCS.middleMatcher(currentMajor, currentMiddle);
    const majFn = NCS.majorMatcher(currentMajor);
    const certKey = `ncs:${major.id}:${middle.id}`;

    /* 유형별 실제 표본 수 — 폴백 전 숫자여야 어디에 데이터가 있는지 보인다 */
    const corpCounts = {};
    Aggregator.CORP_TYPES.forEach(c => {
      corpCounts[c.id] = midFn
        ? Aggregator.compute({ where: midFn, corpType: c.id, certKey }).count
        : 0;
    });

    let agg = { empty: true }, scope = '';
    if (midFn) {
      if (currentCorp === 'all') {
        agg = Aggregator.compute({ where: midFn, certKey });
        scope = '선배 데이터';
      } else {
        agg = Aggregator.compute({ where: midFn, corpType: currentCorp, certKey });
        scope = `${corpLabel(currentCorp)} 선배 데이터`;
        if (agg.empty) {
          agg = Aggregator.compute({ where: midFn, certKey });
          scope = '중분류 전체 (기업유형 미일치)';
        }
      }
    }
    if (agg.empty && majFn) {
      agg = Aggregator.compute({ where: majFn, certKey });
      scope = `${major.name} 전체 (중분류 미일치)`;
    }

    const head = `
      ${corpTabBar(corpCounts)}
      <div class="section-title">${esc(middle.name)} 커리어 로드맵
        ${agg.empty ? '' : `<span class="scope-tag">${esc(scope)} · n = ${agg.count}명</span>`}
      </div>
      <div class="roadmap-grid">
        <div class="roadmap-card">
          <div class="roadmap-card-title">관련 전공</div>
          <div class="roadmap-chips">
            ${middle.majors.length
              ? middle.majors.map(m => `<span class="chip chip--major">${esc(m)}</span>`).join('')
              : `<span class="chip chip--empty">전공 무관</span>`}
          </div>
        </div>
        <div class="roadmap-card">
          <div class="roadmap-card-title">소분류 (세부 직무)</div>
          <div class="roadmap-chips">
            ${middle.smalls.map(s => `<span class="chip chip--small">${esc(s)}</span>`).join('')}
          </div>
        </div>
      </div>`;

    if (agg.empty) return head + emptySpecBlock(middle);

    return `
      ${head}
      ${tabBar()}
      <div id="spec-quant" class="spec-tab-content ${specTab==='quant'?'active':''}">${renderQuant(agg)}</div>
      <div id="spec-qual"  class="spec-tab-content ${specTab==='qual'?'active':''}">${renderQual(agg)}</div>
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

  /* 기업 유형 선택 줄. '전체' 는 유형을 나누기 전 중분류 통계 — 기본값이다.
     각 유형 옆 숫자는 폴백 전 실제 표본 수라 0 이면 0 이라고 그대로 보여준다. */
  function corpTabBar(corpCounts) {
    const tab = (id, label, icon, n) => `
      <div class="corp-tab ${currentCorp===id?'active':''}" onclick="CareerPage.switchCorp('${id}')">
        <span class="ct-icon">${icon}</span>
        <span class="ct-label">${esc(label)}</span>
        ${n == null ? '' : `<span class="ct-count ${n===0?'zero':''}">${n}</span>`}
      </div>`;
    return `
      <div class="section-title">기업 유형</div>
      <div class="corp-tab-bar">
        ${tab('all', '전체', '📊', null)}
        ${Aggregator.CORP_TYPES.map(c => tab(c.id, c.label, c.icon, corpCounts[c.id])).join('')}
      </div>`;
  }

  function corpLabel(id) {
    return (Aggregator.CORP_TYPES.find(c => c.id === id) || {}).label || id;
  }

  function tabBar() {
    return `
      <div class="spec-tab-bar">
        <div class="spec-tab ${specTab==='quant'?'active':''}" onclick="CareerPage.switchTab('quant')">
          <div class="st-icon"><i class="ti ti-chart-bar"></i></div><div class="st-label">정량 스펙</div>
        </div>
        <div class="spec-tab ${specTab==='qual'?'active':''}" onclick="CareerPage.switchTab('qual')">
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
            ${agg.gpa ? `
              <div class="gpa-display"><span class="gpa-num">${agg.gpa.avg}</span><span class="gpa-max">/ 4.5</span></div>
              <div class="gpa-label">합격자 평균 학점 (n=${agg.gpa.n})</div>
              <div class="gpa-bar-bg"><div class="gpa-bar-fill" data-target="${(agg.gpa.avg/4.5*100).toFixed(1)}%" style="width:0%"></div></div>
              <div class="gpa-range"><span>최저 ${agg.gpa.min}</span><span>최고 ${agg.gpa.max}</span></div>
            ` : noDataInline('학점 데이터 없음')}
          </div>
        </div>

        <div class="spec-card">
          <div class="spec-card-header"><i class="ti ti-certificate"></i><div class="spec-card-title">자격증 보유율</div></div>
          <div class="spec-card-body">
            ${agg.certs.length ? `
              <div class="cert-list">
                ${agg.certs.map((c,i) => `
                  <div class="cert-item" style="animation-delay:${i*0.06}s">
                    <div class="cert-bar-wrap">
                      <div class="cert-name">${esc(c.name)} ${c.desc ? `<span class="cert-desc">— ${esc(c.desc)}</span>`:''}</div>
                      <div class="cert-track"><div class="cert-fill" data-target="${c.pct}%" style="width:0%;background:#1a1814"></div></div>
                    </div>
                    <div class="cert-pct">${c.pct}%</div>
                  </div>`).join('')}
              </div>
            ` : noDataInline('자격증 데이터 없음')}
          </div>
        </div>

        <div class="spec-card full">
          <div class="spec-card-header"><i class="ti ti-language"></i><div class="spec-card-title">어학 성적</div></div>
          <div class="spec-card-body">
            <div class="lang-list">
              ${langRow('TOEIC',          agg.scores.toeic,         '점')}
              ${langRow('TOEFL',          agg.scores.toefl,         '점')}
              ${langRow('TOEIC Speaking', agg.scores.toeicSpeaking, '레벨')}
              ${langRow('OPIc',           agg.scores.opic,          '레벨')}
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
    const range = data.min != null ? `합격자 범위 ${data.min} ~ ${data.max}` : `n = ${data.n}명`;
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
  function renderQual(agg) {
    return `
      <div class="qual-grid">
        <div class="qual-card full">
          <div class="qual-card-header"><i class="ti ti-medal"></i><div class="qual-card-title">정성 스펙 보유율 — 합격자 기준</div></div>
          <div class="qual-card-body">
            <div class="activity-list">
              ${agg.qual.map(q => `
                <div class="activity-item">
                  <div class="activity-icon">${q.icon}</div>
                  <div class="activity-body">
                    <div class="activity-name">${q.label}</div>
                    <div class="activity-desc">${q.help}</div>
                  </div>
                  <div class="activity-right">
                    <div class="activity-pct">${q.pct}%</div>
                    <div class="activity-n">${q.n}명</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── helpers ───────────────────────────────────────────────
  function welcomeBlock() {
    return `
      <div class="welcome">
        <div class="welcome-icon">🗺️</div>
        <h2>직업 분류를 선택해 주세요</h2>
        <p>왼쪽 사이드바에서 NCS 24개 직업 대분류를 클릭하면<br>중분류·소분류별 커리어 로드맵과 선배 스펙 데이터를 볼 수 있어요.</p>
      </div>`;
  }
  function placeholderBlock() {
    return `<div class="welcome"><div class="welcome-icon">🚧</div><h2>준비 중</h2><p>이 분류는 곧 추가될 예정이에요.</p></div>`;
  }
  function noDataInline(msg) {
    return `<div class="inline-empty">${msg}</div>`;
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, m =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  }
  function animateBars() {
    requestAnimationFrame(() => {
      document.querySelectorAll('.gpa-bar-fill').forEach(el => setTimeout(() => { el.style.width = el.dataset.target; }, 100));
      document.querySelectorAll('.cert-fill').forEach((el, i) => setTimeout(() => { el.style.width = el.dataset.target; }, 150 + i * 60));
    });
  }

  // ── 외부 인터페이스 ──────────────────────────────────────
  return {
    init, refreshUser, render,
    selectMiddle(id) { currentMiddle = id; specTab = 'quant'; render(); },
    gotoPhase(n)     { if (n === 1) currentMiddle = null; render(); },
    switchTab(t)     { specTab = t; render(); },
    switchCorp(id)   { currentCorp = id; render(); },
  };
})();
