// ════════════════════════════════════════════════════════════
//  CAREERLY — Career Roadmap (집계 데이터 기반)
//   • 학과/분야/직무 카탈로그 + INFO 모달 데이터는 정적 유지
//   • 정량/정성 스펙 섹션은 Aggregator.compute() 결과로 동적 생성
//   • 데이터가 없으면 "데이터 없음" 빈 상태 표시
// ════════════════════════════════════════════════════════════
window.CareerPage = (() => {

  // ── 학과·분야·직무 카탈로그 (정적) ────────────────────────
  const DATA = {
    business: {
      name: '경영학과', emoji: '📊',
      desc: '마케팅, 재무, 인사, 전략 등 기업 경영 전반을 배우는 학과.',
      fields: [
        { id: 'finance',     icon: '🏦', name: '금융권',         desc: '증권·은행·보험' },
        { id: 'consulting',  icon: '💼', name: '컨설팅',         desc: '전략·경영자문' },
        { id: 'marketing',   icon: '📣', name: '마케팅',         desc: '브랜드·광고·디지털' },
        { id: 'corp',        icon: '🏢', name: '대기업 일반직',  desc: '기획·전략·재무' },
      ],
      jobs: {
        finance:    [{ id: 'ib',           label: '증권사 IB' },     { id: 'bank',         label: '시중은행' },   { id: 'am',           label: '자산운용사' }],
        consulting: [{ id: 'strategy',     label: '전략 컨설팅' }, { id: 'it_cons',      label: 'IT 컨설팅' }],
        marketing:  [{ id: 'brand',        label: '브랜드 마케팅' }, { id: 'digital',      label: '디지털 마케팅' }],
        corp:       [{ id: 'plan',         label: '경영기획' },     { id: 'finance_corp', label: '재무·회계' },   { id: 'hr',           label: '인사' }],
      },
    },
    economics: {
      name: '경제학과', emoji: '📈',
      fields: [
        { id: 'finance',  icon: '🏦', name: '금융권',     desc: '증권·은행' },
        { id: 'public',   icon: '🏛️', name: '공공기관',  desc: '한국은행·KDI' },
        { id: 'research', icon: '🔬', name: '리서치',     desc: '경제 리서치' },
      ],
      jobs: {
        finance:  [{ id: 'ib', label: '증권사' }, { id: 'bank', label: '시중은행' }],
        public:   [{ id: 'public', label: '한국은행' }],
        research: [{ id: 'research', label: '리서치 어시스턴트' }],
      },
    },
    accounting: {
      name: '회계학과', emoji: '🧾',
      fields: [
        { id: 'accounting', icon: '📋', name: '회계법인',     desc: 'Big4 · 중소' },
        { id: 'corp',       icon: '🏢', name: '대기업 재무',  desc: '재무·회계 직무' },
      ],
      jobs: {
        accounting: [{ id: 'big4', label: 'Big4 회계법인' }],
        corp:       [{ id: 'finance_corp', label: '재무·회계' }],
      },
    },
    cs: {
      name: '컴퓨터공학과', emoji: '💻',
      fields: [
        { id: 'service',  icon: '🛠️',  name: 'IT 서비스', desc: '백엔드·프론트·모바일' },
        { id: 'platform', icon: '🌐', name: '플랫폼',     desc: '대형 IT' },
        { id: 'game',     icon: '🎮', name: '게임',       desc: '클라이언트·서버' },
        { id: 'fintech',  icon: '💳', name: '핀테크',     desc: '결제·증권' },
      ],
      jobs: {
        service:  [{ id: 'backend', label: '백엔드' }, { id: 'frontend', label: '프론트엔드' }, { id: 'mobile', label: '모바일' }, { id: 'ai', label: 'AI/ML' }],
        platform: [{ id: 'backend', label: '백엔드' }, { id: 'data',     label: '데이터엔지니어' }],
        game:     [{ id: 'client',  label: '클라이언트' }, { id: 'server', label: '서버' }],
        fintech:  [{ id: 'backend', label: '백엔드' }, { id: 'quant',    label: '퀀트' }],
      },
    },
    stat: {
      name: '통계학과', emoji: '📐',
      fields: [
        { id: 'data',     icon: '📊', name: '데이터분석' },
        { id: 'finance',  icon: '🏦', name: '금융' },
        { id: 'research', icon: '🔬', name: '리서치' },
      ],
      jobs: {
        data:     [{ id: 'analyst', label: '데이터분석가' }, { id: 'scientist', label: '데이터사이언티스트' }],
        finance:  [{ id: 'ib', label: '증권사' }],
        research: [{ id: 'research', label: '리서치 어시스턴트' }],
      },
    },
    law:   { name: '법학과', emoji: '⚖️', fields: [
      { id: 'lawfirm', icon: '⚖️', name: '로펌' }, { id: 'public', icon: '🏛️', name: '공공' }
    ], jobs: { lawfirm: [{ id: 'paralegal', label: '로펌 어시스턴트' }], public: [{ id: 'public', label: '공공기관' }] } },
    psych: { name: '심리학과', emoji: '🧠', fields: [
      { id: 'hr', icon: '👥', name: 'HR' }, { id: 'clinical', icon: '🏥', name: '임상' }
    ], jobs: { hr: [{ id: 'hr', label: 'HR 일반' }], clinical: [{ id: 'clinical', label: '임상심리사' }] } },
    media: { name: '미디어학과', emoji: '📱', fields: [
      { id: 'marketing', icon: '📣', name: '마케팅' }, { id: 'media', icon: '🎬', name: '미디어/방송' }
    ], jobs: { marketing: [{ id: 'brand', label: '브랜드 마케팅' }], media: [{ id: 'pd', label: '방송 PD' }] } },
  };

  // ── 학과 라벨 ─────────────────────────────────────────────
  const DEPT_LABEL = Object.fromEntries(
    Object.entries(DATA).map(([k,v]) => [k, v.name])
  );

  let currentDept = null, currentField = null, currentJob = null;
  let specTab = 'quant';

  function init() {
    // 학과 클릭 핸들러 위임
    document.querySelectorAll('.dept-item').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.dept-item').forEach(d => d.classList.remove('active'));
        el.classList.add('active');
        currentDept = el.dataset.id; currentField = null; currentJob = null;
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
      nameEl.innerHTML = `${name} <span class="up-level">Lv.1</span>`;
      avatarEl.textContent = name.slice(0, 1);
    } else {
      nameEl.innerHTML = `게스트 <span class="up-level">Lv.0</span>`;
      avatarEl.textContent = '👤';
    }
  }

  function render() {
    const main = document.getElementById('career-main');
    if (!currentDept) {
      main.innerHTML = welcomeBlock();
      return;
    }
    const d = DATA[currentDept];
    if (!d) { main.innerHTML = placeholderBlock(); return; }

    main.innerHTML = `
      <div class="topbar">
        <div class="breadcrumb">
          <span>${d.emoji} ${d.name}</span>
          ${currentField ? `<span class="sep">›</span><span>${labelOfField(d)}</span>` : ''}
          ${currentJob ? `<span class="sep">›</span><span>${labelOfJob(d)}</span>` : ''}
          <span class="sep">›</span><span class="active">${currentJob ? '스펙 데이터' : (currentField ? '세부직무' : '진출분야')}</span>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <span class="topbar-link" onclick="navigate('main')">← 홈으로</span>
        </div>
      </div>
      <div class="content">
        ${phaseBar()}
        <div class="section-title">진출 가능 분야</div>
        <div class="fields-grid">
          ${d.fields.map(f => `
            <div class="field-card ${currentField===f.id?'active':''}" onclick="CareerPage.selectField('${f.id}')">
              <div class="fc-icon">${f.icon}</div>
              <div class="fc-name">${f.name}</div>
              <div class="fc-desc">${f.desc || ''}</div>
            </div>`).join('')}
        </div>
        ${currentField ? renderJobs(d) : ''}
        ${currentJob ? renderSpec(d) : ''}
      </div>
    `;
    animateBars();
  }

  function phaseBar() {
    return `
      <div class="phase-bar">
        <div class="phase-tab ${!currentField?'active':''}" onclick="CareerPage.gotoPhase(1)">
          <div class="pt-num">STEP 01</div><div class="pt-label">진출분야</div>
        </div>
        <div class="phase-tab ${currentField && !currentJob?'active':''}" onclick="CareerPage.gotoPhase(2)">
          <div class="pt-num">STEP 02</div><div class="pt-label">세부직무</div>
        </div>
        <div class="phase-tab ${currentJob?'active':''}" onclick="CareerPage.gotoPhase(3)">
          <div class="pt-num">STEP 03</div><div class="pt-label">스펙 데이터</div>
        </div>
      </div>`;
  }

  function renderJobs(d) {
    const jobs = d.jobs[currentField] || [];
    if (!jobs.length) return '';
    return `
      <div class="section-title">세부 직무 선택</div>
      <div class="jobs-row">
        ${jobs.map(j => `
          <button class="job-chip ${currentJob===j.id?'active':''}" onclick="CareerPage.selectJob('${j.id}')">
            <span class="dot"></span>${j.label}
          </button>`).join('')}
      </div>`;
  }

  // ── 스펙 섹션 (집계 기반) ────────────────────────────────
  function renderSpec(d) {
    // 우선 dept+field+job 조합으로 집계, 데이터가 없으면 dept+field, 그래도 없으면 dept 만
    let agg = Aggregator.compute({ dept: currentDept, field: currentField, job: currentJob });
    let scope = '학과 + 분야 + 직무 일치';
    if (agg.empty) {
      agg = Aggregator.compute({ dept: currentDept, field: currentField });
      scope = '학과 + 분야 일치 (직무 미일치)';
    }
    if (agg.empty) {
      agg = Aggregator.compute({ dept: currentDept });
      scope = '같은 학과 전체';
    }

    if (agg.empty) {
      return `
        <div class="section-title" style="margin-top:4px">실제 취업자 스펙 데이터</div>
        ${tabBar()}
        <div class="empty-block">
          <div class="empty-icon">📭</div>
          <div class="empty-title">아직 데이터가 없습니다</div>
          <div class="empty-desc">
            ${DEPT_LABEL[currentDept] || currentDept}의 스펙 데이터를 입력한 회원이 없어요.<br>
            <a class="empty-cta" onclick="navigate('mypage')">스펙 입력하기 →</a>
            <span class="empty-or">또는</span>
            <a class="empty-cta" onclick="navigate('backoffice')">백오피스에서 데모 시드 추가 →</a>
          </div>
        </div>
      `;
    }

    const quantHtml = renderQuant(agg, scope);
    const qualHtml  = renderQual(agg);

    return `
      <div class="section-title" style="margin-top:4px">실제 취업자 스펙 데이터
        <span class="scope-tag">${scope} · n = ${agg.count}명</span>
      </div>
      ${tabBar()}
      <div id="spec-quant" class="spec-tab-content ${specTab==='quant'?'active':''}">${quantHtml}</div>
      <div id="spec-qual"  class="spec-tab-content ${specTab==='qual'?'active':''}">${qualHtml}</div>
    `;
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
              ${langRow('TOEIC',         agg.scores.toeic,         '점')}
              ${langRow('TOEFL',         agg.scores.toefl,         '점')}
              ${langRow('TOEIC Speaking', agg.scores.toeicSpeaking, '레벨')}
              ${langRow('OPIc',          agg.scores.opic,           '레벨')}
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
        <h2>학과를 선택해 주세요</h2>
        <p>왼쪽 사이드바에서 학과를 클릭하면<br>실제 회원이 입력한 스펙 데이터 기반의 통계를 볼 수 있어요.</p>
      </div>`;
  }
  function placeholderBlock() {
    return `<div class="welcome"><div class="welcome-icon">🚧</div><h2>준비 중</h2><p>이 학과는 곧 추가될 예정이에요.</p></div>`;
  }
  function noDataInline(msg) {
    return `<div class="inline-empty">${msg}</div>`;
  }
  function labelOfField(d) { return d.fields.find(f => f.id === currentField)?.name || currentField; }
  function labelOfJob(d) {
    return (d.jobs[currentField] || []).find(j => j.id === currentJob)?.label || currentJob;
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
    selectField(id) { currentField = id; currentJob = null; render(); },
    selectJob(id)   { currentJob = id;   specTab = 'quant'; render(); },
    gotoPhase(n)    { if (n===1) { currentField = null; currentJob = null; } if (n===2) currentJob = null; render(); },
    switchTab(t)    { specTab = t; render(); },
  };
})();
