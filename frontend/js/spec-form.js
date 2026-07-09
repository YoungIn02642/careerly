// ════════════════════════════════════════════════════════════
//  CAREERLY — Spec Input Form
//   • 마이페이지에서 호출되는 "스펙 입력" 단일 폼
//   • DB.upsertSpec() 로 저장
// ════════════════════════════════════════════════════════════
window.SpecForm = (() => {

  // 학과 카탈로그 — career.js 사이드바와 동일
  const DEPTS = [
    { id: 'business',   label: '경영학과' },
    { id: 'economics',  label: '경제학과' },
    { id: 'accounting', label: '회계학과' },
    { id: 'cs',         label: '컴퓨터공학과' },
    { id: 'stat',       label: '통계학과' },
    { id: 'law',        label: '법학과' },
    { id: 'psych',      label: '심리학과' },
    { id: 'media',      label: '미디어학과' },
  ];

  const FIELD_OPTIONS = {
    business:   [['finance','금융권'], ['consulting','컨설팅'], ['marketing','마케팅'], ['corp','대기업 일반직']],
    economics:  [['finance','금융권'], ['public','공공기관'], ['research','리서치']],
    accounting: [['accounting','회계법인'], ['corp','대기업 재무']],
    cs:         [['service','IT 서비스'], ['platform','플랫폼'], ['game','게임'], ['fintech','핀테크']],
    stat:       [['data','데이터분석'], ['finance','금융'], ['research','리서치']],
    law:        [['lawfirm','로펌'], ['public','공공']],
    psych:      [['hr','HR'], ['research','심리연구'], ['clinical','임상']],
    media:      [['marketing','마케팅'], ['media','미디어/방송'], ['platform','콘텐츠 플랫폼']],
  };

  const JOB_OPTIONS = {
    finance:     [['ib','증권사 IB'], ['bank','시중은행'], ['am','자산운용사'], ['insurance','보험사']],
    consulting:  [['strategy','전략 컨설팅'], ['it_cons','IT 컨설팅']],
    marketing:   [['brand','브랜드 마케팅'], ['digital','디지털 마케팅']],
    corp:        [['plan','경영기획'], ['finance_corp','재무·회계'], ['hr','인사']],
    service:     [['backend','백엔드'], ['frontend','프론트엔드'], ['mobile','모바일'], ['ai','AI/ML']],
    platform:    [['backend','백엔드'], ['data','데이터엔지니어']],
    game:        [['client','클라이언트'], ['server','서버']],
    fintech:     [['backend','백엔드'], ['quant','퀀트']],
    data:        [['analyst','데이터분석가'], ['scientist','데이터사이언티스트']],
    accounting:  [['big4','Big4 회계법인']],
    research:    [['research','리서치 어시스턴트']],
    public:      [['public','공공기관']],
    lawfirm:     [['paralegal','로펌 어시스턴트']],
    hr:          [['hr','HR 일반']],
    clinical:    [['clinical','임상심리사']],
    media:       [['pd','방송 PD'], ['producer','콘텐츠 기획']],
  };

  // ── render ────────────────────────────────────────────────
  function render(container, user) {
    const spec = DB.getSpec(user.username) || {};
    const certsHaving = new Set(spec.certs || []);
    const qual = spec.qual || {};

    container.innerHTML = `
      <div class="sf-head">
        <h1>스펙 입력</h1>
        <p class="sf-sub">입력한 데이터는 학과·직무별 평균/보유율 계산에 사용되어, 후배들에게 통계로 보여집니다. 개인 정보는 공개되지 않아요.</p>
      </div>

      <div class="success-box" id="sf-success">스펙 정보가 저장되었습니다.</div>
      <div class="error-box" id="sf-error"></div>

      <!-- 기본 정보 -->
      <div class="sf-section">
        <div class="sf-section-title"><i class="ti ti-user"></i>기본 정보</div>
        <div class="form-group">
          <label>닉네임</label>
          <input type="text" id="sf-nickname" placeholder="후배들에게 표시될 닉네임"
                 value="${escapeHtml(user.nickname || '')}" />
        </div>
        <div class="sf-row-2">
          <div class="form-group">
            <label>학과</label>
            <select id="sf-dept">
              <option value="">선택</option>
              ${DEPTS.map(d => `<option value="${d.id}" ${spec.dept===d.id?'selected':''}>${d.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>희망 진출분야</label>
            <select id="sf-field"></select>
          </div>
        </div>
        <div class="form-group">
          <label>희망 세부직무</label>
          <select id="sf-job"></select>
        </div>
      </div>

      <!-- 정량 스펙 -->
      <div class="sf-section">
        <div class="sf-section-title sf-section-title--quant">
          <i class="ti ti-chart-bar"></i>정량 스펙
        </div>

        <div class="sf-subhead">학점 (GPA)</div>
        <div class="sf-row-3">
          <div class="form-group">
            <label>본인 학점</label>
            <input type="number" step="0.01" min="0" max="4.5" id="sf-gpa"
                   value="${spec.gpa ?? ''}" placeholder="예: 3.8" />
          </div>
          <div class="form-group">
            <label>만점 기준</label>
            <select id="sf-gpaMax">
              <option value="4.5" ${spec.gpaMax==4.5?'selected':''}>4.5</option>
              <option value="4.3" ${spec.gpaMax==4.3?'selected':''}>4.3</option>
              <option value="4.0" ${spec.gpaMax==4.0?'selected':''}>4.0</option>
            </select>
          </div>
          <div class="form-group sf-gpa-hint">
            <label>&nbsp;</label>
            <div class="sf-hint-block">학과·직무 평균과 함께 표시됩니다</div>
          </div>
        </div>

        <div class="sf-subhead">자격증 (보유한 것 모두 체크)</div>
        <div class="sf-cert-grid" id="sf-cert-grid"></div>
        <div class="form-group" style="margin-top:8px">
          <label>기타 자격증 (쉼표로 구분)</label>
          <input type="text" id="sf-cert-other" placeholder="예: AWS SAA, 일본어능력시험 N1" />
        </div>

        <div class="sf-subhead">어학 능력</div>
        <div class="sf-row-2">
          <div class="form-group">
            <label>TOEIC (점수 / 990)</label>
            <input type="number" min="0" max="990" id="sf-toeic"
                   value="${spec.scores?.toeic ?? ''}" placeholder="예: 920" />
          </div>
          <div class="form-group">
            <label>TOEFL (점수 / 120)</label>
            <input type="number" min="0" max="120" id="sf-toefl"
                   value="${spec.scores?.toefl ?? ''}" placeholder="예: 105" />
          </div>
        </div>
        <div class="sf-row-2">
          <div class="form-group">
            <label>OPIc</label>
            <select id="sf-opic">
              <option value="">미응시</option>
              ${Aggregator.OPIC_LEVELS.map(l => `<option value="${l}" ${spec.scores?.opic===l?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>TOEIC Speaking</label>
            <select id="sf-toeicSpeaking">
              <option value="">미응시</option>
              ${Aggregator.TS_LEVELS.map(l => `<option value="${l}" ${spec.scores?.toeicSpeaking===l?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- 정성 스펙 -->
      <div class="sf-section">
        <div class="sf-section-title sf-section-title--qual">
          <i class="ti ti-medal"></i>정성 스펙
          <span class="sf-section-helper">취업에 어떻게 도움이 되는지 함께 안내합니다</span>
        </div>
        <div class="sf-qual-list" id="sf-qual-list"></div>
      </div>

      <button class="btn-save" id="sf-save">저장하기</button>
      <button class="btn-cancel" id="sf-cancel">취소</button>
    `;

    // ── 자격증 그리드 채우기
    const deptId = spec.dept || '';
    fillCertGrid(deptId, certsHaving);
    const otherCerts = (spec.certs || []).filter(c => {
      const cat = Aggregator.CERT_CATALOG[deptId] || [];
      return !cat.some(x => x.id === c);
    });
    document.getElementById('sf-cert-other').value = otherCerts.join(', ');

    // ── 정성스펙 리스트
    fillQualList(qual, spec.detail || {});

    // ── 필드/직무 의존 채우기
    fillFieldJob(spec.dept, spec.field, spec.job);

    // ── 이벤트
    document.getElementById('sf-dept').addEventListener('change', e => {
      fillCertGrid(e.target.value, new Set(collectCheckedCerts()));
      fillFieldJob(e.target.value, null, null);
    });
    document.getElementById('sf-field').addEventListener('change', e => {
      fillJob(e.target.value, null);
    });
    document.getElementById('sf-save').addEventListener('click', () => handleSave(user));
    document.getElementById('sf-cancel').addEventListener('click', () => navigate('main'));
  }

  function fillCertGrid(deptId, having) {
    const grid = document.getElementById('sf-cert-grid');
    const cats = Aggregator.CERT_CATALOG[deptId] || [];
    if (!cats.length) {
      grid.innerHTML = `<div class="sf-empty-soft">학과를 먼저 선택하면 추천 자격증이 표시됩니다.</div>`;
      return;
    }
    grid.innerHTML = cats.map(c => `
      <label class="sf-cert-card ${having.has(c.id) ? 'on' : ''}">
        <input type="checkbox" data-cert="${escapeHtml(c.id)}" ${having.has(c.id) ? 'checked' : ''} />
        <div class="sf-cert-name">${escapeHtml(c.id)}</div>
        ${c.desc ? `<div class="sf-cert-desc">${escapeHtml(c.desc)}</div>` : ''}
      </label>
    `).join('');
    grid.querySelectorAll('input[data-cert]').forEach(inp => {
      inp.addEventListener('change', () => {
        inp.closest('.sf-cert-card').classList.toggle('on', inp.checked);
      });
    });
  }

  function fillQualList(qual, detail) {
    const wrap = document.getElementById('sf-qual-list');
    wrap.innerHTML = Aggregator.QUAL_FIELDS.map(q => {
      const checked = !!qual[q.id];
      return `
        <div class="sf-qual-item ${checked ? 'on' : ''}" data-qid="${q.id}">
          <label class="sf-qual-head">
            <input type="checkbox" data-qual="${q.id}" ${checked ? 'checked' : ''} />
            <span class="sf-qual-icon">${q.icon}</span>
            <span class="sf-qual-label">${q.label}</span>
            <span class="sf-qual-help">${q.help}</span>
          </label>
          <div class="sf-qual-detail">
            <input type="text" data-detail="${q.id}Text" placeholder="간단히 적어주세요 (예: 회사명/기간/역할)"
                   value="${escapeHtml(detail[q.id + 'Text'] || '')}" />
          </div>
        </div>
      `;
    }).join('');
    wrap.querySelectorAll('input[data-qual]').forEach(inp => {
      inp.addEventListener('change', () => {
        inp.closest('.sf-qual-item').classList.toggle('on', inp.checked);
      });
    });
  }

  function fillFieldJob(dept, currentField, currentJob) {
    const fieldSel = document.getElementById('sf-field');
    const opts = FIELD_OPTIONS[dept] || [];
    fieldSel.innerHTML = `<option value="">선택 안 함</option>` +
      opts.map(([v,l]) => `<option value="${v}" ${currentField===v?'selected':''}>${l}</option>`).join('');
    fillJob(currentField || '', currentJob);
  }
  function fillJob(field, currentJob) {
    const jobSel = document.getElementById('sf-job');
    const opts = JOB_OPTIONS[field] || [];
    jobSel.innerHTML = `<option value="">선택 안 함</option>` +
      opts.map(([v,l]) => `<option value="${v}" ${currentJob===v?'selected':''}>${l}</option>`).join('');
  }

  function collectCheckedCerts() {
    return [...document.querySelectorAll('input[data-cert]:checked')]
      .map(i => i.dataset.cert);
  }

  function handleSave(user) {
    const success = document.getElementById('sf-success');
    const error   = document.getElementById('sf-error');
    success.style.display = error.style.display = 'none';

    const dept   = document.getElementById('sf-dept').value;
    const field  = document.getElementById('sf-field').value || null;
    const job    = document.getElementById('sf-job').value   || null;
    const nickname = document.getElementById('sf-nickname').value.trim() || null;
    const gpaRaw   = document.getElementById('sf-gpa').value;
    const gpaMax   = parseFloat(document.getElementById('sf-gpaMax').value);
    const gpa      = gpaRaw === '' ? null : parseFloat(gpaRaw);

    if (!dept) {
      error.textContent = '학과를 선택해주세요.';
      error.style.display = 'block';
      return;
    }
    if (gpa != null && (isNaN(gpa) || gpa < 0 || gpa > gpaMax)) {
      error.textContent = `학점은 0 ~ ${gpaMax} 사이여야 합니다.`;
      error.style.display = 'block';
      return;
    }

    const cataloged = collectCheckedCerts();
    const other = document.getElementById('sf-cert-other').value
                   .split(',').map(s => s.trim()).filter(Boolean);
    const certs = [...new Set([...cataloged, ...other])];

    const toToInt = v => v === '' ? null : parseInt(v, 10);
    const scores = {
      toeic:         toToInt(document.getElementById('sf-toeic').value),
      toefl:         toToInt(document.getElementById('sf-toefl').value),
      opic:          document.getElementById('sf-opic').value || null,
      toeicSpeaking: document.getElementById('sf-toeicSpeaking').value || null,
    };

    const qual = {};
    document.querySelectorAll('input[data-qual]').forEach(i => {
      qual[i.dataset.qual] = i.checked;
    });
    const detail = {};
    document.querySelectorAll('input[data-detail]').forEach(i => {
      if (i.value.trim()) detail[i.dataset.detail] = i.value.trim();
    });

    DB.updateUser(user.username, { nickname });
    DB.upsertSpec(user.username, { dept, field, job, gpa, gpaMax, certs, scores, qual, detail });

    success.style.display = 'block';
    setTimeout(() => { success.style.display = 'none'; }, 2500);
    updateNavAuth();
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  }

  return { render };
})();
