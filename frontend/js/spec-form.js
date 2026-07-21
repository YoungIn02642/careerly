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
    // 구조화된 활동 우선. 없으면 옛 boolean qual 을 활동으로 환산해 시작한다.
    const initialActivities = (spec.activities && spec.activities.length)
      ? spec.activities
      : (window.CAS ? CAS.normalizeActivities(spec) : []);

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
        <div class="sf-row-2">
          <div class="form-group">
            <label>회사명 <span class="sf-optional">선택</span></label>
            <input type="text" id="sf-company" placeholder="예: 삼성전자, 한국전력공사"
                   value="${escapeHtml(spec.company || '')}" autocomplete="off" />
            <div class="sf-hint-inline" id="sf-company-hint">입력하면 기업 유형을 자동으로 찾아드려요</div>
          </div>
          <div class="form-group">
            <label>기업 유형</label>
            <select id="sf-corpType">
              <option value="">선택 안 함</option>
              ${Aggregator.CORP_TYPES.map(c =>
                `<option value="${c.id}" ${spec.corpType===c.id?'selected':''}>${c.icon} ${c.label}</option>`).join('')}
            </select>
            <div class="sf-hint-inline">커리어 로드맵에서 기업 유형별 통계로 묶입니다</div>
          </div>
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

      <!-- 정성 스펙 · 대표 활동 -->
      <div class="sf-section">
        <div class="sf-section-title sf-section-title--qual">
          <i class="ti ti-medal"></i>정성 스펙 · 대표 활동
          <span class="sf-section-helper">유형·기간·역할·성과까지 적을수록 CAS 정성 점수가 정확해집니다</span>
        </div>
        <!-- AI 자동 입력 -->
        <div class="sf-ai" id="sf-ai">
          <div class="sf-ai-head"><i class="ti ti-sparkles"></i> AI로 한 번에 입력</div>
          <div class="sf-ai-desc">활동을 자유롭게 적어주세요. 유형·기간·역할이 비어 있어도 AI가 알아서 분류하고 아래 칸을 채워드려요.</div>
          <textarea id="sf-ai-text" class="sf-ai-text" rows="5" placeholder="예)
1. 인턴십 국민은행 3개월~6개월, 결과물 없음
2. 프로젝트 로얄에이전트 6개월~1년, 팀장, 깃헙 공개
3. 공모전 SW상상기업 6개월~1년, 수상"></textarea>
          <div class="sf-ai-actions">
            <button type="button" class="sf-ai-btn" id="sf-ai-run"><i class="ti ti-wand"></i> AI로 분석하기</button>
            <span class="sf-ai-status" id="sf-ai-status"></span>
          </div>
          <div class="sf-ai-result" id="sf-ai-result" hidden></div>
        </div>

        <div class="sf-act-note">인턴십 &gt; 공모전·대외활동 순으로 가중됩니다. 대표 활동을 자유롭게 추가하세요.</div>
        <div class="sf-act-list" id="sf-act-list"></div>
        <button type="button" class="sf-act-add" id="sf-act-add"><i class="ti ti-plus"></i> 활동 추가</button>
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

    // ── 정성스펙 · 대표 활동 편집기
    renderActivities(initialActivities);
    bindActWrap();
    document.getElementById('sf-act-add').addEventListener('click', () => {
      actState.push({});
      paintActivities();
    });
    bindAiAssist();

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

    initCompanyAutoClassify();
  }

  /* ── 회사명 → 기업 유형 자동 판정 ──────────────────────────
     공식 명단(공정위 대규모기업집단 / 공공기관 지정현황)에 있으면 드롭다운을
     대신 골라준다. 명단에 없는 회사가 훨씬 많으므로 못 찾아도 실패가 아니다.
     그때는 회원이 직접 고르게 안내만 한다.

     자동판정은 어디까지나 추천이라 회원이 고른 값을 덮어쓰지 않는다.
     그래서 '회사명이 바뀐 순간' 에만 반영하고, 그 뒤 드롭다운을 손대면 그대로 둔다. */
  let lastClassifiedFor = null;

  function initCompanyAutoClassify() {
    const input = document.getElementById('sf-company');
    const hint  = document.getElementById('sf-company-hint');
    const sel   = document.getElementById('sf-corpType');
    if (!input || !hint || !sel) return;

    // 저장된 회사명이 있으면 이미 판정된 상태로 보고, 다시 덮어쓰지 않는다
    lastClassifiedFor = input.value.trim() || null;

    let timer = null;
    const run = () => {
      const name = input.value.trim();
      if (!name) {
        hint.className = 'sf-hint-inline';
        hint.textContent = '입력하면 기업 유형을 자동으로 찾아드려요';
        lastClassifiedFor = null;
        return;
      }
      if (name === lastClassifiedFor) return;   // 같은 회사명 재조회 방지

      hint.className = 'sf-hint-inline';
      hint.textContent = '찾는 중…';
      DB.classifyCompany(name).then(r => {
        if (input.value.trim() !== name) return;   // 그새 더 입력했으면 결과 버림
        lastClassifiedFor = name;

        if (!r) {
          hint.className = 'sf-hint-inline';
          hint.textContent = '자동 판정을 못 했어요. 기업 유형을 직접 골라주세요.';
          return;
        }
        if (r.matched) {
          sel.value = r.corpType;
          hint.className = 'sf-hint-inline sf-hint-ok';
          hint.textContent = `${r.label}로 확인했어요 (${r.source}). 다르면 직접 고치세요.`;
        } else {
          hint.className = 'sf-hint-inline sf-hint-warn';
          hint.textContent = '공식 명단에 없는 회사예요. 기업 유형을 직접 골라주세요.';
        }
      });
    };

    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 400); });
    input.addEventListener('blur', run);
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

  // ── 정성 · 대표 활동 편집기 ────────────────────────────────
  //   설문(구글폼)과 동일한 구조: 유형 · 활동명 · 기간 · 역할(또는 연구단계) · 성과
  //   저장되는 값은 spec.activities = [{ type, name, duration, role|stage, outcome }]
  //   이 배열이 CAS.computeQual 의 입력이 된다.
  const OUTCOME_KEYS = ['수상', '논문', '발표 또는 산출물 공개(깃헙 등)', '전환, 정규직 합격', '결과물 없음'];
  const ROLE_BY_KIND = {
    team:  ['팀장', '팀원', '개인'],
    exec:  ['임원진', '동아리원, 일반학회원'],
    stage: ['학부연구생', '석사', '박사'],
  };
  const durationKeys = () => Object.keys(CAS.DURATION_MULT);

  let actState = [];   // 현재 편집 중인 활동 배열

  function renderActivities(initial) {
    actState = (initial || []).map(a => ({ ...a }));
    if (!actState.length) actState.push({});
    paintActivities();
  }

  function paintActivities() {
    const wrap = document.getElementById('sf-act-list');
    if (!wrap) return;
    wrap.innerHTML = actState.map((a, i) => activityRow(a, i)).join('');
  }

  /* 이벤트 위임 — 한 번만 바인딩한다. 입력값은 즉시 actState 에 반영되므로
     유형이 바뀌어 역할 옵션을 다시 그려도(paintActivities) 값이 유지된다. */
  function bindActWrap() {
    const wrap = document.getElementById('sf-act-list');
    const onChange = e => {
      const el = e.target;
      const i = el.dataset.i, f = el.dataset.field;
      if (i == null || !f) return;
      actState[+i][f] = el.value;
      if (f === 'type') paintActivities();   // 유형별 역할/단계 옵션 갱신
    };
    wrap.addEventListener('change', onChange);
    wrap.addEventListener('input', onChange);
    wrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-act-remove]');
      if (!btn) return;
      actState.splice(+btn.dataset.i, 1);
      if (!actState.length) actState.push({});
      paintActivities();
    });
  }

  // ── AI 자동 입력 ───────────────────────────────────────────
  /* 반정형 텍스트를 서버(/api/cas/analyze, Gemini)로 보내 활동을 정규화·채점하고,
     그 결과로 활동 편집기와 정량 필드를 채운다. 채운 뒤에도 사용자가 각 칸을
     자유롭게 고칠 수 있다(값은 그대로 편집기 상태에 반영됨). */
  function bindAiAssist() {
    const btn = document.getElementById('sf-ai-run');
    if (!btn) return;
    const textEl   = document.getElementById('sf-ai-text');
    const statusEl = document.getElementById('sf-ai-status');
    const resultEl = document.getElementById('sf-ai-result');

    btn.addEventListener('click', async () => {
      const text = (textEl.value || '').trim();
      if (!text) { statusEl.textContent = '분석할 내용을 입력해 주세요.'; return; }

      btn.disabled = true;
      statusEl.textContent = 'AI가 분석 중…';
      resultEl.hidden = true;
      try {
        const r = await DB.analyzeCas(text);

        // 활동 편집기 채우기 (빈 값이면 그대로 두어 사용자가 마저 채우게)
        if (Array.isArray(r.activities) && r.activities.length) {
          actState = r.activities.map(a => ({
            type: a.type, name: a.name, duration: a.duration,
            role: a.role || undefined, stage: a.stage || undefined, outcome: a.outcome,
          }));
          paintActivities();
        }

        applyQuant(r.quant);

        // 정성 점수 결과 표시.
        // 헤드라인은 결정론 점수(deterministicTotal) — 저장 후 로드맵이 보여줄 값과 같다.
        // AI 총점은 같은 입력에도 흔들려서 참고로만 병기한다.
        const q = r.qual || {};
        resultEl.hidden = false;
        resultEl.innerHTML = `
          <div class="sf-ai-score">정성 CAS <b>${q.deterministicTotal ?? '-'}</b> <span>/ 600</span></div>
          ${q.rationale ? `<div class="sf-ai-reason">${escapeHtml(q.rationale)}</div>` : ''}
          <div class="sf-ai-cross">참고(AI 추정): ${q.aiTotal ?? '-'} / 600</div>
          <div class="sf-ai-hint">아래 활동·정량 칸에 자동으로 채웠어요. 틀린 곳은 직접 고친 뒤 저장하세요.</div>`;
        statusEl.textContent = '완료!';
      } catch (e) {
        statusEl.textContent = '';
        resultEl.hidden = false;
        resultEl.innerHTML = `<div class="sf-ai-err">${escapeHtml(e.message || 'AI 분석에 실패했습니다.')}</div>`;
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* AI 가 파싱한 정량 값을 폼에 반영한다. 값이 있는 것만 덮어쓴다. */
  function applyQuant(quant) {
    if (!quant) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
    if (quant.gpa != null)    set('sf-gpa', quant.gpa);
    if (quant.gpaMax != null) set('sf-gpaMax', String(quant.gpaMax));
    const lang = quant.lang || {};
    set('sf-toeic', lang.toeic);
    set('sf-toefl', lang.toefl);
    // OPIc / 토익스피킹은 select — 해당 옵션이 있을 때만 반영
    const setSelIfOption = (id, v) => {
      const el = document.getElementById(id);
      if (el && v && [...el.options].some(o => o.value === v)) el.value = v;
    };
    setSelIfOption('sf-opic', lang.opic);
    setSelIfOption('sf-toeicSpeaking', lang.toeicSpeaking);

    // 자격증: 카탈로그에 있으면 체크, 나머지는 '기타' 칸에 채운다
    const certs = Array.isArray(quant.certs) ? quant.certs.filter(Boolean) : [];
    if (certs.length) {
      const grid = document.getElementById('sf-cert-grid');
      const matched = new Set();
      grid?.querySelectorAll('input[data-cert]').forEach(inp => {
        if (certs.includes(inp.dataset.cert)) {
          inp.checked = true;
          inp.closest('.sf-cert-card')?.classList.add('on');
          matched.add(inp.dataset.cert);
        }
      });
      const others = certs.filter(c => !matched.has(c));
      const otherEl = document.getElementById('sf-cert-other');
      if (otherEl && others.length) {
        const existing = otherEl.value.split(',').map(s => s.trim()).filter(Boolean);
        otherEl.value = [...new Set([...existing, ...others])].join(', ');
      }
    }
  }

  function activityRow(a, i) {
    const types = CAS.ACTIVITY_TYPES;
    const t = types.find(x => x.id === a.type);
    return `
      <div class="sf-act-row">
        <div class="sf-act-grid">
          <select data-i="${i}" data-field="type" class="sf-act-type">
            <option value="">유형 선택</option>
            ${types.map(x => `<option value="${x.id}" ${a.type === x.id ? 'selected' : ''}>${x.icon} ${x.label}</option>`).join('')}
          </select>
          <input type="text" data-i="${i}" data-field="name" placeholder="활동명 (예: OO기업 인턴, OO 공모전)"
                 value="${escapeHtml(a.name || '')}" />
          <select data-i="${i}" data-field="duration">
            <option value="">기간</option>
            ${durationKeys().map(d => `<option value="${d}" ${a.duration === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
          ${roleFieldHtml(a, i, t && t.roleKind)}
          <select data-i="${i}" data-field="outcome">
            <option value="">성과</option>
            ${OUTCOME_KEYS.map(o => `<option value="${escapeHtml(o)}" ${a.outcome === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
          </select>
          <button type="button" class="sf-act-remove" data-act-remove data-i="${i}" title="삭제"><i class="ti ti-x"></i></button>
        </div>
        ${t ? `<div class="sf-act-help">${escapeHtml(t.help)}</div>` : ''}
      </div>`;
  }

  function roleFieldHtml(a, i, roleKind) {
    if (roleKind === 'stage') {
      return `<select data-i="${i}" data-field="stage">
        <option value="">연구 단계</option>
        ${ROLE_BY_KIND.stage.map(r => `<option value="${r}" ${a.stage === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>`;
    }
    if (roleKind === 'team' || roleKind === 'exec') {
      return `<select data-i="${i}" data-field="role">
        <option value="">역할</option>
        ${ROLE_BY_KIND[roleKind].map(r => `<option value="${escapeHtml(r)}" ${a.role === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
      </select>`;
    }
    if (roleKind === 'free') {
      return `<input type="text" data-i="${i}" data-field="role" placeholder="역할 (예: 기자단 2기)" value="${escapeHtml(a.role || '')}" />`;
    }
    return `<span class="sf-act-spacer"></span>`;   // none / 미선택 — 그리드 정렬 유지
  }

  function collectActivities() {
    return actState
      .filter(a => a.type)
      .map(a => {
        const t = CAS.ACTIVITY_TYPES.find(x => x.id === a.type);
        const o = { type: a.type };
        if (a.name && a.name.trim()) o.name = a.name.trim();
        if (a.duration) o.duration = a.duration;
        if (t && t.roleKind === 'stage') { if (a.stage) o.stage = a.stage; }
        else if (a.role && String(a.role).trim()) o.role = String(a.role).trim();
        if (a.outcome) o.outcome = a.outcome;
        return o;
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

  async function handleSave(user) {
    const success = document.getElementById('sf-success');
    const error   = document.getElementById('sf-error');
    success.style.display = error.style.display = 'none';

    const dept   = document.getElementById('sf-dept').value;
    const field  = document.getElementById('sf-field').value || null;
    const job    = document.getElementById('sf-job').value   || null;
    const corpType = document.getElementById('sf-corpType').value || null;
    const company  = document.getElementById('sf-company').value.trim() || null;
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

    const activities = collectActivities();

    const saveBtn = document.getElementById('sf-save');
    saveBtn.disabled = true;
    try {
      await DB.updateUser({ nickname });
      await DB.upsertSpec({ dept, field, job, company, corpType, gpa, gpaMax, certs, scores, activities });
    } catch (e) {
      alert('저장에 실패했습니다. ' + e.message);
      return;
    } finally {
      saveBtn.disabled = false;
    }

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
