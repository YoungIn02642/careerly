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
  /* ── 역할에 따라 폼이 달라진다 ────────────────────────────────
     멘토는 **취업한 선배**다. 이미 다닌 회사가 있고 경력이 쌓였으니
     '현재 진출분야 · 회사 1곳 · 기업 유형 · 경력'을 받는다. 이 값이 곧 후배가 보는
     합격자 통계의 원천이라 기업 유형이 반드시 필요하다(로드맵이 유형별로 묶는다).

     멘티는 **재학생**이다. 다니는 회사가 없으므로 '희망 진출분야 · 관심 기업 여러 곳'
     을 받는다. 관심 기업에는 기업 유형을 붙이지 않는다 — 아직 붙을 실적이 없고,
     여러 곳을 고르는 칸에 유형을 각각 물으면 입력만 무거워진다. */
  let isMentor = false;

  /* ── 검색 드롭다운 ───────────────────────────────────────────
     원래는 <datalist> 를 썼다. 붙이기는 쉬운데 두 가지가 안 됐다:
       · 항목에 부가 정보(자격 구분·분야)를 붙여 보여줄 수 없다 — 브라우저마다 label 을
         무시하거나 다르게 그린다.
       · 목록에 없을 때 '직접 입력' 같은 다른 길을 넣을 자리가 없다.
     그래서 목록을 직접 그린다. 세 곳(회사명·관심기업·자격증)이 같은 부품을 쓴다.

     items: [{ value, label, sub }]  ·  onPick(value, item)
     footer: 목록 아래에 붙일 HTML (예: '직접 입력') · onFooter: 그걸 눌렀을 때 */
  function openSearchMenu(menuEl, items, { onPick, footer, onFooter, empty } = {}) {
    if (!menuEl) return;

    const rows = items.map((it, i) => `
      <button type="button" class="sf-search-item" data-i="${i}">
        <span class="sf-search-name">${escapeHtml(it.label ?? it.value)}</span>
        ${it.sub ? `<span class="sf-search-sub">${escapeHtml(it.sub)}</span>` : ''}
      </button>`).join('');

    const emptyRow = items.length ? '' :
      `<div class="sf-search-empty">${escapeHtml(empty || '검색 결과가 없어요')}</div>`;

    menuEl.innerHTML = `
      <div class="sf-search-list">${rows}${emptyRow}</div>
      ${footer ? `<button type="button" class="sf-search-footer" data-footer>${footer}</button>` : ''}`;
    menuEl.hidden = false;

    menuEl.querySelectorAll('.sf-search-item').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        // blur 보다 먼저 잡아야 한다 — click 을 쓰면 메뉴가 닫히고 나서 도착해 무시된다
        e.preventDefault();
        const it = items[+btn.dataset.i];
        closeSearchMenu(menuEl);
        onPick?.(it.value, it);
      });
    });
    menuEl.querySelector('[data-footer]')?.addEventListener('mousedown', e => {
      e.preventDefault();
      closeSearchMenu(menuEl);
      onFooter?.();
    });
  }

  function closeSearchMenu(menuEl) {
    if (!menuEl) return;
    menuEl.hidden = true;
    menuEl.innerHTML = '';
  }

  /* 바깥을 누르면 열려 있는 메뉴를 모두 닫는다. 폼을 다시 그려도 리스너가 쌓이지
     않도록 한 번만 건다. */
  let _menuCloserBound = false;
  function bindMenuCloser() {
    if (_menuCloserBound) return;
    _menuCloserBound = true;
    document.addEventListener('mousedown', e => {
      document.querySelectorAll('.sf-search-menu:not([hidden])').forEach(menu => {
        if (!menu.closest('.sf-search')?.contains(e.target)) closeSearchMenu(menu);
      });
    });
  }

  function render(container, user) {
    const spec = DB.getSpec(user.username) || {};
    isMentor = user.role === 'mentor';
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
        <div class="form-group">
          <label>학과</label>
          <div class="sf-search" id="sf-major-search">
            <input type="text" id="sf-major" class="sf-search-input" placeholder="학과명을 검색하세요 (예: 컴퓨터공학과)"
                   value="${escapeHtml(spec.major || '')}" autocomplete="off" />
            <i class="ti ti-search sf-search-icon"></i>
            <div class="sf-search-menu" id="sf-major-menu" hidden></div>
          </div>
          <div class="sf-hint-inline" id="sf-major-hint">학과명은 자유롭게 적어도 돼요. 통계는 아래 분류로 묶입니다.</div>
        </div>
        <div class="sf-row-2">
          <div class="form-group">
            <label>통계 분류</label>
            <select id="sf-dept">
              <option value="">선택</option>
              ${DEPTS.map(d => `<option value="${d.id}" ${spec.dept===d.id?'selected':''}>${d.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>${isMentor ? '현재' : '희망'} 진출분야</label>
            <select id="sf-field"></select>
          </div>
        </div>
        <div class="form-group">
          <label>${isMentor ? '현재' : '희망'} 세부직무</label>
          <select id="sf-job"></select>
        </div>

        ${isMentor ? `
        <div class="sf-row-2">
          <div class="form-group">
            <label>회사명 <span class="sf-optional">선택</span></label>
            <div class="sf-search" id="sf-company-search">
              <input type="text" id="sf-company" class="sf-search-input" placeholder="회사명"
                     value="${escapeHtml(spec.company || '')}" autocomplete="off" />
              <i class="ti ti-search sf-search-icon"></i>
              <div class="sf-search-menu" id="sf-company-menu" hidden></div>
            </div>
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
        ` : `
        <div class="form-group">
          <label>관심 기업 <span class="sf-optional">여러 곳 선택 가능</span></label>
          <div class="sf-search" id="sf-interest-search">
            <input type="text" id="sf-interest" class="sf-search-input" placeholder="기업명을 검색해 추가하세요"
                   autocomplete="off" />
            <i class="ti ti-search sf-search-icon"></i>
            <div class="sf-search-menu" id="sf-interest-menu" hidden></div>
          </div>
          <div class="sf-chips" id="sf-interest-chips"></div>
          <div class="sf-hint-inline">가고 싶은 기업을 담아두면, 그 기업에 간 선배들의 스펙을 모아서 보여드릴 예정이에요</div>
        </div>
        `}
      </div>

      ${isMentor ? `
      <!-- 경력 (멘토 전용) -->
      <div class="sf-section">
        <div class="sf-section-title"><i class="ti ti-briefcase"></i>경력
          <span class="sf-section-helper">재직했던 회사를 순서대로 적어주세요</span>
        </div>
        <div class="sf-career-list" id="sf-career-list"></div>
        <button type="button" class="sf-act-add" id="sf-career-add"><i class="ti ti-plus"></i> 경력 추가</button>
      </div>
      ` : ''}

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

        <div class="sf-subhead">자격증</div>
        <div class="sf-act-note">자격증명을 입력하면 목록에서 찾아드려요 (국가자격 613종 + 주요 민간자격).
          목록에 없으면 <b>그냥 적어도 저장</b>됩니다.</div>
        <div class="sf-cert-reco" id="sf-cert-reco" hidden></div>
        <div class="sf-lang-list" id="sf-cert-list"></div>
        <button type="button" class="sf-act-add" id="sf-cert-add"><i class="ti ti-plus"></i> 자격증 추가</button>

        <div class="sf-subhead">어학 능력 (영어)</div>
        <div class="sf-act-note">응시한 시험을 고르고 점수·등급을 적어주세요.
          여러 개를 냈다면 <b>가장 높게 환산되는 하나</b>만 점수에 반영됩니다.</div>
        <div class="sf-lang-list" id="sf-lang-list"></div>
        <button type="button" class="sf-act-add" id="sf-lang-add"><i class="ti ti-plus"></i> 어학 시험 추가</button>

        <div class="sf-subhead">제2외국어</div>
        <div class="sf-act-note">등급만 선택하면 됩니다. 프로필에 기록으로 남고,
          CAS 어학 점수는 영어 시험 기준이라 여기 값은 점수에 반영되지 않아요.</div>
        <div class="sf-lang-list" id="sf-foreign-list"></div>
        <button type="button" class="sf-act-add" id="sf-foreign-add"><i class="ti ti-plus"></i> 제2외국어 추가</button>
      </div>

      <!-- 정성 스펙 · 대표 활동 -->
      <div class="sf-section">
        <div class="sf-section-title sf-section-title--qual">
          <i class="ti ti-medal"></i>정성 스펙 · 대표 활동
          <span class="sf-section-helper">유형·기간·역할·성과까지 적을수록 CAS 정성 점수가 정확해집니다</span>
        </div>
        <div class="sf-act-note">인턴십 &gt; 공모전·대외활동 순으로 가중됩니다. 대표 활동을 자유롭게 추가하세요.</div>
        <div class="sf-act-list" id="sf-act-list"></div>
        <button type="button" class="sf-act-add" id="sf-act-add"><i class="ti ti-plus"></i> 활동 추가</button>
      </div>

      <button class="btn-save" id="sf-save">저장하기</button>
      <button class="btn-cancel" id="sf-cancel">취소</button>

      <!-- 자격증 직접 입력 모달이 들어갈 자리 -->
      <div class="sf-modal-host" id="sf-cert-manual" hidden></div>
    `;

    bindMenuCloser();

    // ── 관심 기업(멘티) · 경력(멘토)
    if (isMentor) {
      careerState = (spec.careers || []).map(c => ({ ...c }));
      if (!careerState.length) careerState.push({});
      paintCareers();
      bindCareers();
    } else {
      interestState = [...(spec.interestCompanies || [])];
      paintInterest();
      bindInterest();
    }

    // ── 자격증 편집기
    certState = [...(spec.certs || [])];
    certMeta  = { ...(spec.certMeta || {}) };
    certKnown = new Map();
    if (!certState.length) certState.push('');
    paintCerts();
    paintCertReco(spec.dept || '');
    bindCertWrap();

    // ── 어학 · 제2외국어 편집기
    langState    = langRowsFromScores(spec.scores);
    foreignState = foreignRowsFromScores(spec.scores);
    if (!langState.length) langState.push({ test: '', value: '' });
    paintLang();
    paintForeign();
    bindLangWraps();

    // ── 정성스펙 · 대표 활동 편집기
    renderActivities(initialActivities);
    bindActWrap();
    document.getElementById('sf-act-add').addEventListener('click', () => {
      actState.push({});
      paintActivities();
    });

    // ── 필드/직무 의존 채우기
    fillFieldJob(spec.dept, spec.field, spec.job);

    // ── 이벤트
    document.getElementById('sf-dept').addEventListener('change', e => {
      paintCertReco(e.target.value);
      fillFieldJob(e.target.value, null, null);
    });
    document.getElementById('sf-field').addEventListener('change', e => {
      fillJob(e.target.value, null);
    });
    document.getElementById('sf-save').addEventListener('click', () => handleSave(user));
    document.getElementById('sf-cancel').addEventListener('click', () => navigate('main'));

    initMajorSearch();
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

    /* 같은 디바운스 타이머로 자동완성 후보도 같이 받는다. 판정(classify)과
       후보(suggest)는 서버에서 같은 캐시를 보므로 호출을 나눠도 부담이 없다. */
    const runBoth = () => {
      run();
      fillCompanyOptions('sf-company-menu', input.value, name => {
        input.value = name;
        run();                     // 고른 회사로 기업 유형을 바로 판정한다
      });
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runBoth, 400); });
    input.addEventListener('blur', run);
  }

  /* 회사명 칸(멘토)의 검색 메뉴. datalist 대신 직접 그린 목록을 쓴다 —
     기업 유형을 부가 정보로 같이 보여주려면 datalist 로는 안 된다. */
  async function fillCompanyOptions(menuId, query, onPick) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
    const q = (query || '').trim();
    if (q.length < 2) { closeSearchMenu(menu); return; }   // 한 글자로는 후보가 너무 많다

    const items = await DB.suggestCompanies(q);
    // 응답을 기다리는 사이 입력이 더 진행됐으면 낡은 후보로 덮지 않는다
    const live = menu.closest('.sf-search')?.querySelector('.sf-search-input');
    if (live && live.value.trim() !== q) return;

    openSearchMenu(menu, items.map(c => ({ value: c.name, sub: CORP_LABEL[c.corpType] || '' })), {
      onPick,
      empty: '명단에 없는 회사예요 — 그냥 적어도 저장돼요',
    });
  }

  const CORP_LABEL = { large: '대기업', mid: '중견기업', small: '중소기업', public: '공공기관' };

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

  // ── 어학 · 제2외국어 편집기 ────────────────────────────────
  /* 저장 형식은 예전 그대로 평평한 키(scores.toeic / scores.opic …)를 유지한다.
     집계(aggregation.js)·비교(cas-compare.js)·백오피스가 전부 그 키를 직접 읽고 있어서,
     행 배열을 그대로 저장하면 그쪽을 다 같이 고쳐야 하고 옛 스펙도 못 읽는다.
     화면에서만 '행 목록'으로 다루고, 저장·로드에서 평평한 키와 상호 변환한다.
     제2외국어는 점수 체계가 없어 새 키(scores.foreign)에 배열로 둔다. */
  let langState    = [];   // [{ test, value }]  value: 점수 문자열 또는 등급
  let foreignState = [];   // [{ test, level }]

  /* 저장된 scores → 행 목록. LANG_TESTS 순서대로 넣어 화면 순서가 매번 같게 한다. */
  function langRowsFromScores(scores) {
    const rows = [];
    CAS.LANG_TESTS.forEach(t => {
      const v = scores?.[t.id];
      if (v != null && v !== '') rows.push({ test: t.id, value: String(v) });
    });
    return rows;
  }

  function foreignRowsFromScores(scores) {
    return (scores?.foreign || [])
      .filter(f => f && f.test && CAS.FOREIGN_TESTS.some(t => t.id === f.test))
      .map(f => ({ test: f.test, level: f.level || '' }));
  }

  function paintLang() {
    const wrap = document.getElementById('sf-lang-list');
    if (!wrap) return;
    wrap.innerHTML = langState.map((r, i) => langRowHtml(r, i)).join('');
  }

  function langRowHtml(r, i) {
    const t = CAS.LANG_TESTS.find(x => x.id === r.test);
    // 이미 고른 시험은 다른 행에서 다시 못 고르게 막는다 — 같은 시험 두 줄은 저장할 때 하나로 뭉개진다
    const taken = new Set(langState.filter((_, j) => j !== i).map(x => x.test).filter(Boolean));
    const opts = CAS.LANG_TESTS
      .filter(x => !taken.has(x.id))
      .map(x => `<option value="${x.id}" ${r.test === x.id ? 'selected' : ''}>${escapeHtml(x.label)}</option>`)
      .join('');

    let valueField;
    if (!t) {
      valueField = `<input type="text" disabled placeholder="시험을 먼저 고르세요" />`;
    } else if (t.kind === 'level') {
      valueField = `<select data-lang-i="${i}" data-lang-field="value">
          <option value="">등급 선택</option>
          ${t.levels.map(l => `<option value="${l}" ${r.value === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select>`;
    } else {
      valueField = `<input type="number" min="0" max="${t.max}" data-lang-i="${i}" data-lang-field="value"
             value="${escapeHtml(r.value ?? '')}" placeholder="${escapeHtml(t.placeholder || `0 ~ ${t.max}`)}" />`;
    }

    return `<div class="sf-lang-row">
        <select data-lang-i="${i}" data-lang-field="test">
          <option value="">시험 선택</option>${opts}
        </select>
        ${valueField}
        <span class="sf-lang-unit">${t ? (t.kind === 'level' ? '등급' : `/ ${t.max}점`) : ''}</span>
        <button type="button" class="sf-act-remove" data-lang-remove data-lang-i="${i}" title="삭제"><i class="ti ti-x"></i></button>
      </div>`;
  }

  function paintForeign() {
    const wrap = document.getElementById('sf-foreign-list');
    if (!wrap) return;
    wrap.innerHTML = foreignState.map((r, i) => foreignRowHtml(r, i)).join('');
  }

  function foreignRowHtml(r, i) {
    const t = CAS.FOREIGN_TESTS.find(x => x.id === r.test);
    const taken = new Set(foreignState.filter((_, j) => j !== i).map(x => x.test).filter(Boolean));
    const opts = CAS.FOREIGN_TESTS
      .filter(x => !taken.has(x.id))
      .map(x => `<option value="${x.id}" ${r.test === x.id ? 'selected' : ''}>${escapeHtml(x.label)}</option>`)
      .join('');

    const levelField = t
      ? `<select data-foreign-i="${i}" data-foreign-field="level">
           <option value="">등급 선택</option>
           ${t.levels.map(l => `<option value="${escapeHtml(l)}" ${r.level === l ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('')}
         </select>`
      : `<select disabled><option>시험을 먼저 고르세요</option></select>`;

    return `<div class="sf-lang-row">
        <select data-foreign-i="${i}" data-foreign-field="test">
          <option value="">시험 선택</option>${opts}
        </select>
        ${levelField}
        <span class="sf-lang-unit">${t ? '등급' : ''}</span>
        <button type="button" class="sf-act-remove" data-foreign-remove data-foreign-i="${i}" title="삭제"><i class="ti ti-x"></i></button>
      </div>`;
  }

  /* 활동 편집기와 같은 방식 — 이벤트 위임으로 한 번만 바인딩한다.
     시험을 바꾸면 값 위젯(숫자 ↔ 등급)이 통째로 달라지므로 값도 같이 비운다. */
  function bindLangWraps() {
    const langWrap = document.getElementById('sf-lang-list');
    const onLang = e => {
      const el = e.target;
      const i = el.dataset.langI, f = el.dataset.langField;
      if (i == null || !f) return;
      langState[+i][f] = el.value;
      if (f === 'test') { langState[+i].value = ''; paintLang(); }
    };
    langWrap.addEventListener('change', onLang);
    langWrap.addEventListener('input', onLang);
    langWrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-lang-remove]');
      if (!btn) return;
      langState.splice(+btn.dataset.langI, 1);
      paintLang();
    });

    const foreignWrap = document.getElementById('sf-foreign-list');
    const onForeign = e => {
      const el = e.target;
      const i = el.dataset.foreignI, f = el.dataset.foreignField;
      if (i == null || !f) return;
      foreignState[+i][f] = el.value;
      if (f === 'test') { foreignState[+i].level = ''; paintForeign(); }
    };
    foreignWrap.addEventListener('change', onForeign);
    foreignWrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-foreign-remove]');
      if (!btn) return;
      foreignState.splice(+btn.dataset.foreignI, 1);
      paintForeign();
    });

    document.getElementById('sf-lang-add').addEventListener('click', () => {
      // 남은 시험이 없으면 고를 게 없는 빈 줄만 생긴다
      if (langState.length >= CAS.LANG_TESTS.length) return;
      langState.push({ test: '', value: '' });
      paintLang();
    });
    document.getElementById('sf-foreign-add').addEventListener('click', () => {
      if (foreignState.length >= CAS.FOREIGN_TESTS.length) return;
      foreignState.push({ test: '', level: '' });
      paintForeign();
    });
  }

  /* 행 목록 → 저장 형식. 값이 빈 행은 버린다(시험만 고르고 안 적은 줄). */
  function collectScores() {
    const scores = {};
    langState.forEach(r => {
      const t = CAS.LANG_TESTS.find(x => x.id === r.test);
      if (!t || r.value == null || r.value === '') return;
      if (t.kind === 'level') {
        if (t.levels.includes(r.value)) scores[t.id] = r.value;
      } else {
        const n = parseInt(r.value, 10);
        if (!isNaN(n)) scores[t.id] = n;
      }
    });

    const foreign = foreignState
      .filter(r => r.test && r.level)
      .map(r => ({ test: r.test, level: r.level }));
    if (foreign.length) scores.foreign = foreign;

    return scores;
  }

  /* 어학 입력값 검증 — 만점을 넘는 점수는 환산 곡선이 100 으로 잘라버려
     조용히 틀린 점수가 저장된다. 저장 전에 막고 어디가 잘못됐는지 알려준다. */
  function validateScores() {
    for (const r of langState) {
      const t = CAS.LANG_TESTS.find(x => x.id === r.test);
      if (!t || t.kind !== 'score' || r.value === '') continue;
      const n = parseInt(r.value, 10);
      if (isNaN(n) || n < 0 || n > t.max) return `${t.label} 점수는 0 ~ ${t.max} 사이여야 합니다.`;
    }
    return null;
  }

  // ── 학과 검색 ───────────────────────────────────────────────
  /* 학과명은 자유롭게 받고, 통계 분류(dept)는 그 이름에서 자동으로 정한다.
     회사명 → 기업 유형 자동판정과 같은 구조다.

     자동 분류는 어디까지나 추천이라 회원이 고른 값을 덮어쓰지 않는다.
     '학과명이 바뀐 순간'에만 반영하고, 그 뒤 분류를 손대면 그대로 둔다.

     못 맞추는 학과가 많다 — careerly 통계는 아직 8개 분류뿐이라 간호·기계처럼
     해당 없는 계열이 훨씬 많다. 그때 아무 데나 밀어 넣으면 간호학과 학생에게
     컴공 합격자 평균이 보인다. 그래서 비워 두고 직접 고르게 안내한다. */
  let lastMajorClassified = null;

  function initMajorSearch() {
    const input = document.getElementById('sf-major');
    const menu  = document.getElementById('sf-major-menu');
    const hint  = document.getElementById('sf-major-hint');
    const sel   = document.getElementById('sf-dept');
    if (!input || !menu || !sel) return;

    lastMajorClassified = input.value.trim() || null;

    const applyDept = async name => {
      if (!name) {
        hint.className = 'sf-hint-inline';
        hint.textContent = '학과명은 자유롭게 적어도 돼요. 통계는 아래 분류로 묶입니다.';
        lastMajorClassified = null;
        return;
      }
      if (name === lastMajorClassified) return;

      const r = await DB.classifyMajor(name);
      if (input.value.trim() !== name) return;      // 그새 더 입력했으면 버린다
      lastMajorClassified = name;

      if (r?.dept) {
        sel.value = r.dept;
        const label = DEPTS.find(d => d.id === r.dept)?.label || r.dept;
        hint.className = 'sf-hint-inline sf-hint-ok';
        hint.textContent = `${label} 통계로 묶여요. 다르면 아래에서 직접 고치세요.`;
      } else {
        hint.className = 'sf-hint-inline sf-hint-warn';
        hint.textContent = '아직 이 계열의 선배 통계가 없어요. 가장 가까운 분류를 직접 골라주세요.';
      }
    };

    const search = async () => {
      const q = input.value.trim();
      if (!q) { closeSearchMenu(menu); return; }

      const hits = await DB.suggestMajors(q);
      if (input.value.trim() !== q) return;      // 늦게 온 응답으로 덮지 않는다

      openSearchMenu(menu, hits.map(m => ({
        value: m.name,
        sub: m.dept ? (DEPTS.find(d => d.id === m.dept)?.label || '') : '통계 없음',
      })), {
        onPick: name => { input.value = name; applyDept(name); },
        empty: '목록에 없는 학과예요',
        /* 학과 이름은 학교마다 제각각이라 목록이 못 따라간다.
           못 찾았다고 못 적게 하면 그 자리에서 막힌다. */
        footer: `<b>${escapeHtml(q)}</b> 직접 입력`,
        onFooter: () => { applyDept(q); },
      });
    };

    let timer = null;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 250); });
    input.addEventListener('blur', () => applyDept(input.value.trim()));

    // 분류를 직접 고치면 그 선택을 존중한다 — 다음 자동판정이 덮지 않게 표시만 바꾼다
    sel.addEventListener('change', () => {
      hint.className = 'sf-hint-inline';
      hint.textContent = '직접 고른 분류로 저장돼요.';
    });
  }

  // ── 관심 기업 (멘티 전용) ───────────────────────────────────
  /* 여러 곳을 담는다. 기업 유형은 묻지 않는다 — 아직 다니지 않는 회사라 유형별
     통계에 넣을 근거가 없고, 여러 곳마다 유형을 고르게 하면 입력이 무거워진다. */
  let interestState = [];

  function paintInterest() {
    const box = document.getElementById('sf-interest-chips');
    if (!box) return;
    box.innerHTML = interestState.map((name, i) => `
      <span class="sf-chip">${escapeHtml(name)}
        <button type="button" class="sf-chip-x" data-interest-remove="${i}" aria-label="삭제">
          <i class="ti ti-x"></i>
        </button>
      </span>`).join('');
  }

  function bindInterest() {
    const input = document.getElementById('sf-interest');
    const menu  = document.getElementById('sf-interest-menu');
    const chips = document.getElementById('sf-interest-chips');
    if (!input || !menu) return;

    const add = name => {
      const v = (name || '').trim();
      if (!v || interestState.includes(v)) return;    // 같은 회사를 두 번 담지 않는다
      interestState.push(v);
      paintInterest();
      input.value = '';
    };

    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { closeSearchMenu(menu); return; }
      timer = setTimeout(async () => {
        const items = await DB.suggestCompanies(q, 8);
        if (input.value.trim() !== q) return;         // 그새 더 입력했으면 버린다
        openSearchMenu(menu, items.map(c => ({ value: c.name, sub: CORP_LABEL[c.corpType] || '' })), {
          onPick: add,
          empty: '검색 결과가 없어요',
          /* 명단에 없는 회사가 훨씬 많다(중소·신설). 못 찾았다고 못 담게 하면
             중소기업 지망 학생이 이 칸을 아예 못 쓴다. */
          footer: `<b>${escapeHtml(q)}</b> 직접 추가`,
          onFooter: () => add(q),
        });
      }, 300);
    });

    // 엔터로도 담는다 — 검색 결과를 기다리지 않고 아는 이름을 바로 치는 사람이 있다
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); closeSearchMenu(menu); add(input.value); }
    });

    chips.addEventListener('click', e => {
      const btn = e.target.closest('[data-interest-remove]');
      if (!btn) return;
      interestState.splice(+btn.dataset.interestRemove, 1);
      paintInterest();
    });
  }

  // ── 경력 (멘토 전용) ────────────────────────────────────────
  /* 회사·기간·직무만 받는다. 연봉은 넣지 않았다 — 지금 어디에도 쓰이지 않는 값을
     민감정보까지 받아 쌓아둘 이유가 없다. 쓸 곳이 정해지면 그때 칸을 늘린다. */
  let careerState = [];

  function paintCareers() {
    const wrap = document.getElementById('sf-career-list');
    if (!wrap) return;
    wrap.innerHTML = careerState.map((c, i) => careerRowHtml(c, i)).join('');
  }

  function careerRowHtml(c, i) {
    return `
      <div class="sf-career-row">
        <div class="sf-career-head">
          <span class="sf-career-n">${i + 1}</span>
          <div class="sf-search sf-career-company">
            <input type="text" class="sf-search-input" placeholder="회사명"
                   data-career-i="${i}" data-career-field="company"
                   value="${escapeHtml(c.company || '')}" autocomplete="off" />
            <i class="ti ti-search sf-search-icon"></i>
            <div class="sf-search-menu" id="sf-career-menu-${i}" hidden></div>
          </div>
          <button type="button" class="sf-act-remove" data-career-remove="${i}" title="삭제">
            <i class="ti ti-x"></i>
          </button>
        </div>
        <div class="sf-career-grid">
          <input type="month" data-career-i="${i}" data-career-field="start"
                 value="${escapeHtml(c.start || '')}" aria-label="입사년월" />
          <span class="sf-career-tilde">~</span>
          <input type="month" data-career-i="${i}" data-career-field="end"
                 value="${escapeHtml(c.end || '')}" aria-label="퇴사년월"
                 ${c.current ? 'disabled' : ''} />
          <label class="sf-career-now">
            <input type="checkbox" data-career-i="${i}" data-career-field="current"
                   ${c.current ? 'checked' : ''} /> 재직중
          </label>
        </div>
        <div class="sf-career-grid2">
          <input type="text" data-career-i="${i}" data-career-field="position"
                 placeholder="직급/직책 (예: 선임)" value="${escapeHtml(c.position || '')}" />
          <input type="text" data-career-i="${i}" data-career-field="job"
                 placeholder="담당직무 (예: 백엔드 개발)" value="${escapeHtml(c.job || '')}" />
        </div>
        <textarea data-career-i="${i}" data-career-field="desc" rows="2"
          placeholder="담당한 업무와 성과를 간단히 적어주세요">${escapeHtml(c.desc || '')}</textarea>
      </div>`;
  }

  function bindCareers() {
    const wrap = document.getElementById('sf-career-list');
    const addBtn = document.getElementById('sf-career-add');
    if (!wrap || !addBtn) return;

    const onChange = e => {
      const el = e.target;
      const i = el.dataset.careerI, f = el.dataset.careerField;
      if (i == null || !f) return;
      careerState[+i][f] = el.type === 'checkbox' ? el.checked : el.value;
      // '재직중'을 켜면 퇴사년월 칸이 잠겨야 한다 — 둘 다 채워진 상태가 남으면 안 된다
      if (f === 'current') { careerState[+i].end = ''; paintCareers(); }
    };
    wrap.addEventListener('change', onChange);
    wrap.addEventListener('input', e => {
      onChange(e);
      if (e.target.dataset.careerField === 'company') suggestCareerCompany(+e.target.dataset.careerI);
    });
    wrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-career-remove]');
      if (!btn) return;
      careerState.splice(+btn.dataset.careerRemove, 1);
      paintCareers();
    });

    addBtn.addEventListener('click', () => {
      careerState.push({});
      paintCareers();
      wrap.querySelector(`[data-career-i="${careerState.length - 1}"]`)?.focus();
    });
  }

  const careerTimers = {};
  function suggestCareerCompany(i) {
    const input = document.querySelector(`[data-career-i="${i}"][data-career-field="company"]`);
    const menu = document.getElementById(`sf-career-menu-${i}`);
    if (!input || !menu) return;

    clearTimeout(careerTimers[i]);
    const q = input.value.trim();
    if (q.length < 2) { closeSearchMenu(menu); return; }
    careerTimers[i] = setTimeout(async () => {
      const items = await DB.suggestCompanies(q, 8);
      if (input.value.trim() !== q) return;
      openSearchMenu(menu, items.map(c => ({ value: c.name, sub: CORP_LABEL[c.corpType] || '' })), {
        onPick: v => { careerState[i].company = v; paintCareers(); },
        empty: '검색 결과가 없어요 — 그냥 적어도 저장돼요',
      });
    }, 300);
  }

  function collectCareers() {
    return careerState
      .filter(c => (c.company || '').trim())
      .map(c => {
        const o = { company: c.company.trim() };
        if (c.start) o.start = c.start;
        if (c.current) o.current = true;
        else if (c.end) o.end = c.end;
        if ((c.position || '').trim()) o.position = c.position.trim();
        if ((c.job || '').trim()) o.job = c.job.trim();
        if ((c.desc || '').trim()) o.desc = c.desc.trim();
        return o;
      });
  }

  // ── 자격증 편집기 ──────────────────────────────────────────
  /* 예전에는 학과별 추천 자격증 6개를 체크박스로 깔고, 나머지는 '기타 (쉼표로 구분)'
     한 칸에 몰아 받았다. 그래서 체크박스 밖의 자격증은 오타·표기흔들림(정보처리 기사 /
     정보처리기사)이 그대로 저장돼 보유율 집계에서 서로 다른 자격으로 세어졌다.

     지금은 국가자격 613종(큐넷 API 캐시)을 검색 목록으로 붙여 **고르면 표기가 통일**되게 한다.
     목록에 없는 자격도 그냥 적어서 저장할 수 있다 — 막으면 신설 자격·해외 자격을
     아예 못 적게 되고, 그건 오타보다 나쁘다. 대신 목록에서 고른 건지 직접 적은 건지를
     화면에 표시해 학생이 스스로 알아채게 한다.

     저장 형식은 예전 그대로 문자열 배열(spec.certs)이다. 집계·로드맵이 전부
     자격증명 문자열로 맞춰보고 있어서 형식을 바꾸면 저장된 스펙을 못 읽는다. */
  let certState = [];    // ['정보처리기사', ...]  — 이름만. 집계(aggregation)가 이 형식을 쓴다
  /* 목록에 있는 자격증인지 확인된 것만 담는다 — { 이름: 부가정보 } 또는 { 이름: null }.
     전체 카탈로그(643종·77KB)를 받아 두던 것을 대신한다. 검색을 서버에 맡겼으니
     화면이 아는 것은 '지금까지 확인해 본 이름' 뿐이면 충분하다. */
  let certKnown = new Map();
  /* 목록에 없어 직접 적은 자격증의 부가 정보. { 자격증명: { issuer, date } }
     certs 는 이름 배열 그대로 두고 옆에 따로 붙인다 — 배열 모양을 바꾸면
     보유율 집계(aggregation.js)와 저장된 옛 스펙이 전부 깨진다. */
  let certMeta = {};

  function paintCerts() {
    const wrap = document.getElementById('sf-cert-list');
    if (!wrap) return;
    wrap.innerHTML = certState.map((c, i) => certRowHtml(c, i)).join('');
  }

  function certRowHtml(name, i) {
    const manual = certMeta[name];
    const known = certKnown.has(name) ? certKnown.get(name) : undefined;

    /* 아직 확인 전(undefined)이면 '목록에 없음' 이라고 단정하지 않는다 —
       확인 중일 뿐인데 학생에게 오타라고 알리는 꼴이 된다. */
    const badge = !name ? ''
      : manual ? `<span class="sf-cert-badge sf-cert-badge--ok">직접 입력</span>`
      : known === undefined ? ''
      : known ? `<span class="sf-cert-badge sf-cert-badge--ok">${escapeHtml(known)}</span>`
      : `<span class="sf-cert-badge sf-cert-badge--free">목록에 없음</span>`;

    /* 직접 입력한 자격증은 발급기관·취득일을 함께 보여준다. 목록에서 고른 것은
       그 정보가 카탈로그에 없으므로 묻지 않는다(공식 자격은 이름만으로 특정된다). */
    const detail = manual ? `
      <div class="sf-cert-detail">
        <span><i class="ti ti-building"></i> ${escapeHtml(manual.issuer)}</span>
        <span><i class="ti ti-calendar"></i> ${escapeHtml(manual.date)}</span>
        <button type="button" class="sf-cert-edit" data-cert-edit="${i}">수정</button>
      </div>` : '';

    return `<div class="sf-cert-row">
        <div class="sf-cert-main">
          <div class="sf-search">
            <input type="text" class="sf-search-input" data-cert-i="${i}"
                   value="${escapeHtml(name)}" placeholder="자격증명을 검색하세요" autocomplete="off" />
            <i class="ti ti-search sf-search-icon"></i>
            <div class="sf-search-menu" id="sf-cert-menu-${i}" hidden></div>
          </div>
          ${badge}
          <button type="button" class="sf-act-remove" data-cert-remove data-cert-i="${i}" title="삭제"><i class="ti ti-x"></i></button>
        </div>
        ${detail}
      </div>`;
  }

  /* 학과를 고르면 그 학과에서 많이 따는 자격증을 한 번에 넣을 수 있게 칩으로 보여준다.
     체크박스 그리드를 없애면서 사라진 '뭘 따야 하는지 모르겠는' 학생용 길잡이를 대신한다. */
  function paintCertReco(deptId) {
    const box = document.getElementById('sf-cert-reco');
    if (!box) return;
    const reco = (Aggregator.CERT_CATALOG[deptId] || []).filter(c => !certState.includes(c.id));
    if (!reco.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<span class="sf-cert-reco-label">이 학과에서 많이 따는 자격증</span>`
      + reco.map(c => `<button type="button" class="sf-cert-chip" data-cert-reco="${escapeHtml(c.id)}"
             ${c.desc ? `title="${escapeHtml(c.desc)}"` : ''}>+ ${escapeHtml(c.id)}</button>`).join('');
  }

  /* 자격증 검색 — 카탈로그 643종을 메모리에서 찾는다(서버 왕복 없음).
     목록에 없으면 '직접 입력'으로 빠질 수 있게 아래에 항상 길을 하나 둔다. */
  async function suggestCert(i) {
    const input = document.querySelector(`[data-cert-i="${i}"]`);
    const menu  = document.getElementById(`sf-cert-menu-${i}`);
    if (!input || !menu) return;

    const q = input.value.trim();
    if (!q) { closeSearchMenu(menu); return; }

    const hits = await DB.suggestCerts(q);
    if (input.value.trim() !== q) return;      // 늦게 온 응답으로 덮지 않는다

    /* 응답에 지금 적힌 이름과 똑같은 게 있으면 목록에 있는 자격증이다.
       없으면 '목록에 없음' 으로 확정한다 — 배지를 위해 따로 부르지 않는다. */
    const exact = hits.find(c => c.name === q);
    const had = certKnown.get(q);
    certKnown.set(q, exact ? (exact.sub || '') : null);
    if (had !== certKnown.get(q)) setTimeout(paintCerts, 0);

    openSearchMenu(menu, hits.map(c => ({ value: c.name, sub: c.sub })), {
      onPick: (v, item) => {
        certState[i] = v;
        certKnown.set(v, item.sub || '');   // 목록에서 골랐으니 확인된 이름이다
        delete certMeta[v];                 // 목록에서 고르면 직접입력 정보는 필요 없다
        paintCerts();
        paintCertReco(document.getElementById('sf-dept').value);
      },
      empty: '목록에 없는 자격증이에요',
      footer: `<b>${escapeHtml(q)}</b> 직접 입력`,
      onFooter: () => openCertManual(i, q),
    });
  }

  /* ── 직접 입력 ────────────────────────────────────────────────
     목록에 없는 자격증(신설·해외·사내자격)은 이름만 받으면 나중에 그게 무엇인지
     아무도 알 수 없다. 그래서 **자격증명·발급기관·취득일을 모두** 받는다.
     셋 다 채워야 저장된다 — 하나라도 비면 기록으로서 값이 없다. */
  function openCertManual(i, presetName) {
    const cur = certMeta[certState[i]] || {};
    const host = document.getElementById('sf-cert-manual');
    if (!host) return;

    host.innerHTML = `
      <div class="sf-modal-back" data-manual-close></div>
      <div class="sf-modal">
        <div class="sf-modal-head">자격증 직접 입력</div>
        <p class="sf-modal-desc">목록에 없는 자격증이에요. 세 가지를 모두 적어주세요.</p>
        <div class="form-group">
          <label>자격증명</label>
          <input type="text" id="cm-name" value="${escapeHtml(presetName || certState[i] || '')}" placeholder="예: 사내 데이터분석 인증" />
        </div>
        <div class="form-group">
          <label>발급기관</label>
          <input type="text" id="cm-issuer" value="${escapeHtml(cur.issuer || '')}" placeholder="예: 한국데이터산업진흥원" />
        </div>
        <div class="form-group">
          <label>취득일</label>
          <input type="month" id="cm-date" value="${escapeHtml(cur.date || '')}" />
        </div>
        <div class="sf-modal-err" id="cm-err" hidden></div>
        <div class="sf-modal-actions">
          <button type="button" class="sf-modal-cancel" data-manual-close>취소</button>
          <button type="button" class="sf-modal-ok" id="cm-ok">추가하기</button>
        </div>
      </div>`;
    host.hidden = false;
    document.getElementById('cm-name').focus();

    host.querySelectorAll('[data-manual-close]').forEach(el =>
      el.addEventListener('click', () => { host.hidden = true; host.innerHTML = ''; }));

    document.getElementById('cm-ok').addEventListener('click', () => {
      const name   = document.getElementById('cm-name').value.trim();
      const issuer = document.getElementById('cm-issuer').value.trim();
      const date   = document.getElementById('cm-date').value;
      const err    = document.getElementById('cm-err');

      const missing = [!name && '자격증명', !issuer && '발급기관', !date && '취득일'].filter(Boolean);
      if (missing.length) {
        err.textContent = `${missing.join(' · ')}을(를) 입력해 주세요.`;
        err.hidden = false;
        return;
      }

      const old = certState[i];
      if (old && old !== name) delete certMeta[old];   // 이름을 바꿨으면 옛 키를 지운다
      certState[i] = name;
      certMeta[name] = { issuer, date };

      host.hidden = true;
      host.innerHTML = '';
      paintCerts();
      paintCertReco(document.getElementById('sf-dept').value);
    });
  }

  function bindCertWrap() {
    const wrap = document.getElementById('sf-cert-list');

    /* 값은 input 마다 즉시 반영한다. 행을 다시 그리면 커서가 튀므로 입력 중에는
       다시 그리지 않고, 검색 메뉴만 갱신한다. */
    /* 입력할 때마다 서버에 묻되 250ms 로 묶는다. 글자마다 부르면 한 단어 치는 사이에
       요청이 대여섯 개 나간다. */
    const certTimers = {};
    wrap.addEventListener('input', e => {
      const i = e.target.dataset.certI;
      if (i == null) return;
      certState[+i] = e.target.value;
      clearTimeout(certTimers[i]);
      certTimers[i] = setTimeout(() => suggestCert(+i), 250);
    });
    wrap.addEventListener('click', e => {
      const edit = e.target.closest('[data-cert-edit]');
      if (edit) { openCertManual(+edit.dataset.certEdit); return; }

      const btn = e.target.closest('[data-cert-remove]');
      if (!btn) return;
      const removed = certState[+btn.dataset.certI];
      certState.splice(+btn.dataset.certI, 1);
      if (removed && !certState.includes(removed)) delete certMeta[removed];
      paintCerts();
      paintCertReco(document.getElementById('sf-dept').value);
    });

    document.getElementById('sf-cert-reco').addEventListener('click', e => {
      const btn = e.target.closest('[data-cert-reco]');
      if (!btn) return;
      // 빈 줄이 있으면 그 자리를 채운다 — 칩을 눌렀는데 빈 줄이 남아 있으면 지저분하다
      const blank = certState.findIndex(c => !c || !c.trim());
      if (blank >= 0) certState[blank] = btn.dataset.certReco;
      else certState.push(btn.dataset.certReco);
      paintCerts();
      paintCertReco(document.getElementById('sf-dept').value);
    });

    document.getElementById('sf-cert-add').addEventListener('click', () => {
      certState.push('');
      paintCerts();
      // 새로 생긴 칸으로 바로 커서를 옮겨 준다
      wrap.querySelector(`[data-cert-i="${certState.length - 1}"]`)?.focus();
    });
  }

  function collectCerts() {
    // 표기 흔들림을 줄이려고 앞뒤 공백만 정리하고, 같은 자격을 두 번 적은 건 합친다
    return [...new Set(certState.map(c => (c || '').trim()).filter(Boolean))];
  }

  /* 직접 입력 정보는 실제로 저장되는 자격증에 대한 것만 남긴다 —
     지웠다 다시 넣는 사이에 고아 항목이 쌓이지 않게. */
  function collectCertMeta(names) {
    const out = {};
    names.forEach(n => { if (certMeta[n]) out[n] = certMeta[n]; });
    return Object.keys(out).length ? out : undefined;
  }

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
      /* 유형이 바뀌면 역할/단계 옵션이, 회사 규모가 바뀌면 배수 안내가 달라진다.
         유형이 바뀌면 주최기관 안내문도 따라 바뀐다(orgPlaceholder). */
      if (f === 'type' || f === 'companyTier') paintActivities();
      // 인턴십의 주최기관 = 회사. 적어 넣는 대로 규모를 판정해 배수를 채운다.
      if (f === 'org') classifyActOrg(+i);
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
          <input type="text" data-i="${i}" data-field="name" placeholder="활동명 (예: 하계 인턴십, SW 공모전)"
                 value="${escapeHtml(a.name || '')}" />
          <div class="sf-search">
            <input type="text" data-i="${i}" data-field="org" placeholder="${escapeHtml(orgPlaceholder(a.type))}"
                   value="${escapeHtml(a.org || '')}" autocomplete="off" />
            ${a.type === 'internship' ? `<i class="ti ti-search sf-search-icon"></i>
            <div class="sf-search-menu" id="sf-org-menu-${i}" hidden></div>` : ''}
          </div>
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
        ${companyTierRow(a, i)}
        ${t ? `<div class="sf-act-help">${escapeHtml(t.help)}</div>` : ''}
      </div>`;
  }

  /* 인턴십 주최기관(=회사) → 기업 규모 자동 판정.

     활동명 하나에 회사와 활동을 같이 적던 때는 서버 AI 가 문장에서 회사를 뽑아야 했다.
     주최기관을 따로 받으니 그 칸을 그대로 판정에 넘기면 된다 — AI 없이도
     인턴십 배수(×1.0~×1.2)가 채워진다.

     학생이 드롭다운으로 직접 고른 값을 덮어쓰지 않도록, 회사명이 실제로 바뀐
     행에만 반영한다(회사명 자동판정 initCompanyAutoClassify 와 같은 규칙). */
  const actOrgTimers = {};
  const actOrgLast   = {};

  function classifyActOrg(i) {
    const a = actState[i];
    if (!a || a.type !== 'internship') return;
    const name = (a.org || '').trim();

    clearTimeout(actOrgTimers[i]);
    if (!name) { actOrgLast[i] = null; return; }
    if (name === actOrgLast[i]) return;

    actOrgTimers[i] = setTimeout(async () => {
      // 후보 목록도 같이 띄운다. 고르면 그 이름으로 확정하고 규모를 다시 판정한다.
      fillCompanyOptions(`sf-org-menu-${i}`, name, picked => {
        const row = actState[i];
        if (!row) return;
        row.org = picked;
        paintActivities();
        classifyActOrg(i);
      });
      const r = await DB.classifyCompany(name);
      // 기다리는 사이 이 행이 지워졌거나 회사명이 또 바뀌었으면 결과를 버린다
      const cur = actState[i];
      if (!cur || (cur.org || '').trim() !== name) return;
      actOrgLast[i] = name;
      if (!r || !r.matched || !r.corpType) return;
      cur.companyTier = r.corpType;
      cur.companyName = name;
      paintActivities();
    }, 400);
  }

  /* 주최기관 칸의 안내문. 활동 유형마다 '주최' 의 뜻이 달라서(인턴십은 회사,
     공모전은 주최사, 동아리는 학교) 유형에 맞는 예시를 보여준다. */
  function orgPlaceholder(type) {
    switch (type) {
      case 'internship':    return '회사명 (예: 삼성전자)';
      case 'competition':   return '주최기관 (예: 과학기술정보통신부)';
      case 'extracurricular': return '주관기관 (예: 대학내일)';
      case 'club':
      case 'campus':        return '소속 학교·기관';
      case 'research':      return '소속 연구실·학교';
      case 'exchange':      return '파견 학교·기관';
      case 'volunteer':     return '주관 단체';
      default:              return '주최·소속 기관';
    }
  }

  /* 인턴십은 회사 규모가 점수 배수로 들어간다(cas.js COMPANY_MULT).

     ── 예전에는 판정에 성공했을 때만, 그것도 배수가 1 이 아닐 때만 알려줬다 ──
     그래서 회사명을 못 알아본 경우(활동명이 "하계 인턴십" 처럼 회사명이 없거나
     명단에 없는 회사)에는 **아무 말 없이 ×1.0** 이 적용됐다. 대기업 인턴을 쓰고도
     점수가 낮게 나오는데 학생은 이유를 알 수 없었다 — 에러가 안 나니 발견되지도 않는다.

     지금은 인턴십이면 **항상** 상태를 보여주고, 드롭다운으로 직접 고칠 수 있게 한다.
     '조용히 틀리는 것' 대신 '보이고 고칠 수 있는 것'으로 바꾸는 게 요점이다. */
  const TIER_LABEL = { large: '대기업', public: '공공기관', mid: '중견기업', small: '중소기업' };

  function companyTierRow(a, i) {
    if (a.type !== 'internship') return '';

    const tiers = Object.keys(CAS.COMPANY_MULT || {});
    const mult  = (CAS.COMPANY_MULT || {})[a.companyTier] || 1;
    const opts  = tiers.map(t =>
      `<option value="${t}" ${a.companyTier === t ? 'selected' : ''}>${TIER_LABEL[t] || t} ×${CAS.COMPANY_MULT[t]}</option>`
    ).join('');

    /* 판정 성공 / 실패에 따라 문구만 다르고, 고칠 수단(드롭다운)은 똑같이 준다.
       판정이 맞아도 학생이 아는 사실(계열사·지사 등)이 더 정확할 수 있다. */
    const note = a.companyTier
      ? `<span class="sf-tier-ok">🏢 ${escapeHtml(a.companyName || '회사')} — ${TIER_LABEL[a.companyTier] || a.companyTier}으로 확인 (점수 ×${mult})</span>`
      : `<span class="sf-tier-warn">⚠️ 회사를 못 찾아 <b>중소기업 기준(×1.0)</b>으로 계산됩니다.
           대기업·공공기관 인턴이면 직접 골라주세요 — 점수가 최대 ×1.2 까지 달라져요.</span>`;

    return `<div class="sf-act-tier">
        ${note}
        <select data-i="${i}" data-field="companyTier" class="sf-tier-select" aria-label="인턴 회사 규모">
          <option value="">${a.companyTier ? '직접 고치기' : '회사 규모 선택'}</option>
          ${opts}
        </select>
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
        if (a.org && a.org.trim()) o.org = a.org.trim();
        if (a.duration) o.duration = a.duration;
        if (t && t.roleKind === 'stage') { if (a.stage) o.stage = a.stage; }
        else if (a.role && String(a.role).trim()) o.role = String(a.role).trim();
        if (a.outcome) o.outcome = a.outcome;
        /* 기업 규모는 주최기관 칸을 서버가 판정한 결과다.
           여기서 빠뜨리면 저장 후 배수가 사라져 "입력할 때 본 점수"와 달라진다. */
        if (a.type === 'internship' && a.companyTier) {
          o.companyTier = a.companyTier;
          if (a.companyName) o.companyName = a.companyName;
        }
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

  async function handleSave(user) {
    const success = document.getElementById('sf-success');
    const error   = document.getElementById('sf-error');
    success.style.display = error.style.display = 'none';

    const dept   = document.getElementById('sf-dept').value;
    const major  = document.getElementById('sf-major')?.value.trim() || null;
    const field  = document.getElementById('sf-field').value || null;
    const job    = document.getElementById('sf-job').value   || null;
    /* 회사·기업유형 칸은 멘토 화면에만 있고, 관심기업 칸은 멘티 화면에만 있다.
       없는 칸을 읽으려 하면 여기서 죽으므로 역할에 맞는 것만 읽는다. */
    const corpType = isMentor ? (document.getElementById('sf-corpType')?.value || null) : null;
    const company  = isMentor ? (document.getElementById('sf-company')?.value.trim() || null) : null;
    const nickname = document.getElementById('sf-nickname').value.trim() || null;
    const gpaRaw   = document.getElementById('sf-gpa').value;
    const gpaMax   = parseFloat(document.getElementById('sf-gpaMax').value);
    const gpa      = gpaRaw === '' ? null : parseFloat(gpaRaw);

    if (!dept) {
      /* 학과명은 적었는데 분류만 비어 있는 경우가 흔하다(간호·기계처럼 아직 통계가
         없는 계열). '학과를 선택하라'고만 하면 이미 적었는데 왜 그러냐가 된다. */
      error.textContent = major
        ? `'${major}'가 어느 분류로 묶일지 못 찾았어요. 통계 분류를 직접 골라주세요.`
        : '학과를 입력해주세요.';
      error.style.display = 'block';
      return;
    }
    if (gpa != null && (isNaN(gpa) || gpa < 0 || gpa > gpaMax)) {
      error.textContent = `학점은 0 ~ ${gpaMax} 사이여야 합니다.`;
      error.style.display = 'block';
      return;
    }

    const certs = collectCerts();

    const scoreErr = validateScores();
    if (scoreErr) {
      error.textContent = scoreErr;
      error.style.display = 'block';
      return;
    }
    const scores = collectScores();

    const activities = collectActivities();

    const saveBtn = document.getElementById('sf-save');
    saveBtn.disabled = true;
    try {
      await DB.updateUser({ nickname });
      await DB.upsertSpec({
        dept, major, field, job, company, corpType, gpa, gpaMax, certs, scores, activities,
        certMeta: collectCertMeta(certs),
        /* 역할별로만 있는 값. 반대 역할의 키는 아예 보내지 않아서
           멘티 스펙에 빈 careers 가, 멘토 스펙에 빈 관심기업이 남지 않게 한다. */
        ...(isMentor
          ? { careers: collectCareers() }
          : { interestCompanies: [...interestState] }),
      });
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

  // 학과·분야·직무 id → 라벨의 단일 출처로도 쓰인다 (cas-hero.js 등)
  return { render, DEPTS, FIELD_OPTIONS, JOB_OPTIONS };
})();
