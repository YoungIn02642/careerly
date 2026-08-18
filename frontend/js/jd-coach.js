/* ════════════════════════════════════════════════════════════
   C:road — 자소서 코치 (직무기술서 → 요구역량 → 작성 가이드)

   화면 규칙 두 개만 지키면 이 페이지는 신뢰를 잃지 않는다:
     1) 역량마다 **공고 원문 근거 문장**을 같이 보여준다. 자동 추출은 반드시
        오탐이 섞이는데, 근거가 보이면 사용자가 스스로 걸러낼 수 있다.
     2) 완성된 자소서 문장을 주지 않는다는 것을 화면에 적어 둔다(서버가 문구를 준다).
        대필로 오해하면 그대로 베껴 쓰고, 유사도 검사에 걸린다.

   ── 화면 구조 ──────────────────────────────────────────────
   입력부는 **문서형**이다. rows 를 고정하지 않고 내용만큼 자라며, 다 쓴 칸은
   접힌다. 접힌 칸도 첫 두 줄과 글자수를 남겨서 "내가 뭘 넣었는지"를 펼치지 않고
   확인할 수 있다. 왼쪽 사이드바가 '입력 항목' 목록이자 확인 표시(점)를 겸하고,
   그 아래 '분석 준비' 막대 하나가 전체가 얼마나 찼는지를 말한다.

   결과부는 **좌우 2단**이다. 왼쪽은 요구 역량 하나로 합친 목록(예전에는 요구역량
   카드와 문항별 직무역량 카드가 따로 나와 같은 말을 두 번 읽어야 했다), 오른쪽은
   자소서 초안 에디터. 둘 다 화면에 남아 있어서, 역량을 보면서 그 자리에서 쓴다.
   왼쪽 맨 위 키워드 칩을 누르면 그 역량으로 바꿔 가며 볼 수 있다.
   ════════════════════════════════════════════════════════════ */
/* cas.js 와 같은 이중 노출 — 브라우저에서는 window.JdCoach, node 에서는 module.exports.
   문항 분류 규칙(classifyQuestion)을 화면 없이 테스트하기 위해서다. DOM 은 함수 안에서만
   건드리므로 로드 시점에는 document 가 없어도 된다. */
(root => {
  const $ = sel => document.querySelector(sel);

  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* lead 문구에만 **강조** 를 쓴다(서버가 활동 이름을 그렇게 감싼다).
     escape 를 먼저 하고 나서 강조를 풀어야 XSS 가 되지 않는다. */
  const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  let _last = null;         // 마지막 결과 — 다시 그릴 때 재요청하지 않는다
  let _focused = 0;         // 지금 펼친 역량 index
  let _tab = 0;             // 지금 쓰고 있는 초안 탭 index
  let _lastTabs = [];       // 지금 그려진 초안 탭 — AI 초안이 문항 문구를 같이 보낸다

  /* ── 내가 쓴 자소서 초안 보관 ────────────────────────────────
     가이드를 보면서 바로 쓰고, 다음에 같은 회사로 들어오면 이어 쓰게 하는 게 목적.

     저장 위치는 localStorage 다. 서버에 두면 계정·동기화·삭제 정책이 따라붙는데
     아직 그 설계가 없고, 초안은 남에게 보일 물건도 아니다. 기기를 옮기면
     안 따라온다는 한계는 화면에 적어 둔다.

     키는 '회사명 + 항목 이름'. 회사명을 안 적었으면 공용 칸(기본)으로 떨어진다 —
     회사를 적어야 회사별로 따로 쌓인다. */
  const LS_DRAFTS = 'careerly_jd_drafts_v1';

  function loadDrafts() {
    try { return JSON.parse(localStorage.getItem(LS_DRAFTS)) || {}; } catch { return {}; }
  }
  function draftScope() {
    return ($('#jd-company')?.value || '').trim() || '(회사 미지정)';
  }

  /* 저장 형태가 두 가지다. 처음에는 문자열만 넣었는데(v1), 보관함에서 "언제 쓴 글인지"를
     보여주려면 시각이 필요해 { text, at } 로 바꿨다(v2). 이미 저장해 둔 초안을 버릴 수는
     없으므로 **읽을 때 두 모양을 다 받는다.** 다음에 저장될 때 자연스럽게 v2 가 된다. */
  function unwrap(v) {
    if (typeof v === 'string') return { text: v, at: null };
    if (v && typeof v === 'object') return { text: String(v.text || ''), at: v.at || null };
    return { text: '', at: null };
  }

  function getDraft(label) {
    return unwrap(loadDrafts()[draftScope()]?.[label]).text;
  }
  function saveDraft(label, text) {
    const all = loadDrafts();
    const scope = draftScope();
    all[scope] = all[scope] || {};
    if (text.trim()) all[scope][label] = { text, at: Date.now() };
    else delete all[scope][label];            // 비우면 흔적을 남기지 않는다
    if (!Object.keys(all[scope]).length) delete all[scope];
    localStorage.setItem(LS_DRAFTS, JSON.stringify(all));
    paintLibrary();
  }

  /* ── STAR 입력 보관 ──────────────────────────────────────────
     사용자가 S/T/A/R 칸에 직접 적은 경험. 초안과 같은 규약(localStorage · 회사별)이되
     **문항마다 따로** 담는다 — 문항이 셋이면 보통 다른 경험 셋을 쓰기 때문이다.
     한 벌만 두면 문항 2를 쓰다가 문항 1의 경험을 덮어쓴다.

     이 값은 AI 초안의 재료가 된다. 활동 목록(이름·기간·역할)만으로는 '무슨 일이
     있었는지' 를 알 수 없어서 모델이 그 자리를 관용구로 메웠고, 그래서 "노력했고 잘
     마무리했습니다" 같은 문단이 나왔다(draft-coach.js 주석). */
  const LS_STAR = 'careerly_jd_star_v1';
  const STAR_KEYS = ['S', 'T', 'A', 'R'];

  function loadStars() {
    try { return JSON.parse(localStorage.getItem(LS_STAR)) || {}; } catch { return {}; }
  }
  const starSlot = tabKey => `${draftScope()}::${tabKey}`;

  function getStar(tabKey) {
    const v = loadStars()[starSlot(tabKey)];
    return (v && typeof v === 'object') ? v : {};
  }
  function saveStar(tabKey, key, text) {
    const all = loadStars();
    const slot = starSlot(tabKey);
    const cur = (all[slot] && typeof all[slot] === 'object') ? all[slot] : {};
    if (text.trim()) cur[key] = text;
    else delete cur[key];                       // 비우면 흔적을 남기지 않는다(초안과 같은 규칙)
    if (Object.keys(cur).length) all[slot] = cur;
    else delete all[slot];
    localStorage.setItem(LS_STAR, JSON.stringify(all));
  }

  /* 지금 탭의 STAR 를 { S,T,A,R } 로. 한 칸도 안 썼으면 null 을 준다 —
     빈 객체를 보내면 서버가 "STAR 가 있다" 고 보고 활동 목록 쪽 안내를 끈다. */
  function currentStar() {
    const tab = (_lastTabs || [])[_tab];
    if (!tab) return null;
    const v = getStar(tab.key);
    return STAR_KEYS.some(k => (v[k] || '').trim()) ? v : null;
  }

  /* ── 보관함 ────────────────────────────────────────────────
     초안은 예전에도 저장은 됐지만, 분석을 다시 돌리기 전에는 **화면에 꺼낼 방법이
     없었다**. 어제 쓴 글이 어디 있는지 알 수 없으면 저장한 것이 아니다.
     그래서 회사별로 모아 보여주고, 여기서 바로 열어 읽고 복사할 수 있게 한다. */
  const timeAgo = at => {
    if (!at) return '';
    const m = Math.floor((Date.now() - at) / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    return d < 30 ? `${d}일 전` : new Date(at).toLocaleDateString('ko-KR');
  };

  function libraryEntries() {
    const all = loadDrafts();
    return Object.entries(all).map(([company, items]) => ({
      company,
      drafts: Object.entries(items)
        .map(([label, v]) => ({ label, ...unwrap(v) }))
        .filter(d => d.text.trim())
        .sort((a, b) => (b.at || 0) - (a.at || 0)),
    })).filter(g => g.drafts.length)
      .sort((a, b) => (b.drafts[0].at || 0) - (a.drafts[0].at || 0));
  }

  let _libOpen = null;      // 지금 펼쳐 본 초안 키 (회사::항목)

  function paintLibrary() {
    const box = $('#jd-library');
    if (!box) return;
    const groups = libraryEntries();
    if (!groups.length) { box.hidden = true; box.innerHTML = ''; return; }

    const total = groups.reduce((n, g) => n + g.drafts.length, 0);
    box.hidden = false;
    box.innerHTML = `
      <div class="co-sec-h">
        <h2>내 자소서 보관함</h2>
        <span class="co-src">${groups.length}개 회사 · 초안 ${total}건 · 이 브라우저에만 저장됩니다</span>
      </div>
      <div class="jd-lib">
        ${groups.map(g => `
          <div class="jd-lib-group">
            <div class="jd-lib-company">
              <span class="wf-avatar wf-avatar--sm" style="--co-color:${accentOf(g.company)}">${esc(g.company.charAt(0))}</span>
              <b>${esc(g.company)}</b>
              <span class="wf-badge wf-badge--mute">${g.drafts.length}건</span>
              <button type="button" class="wf-btn wf-btn--xs" data-lib-open="${esc(g.company)}">이 회사로 이어쓰기</button>
            </div>
            ${g.drafts.map(d => {
              const key = `${g.company}::${d.label}`;
              const open = _libOpen === key;
              return `<div class="jd-lib-item ${open ? 'is-open' : ''}">
                <button type="button" class="jd-lib-h" data-lib-toggle="${esc(key)}">
                  <b>${esc(d.label)}</b>
                  <span class="jd-lib-meta">${d.text.length.toLocaleString()}자${d.at ? ` · ${timeAgo(d.at)}` : ''}</span>
                  <i class="ti ti-chevron-down jd-block-chev"></i>
                </button>
                ${open ? `<div class="jd-lib-body">
                  <pre class="jd-lib-text">${esc(d.text)}</pre>
                  <div class="jd-lib-act">
                    <button type="button" class="wf-btn wf-btn--xs" data-lib-copy="${esc(key)}">복사</button>
                    <button type="button" class="wf-btn wf-btn--xs" data-lib-del="${esc(key)}">삭제</button>
                  </div>
                </div>` : ''}
              </div>`;
            }).join('')}
          </div>`).join('')}
      </div>`;

    bindLibrary(box);
  }

  /* 회사명 색은 회사 리포트 화면과 같은 규칙으로 고른다(같은 회사 = 같은 색). */
  const LIB_ACCENTS = ['#7a3dff', '#ed52cb', '#3b89ff', '#ff6b00', '#00a83a'];
  function accentOf(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 9973;
    return LIB_ACCENTS[h % LIB_ACCENTS.length];
  }

  function draftAt(key) {
    const [company, label] = key.split('::');
    return unwrap(loadDrafts()[company]?.[label]).text;
  }

  function bindLibrary(box) {
    box.querySelectorAll('[data-lib-toggle]').forEach(el =>
      el.addEventListener('click', () => {
        _libOpen = _libOpen === el.dataset.libToggle ? null : el.dataset.libToggle;
        paintLibrary();
      }));

    box.querySelectorAll('[data-lib-copy]').forEach(el =>
      el.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(draftAt(el.dataset.libCopy));
          el.textContent = '복사됨';
          setTimeout(() => { el.textContent = '복사'; }, 1500);
        } catch { el.textContent = '복사 실패'; }
      }));

    box.querySelectorAll('[data-lib-del]').forEach(el =>
      el.addEventListener('click', () => {
        const [company, label] = el.dataset.libDel.split('::');
        /* 지우면 되돌릴 수 없다 — 자소서는 다시 쓰기 어려운 글이라 한 번 묻는다. */
        if (!confirm(`${company} · ${label} 초안을 지울까요? 되돌릴 수 없어요.`)) return;
        const all = loadDrafts();
        delete all[company]?.[label];
        if (all[company] && !Object.keys(all[company]).length) delete all[company];
        localStorage.setItem(LS_DRAFTS, JSON.stringify(all));
        _libOpen = null;
        paintLibrary();
      }));

    /* 그 회사로 이어쓰기 — 회사명을 채우면 저장 칸(scope)이 그 회사로 바뀌므로
       분석을 다시 돌렸을 때 예전 초안이 그대로 불러와진다. */
    box.querySelectorAll('[data-lib-open]').forEach(el =>
      el.addEventListener('click', () => {
        const input = $('#jd-company');
        if (!input) return;
        input.value = el.dataset.libOpen;
        input.dispatchEvent(new Event('input'));
        STEPS.forEach(paintBlock);
        paintProgress();
        $('#jd-doc')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
  }

  /* 회사 리포트 화면(company-cover.js)에서 담은 근거를 같은 키로 읽는다.
     지원동기 문항은 공고가 아니라 이 사실들로 쓴다. */
  /* 담은 근거는 Roadmap 이 들고 있다(흐름 상태). 예전에는 이 파일이 localStorage
     키를 직접 파싱했는데, 3단계에서 모양을 바꾸면 여기는 조용히 빈 목록을 봤다. */
  function evidenceFor(company) {
    return Roadmap.evidenceOf(company);
  }
  /* 채용공고만 — 아래 applyPickedJob 은 '지원할 공고' 하나를 쓴다.
     사업 내용·기사까지 섞여 들어오면 공고 칸에 기사 제목이 들어간다. */
  const pickedJobs = company => evidenceFor(company).filter(e => e.kind === 'job');

  const SAMPLE = `[주요업무]
- 채널별 마케팅 성과 데이터 분석 및 리포트 작성
- 유관부서와 협업하여 프로모션 기획 및 실행
[자격요건]
- 데이터를 근거로 문제를 정의하고 개선안을 제안할 수 있는 분
- 엑셀·SQL 등 데이터 도구 활용 가능자
[우대사항]
- 고객 니즈 파악 및 UX 개선 경험
- 영어 커뮤니케이션 가능자`;

  const SAMPLE_QUESTIONS = `1. 지원 동기와 입사 후 포부를 기술해 주십시오.
2. 직무 수행에 필요한 역량을 갖추기 위해 노력한 경험을 서술해 주십시오.
3. 팀으로 일하며 갈등을 해결한 경험을 기술해 주십시오.`;

  /* ══ 입력부 — 문서형 에디터 ═══════════════════════════════ */

  const STEPS = [
    { id: 'jd-step-company',     label: '지원 회사',   input: '#jd-company',   optional: true  },
    { id: 'jd-step-posting',     label: '채용공고',    input: '#jd-text',      optional: false },
    { id: 'jd-step-description', label: '직무기술서',  input: '#jd-jd',        optional: true  },
    { id: 'jd-step-questions',   label: '자소서 문항', input: '#jd-questions', optional: true  },
  ];

  const valueOf = sel => ($(sel)?.value || '').trim();

  /* 내용만큼 자란다. scrollHeight 를 그대로 쓰면 지울 때 줄어들지 않으므로
     먼저 auto 로 되돌린 뒤 잰다. 전체화면일 때는 CSS 가 높이를 맡는다. */
  function autoGrow(el) {
    if (!el || el.closest('.jd-block')?.classList.contains('is-full')) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function blockOf(step) { return document.getElementById(step.id); }

  /* 접힌 칸의 미리보기 — 두 줄까지. CSS 가 line-clamp 로 자른다. */
  function paintPeek(step) {
    const block = blockOf(step);
    const peek = block?.querySelector('[data-peek]');
    if (!peek) return;
    const v = valueOf(step.input);
    if (v) {
      peek.textContent = v.replace(/\s+/g, ' ').slice(0, 300);
      peek.classList.remove('jd-block-peek--empty');
    } else {
      peek.textContent = step.optional ? '아직 비어 있어요 (선택 항목)' : '아직 비어 있어요';
      peek.classList.add('jd-block-peek--empty');
    }
  }

  function paintBlock(step) {
    const block = blockOf(step);
    if (!block) return;
    const v = valueOf(step.input);
    block.classList.toggle('is-filled', Boolean(v));

    const count = block.querySelector('[data-count]');
    if (count) count.textContent = v ? `${v.length.toLocaleString()}자` : '';

    const stat = block.querySelector('[data-stat]');
    if (stat) {
      const lines = v ? v.split(/\r?\n/).filter(s => s.trim()).length : 0;
      /* 문단 수까지 세는 건 붙여넣기가 제대로 됐는지 확인하는 자리라서다 —
         공고를 통째로 복사하면 문단이 여러 개 잡히고, 한 줄만 들어오면 1개로 나온다. */
      const paras = v ? v.split(/\n\s*\n/).filter(s => s.trim()).length : 0;
      stat.textContent = v
        ? `${v.length.toLocaleString()}자 · ${lines}줄${paras > 1 ? ` · 문단 ${paras}개 인식됨` : ''}`
        : '아직 비어 있어요';
    }

    /* 1번 칸은 글자수가 의미 없다(회사명 한 개다). 대신 채웠는지 여부를 배지로 말한다. */
    const badge = block.querySelector('[data-badge]');
    if (badge) {
      badge.textContent = v ? '입력됨' : '선택';
      badge.className = v ? 'wf-badge wf-badge--ok' : 'wf-badge wf-badge--mute';
    }

    const toggleLabel = block.querySelector('[data-toggle-label]');
    if (toggleLabel) toggleLabel.textContent = block.classList.contains('is-open') ? '접기' : '펼치기';

    paintPeek(step);
  }

  /* 진행도 — 사이드바의 '입력 항목' 목록이 겸한다. 각 칸은 채웠나/비었나 두 상태뿐이라
     퍼센트 막대를 그리지 않고 **체크 표시**로 둔다(55% 가 무슨 뜻인지 설명할 수 없다). */
  function paintProgress() {
    const box = $('#jd-progress-steps');
    if (!box) return;
    box.innerHTML = STEPS.map((s, i) => {
      const v = valueOf(s.input);
      const open = blockOf(s)?.classList.contains('is-open');
      const cls = v ? 'is-done' : open ? 'is-active' : '';
      const meta = v
        ? (i === 0 ? esc(v) : `${v.length.toLocaleString()}자`)
        : '비어 있음';
      return `<button type="button" class="jd-pstep ${cls}" data-goto="${i}">
        <span class="jd-pstep-mark"></span>
        <span class="jd-pstep-t"><b>${i + 1} ${esc(s.label)}</b><small>${meta}</small></span>
      </button>`;
    }).join('');

    box.querySelectorAll('[data-goto]').forEach(btn =>
      btn.addEventListener('click', () => openStep(Number(btn.dataset.goto), true)));

    /* 분석 준비 — 항목별 점이 '이 칸을 채웠나'라면, 이 막대는 '전체가 얼마나 찼나'다.
       분석을 돌릴 수 있는지도 같이 알린다. 버튼을 눌러 보고 나서 "공고를 넣으세요"를
       만나면 늦다. */
    const done = STEPS.filter(s => valueOf(s.input)).length;
    /* ── '공고 필수' 를 풀었다 ────────────────────────────────────
       예전에는 공고 30자가 없으면 아무것도 못 했다. 그런데 **공고를 못 구하는 것이
       보통이다** — 대기업 공채는 자사 채용 사이트로만 올라와서 워크넷·잡알리오에
       안 잡히고, 3단계에서 회사를 골라 와도 넘어오는 것은 회사 이름뿐인 일이 많다.
       그 상태로 입구를 잠가 두면 로드맵 3→4 가 대부분의 경우 거기서 끊긴다.

       대신 **무엇으로 시작했는지에 따라 나오는 것이 다르다**고 화면이 말한다.
       공고가 있으면 역량까지, 회사 근거만 있으면 지원동기까지. 같은 버튼이 같은
       결과를 낸다고 믿게 두면 안 된다. */
    const hasPosting = valueOf('#jd-text').length >= 30;
    const evCount = evidenceFor(valueOf('#jd-company')).length;
    const canRun = hasPosting || evCount > 0;

    const bar = $('#jd-ready-fill');
    if (bar) {
      bar.style.width = `${(done / STEPS.length) * 100}%`;
      bar.parentElement.classList.toggle('is-ready', canRun);
    }
    const ready = $('#jd-ready');
    if (ready) {
      ready.innerHTML = hasPosting
        ? `${STEPS.length}개 중 <b>${done}개</b> 입력됨.${
            valueOf('#jd-questions') ? '' : ' 문항까지 넣으면 문항별 배분까지 나와요.'}`
        : evCount
          ? `담아 온 회사 근거 <b>${evCount}건</b>으로 <b>지원동기</b>부터 쓸 수 있어요.
             공고를 넣으면 <b>직무역량</b> 문항까지 분석합니다.`
          : `<b>채용공고</b>를 넣거나, 회사 리포트에서 <b>근거를 담아</b> 오세요.`;
    }
  }

  function openStep(i, scroll) {
    const step = STEPS[i];
    const block = blockOf(step);
    if (!block) return;
    block.classList.add('is-open');
    paintBlock(step);
    paintProgress();
    if (scroll) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const el = $(step.input);
    if (el) { autoGrow(el); el.focus({ preventScroll: true }); }
  }

  function toggleBlock(block) {
    block.classList.toggle('is-open');
    if (block.classList.contains('is-open')) {
      const ta = block.querySelector('[data-grow]');
      if (ta) autoGrow(ta);
    }
    const step = STEPS[Number(block.dataset.step)];
    if (step) paintBlock(step);          // '펼치기 ↔ 접기' 문구를 같이 바꾼다
    paintProgress();
  }

  /* 넓게 보기 — 긴 공고를 통째로 확인하는 자리. Esc 로 닫힌다. */
  function setFull(block, on) {
    document.querySelectorAll('.jd-block.is-full').forEach(b => {
      if (b !== block) b.classList.remove('is-full');
    });
    block.classList.toggle('is-full', on);
    block.classList.add('is-open');
    const scrim = $('#jd-scrim');
    if (scrim) scrim.hidden = !on;
    const btn = block.querySelector('[data-full]');
    if (btn) btn.textContent = on ? '닫기' : '전체화면';
    const ta = block.querySelector('[data-grow]');
    if (ta) { if (on) ta.style.height = ''; else autoGrow(ta); ta.focus({ preventScroll: true }); }
  }

  function closeFull() {
    const open = document.querySelector('.jd-block.is-full');
    if (open) setFull(open, false);
  }

  /* 회사 리포트에서 담아 온 **공고** — 1번 칸 안에 그대로 보여준다.
     예전에는 기사·실적을 담았는데, 담은 것들이 서로 다른 종류라 여기 와서 무엇에
     쓰라는 것인지 알 수 없었다. 지금은 '지원할 공고' 하나만 담긴다. */
  function paintEvidence() {
    const box = $('#jd-evidence');
    if (!box) return;
    const company = ($('#jd-company')?.value || '').trim();
    const list = evidenceFor(company);

    if (!company) {
      box.innerHTML = `<p class="jd-hint" style="padding:0 16px 16px">회사명을 적으면 초안이 회사별로 나뉘어 저장돼요.
        회사 리포트에서 근거를 담아 오면 여기에 나타나고, 아래 채용공고 칸도 함께 채워집니다.</p>`;
      return;
    }

    /* ── 종류별로 나눠 보여준다 ──────────────────────────────────
       한 통에 섞어 놓으면 "담긴 건 알겠는데 무엇을 어디에 쓰라는 거지" 가 된다 —
       담기를 한 번 좁혔던 이유가 정확히 그것이었다. 종류마다 **어느 문항에 쓰는지**를
       같이 적는 것이 넓히기의 전제 조건이다. */
    const groups = Roadmap.evidenceByKind(company);
    box.innerHTML = `
      <div style="padding:0 16px 16px">
        <span class="wf-eyebrow">${esc(company)} · 담은 근거 ${list.length}건</span>
        ${groups.length ? `
          <div class="jd-ev-groups">
            ${groups.map(g => `
              <div class="jd-ev-group">
                <div class="jd-ev-h">
                  <b>${esc(g.label)}</b>
                  <span class="wf-badge wf-badge--mute">${g.items.length}건</span>
                  <span class="jd-ev-use">${esc(g.use.join(' · '))} 문항에 씁니다</span>
                </div>
                <div class="co-picked">
                  ${g.items.map(e => `<div class="co-picked-item"><span>
                    <b>${esc(e.text.length > 160 ? e.text.slice(0, 160) + '…' : e.text)}</b>
                    ${e.qualification || e.preference
                      ? ` <span class="wf-badge wf-badge--ok">지원자격 포함</span>` : ''}
                    ${[e.source, ...[e.region, e.career, e.edu]].filter(Boolean).length
                      ? `<br><span style="color:var(--wf-mute)">${[e.source, e.region, e.career, e.edu].filter(Boolean).map(esc).join(' · ')}</span>`
                      : ''}
                    ${e.url ? ` <a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">원문 열기</a>` : ''}
                  </span></div>`).join('')}
                </div>
              </div>`).join('')}
          </div>`
          : `<p class="jd-hint">아직 없어요. <b>회사 리포트</b>의 개요·재무·최근 이슈·채용공고 칸에서
               <b>자소서에 담기</b>를 누르면 여기로 넘어옵니다.</p>`}
      </div>`;
  }

  /* ── 담아 온 공고를 채용공고 칸에 적용한다 ───────────────────
     회사명만 넘겨받던 것을 공고까지 넘겨받도록 바꿨다. 다만 **본문은 못 받는다** —
     사람인·워크넷 API 둘 다 제목·근무지·경력·학력만 주고 공고 본문은 주지 않는다.
     그래서 받은 것만 적어 두고, 본문은 링크를 열어 붙여넣게 안내한다.

     이미 입력한 내용이 있으면 덮지 않는다. 사용자가 직접 붙여넣은 공고가
     자동 입력으로 지워지면 되돌릴 방법이 없다. */
  /* 담아 온 공고로 '채용공고' 칸을 채운다.

     ── 소스에 따라 채워지는 정도가 다르다 (B20) ──
     사람인·워크넷 목록 API 는 제목·조건만 준다. 그것만으로 분석을 돌리면 역량이
     빈약하게 나오는데, 그걸 '분석 결과'로 믿으면 안 되므로 본문을 붙여넣으라고 알린다.

     공공기관 채용정보(잡알리오)는 **지원자격·우대사항이 구조화돼서 온다.** 그 공고는
     복사·붙여넣기 없이 바로 분석이 된다 — `jd-competency.js` 가 읽는 것이 정확히
     이런 자격요건·우대사항 문장이다.

     반환값으로 '어디까지 채웠는지'를 알려준다. 호출부가 안내 문구를 고르는 데 쓴다 —
     본문이 들어갔는데도 "본문을 붙여넣으세요"라고 하면 안 된다. */
  function applyPickedJob(company) {
    const job = pickedJobs(company)[0];
    const ta = $('#jd-text');
    if (!job || !ta || ta.value.trim()) return null;

    const head = [
      `[모집분야] ${job.text}`,
      job.region ? `[근무지] ${job.region}` : null,
      job.career ? `[경력] ${job.career}` : null,
      job.edu ? `[학력] ${job.edu}` : null,
    ].filter(Boolean);

    /* 원문을 그대로 싣는다 — 요약하지 않는다. 요약은 없는 사실을 만들고, 학생은
       그걸 자소서에 쓴다(11-2 와 같은 원칙). */
    const body = [
      job.qualification ? `[자격요건]\n${job.qualification}` : null,
      job.preference ? `[우대사항]\n${job.preference}` : null,
    ].filter(Boolean);

    const tail = job.url ? [`[공고 주소] ${job.url}`] : [];

    ta.value = [...head, ...body, ...tail].join('\n');
    return body.length ? 'full' : 'head';
  }

  function init() {
    const runBtn = $('#jd-run');
    if (runBtn) runBtn.addEventListener('click', run);

    const sampleBtn = $('#jd-sample');
    if (sampleBtn) sampleBtn.addEventListener('click', () => {
      $('#jd-text').value = SAMPLE;
      $('#jd-questions').value = SAMPLE_QUESTIONS;
      STEPS.forEach(s => { blockOf(s)?.classList.add('is-open'); paintBlock(s); });
      document.querySelectorAll('#jd-doc [data-grow]').forEach(autoGrow);
      paintProgress();
      $('#jd-text').focus();
    });

    // 접기·펼치기
    document.querySelectorAll('#jd-doc [data-toggle]').forEach(btn =>
      btn.addEventListener('click', () => toggleBlock(btn.closest('.jd-block'))));

    // 넓게 보기
    document.querySelectorAll('#jd-doc [data-full]').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const block = btn.closest('.jd-block');
        setFull(block, !block.classList.contains('is-full'));
      }));
    const scrim = $('#jd-scrim');
    if (scrim) scrim.addEventListener('click', closeFull);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFull(); });

    // 자라는 입력칸 + 진행도 갱신
    STEPS.forEach(step => {
      const el = $(step.input);
      if (!el) return;
      el.addEventListener('input', () => {
        autoGrow(el);
        paintBlock(step);
        paintProgress();
      });
      /* 입력칸 안에서 Ctrl+Enter 로 바로 분석. 칸 아래에 그렇게 적어 뒀으므로
         실제로 되게 해 둔다 — 안 되는 안내를 띄우면 그 화면 전체를 못 믿게 된다. */
      el.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      });
    });

    /* 회사명을 고치면 앞 회사의 결과를 지운다. 남겨 두면 새 회사의 자료인 줄 알고
       그 기사를 지원동기에 쓴다. 초안 저장 칸(scope)도 회사명을 따라가므로 같이 다시 그린다. */
    const companyEl = $('#jd-company');
    if (companyEl) {
      let t = null;
      companyEl.addEventListener('input', () => {
        const box = $('#jd-result');
        if (box && !box.hidden) { box.hidden = true; box.innerHTML = ''; }
        paintEvidence();
        clearTimeout(t);
        t = setTimeout(() => fillCompanyOptions(companyEl.value), 250);
      });
    }

    /* 회사 리포트로 넘어갈 때 지금 적은 회사명을 들고 간다 —
       이름을 다시 치게 하지 않는다. (인라인 onclick 대신 여기서 묶는다) */
    document.querySelectorAll('#jd-step-company .wf-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const name = ($('#jd-company')?.value || '').trim();
        if (name) localStorage.setItem('careerly_company_open', name);
        navigate('company');
      }));
  }

  async function fillCompanyOptions(q) {
    const dl = $('#jd-company-options');
    if (!dl) return;
    const query = (q || '').trim();
    if (query.length < 2) { dl.innerHTML = ''; return; }
    const items = await DB.suggestCompanies(query).catch(() => []);
    if (dl.dataset.q && dl.dataset.q !== query) return;   // 늦게 온 응답으로 덮지 않는다
    dl.dataset.q = query;
    dl.innerHTML = items.map(i => `<option value="${esc(i.name)}"></option>`).join('');
  }

  /* 페이지에 들어올 때마다 — 지난번 분석 결과를 지우고 들어온다. 안 지우면 다른 회사를
     보러 다시 들어와도 이전 회사의 역량·문항이 그대로 남아 새 결과인 줄 알고 읽게 된다. */
  function onEnter() {
    Roadmap.mount('rm-bar-jd', 'cover');
    const result = $('#jd-result');
    if (result) { result.hidden = true; result.innerHTML = ''; }
    const status = $('#jd-status');
    if (status) status.textContent = '';
    closeFull();

    /* 3단계에서 회사를 골라 왔으면 그것을 쓰고, 아니면 로드맵에 남아 있는 회사를
       되살린다 — 자소서를 며칠에 걸쳐 쓰는 동안 회사 칸이 매번 비어 있으면
       흐름이 화면을 나갈 때마다 끊긴다. */
    const picked = localStorage.getItem('careerly_selected_company') || Roadmap.company();
    let applied = null;        // null | 'head'(제목·조건만) | 'full'(자격요건까지)
    if (picked && $('#jd-company')) {
      $('#jd-company').value = picked;
      localStorage.removeItem('careerly_selected_company');
      /* 담아 온 공고가 있으면 채용공고 칸까지 채운다 — 회사만 넘기면 여기서
         공고를 다시 찾아야 해서, 담기를 한 의미가 없다. */
      applied = applyPickedJob(picked);
    }

    STEPS.forEach(paintBlock);
    document.querySelectorAll('#jd-doc [data-grow]').forEach(autoGrow);
    paintEvidence();
    paintProgress();
    paintLibrary();

    /* 어디까지 채워졌는지에 따라 다르게 알린다.
         head — 제목·조건만
         full — 지원자격·우대사항까지 들어왔다
       둘 다 '본문을 이어붙이라'고 말하는 것은 같다. 공공기관 공고의 지원자격은
       **응시 요건**이지 역량 서술이 아니라, 그것만으로는 역량이 잘 안 잡힌다(실측
       532건 중 절반이 0개). 채워졌다고 다 된 것처럼 말하지 않는다. */
    if (applied) {
      openStep(1, true);
      if (typeof toast === 'function') {
        toast(applied === 'full'
          ? '공고를 지원자격까지 불러왔어요 — 역량까지 보려면 본문을 이어붙이세요'
          : '공고를 불러왔어요 — 본문을 복사해 이어붙이면 역량이 정확해져요', { icon: false });
      }
    }
  }

  /* 공고와 직무기술서를 합쳐 하나의 분석 입력으로 만든다.
     둘을 나눠 받는 건 사용자가 헷갈리지 않게 하기 위해서고, 역량 추출은 두 문서를
     같이 읽어야 정확해진다(공고에만 있는 우대사항, JD 에만 있는 업무 상세가 있다).
     구분선을 넣어 서버 문장 분리가 두 문서를 한 문장으로 잇지 않게 한다. */
  function analysisText() {
    const jd = valueOf('#jd-jd');
    const ad = valueOf('#jd-text');
    return [ad, jd].filter(Boolean).join('\n\n');
  }

  /* '1. …' / '- …' / 빈 줄로 나뉜 문항을 한 줄씩 끊는다. 번호는 표시할 때
     우리가 다시 붙이므로 떼어낸다. */
  function parseQuestions() {
    return ($('#jd-questions')?.value || '')
      .split(/\r?\n/)
      .map(s => s.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
      .filter(s => s.length >= 5);
  }

  async function run() {
    const btn = $('#jd-run');
    const statusEl = $('#jd-status');
    const resultEl = $('#jd-result');
    const text = analysisText();

    /* 공고가 없으면 담아 온 회사 근거로 간다. 서버는 역량 추출을 건너뛰고
       안내 문구(disclaimer·checklist)만 준다 — 그 문장들의 단일 출처가 서버라
       프론트에 복사해 두면 한쪽만 고쳐진다. */
    if (text.length < 30) {
      const company = valueOf('#jd-company');
      if (!evidenceFor(company).length) {
        statusEl.textContent = company
          ? '채용공고를 30자 이상 넣거나, 회사 리포트에서 근거를 담아 오세요.'
          : '채용공고를 30자 이상 넣어 주세요.';
        openStep(1, true);
        return;
      }
      return runFromEvidence(company);
    }

    btn.disabled = true;
    /* AI 보강은 항상 켠다(끄는 토글을 없앴다). 규칙만 쓰면 즉시 끝나지만
       AI 보강이 붙으면 로컬 모델에서 1분 이상 걸릴 수 있어 그 이유를 적어둔다 —
       안 그러면 사용자가 멈춘 줄 안다. */
    statusEl.textContent = '공고를 읽고 있어요… (1분 이상 걸릴 수 있어요)';
    resultEl.hidden = true;

    try {
      _last = await DB.coachJd(text, { useAi: true, company: valueOf('#jd-company') });
      statusEl.textContent = '';
      _focused = 0; _tab = 0;
      render(_last);
      /* 결과가 나오면 입력칸을 접는다 — 다 쓴 입력이 화면을 차지하고 있으면
         결과를 보려고 매번 그만큼을 스크롤해서 지나가야 한다. */
      STEPS.forEach(s => blockOf(s)?.classList.remove('is-open'));
      STEPS.forEach(paintBlock);
      paintProgress();
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      statusEl.textContent = '';
      resultEl.hidden = false;
      resultEl.innerHTML = `<div class="jd-err">${esc(e.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  }

  /* ── 공고 없이 시작하기 ──────────────────────────────────────
     담아 온 회사 근거만으로 지원동기부터 쓴다. 서버는 작성 기준만 주고 역량은
     주지 않는다 — 역량은 공고에서 나오는 값이라, 없는데 지어 주면 근거 없는
     목록이 된다(routes/jdCoach.js /guide 주석).

     ── 문항이 없으면 하나를 깔아 준다 ──
     문항 칸이 비어 있으면 탭이 없어서 "쓸 문항이 없어요" 만 뜬다. 회사 근거를
     담아 온 사람에게 그건 막다른 길이라, 지원동기 문항 하나를 기본으로 깐다.
     사용자가 자기 문항을 넣으면 그것으로 바뀐다. */
  const DEFAULT_MOTIVE_Q = '지원 동기와 입사 후 포부를 기술해 주십시오.';

  async function runFromEvidence(company) {
    const btn = $('#jd-run');
    const statusEl = $('#jd-status');
    const resultEl = $('#jd-result');

    btn.disabled = true;
    statusEl.textContent = '담아 온 근거로 작성 기준을 준비하는 중…';
    resultEl.hidden = true;

    try {
      _last = await DB.guideJd(company);
      statusEl.textContent = '';
      _focused = 0; _tab = 0;
      /* 문항 칸이 비어 있으면 기본 문항을 실제로 **써 넣는다**. 화면에만 띄우고
         입력칸을 비워 두면, 사용자가 문항을 고치려 할 때 어디를 고쳐야 할지 모른다. */
      if (!parseQuestions().length && $('#jd-questions')) {
        $('#jd-questions').value = DEFAULT_MOTIVE_Q;
        paintBlock(STEPS[3]);
      }
      render(_last);
      STEPS.forEach(s => blockOf(s)?.classList.remove('is-open'));
      STEPS.forEach(paintBlock);
      paintProgress();
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      statusEl.textContent = '';
      resultEl.hidden = false;
      resultEl.innerHTML = `<div class="jd-err">${esc(e.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  }

  /* ── 문항별 키워드 ───────────────────────────────────────────
     문항 문장과 역량을 맞춰 "이 문항에는 이 역량을, 내 경험 중 이걸로" 를 정리한다.

     **AI 를 부르지 않는다.** 문항 유형은 회사가 달라도 몇 가지로 수렴하고(지원동기·
     직무역량·협업·도전·성장), 유형만 맞히면 어떤 역량을 붙일지는 규칙으로 정해진다.
     AI 에 시키면 문항마다 다른 말이 나와서 같은 문항을 두 번 분석하면 답이 달라지고,
     학생은 어느 쪽이 맞는지 알 수 없게 된다. 지어낸 소재를 자소서에 쓰는 위험도 같다.

     역량 매칭은 서버가 이미 뽑아준 items(공고 근거가 붙어 있는 것)에서만 고른다 —
     화면에 없는 역량을 문항에 붙이면 근거를 추적할 수 없다.

     ── 순서가 규칙의 일부다 ──
     첫 번째로 걸리는 유형을 쓴다. 그래서 **좁은 유형을 먼저, 넓은 유형을 뒤에** 둔다.
     '직무역량'은 단어가 넓어서 앞에 두면 협업·도전 문항까지 다 삼킨다.

     ── '기술' 을 단어로 쓰면 안 된다 ──
     처음에 직무역량 규칙에 '기술' 을 넣었다가 테스트에서 걸렸다. 자소서 문항은 대부분
     "~을 기술하시오 / 기술해 주십시오" 로 끝나서, 협업·도전·성장 문항이 전부 직무역량으로
     분류됐다. 기술(技術)을 뜻하려면 뒤에 오는 말까지 같이 봐야 한다. */
  const QUESTION_TYPES = [
    { id: 'motive', label: '지원동기', match: /지원\s*(동기|이유)|왜\s*우리|입사\s*후|포부|비전|기여/,
      pick: 'news',
      how: '회사 최근 소식에서 사실 하나를 고르고 → 그 일이 왜 어려운지 → 내 경험과 맞닿는 지점 → 맡고 싶은 일 순서로 씁니다.' },
    { id: 'collab', label: '협업·갈등', match: /협업|갈등|팀|소통|설득|의견\s*차이|함께/,
      pick: 'soft',
      how: '갈등의 원인을 먼저 정의하고, 내가 한 행동과 그 결과를 숫자로 씁니다. 상대를 탓하면 감점입니다.' },
    { id: 'challenge', label: '도전·실패', match: /도전|실패|어려움|극복|한계|위기|문제\s*해결/,
      pick: 'top',
      how: '무엇이 왜 어려웠는지를 먼저 쓰고, 시도한 것 중 안 된 것까지 씁니다. 성공만 쓰면 도전이 아닙니다.' },
    { id: 'growth', label: '성장과정·가치관', match: /성장\s*과정|가치관|영향을\s*준|좌우명|인생/,
      pick: 'soft',
      how: '사건 하나만 씁니다. 그 사건이 지금 지원 직무의 어떤 태도로 이어졌는지로 닫습니다.' },
    /* 가장 넓은 규칙이라 맨 뒤에 둔다 — 위에서 안 걸린 문항의 기본값 역할을 겸한다. */
    { id: 'competency', label: '직무역량',
      match: /역량|직무|전문성|준비\s*과정|노력한\s*경험|강점|스킬|전문\s*지식|기술\s*(스택|력|적\s*역량)/,
      pick: 'top',
      how: '공고가 가장 많이 요구하는 역량부터 씁니다. 역량 이름을 쓰지 말고 그 역량을 쓴 상황을 씁니다.' },
  ];

  const SOFT_HINT = /협업|소통|커뮤니케이션|리더|조율|설득|책임|주도|갈등/;

  function classifyQuestion(q) {
    return QUESTION_TYPES.find(t => t.match.test(q)) || null;
  }

  /* 문항 유형 → 붙일 역량. 서버가 준 items 안에서만 고른다. */
  function competenciesFor(type, items) {
    if (!items?.length) return [];
    if (type?.pick === 'soft') {
      const soft = items.filter(it => SOFT_HINT.test(it.label));
      return (soft.length ? soft : items).slice(0, 2);
    }
    return items.slice(0, 3);
  }

  /* 문항 초안의 저장 키. **문항 문구가 아니라 순번**을 쓴다.
     문구를 키로 잡으면 오타 하나만 고쳐도 저장된 초안을 못 찾아 사라진 것처럼 보인다.
     자소서는 문항을 다듬어 가며 쓰는 물건이라 그 일이 실제로 자주 일어난다.
     대신 문항 순서를 바꾸면 초안이 자리에 남는데, 그건 화면에 적어 알린다. */
  const questionDraftKey = i => `문항${i + 1}`;

  /* ══ 결과부 — 좌우 2단 작업 화면 ═══════════════════════════ */

  /* 초안 탭. 문항을 넣었으면 문항이 탭이 되고(제출 단위가 문항이니까),
     안 넣었으면 역량이 탭이 된다. 어느 쪽이든 오른쪽 칸 하나에서 쓴다. */
  function tabsOf(r) {
    const questions = parseQuestions();
    if (questions.length) {
      return questions.map((q, i) => {
        const type = classifyQuestion(q);
        return {
          kind: 'question', text: q, type,
          label: `문항 ${i + 1}`, key: questionDraftKey(i),
          comps: competenciesFor(type, r.items),
        };
      });
    }
    return r.items.map(it => ({
      kind: 'item', text: it.label, type: null,
      label: it.label, key: it.label, comps: [it],
    }));
  }

  const RARITY_TEXT = {
    common: '지원자 대부분이 쓰는 역량입니다. <b>안 쓰면 감점</b>이니 반드시 넣되, 여기서 차별화되긴 어렵습니다.',
    normal: '절반 이하의 공고가 요구합니다. 근거가 있다면 <b>비중 있게</b> 쓰세요.',
    rare:   '요구하는 공고가 드뭅니다. 근거가 있다면 <b>가장 강한 차별점</b>이 됩니다.',
  };

  const hasMine = it => Boolean(it.mine?.length) && !it.gap;

  /* 역량 키워드 칩 — 왼쪽 맨 위. 눌러서 역량을 바꿔 가며 본다. */
  function keysHtml(r) {
    const ok = r.items.filter(hasMine).length;
    return `<div class="jd-comp-keys">
      <div class="jd-comp-keys-h">
        <b>요구 역량 ${r.items.length}가지</b>
        <span>내 근거 있음 ${ok} · 없음 ${r.items.length - ok}</span>
      </div>
      <div class="jd-keys">
        ${r.items.map((it, i) => `
          <button type="button" class="jd-key ${i === _focused ? 'is-on' : ''}" data-key="${i}">
            <span class="jd-key-dot ${hasMine(it) ? 'jd-key-dot--ok' : 'jd-key-dot--gap'}"></span>
            ${esc(it.label)}
            ${it.market ? `<span class="jd-key-n">${it.market.pct}%</span>` : ''}
          </button>`).join('')}
      </div>
      <p class="jd-hint">점이 <b>초록</b>이면 내 활동에 쓸 소재가 있고, <b>빨강</b>이면 아직 없습니다.
        옆 숫자는 같은 직군 공고 중 이 역량을 요구한 비율이에요.</p>
    </div>`;
  }

  function mineHtml(item) {
    if (item.gap) return `<div class="jd-gap"><i class="ti ti-alert-triangle"></i> ${esc(item.gap)}</div>`;
    if (!item.mine?.length) return '';
    return `<ul class="jd-mine">
      ${item.mine.map((m, i) => `
        <li class="${i === 0 ? 'is-top' : ''}">
          <div class="jd-mine-name">${esc(m.name)}${i === 0
            ? ' <span class="wf-badge wf-badge--ok">1순위</span>' : ''}</div>
          <div class="jd-mine-meta">${esc(m.typeLabel)}${m.duration ? ' · ' + esc(m.duration) : ''}${
            m.role ? ' · ' + esc(m.role) : ''}${
            m.outcome && m.outcome !== '결과물 없음' ? ' · ' + esc(m.outcome) : ''}</div>
        </li>`).join('')}
    </ul>`;
  }

  /* 한 역량의 상세. 펼친 것만 보이고 나머지는 머리줄만 남는다 —
     예전에는 7개가 통째로 세로로 쌓여 카드 하나가 화면보다 길었다. */
  function compHtml(item, i, qMap) {
    const m = item.market;
    const badges = qMap[i] || [];

    return `<div class="jd-comp ${i === _focused ? 'is-open' : ''}" id="jd-comp-${i}">
      <button type="button" class="jd-comp-h" data-comp="${i}">
        <span class="jd-comp-rank">${i + 1}</span>
        <span class="jd-comp-h-t">
          <b>${esc(item.label)}</b>
          <span class="jd-comp-h-meta">
            ${m ? `<span class="jd-freq jd-freq--${esc(m.rarity)}">
                     <span class="jd-freq-bar"><i style="width:${Math.min(100, m.pct)}%"></i></span>
                     <span class="jd-freq-t">${m.pct}% 요구</span>
                   </span>` : ''}
            ${hasMine(item)
              ? `<span class="wf-badge wf-badge--ok">내 소재 ${item.mine.length}건</span>`
              : `<span class="wf-badge wf-badge--error">소재 없음</span>`}
            ${badges.map(n => `<span class="wf-badge wf-badge--mute">문항 ${n}</span>`).join('')}
            <span class="wf-badge wf-badge--mute">${item.source === 'ai' ? 'AI 추출' : '공고 키워드'}</span>
          </span>
        </span>
      </button>

      <div class="jd-comp-body">
        ${m ? `<div class="jd-comp-sec">
          <span class="wf-eyebrow">시장 빈도</span>
          <p class="jd-comp-p">${esc(m.bucket)} 공고 <b>${m.sample}건</b> 중 ${m.count}건이 요구 —
            ${RARITY_TEXT[m.rarity] || ''}</p>
        </div>` : ''}

        <div class="jd-comp-sec">
          <span class="wf-eyebrow">기업이 보는 것</span>
          <p class="jd-comp-p">${esc(item.reads)}</p>
        </div>

        ${item.quotes?.length ? `<div class="jd-comp-sec">
          <span class="wf-eyebrow">공고 근거</span>
          ${item.quotes.map(q => `<div class="jd-quote">${esc(q)}</div>`).join('')}
        </div>` : ''}

        <div class="jd-comp-sec">
          <span class="wf-eyebrow">이 순서로 쓰세요</span>
          <div class="jd-frame">${esc(item.frame)}</div>
          <p class="jd-hint">${bold(item.lead)}</p>
          <div class="jd-ai-row">
            <button type="button" class="wf-btn wf-btn--sm wf-btn--primary" data-ai="${i}">
              <i class="ti ti-sparkles"></i> AI 초안 넣기
            </button>
            <span class="jd-ai-state" data-ai-state="${i}"></span>
          </div>
          <p class="jd-hint">내 활동·공고 근거·이 역량을 같이 읽고 문단을 만들어 오른쪽 작성칸에 넣습니다.
            <b>모르는 수치는 [대괄호]로 남습니다</b> — 그 자리는 본인 사실로 채우셔야 해요.</p>
        </div>

        ${(item.mine?.length || item.gap) ? `<div class="jd-comp-sec">
          <span class="wf-eyebrow">소재로 쓸 내 경험</span>
          ${mineHtml(item)}
        </div>` : ''}

        ${item.openings?.length ? `<div class="jd-comp-sec">
          <span class="wf-eyebrow">첫 문장 틀 · ${esc(item.openings[0].basedOn)} 기준</span>
          ${item.openings[0].warn
            ? `<div class="jd-gap" style="margin-bottom:8px"><i class="ti ti-alert-triangle"></i> ${esc(item.openings[0].warn)}</div>` : ''}
          <ul class="jd-openings">
            ${item.openings.map(o => `<li>
              <div class="jd-opening-label">${esc(o.label)}</div>
              <p class="jd-opening-text">${esc(o.text)}</p>
            </li>`).join('')}
          </ul>
          <p class="jd-hint"><b>[대괄호]는 직접 채우세요.</b> 채우지 않으면 문장이 되지 않습니다 —
            남은 빈칸은 오른쪽 작성칸 아래가 세어 줍니다.</p>
        </div>` : ''}

        ${item.openers?.length ? `<div class="jd-comp-sec">
          <span class="wf-eyebrow">첫 문장 여는 방법</span>
          <ul class="jd-list">${item.openers.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
        </div>` : ''}

        <div class="jd-comp-sec">
          <span class="wf-eyebrow">반드시 숫자로 바꿀 것</span>
          <ul class="jd-list">${item.numbers.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        </div>

        <div class="jd-comp-sec">
          <span class="wf-eyebrow">이렇게 쓰면 감점</span>
          <ul class="jd-list jd-list--avoid">${item.avoid.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
        </div>

        ${item.followup ? `<div class="jd-followup">
          이렇게 쓰면 면접에서 이걸 물어봅니다 — <b>“${esc(item.followup)}”</b>
        </div>` : ''}

        <!-- AI 초안이 같이 준 '채워야 할 빈칸'과 '약한 지점'이 여기에 들어온다 -->
        <div data-ai-notes="${i}"></div>
      </div>
    </div>`;
  }

  /* 오른쪽 초안 칸. 지금 고른 탭 하나만 그린다. */
  function draftHtml(r, tabs) {
    const tab = tabs[_tab] || tabs[0];
    if (!tab) {
      return `<div class="jd-draft-pane"><div class="jd-empty">쓸 문항이 없어요.
        위 <b>자소서 문항</b> 칸에 문항을 한 줄에 하나씩 넣으면 문항별로 쓸 수 있습니다.</div></div>`;
    }

    const company = valueOf('#jd-company');
    /* 지원동기 문항은 공고가 아니라 **회사 근거**가 재료다. 담아 온 것 중 이 문항
       유형에 쓰는 것만 고른다 — 종류를 안 가리고 다 올리면 지원동기 칸에 채용공고
       제목이 섞여서, 담기를 넓힌 만큼 도리어 헷갈린다(3단계 담기의 옛 실패와 같은 부류).
       무엇이 어느 문항에 쓰이는지의 단일 출처는 Roadmap.EVIDENCE_KINDS 다. */
    const isMotive = tab.type?.pick === 'news';
    const ev = tab.type ? Roadmap.evidenceFor(company, tab.type.label) : [];

    const source = isMotive
      ? `<div class="jd-qprompt-comps">
           ${ev.length
             ? ev.slice(0, 4).map(e => `<span class="wf-badge wf-badge--soft" title="${esc(e.source || '')}">${esc(e.text.slice(0, 28))}${e.text.length > 28 ? '…' : ''}</span>`).join('')
             : `<span class="wf-badge wf-badge--warn">회사 리포트에서 근거를 먼저 담으세요</span>`}
         </div>
         <!-- ── 지원동기 AI 초안 (사용자 결정) ────────────────────
              역량 문항의 AI 초안은 왼쪽 역량 카드마다 붙어 있는데, 지원동기 문항은
              왼쪽에 붙을 카드가 없다(역량이 아니라 회사 근거가 재료라서). 그래서
              문항 프롬프트 바로 아래에 둔다.

              **근거가 없으면 버튼을 만들지 않는다.** 근거 없이 부르면 모델이 회사
              이야기를 통째로 지어내는데, 그건 '대괄호로 비운다' 규칙으로도 못 막는다 —
              지어낼 재료가 프롬프트 밖(모델의 사전지식)에 있기 때문이다. -->
         ${ev.length ? `<div class="jd-motive-ai">
           <button type="button" class="wf-btn wf-btn--sm wf-btn--primary" data-motive>
             <i class="ti ti-sparkles"></i> 담은 근거로 지원동기 초안 쓰기
           </button>
           <span class="jd-draft-state" data-motive-state></span>
           <p class="jd-hint">담아 온 <b>${ev.length}건</b>만 사실로 씁니다 —
             그 밖의 회사 이야기는 대괄호로 비워서 직접 확인하게 해요.</p>
           <div data-motive-notes></div>
         </div>` : ''}`
      : `<div class="jd-qprompt-comps">
           ${tab.comps.map(c => {
             const i = r.items.indexOf(c);
             return `<button type="button" class="jd-key" data-key="${i}">
               <span class="jd-key-dot ${hasMine(c) ? 'jd-key-dot--ok' : 'jd-key-dot--gap'}"></span>
               ${esc(c.label)}</button>`;
           }).join('')}
           ${tab.comps.length > 2
             ? `<span class="wf-badge wf-badge--mute">한 문항에 역량 2개까지가 안전해요</span>` : ''}
         </div>`;

    const draft = getDraft(tab.key);

    return `<div class="jd-draft-pane">
      <div class="jd-draft-h">
        <b>내 자소서 초안</b>
        <span class="jd-draft-end">
          <span class="jd-draft-state" id="jd-draft-state"></span>
        </span>
      </div>

      <div class="jd-qtabs">
        ${tabs.map((t, i) => {
          const len = getDraft(t.key).length;
          return `<button type="button" class="jd-qtab ${i === _tab ? 'is-on' : ''}" data-tab="${i}">
            ${esc(t.label)}<span>${len ? len.toLocaleString() : '0'}</span>
          </button>`;
        }).join('')}
      </div>

      <div class="jd-qprompt">
        <div class="jd-qprompt-q">${esc(tab.text)}</div>
        ${tab.kind === 'question' ? `<p class="jd-qprompt-how">${tab.type
          ? esc(tab.type.how)
          : '문항 유형을 알아보지 못했어요. 왼쪽 역량 중 이 문항과 가까운 것을 직접 고르세요.'}</p>` : ''}
        ${source}
      </div>

      <div class="jd-draft-wrap">
        <textarea class="jd-draft-text" id="jd-draft" data-key="${esc(tab.key)}"
          placeholder="왼쪽 역량의 '이 순서로 쓰세요'를 보면서 여기에 쓰세요. 적는 대로 저장돼요.">${esc(draft)}</textarea>
      </div>

      <div class="jd-draft-foot">
        <span class="jd-draft-count" id="jd-draft-count"></span>
        <span>이 브라우저에만 저장됩니다${company ? ` · ${esc(company)} 기준` : ''}</span>
        <span class="jd-chk-row" id="jd-chk"></span>
      </div>
    </div>`;
  }

  /* STAR — 초안을 쓰는 내내 보고 있어야 하는 뼈대라 작업 화면 **위**에 둔다.
     아래에 두면 문단을 쓰다가 골격을 확인하려고 매번 스크롤을 내려야 했다. */
  function starHtml(r) {
    if (!r.star?.length) return '';
    return `<div class="jd-star-band">
      <div class="co-sec-h"><h2>모든 문항의 뼈대 — STAR</h2>
        <span class="co-src">아래 역량별 순서는 이 뼈대를 그 역량에 맞게 편 것입니다</span></div>
      <div class="jd-star-grid">
        ${r.star.map(s => `<div class="jd-star-cell">
          <div class="jd-star-key">${esc(s.key)}<span>${esc(s.label)}</span></div>
          <div class="jd-star-what">${esc(s.what)}</div>
          <div class="jd-star-check">${esc(s.check)}</div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  /* ── STAR 입력 아코디언 ──────────────────────────────────────
     위 띠가 "뼈대가 무엇인가" 를 말한다면, 여기는 **그 뼈대에 내 경험을 직접 채우는
     자리**다. AI 초안은 여기 적힌 문장을 재료로 쓴다.

     ── 왜 한 번에 하나만 펼치나 ──
     네 칸을 한꺼번에 열어 두면 화면이 길어지는 것보다 나쁜 일이 생긴다. S 를 대충 쓰고
     A 로 건너뛰게 된다. STAR 는 앞 칸이 뒤 칸의 전제라(문제를 안 적으면 행동이 왜
     필요했는지 쓸 수 없다) **순서대로 하나씩** 열리게 했다.

     ── 칸마다 나쁜 예/고친 예를 같이 보여준다 ──
     "구체적으로 쓰세요" 는 무엇을 고쳐야 하는지 알려주지 않는다. 틀린 문장과 고친
     문장을 나란히 두는 편이 훨씬 빠르다. 문구는 서버(cover-guide.STAR_WRITE)가 주고,
     **AI 프롬프트도 같은 표를 읽는다** — 따로 두면 화면이 시킨 것과 AI 가 쓴 것이 갈린다. */
  let _starOpen = 'S';
  /* 마지막 AI 되짚기 — STAR 머리줄의 '더 적을 것' 배지가 읽는다.
     칸을 고치고 다시 돌리면 새 결과로 통째로 갈린다. */
  let _starCoach = {};

  function starInputHtml(r) {
    const write = r.starWrite;
    if (!write?.length) return '';
    const tab = (_lastTabs || [])[_tab];
    if (!tab) return '';

    const saved = getStar(tab.key);
    const filled = STAR_KEYS.filter(k => (saved[k] || '').trim()).length;

    return `<div class="jd-starin">
      <div class="co-sec-h">
        <h2>여기에 내 경험을 채우세요 — ${esc(tab.label)}</h2>
        <span class="co-src">${filled}/4 칸 작성 · 이 브라우저에만 저장됩니다 ·
          <b>AI 초안 넣기</b>가 이 내용을 읽습니다</span>
      </div>
      <div class="jd-starin-steps">
        ${write.map(w => {
          const meta = (r.star || []).find(s => s.key === w.key) || {};
          const val = saved[w.key] || '';
          const on = _starOpen === w.key;
          return `
          <div class="jd-si ${on ? 'is-open' : ''}" data-si="${esc(w.key)}">
            <button type="button" class="jd-si-h" data-si-open="${esc(w.key)}">
              <span class="jd-si-key">${esc(w.key)}</span>
              <span class="jd-si-t">
                <b>${esc(meta.label || '')}</b>
                <span class="jd-si-ask">${esc(w.ask)}</span>
              </span>
              ${_starCoach[w.key]
                ? `<span class="jd-si-state is-todo" title="${esc(_starCoach[w.key])}">더 적을 것</span>`
                : `<span class="jd-si-state ${val.trim() ? 'is-done' : ''}">
                     ${val.trim() ? `${val.trim().length}자` : '미작성'}
                   </span>`}
            </button>
            <div class="jd-si-body">
              <p class="jd-si-hint">${bold(w.hint)}</p>
              <div class="jd-si-ex">
                <div class="jd-si-ex-row jd-si-ex--bad">
                  <span class="jd-si-ex-tag">이렇게 쓰면 탈락</span>
                  <p>${esc(w.bad)}</p>
                </div>
                <div class="jd-si-ex-row jd-si-ex--good">
                  <span class="jd-si-ex-tag">이렇게</span>
                  <p>${esc(w.good)}</p>
                </div>
              </div>
              <textarea class="jd-si-ta" data-si-key="${esc(w.key)}" rows="5"
                placeholder="${esc(w.ask)}">${esc(val)}</textarea>
              <div class="jd-si-foot">
                <span class="jd-si-saved" data-si-saved="${esc(w.key)}"></span>
                ${nextStarKey(w.key)
                  ? `<button type="button" class="wf-btn wf-btn--sm" data-si-next="${esc(nextStarKey(w.key))}">
                       저장하고 ${esc(nextStarKey(w.key))} 쓰기 <i class="ti ti-arrow-down"></i>
                     </button>`
                  : `<span class="jd-si-done">네 칸을 다 채웠으면 아래 <b>AI 초안 넣기</b>를 누르세요</span>`}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  const nextStarKey = k => STAR_KEYS[STAR_KEYS.indexOf(k) + 1] || null;

  /* 아코디언·자동저장. 초안 칸과 같은 규약으로 600ms 묶어 쓴다 — 글자마다
     localStorage 를 때리면 긴 문장에서 눈에 띄게 버벅인다. */
  function bindStarInput(box) {
    const tab = (_lastTabs || [])[_tab];
    if (!tab) return;

    box.querySelectorAll('[data-si-open]').forEach(el => {
      el.addEventListener('click', () => {
        const k = el.dataset.siOpen;
        _starOpen = (_starOpen === k) ? null : k;   // 열린 것을 다시 누르면 접는다
        repaintStarInput(box);
      });
    });

    box.querySelectorAll('[data-si-next]').forEach(el => {
      el.addEventListener('click', () => {
        _starOpen = el.dataset.siNext;
        repaintStarInput(box);
      });
    });

    box.querySelectorAll('[data-si-key]').forEach(ta => {
      let timer = null;
      const key = ta.dataset.siKey;
      const state = box.querySelector(`[data-si-saved="${key}"]`);
      ta.addEventListener('input', () => {
        if (state) state.textContent = '입력 중…';
        clearTimeout(timer);
        timer = setTimeout(() => {
          saveStar(tab.key, key, ta.value);
          if (state) state.textContent = `저장됨 · ${ta.value.trim().length}자`;
          /* 머리줄의 '미작성/N자' 도 같이 고친다 — 접었을 때 보이는 유일한 표시라
             안 바꾸면 다 쓰고 접었는데 '미작성' 으로 남는다. */
          const head = box.querySelector(`[data-si-open="${key}"] .jd-si-state`);
          if (head) {
            const n = ta.value.trim().length;
            head.textContent = n ? `${n}자` : '미작성';
            head.classList.toggle('is-done', Boolean(n));
          }
        }, 600);
      });
    });
  }

  /* 펼침만 바꾸는 다시 그리기. 통째로 render(r) 를 부르면 오른쪽 초안 칸의 커서와
     스크롤까지 날아간다 — STAR 를 쓰는 중에 그러면 쓰던 자리를 잃는다. */
  function repaintStarInput(box) {
    const host = box.querySelector('.jd-starin');
    if (!host || !_last) return;
    const fresh = document.createRange().createContextualFragment(starInputHtml(_last));
    host.replaceWith(fresh);
    bindStarInput(box);
    const open = box.querySelector('.jd-si.is-open .jd-si-ta');
    if (open) open.focus();
  }

  function checklistHtml(r) {
    if (!r.checklist?.length) return '';
    return `<div class="co-sec">
      <div class="co-sec-h"><h2>제출 전 체크리스트</h2></div>
      <div class="wf-card">
        <ul class="jd-list">${r.checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        <p class="jd-hint">위에서부터 순서대로 봅니다 — 앞이 걸리면 뒤를 볼 필요가 없어요.
          상투 표현·AI 흔적은 작성칸 아래에서 <b>브라우저 안에서만</b> 검사합니다(초안은 서버로 보내지 않아요).</p>
      </div>
    </div>`;
  }

  function render(r) {
    const box = $('#jd-result');
    if (!box) return;
    box.hidden = false;

    /* 역량이 비는 경우가 둘인데 뜻이 정반대다.
         · 공고를 넣었는데 못 뽑았다      → 공고를 다시 넣어야 한다
         · 애초에 공고 없이 시작했다      → 정상이다. 지원동기부터 쓰면 된다
       빈 목록 하나로 두 경우를 같이 처리하면, 근거를 담아 온 사람이 "실패했다" 는
       화면을 보게 된다(16-5 · 17-5 와 같은 원칙 — 빈칸의 뜻을 갈라 적는다). */
    if (!r.items?.length && r.mode !== 'company') {
      box.innerHTML = `<div class="wf-card"><div class="jd-empty">공고에서 역량을 뽑아내지 못했어요.
        모집분야·자격요건이 들어간 본문을 넣어 주세요.</div></div>`;
      return;
    }

    _focused = Math.max(0, Math.min(_focused, r.items.length - 1));
    const tabs = tabsOf(r);
    _lastTabs = tabs;
    _tab = Math.min(_tab, Math.max(0, tabs.length - 1));

    /* 역량 → 그 역량이 배정된 문항 번호. 예전에는 문항 카드가 따로 한 벌 더 나와서
       같은 역량 설명을 두 번 읽어야 했다. 여기서는 역량 줄에 문항 번호만 붙인다. */
    const qMap = {};
    tabs.forEach((t, ti) => {
      if (t.kind !== 'question') return;
      t.comps.forEach(c => {
        const i = r.items.indexOf(c);
        if (i < 0) return;
        (qMap[i] = qMap[i] || []).push(ti + 1);
      });
    });

    const src = r.mode === 'company'
      ? '공고 없이 시작 — 담아 온 회사 근거 기준'
      : r.provider === 'rule'
        ? '공고 키워드로 직접 추출 (AI 미사용)'
        : `공고 키워드 + AI 보강 (${esc(r.model || r.provider)})`;

    box.innerHTML = `
      <div class="jd-workspace">
        <div class="jd-ws-bar">
          <h2>분석 결과</h2>
          <span class="jd-ws-src">${r.mode === 'company'
            ? src
            : `공고 문장 ${r.jdSentences}개를 읽었어요 · ${src}`}</span>
          <span class="jd-ws-end">
            ${r.notice ? `<span class="jd-notice">${esc(r.notice)}</span>` : ''}
            <button type="button" class="wf-btn wf-btn--sm" data-reopen>입력 다시 보기</button>
          </span>
        </div>

        ${starHtml(r)}
        ${starInputHtml(r)}

        <div class="jd-split">
          <div class="jd-comp-pane">
            ${r.items.length ? keysHtml(r) : ''}
            <div class="jd-comp-list">
              ${r.items.length
                ? r.items.map((it, i) => compHtml(it, i, qMap)).join('')
                : `<div class="jd-empty jd-empty--soft">
                     <b>요구 역량은 공고에서 나옵니다.</b>
                     <p>지금은 담아 온 회사 근거로 <b>지원동기</b>를 쓰는 중이에요.
                        위 <b>채용공고</b> 칸에 공고 본문을 붙여넣고 다시 누르면
                        이 자리에 요구 역량과 내 경험 배정이 나옵니다.</p>
                     <button type="button" class="wf-btn wf-btn--sm" data-reopen>공고 넣으러 가기</button>
                   </div>`}
            </div>
          </div>
          ${draftHtml(r, tabs)}
        </div>

        ${r.market ? `<p class="jd-hint" style="margin-top:10px">시장 비율은 워크넷
          <b>${esc(r.market.bucket)}</b> 채용공고 ${r.market.totalJobs.toLocaleString()}건을
          ${esc(r.market.basedOn)} 기준으로 집계한 값이에요. 공고 본문에 적혔지만 제목에 없는 요건은
          빠지므로 실제보다 낮게 나옵니다.</p>` : ''}

        <div class="co-sec">
          <div class="jd-disclaimer"><i class="ti ti-alert-circle"></i> ${esc(r.disclaimer)}</div>
        </div>

        ${checklistHtml(r)}
      </div>`;

    bind(box, r, tabs);
  }

  function bind(box, r, tabs) {
    // 역량 키워드 칩 · 역량 머리줄 — 둘 다 같은 역량을 연다
    box.querySelectorAll('[data-key]').forEach(el =>
      el.addEventListener('click', () => focusItem(Number(el.dataset.key))));
    box.querySelectorAll('[data-comp]').forEach(el =>
      el.addEventListener('click', () => focusItem(Number(el.dataset.comp))));

    // 초안 탭
    box.querySelectorAll('[data-tab]').forEach(el =>
      el.addEventListener('click', () => { _tab = Number(el.dataset.tab); render(r); }));

    // 'AI 초안 넣기' — 내 활동과 공고 근거로 문단을 만들어 작성칸에 끼워 넣는다
    box.querySelectorAll('[data-ai]').forEach(el => {
      const i = Number(el.dataset.ai);
      el.addEventListener('click', () => insertAiDraft(r.items[i], i, r));
    });

    // 지원동기 초안 — 담아 온 회사 근거로 문단을 만든다
    const motiveBtn = box.querySelector('[data-motive]');
    if (motiveBtn) motiveBtn.addEventListener('click', () => insertMotiveDraft(r, tabs));

    const reopen = box.querySelector('[data-reopen]');
    if (reopen) reopen.addEventListener('click', () => {
      STEPS.forEach(s => blockOf(s)?.classList.add('is-open'));
      STEPS.forEach(paintBlock);
      document.querySelectorAll('#jd-doc [data-grow]').forEach(autoGrow);
      paintProgress();
      $('#jd-doc')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    bindStarInput(box);
    bindDraft(box);
  }

  /* 역량 바꿔 보기 — 다시 그리지 않고 클래스만 토글한다.
     innerHTML 로 새로 그리면 작성 중이던 초안이 날아간다(자동저장은 600ms 디바운스라
     방금 친 글자는 아직 저장 전이다). */
  function focusItem(i) {
    if (!Number.isInteger(i) || i < 0) return;
    _focused = i;

    document.querySelectorAll('#jd-result .jd-comp').forEach((el, idx) =>
      el.classList.toggle('is-open', idx === i));
    document.querySelectorAll('#jd-result .jd-keys .jd-key').forEach(el =>
      el.classList.toggle('is-on', Number(el.dataset.key) === i));

    const el = document.getElementById(`jd-comp-${i}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── AI 초안 ──────────────────────────────────────────────
     서버(draft-coach.js)가 인사담당자·현업 관점의 틀로 문단을 만들어 온다.
     받은 문단은 **덮어쓰지 않고 커서 자리에 끼워 넣는다** — 이미 쓰던 글이 있으면
     그게 사용자의 문장이고, 그걸 AI 문장으로 지우면 되돌릴 방법이 없다. */
  async function insertAiDraft(item, i, r) {
    const ta = $('#jd-draft');
    const btn = document.querySelector(`[data-ai="${i}"]`);
    const stateEl = document.querySelector(`[data-ai-state="${i}"]`);
    if (!ta || !item) return;

    const tabs = _lastTabs || [];
    const tab = tabs[_tab];

    /* 위 STAR 칸에 적은 것이 초안의 재료다. 한 칸도 안 적혀 있으면 모델이 아는 것이
       활동 이름·기간·역할뿐이라 문단이 뻔해진다 — 그럴 땐 만들기 전에 알려준다. */
    const star = currentStar();
    if (!star) {
      const go = confirm(
        '위 STAR 칸이 비어 있어요.\n\n'
        + '거기에 적은 내용이 초안의 재료라, 비어 있으면 활동 이름·기간·역할만 가지고 '
        + '뻔한 문단이 나옵니다.\n\n확인을 누르면 그대로 만들고, 취소하면 STAR 부터 채웁니다.');
      if (!go) {
        _starOpen = 'S';
        repaintStarInput(document.getElementById('jd-result'));
        document.querySelector('.jd-starin')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    btn.disabled = true;
    if (stateEl) stateEl.textContent = '초안을 쓰는 중… (1분 이상 걸릴 수 있어요)';

    try {
      const out = await DB.draftJd({
        competency: item.label,
        company: valueOf('#jd-company'),
        jobTitle: r?.market?.bucket || '',
        question: tab?.kind === 'question' ? tab.text : '',
        quotes: item.quotes || [],
        reads: item.reads || '',
        frame: item.frame || '',
        star,
        limit: 600,
      });

      const at = ta.selectionStart ?? ta.value.length;
      const pad = ta.value.trim() && at > 0 ? '\n\n' : '';
      const text = pad + out.draft;
      ta.value = ta.value.slice(0, at) + text + ta.value.slice(ta.selectionEnd ?? at);
      ta.focus();
      ta.setSelectionRange(at + text.length, at + text.length);
      ta.dispatchEvent(new Event('input'));

      if (stateEl) {
        stateEl.innerHTML = out.blankCount
          ? `<b>빈칸 ${out.blankCount}개</b>를 본인 사실로 채우세요`
          : '넣었어요';
      }
      paintAiNotes(i, out);
    } catch (e) {
      if (stateEl) stateEl.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  /* ── 지원동기 초안 ────────────────────────────────────────────
     insertAiDraft 와 하는 일은 같지만(문단을 만들어 커서 자리에 끼운다) 재료가
     다르다 — 저기는 내 STAR, 여기는 담아 온 회사 근거다. 그래서 STAR 가 비었는지
     묻지 않는다. 지원동기는 STAR 없이도 쓰는 문항이다.

     덮어쓰지 않고 **커서 자리에 끼워 넣는 것**은 같다. 이미 쓰던 글이 있으면
     그게 사용자의 문장이고, AI 문장으로 지우면 되돌릴 방법이 없다. */
  async function insertMotiveDraft(r, tabs) {
    const ta = $('#jd-draft');
    const btn = document.querySelector('[data-motive]');
    const stateEl = document.querySelector('[data-motive-state]');
    if (!ta || !btn) return;

    const company = valueOf('#jd-company');
    const tab = (tabs || _lastTabs || [])[_tab];
    const ev = tab?.type ? Roadmap.evidenceFor(company, tab.type.label) : [];
    if (!ev.length) {
      if (stateEl) stateEl.textContent = '담아 온 근거가 없어요.';
      return;
    }

    btn.disabled = true;
    if (stateEl) stateEl.textContent = '담은 근거를 읽고 쓰는 중… (1분 이상 걸릴 수 있어요)';

    try {
      const out = await DB.motiveJd({
        company,
        jobTitle: r?.market?.bucket || Roadmap.get()?.jobName || '',
        question: tab?.kind === 'question' ? tab.text : '',
        /* 서버가 필요한 것만 보낸다 — id·url 은 프롬프트에 쓸모가 없고,
           보내 봤자 프롬프트만 길어져 뒤쪽 규칙이 밀린다. */
        evidence: ev.map(e => ({ kind: e.kind, text: e.text, source: e.source || '' })),
        limit: 600,
      });

      const at = ta.selectionStart ?? ta.value.length;
      const pad = ta.value.trim() && at > 0 ? '\n\n' : '';
      const text = pad + out.draft;
      ta.value = ta.value.slice(0, at) + text + ta.value.slice(ta.selectionEnd ?? at);
      ta.focus();
      ta.setSelectionRange(at + text.length, at + text.length);
      ta.dispatchEvent(new Event('input'));

      /* 빈칸 0개는 '완성됐다' 가 아니라 **그대로 내면 안 되는 상태**다.
         대괄호가 대필 방지 장치라, 없으면 그 장치가 안 걸린 문단이다(16-2).
         '넣었어요' 로 끝내면 학생은 다 됐다고 읽는다. */
      if (stateEl) {
        stateEl.innerHTML = out.blankCount
          ? `<b>빈칸 ${out.blankCount}개</b>를 본인 사실로 채우세요`
          : '<b>빈칸 없이 나왔어요</b> — 수치·상황을 본인 사실로 바꿔 쓰세요';
      }
      paintMotiveNotes(out);
    } catch (e) {
      if (stateEl) stateEl.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  /* 초안 옆에 '무엇을 채워야 하는지'·'약한 지점'과 **어느 근거로 썼는지**를 적는다.
     출처를 안 적으면 학생은 이 문단의 회사 이야기가 어디서 온 것인지 알 수 없고,
     그러면 면접에서 되물었을 때 답할 수 없다(3단계가 출처를 같이 담는 이유와 같다). */
  function paintMotiveNotes(out) {
    const host = document.querySelector('[data-motive-notes]');
    if (!host) return;
    const list = (arr, title) => arr?.length
      ? `<div class="jd-comp-sec"><span class="wf-eyebrow">${title}</span>
           <ul class="jd-list">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`
      : '';
    const used = (out.usedEvidence || []).length
      ? `<div class="jd-comp-sec"><span class="wf-eyebrow">이 초안이 쓴 사실</span>
           <ul class="jd-list">${out.usedEvidence.map(e =>
             `<li>${esc(e.text.slice(0, 90))}${e.text.length > 90 ? '…' : ''}
              ${e.source ? `<span style="color:var(--wf-mute)"> — ${esc(e.source)}</span>` : ''}</li>`).join('')}</ul>
         </div>`
      : '';
    host.innerHTML = used + list(out.blanks, '채워야 할 빈칸') + list(out.review, '채용담당자가 볼 약한 지점');
  }

  /* 모델이 같이 준 '무엇을 채워야 하는지'와 '채용담당자가 볼 약한 지점'.
     초안만 주고 끝내면 학생은 그대로 낸다 — 고칠 지점을 같이 붙인다. */
  function paintAiNotes(i, out) {
    const host = document.querySelector(`[data-ai-notes="${i}"]`);
    if (!host) return;
    const list = (arr, title) => arr?.length
      ? `<div class="jd-comp-sec"><span class="wf-eyebrow">${title}</span>
           <ul class="jd-list">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`
      : '';

    /* 칸별 되짚기는 목록이 아니라 **STAR 칸으로 돌려보내는 안내**다. 그래서 그냥
       나열하지 않고 해당 칸을 여는 버튼으로 만든다 — 읽고 나서 어디를 고쳐야 하는지
       다시 찾게 하면 대부분 안 고친다. */
    const coach = out.coach?.length
      ? `<div class="jd-comp-sec"><span class="wf-eyebrow">STAR 에서 더 적어야 할 것</span>
           <div class="jd-coach">${out.coach.map(c => `
             <button type="button" class="jd-coach-row" data-coach="${esc(c.key)}">
               <span class="jd-coach-key">${esc(c.key)}</span>
               <span class="jd-coach-t">
                 <b>${esc(c.missing || '더 적을 것이 있어요')}</b>
                 ${c.ask ? `<span>${esc(c.ask)}</span>` : ''}
               </span>
               <i class="ti ti-arrow-up-right"></i>
             </button>`).join('')}</div>
           <p class="jd-hint">누르면 그 칸이 열립니다. 채운 뒤 <b>AI 초안 넣기</b>를 다시 누르면
             그 내용으로 다시 씁니다.</p>
         </div>`
      : '';

    host.innerHTML = coach + list(out.blanks, '채워야 할 빈칸') + list(out.review, '채용담당자가 볼 약한 지점');

    host.querySelectorAll('[data-coach]').forEach(el => el.addEventListener('click', () => {
      _starOpen = el.dataset.coach;
      const box = document.getElementById('jd-result');
      repaintStarInput(box);
      box.querySelector('.jd-starin')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));

    /* 어느 칸이 모자란지 STAR 머리줄에도 표시해 둔다. 초안 카드를 닫으면
       되짚기가 안 보이는데, 고쳐야 할 칸은 계속 보여야 한다. */
    _starCoach = {};
    (out.coach || []).forEach(c => { _starCoach[c.key] = c.missing || c.ask || ''; });
    repaintStarInput(document.getElementById('jd-result'));
  }


  /* 작성칸 자동 저장. 글자마다 localStorage 를 때리지 않도록 600ms 묶어서 쓴다.
     저장은 조용히 되면 사용자가 저장됐는지 모른다 — 상태 문구를 같이 갱신한다. */
  function bindDraft(box) {
    const ta = box.querySelector('#jd-draft');
    if (!ta) return;
    const stateEl = box.querySelector('#jd-draft-state');
    const countEl = box.querySelector('#jd-draft-count');
    const chkEl = box.querySelector('#jd-chk');
    const key = ta.dataset.key;
    let timer = null;

    const paint = () => {
      countEl.textContent = ta.value.length ? `${ta.value.length.toLocaleString()}자` : '0자';
      paintCheck(chkEl, ta.value);
    };
    paint();
    if (ta.value.trim()) stateEl.textContent = '저장된 초안을 불러왔어요';

    ta.addEventListener('input', () => {
      paint();
      stateEl.textContent = '작성 중…';
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveDraft(key, ta.value);
        stateEl.textContent = '저장됨';
        // 탭 글자수도 같이 갱신 — 어느 문항이 얼마나 찼는지가 탭에 보인다
        const tab = box.querySelector(`[data-tab="${_tab}"] span`);
        if (tab) tab.textContent = ta.value.length.toLocaleString();
      }, 600);
    });
    // 탭을 옮기거나 페이지를 뜨면 대기 중인 저장을 흘려보내지 않는다
    ta.addEventListener('blur', () => {
      clearTimeout(timer);
      saveDraft(key, ta.value);
      if (ta.value.trim()) stateEl.textContent = '저장됨';
    });
  }

  /* ── 초안 검사 (브라우저에서만 돈다) ──────────────────────────
     상투 표현·AI 흔적 검사는 서버로 보내지 않는다. 자소서 초안은 남의 서버에
     올릴 이유가 없는 글이고, 검사 자체가 단순 문자열 대조라 여기서 끝난다.
     서버는 '무엇을 찾을지'(사전)만 내려보낸다. */
  function checkDraft(text) {
    const body = String(text || '');
    const out = { cliches: [], aiTells: [], blanks: 0 };
    if (!body.trim() || !_last) return out;

    for (const c of _last.cliches || []) {
      if (body.includes(c.term)) out.cliches.push(c);
    }
    for (const t of _last.aiTells || []) {
      const parts = t.term.split('~').map(s => s.trim()).filter(Boolean);
      const counts = parts.map(p => body.split(p).length - 1);
      const n = parts.length > 1 ? Math.min(...counts) : counts[0];
      if (n > t.repeat) out.aiTells.push({ ...t, count: n });
    }
    out.blanks = (body.match(/\[[^\]]+\]/g) || []).length;
    return out;
  }

  function paintCheck(el, text) {
    if (!el) return;
    const r = checkDraft(text);
    const bits = [];
    if (r.blanks) bits.push(`<span class="jd-chk jd-chk--warn">빈칸 ${r.blanks}개</span>`);
    for (const c of r.cliches) bits.push(`<span class="jd-chk jd-chk--bad" title="${esc(c.why)}">${esc(c.term)}</span>`);
    for (const t of r.aiTells) bits.push(`<span class="jd-chk jd-chk--ai" title="${esc(t.why)}">${esc(t.term)} ×${t.count}</span>`);
    el.innerHTML = bits.length
      ? `<span class="jd-chk-h">고칠 것</span>${bits.join('')}`
      : (text.trim() ? '<span class="jd-chk jd-chk--ok">걸리는 표현 없음</span>' : '');
  }

  const api = {
    init, onEnter, focusItem,
    // 화면 없이 검증하는 규칙들 (test/jd-questions.test.js)
    classifyQuestion, competenciesFor, parseQuestions, questionDraftKey, QUESTION_TYPES,
    checkDraft,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node 테스트용
  root.JdCoach = api;

})(typeof window !== 'undefined' ? window : globalThis);
