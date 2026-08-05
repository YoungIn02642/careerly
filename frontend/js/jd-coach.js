/* ════════════════════════════════════════════════════════════
   CAREERLY — 자소서 코치 (직무기술서 → 요구역량 → 작성 가이드)

   화면 규칙 두 개만 지키면 이 페이지는 신뢰를 잃지 않는다:
     1) 역량마다 **공고 원문 근거 문장**을 같이 보여준다. 자동 추출은 반드시
        오탐이 섞이는데, 근거가 보이면 사용자가 스스로 걸러낼 수 있다.
     2) 완성된 자소서 문장을 주지 않는다는 것을 화면에 적어 둔다(서버가 문구를 준다).
        대필로 오해하면 그대로 베껴 쓰고, 유사도 검사에 걸린다.
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

  /* ── 내가 쓴 자소서 초안 보관 ────────────────────────────────
     역량 카드마다 작성칸을 두고, 입력하는 대로 브라우저에 저장한다.
     가이드를 보면서 바로 쓰고, 다음에 같은 회사로 들어오면 이어 쓰게 하는 게 목적.

     저장 위치는 localStorage 다. 서버에 두면 계정·동기화·삭제 정책이 따라붙는데
     아직 그 설계가 없고, 초안은 남에게 보일 물건도 아니다. 기기를 옮기면
     안 따라온다는 한계는 화면에 적어 둔다.

     키는 '회사명 + 역량 이름'. 회사명을 안 적었으면 공용 칸(기본)으로 떨어진다 —
     회사를 적어야 회사별로 따로 쌓인다. */
  const LS_DRAFTS = 'careerly_jd_drafts_v1';

  function loadDrafts() {
    try { return JSON.parse(localStorage.getItem(LS_DRAFTS)) || {}; } catch { return {}; }
  }
  function draftScope() {
    return ($('#jd-company')?.value || '').trim() || '(회사 미지정)';
  }
  function getDraft(label) {
    return loadDrafts()[draftScope()]?.[label] || '';
  }
  function saveDraft(label, text) {
    const all = loadDrafts();
    const scope = draftScope();
    all[scope] = all[scope] || {};
    if (text.trim()) all[scope][label] = text;
    else delete all[scope][label];            // 비우면 흔적을 남기지 않는다
    if (!Object.keys(all[scope]).length) delete all[scope];
    localStorage.setItem(LS_DRAFTS, JSON.stringify(all));
  }

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

  function init() {
    const runBtn = $('#jd-run');
    if (runBtn) runBtn.addEventListener('click', run);

    const companyEl = $('#jd-company');

    const sampleBtn = $('#jd-sample');
    if (sampleBtn) sampleBtn.addEventListener('click', () => {
      $('#jd-text').value = SAMPLE;
      $('#jd-questions').value = SAMPLE_QUESTIONS;
      $('#jd-text').focus();
    });

  }

  async function fillCompanyOptions(q) {
    const dl = $('#jd-company-options');
    if (!dl) return;
    const query = (q || '').trim();
    if (query.length < 2) { dl.innerHTML = ''; return; }
    const items = await DB.suggestCompanies(query);
    if (dl.dataset.q && dl.dataset.q !== query) return;   // 늦게 온 응답으로 덮지 않는다
    dl.dataset.q = query;
    dl.innerHTML = items.map(i => `<option value="${esc(i.name)}"></option>`).join('');
  }

  /* 페이지에 들어올 때마다 — 로그인 상태에 따라 안내가 달라진다. */
  function onEnter() {
    /* 지난번 분석 결과를 지우고 들어온다. 안 지우면 다른 회사를 보러 다시 들어와도
       이전 회사 기사·문항 카드가 그대로 남아, 새 회사의 결과인 줄 알고 읽게 된다. */
    ['#jd-result', '#jd-questions-result']
      .forEach(sel => { const el = $(sel); if (el) el.hidden = true; });
    const status = $('#jd-status');
    if (status) status.textContent = '';
    const pickedCompany = localStorage.getItem('careerly_selected_company');
    if (pickedCompany && $('#jd-company')) {
      $('#jd-company').value = pickedCompany;
      localStorage.removeItem('careerly_selected_company');
    }

    /* 예전에는 여기서 "내 활동 N건을 불러왔어요" 안내를 띄웠다. 아무것도 안 한 상태에서
       먼저 말을 거는 배너라 페이지를 열자마자 눈에 걸렸고, 정작 필요한 시점(역량 카드에
       내 경험이 붙을 때)에는 이미 스크롤 위로 사라져 있었다. 그 안내는 카드가 직접
       하고 있으므로(mineHtml) 배너는 두지 않는다. */
  }

  /* 공고와 직무기술서를 합쳐 하나의 분석 입력으로 만든다.
     둘을 나눠 받는 건 사용자가 헷갈리지 않게 하기 위해서고, 역량 추출은 두 문서를
     같이 읽어야 정확해진다(공고에만 있는 우대사항, JD 에만 있는 업무 상세가 있다).
     구분선을 넣어 서버 문장 분리가 두 문서를 한 문장으로 잇지 않게 한다. */
  function analysisText() {
    const jd  = $('#jd-jd')?.value.trim() || '';
    const ad  = $('#jd-text').value.trim();
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
    const btn      = $('#jd-run');
    const statusEl = $('#jd-status');
    const resultEl = $('#jd-result');
    const useAi    = $('#jd-use-ai')?.checked !== false;
    const text     = analysisText();

    if (text.length < 30) {
      statusEl.textContent = '채용공고 내용을 30자 이상 붙여넣어 주세요.';
      return;
    }

    btn.disabled = true;
    /* 규칙만 쓰면 즉시 끝나지만 AI 보강이 붙으면 로컬 모델에서 1분 이상 걸린다.
       기다리는 이유를 적어두지 않으면 사용자가 멈춘 줄 안다. */
    statusEl.textContent = useAi
      ? '공고를 읽고 있어요… (AI 보강이 필요하면 1분 이상 걸릴 수 있어요)'
      : '공고를 읽고 있어요…';
    resultEl.hidden = true;
    $('#jd-questions-result').hidden = true;

    try {
      _last = await DB.coachJd(text, { useAi });
      statusEl.textContent = '';
      renderQuestions(parseQuestions(), _last);
      render(_last);
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

  function renderQuestions(questions, r) {
    const box = $('#jd-questions-result');
    if (!box) return;
    if (!questions.length) { box.hidden = true; return; }

    const company = ($('#jd-company')?.value || '').trim();

    box.hidden = false;
    box.innerHTML = `
      <div class="jd-summary">
        <div class="jd-summary-h">자소서 문항 <b>${questions.length}개</b>에 이렇게 배분하세요</div>
        <div class="jd-summary-sub">
          같은 역량을 여러 문항에 반복해서 쓰면 읽는 사람에게는 소재가 하나로 보입니다.
          문항마다 <b>다른 경험</b>을 배치하는 게 목적이에요.
        </div>
      </div>
      <div class="jd-cards">${questions.map((q, i) => questionHtml(q, i, r, company)).join('')}</div>`;

    bindDrafts(box);
  }

  /* 문항 초안의 저장 키. **문항 문구가 아니라 순번**을 쓴다.
     문구를 키로 잡으면 오타 하나만 고쳐도 저장된 초안을 못 찾아 사라진 것처럼 보인다.
     자소서는 문항을 다듬어 가며 쓰는 물건이라 그 일이 실제로 자주 일어난다.
     대신 문항 순서를 바꾸면 초안이 자리에 남는데, 그건 화면에 적어 알린다. */
  const questionDraftKey = i => `문항${i + 1}`;

  function questionHtml(q, i, r, company) {
    const type  = classifyQuestion(q);
    const comps = competenciesFor(type, r?.items);

    /* 지원동기 문항은 공고가 아니라 회사 소식이 근거다. 뉴스를 아직 안 찾았으면
       "여기서 찾아라"까지만 말하고 없는 소재를 지어내지 않는다. */
    const source = type?.pick === 'news'
      ? `<div class="jd-block jd-block--mine">
           <div class="jd-block-h"><i class="ti ti-news"></i> 이 문항의 근거</div>
           <p class="jd-frame">${company
             ? `<b>회사 검색과 자소서</b> 페이지에서 정한 관점 하나를 사용하세요. 회사명은 이 문항의 작성 방향을 맞추는 보조 정보입니다.`
             : `<b>회사 검색과 자소서</b> 페이지에서 회사를 먼저 선택하면 지원동기 작성 순서를 준비할 수 있어요.`}</p>
         </div>`
      : comps.length
        ? `<div class="jd-block jd-block--mine">
             <div class="jd-block-h"><i class="ti ti-target"></i> 이 문항에 쓸 역량</div>
             <div class="jd-chips">${comps.map(c => `<span class="jd-chip jd-chip--static">${esc(c.label)}</span>`).join('')}</div>
             ${comps[0]?.mine?.length
               ? `<p class="jd-frame">내 활동 중 <b>${esc(comps[0].mine[0].name || comps[0].mine[0])}</b> 이(가) 이 역량의 소재로 맞습니다.</p>`
               : `<p class="jd-frame">마이페이지에 활동을 입력하면 어떤 경험을 쓸지까지 짚어드려요.</p>`}
           </div>`
        : '';

    return `<article class="jd-card">
      <header class="jd-card-h">
        <span class="jd-idx">${i + 1}</span>
        <h3>${esc(q)}</h3>
        <span class="jd-src jd-src--${type ? 'ai' : 'rule'}">${type ? esc(type.label) : '유형 미확인'}</span>
      </header>

      <p class="jd-lead">${type
        ? esc(type.how)
        : '문항 유형을 알아보지 못했어요. 아래 역량 카드에서 이 문항과 가까운 것을 직접 고르세요.'}</p>

      ${source}

      <div class="jd-draft">
        <div class="jd-block-h">
          <i class="ti ti-pencil"></i> 내 자소서 초안
          <span class="jd-draft-state" id="jd-draft-state-q${i}"></span>
        </div>
        <textarea class="jd-draft-text" id="jd-draft-q${i}" rows="8"
          data-label="${esc(questionDraftKey(i))}"
          placeholder="이 문항의 답변을 여기에 쓰세요. 적는 대로 저장돼요.">${esc(getDraft(questionDraftKey(i)))}</textarea>
        <div class="jd-draft-foot">
          <span class="jd-draft-count" id="jd-draft-count-q${i}"></span>
          <span class="jd-draft-hint">이 브라우저에만 저장됩니다 · 문항 문구를 고쳐도 초안은 남아요
            (문항 <b>순서</b>를 바꾸면 초안은 그 자리에 남습니다)</span>
        </div>
      </div>
    </article>`;
  }

  function mineHtml(item) {
    if (item.gap) return `<div class="jd-gap"><i class="ti ti-alert-triangle"></i> ${esc(item.gap)}</div>`;
    if (!item.mine.length) return '';

    const rows = item.mine.map((m, i) => `
      <li class="${i === 0 ? 'is-top' : ''}">
        <span class="jd-mine-name">${esc(m.name)}</span>
        <span class="jd-mine-meta">${esc(m.typeLabel)}${m.duration ? ' · ' + esc(m.duration) : ''}${m.role ? ' · ' + esc(m.role) : ''}${m.outcome && m.outcome !== '결과물 없음' ? ' · ' + esc(m.outcome) : ''}</span>
      </li>`).join('');
    return `<div class="jd-block jd-block--mine">
        <div class="jd-block-h"><i class="ti ti-user-star"></i> 소재로 쓸 내 경험</div>
        <ul class="jd-mine">${rows}</ul>
      </div>`;
  }

  /* 시장 빈도 — careerly 만 할 수 있는 말이라 카드에서 가장 눈에 띄는 자리에 둔다.
     비율만 쓰면 근거 없는 숫자로 보이므로 표본 수를 항상 같이 적는다.
     데이터가 없으면(채용공고 미수집) 통째로 생략 — 빈 자리를 만들지 않는다. */
  const RARITY_TEXT = {
    common: '지원자 대부분이 쓰는 역량입니다. <b>안 쓰면 감점</b>이니 반드시 넣되, 여기서 차별화되긴 어렵습니다.',
    normal: '절반 이하의 공고가 요구합니다. 근거가 있다면 <b>비중 있게</b> 쓰세요.',
    rare:   '요구하는 공고가 드뭅니다. 근거가 있다면 <b>가장 강한 차별점</b>이 됩니다.',
  };

  function marketHtml(item) {
    const m = item.market;
    if (!m) return '';
    return `<div class="jd-market jd-market--${m.rarity}">
        <div class="jd-market-num">${m.pct}<span>%</span></div>
        <div class="jd-market-txt">
          <div class="jd-market-h">${esc(m.bucket)} 공고 <b>${m.sample}건</b> 중 ${m.count}건이 요구</div>
          <div class="jd-market-note">${RARITY_TEXT[m.rarity] || ''}</div>
        </div>
      </div>`;
  }

  function itemHtml(item, idx) {
    const quotes = item.quotes.length
      ? `<div class="jd-quotes">
           <div class="jd-quotes-h">공고 근거</div>
           ${item.quotes.map(q => `<blockquote>${esc(q)}</blockquote>`).join('')}
         </div>`
      : '';

    const openers = item.openers?.length
      ? `<div class="jd-block">
           <div class="jd-block-h"><i class="ti ti-quote"></i> 첫 문장 여는 방법</div>
           <ul class="jd-list">${item.openers.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
         </div>`
      : '';

    return `<article class="jd-card">
      <header class="jd-card-h">
        <span class="jd-idx">${idx + 1}</span>
        <h3>${esc(item.label)}</h3>
        <span class="jd-src jd-src--${item.source}">${item.source === 'ai' ? 'AI 추출' : '공고 키워드'}</span>
      </header>

      ${marketHtml(item)}
      <p class="jd-reads"><b>기업이 보는 것</b> — ${esc(item.reads)}</p>
      ${quotes}

      <p class="jd-lead">${bold(item.lead)}</p>

      <div class="jd-block jd-block--frame">
        <div class="jd-block-h"><i class="ti ti-list-numbers"></i> 이 순서로 쓰세요</div>
        <p class="jd-frame">${esc(item.frame)}</p>
      </div>

      ${mineHtml(item)}
      ${openers}

      <div class="jd-block">
        <div class="jd-block-h"><i class="ti ti-number-123"></i> 반드시 숫자로 바꿀 것</div>
        <ul class="jd-list">${item.numbers.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
      </div>

      <div class="jd-block jd-block--avoid">
        <div class="jd-block-h"><i class="ti ti-circle-x"></i> 이렇게 쓰면 감점</div>
        <ul class="jd-list">${item.avoid.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
      </div>

      ${item.followup ? `<div class="jd-followup">
          <i class="ti ti-messages"></i> 이렇게 쓰면 면접에서 이걸 물어봅니다 —
          <b>“${esc(item.followup)}”</b>
        </div>` : ''}

      <div class="jd-draft">
        <div class="jd-block-h">
          <i class="ti ti-pencil"></i> 내 자소서 초안
          <span class="jd-draft-state" id="jd-draft-state-${idx}"></span>
        </div>
        <textarea class="jd-draft-text" id="jd-draft-${idx}" rows="6"
          data-label="${esc(item.label)}"
          placeholder="위 순서대로 이 역량에 대한 문단을 써 보세요. 적는 대로 저장돼요.">${esc(getDraft(item.label))}</textarea>
        <div class="jd-draft-foot">
          <span class="jd-draft-count" id="jd-draft-count-${idx}"></span>
          <span class="jd-draft-hint">이 브라우저에만 저장됩니다 · 회사명을 적으면 회사별로 나뉘어요</span>
        </div>
      </div>
    </article>`;
  }

  function render(r) {
    const resultEl = $('#jd-result');
    resultEl.hidden = false;

    const src = r.provider === 'rule'
      ? '공고 키워드로 직접 추출 (AI 미사용)'
      : `공고 키워드 + AI 보강 (${esc(r.model || r.provider)})`;

    resultEl.innerHTML = `
      <div class="jd-summary">
        <div class="jd-summary-h">
          이 공고가 요구하는 역량 <b>${r.items.length}가지</b>
        </div>
        <div class="jd-summary-sub">공고 문장 ${r.jdSentences}개를 읽었어요 · ${src}</div>
        ${r.market ? `<div class="jd-market-src">
            시장 비율은 워크넷 <b>${esc(r.market.bucket)}</b> 채용공고 ${r.market.totalJobs.toLocaleString()}건을
            ${esc(r.market.basedOn)} 기준으로 집계한 값이에요. 공고 본문에 적혔지만 제목에 없는 요건은 빠지므로
            실제보다 낮게 나옵니다.
          </div>` : ''}
        <div class="jd-chips">
          <button class="jd-chip jd-chip--all is-on" data-i="" onclick="JdCoach.focusItem(null)">전체 ${r.items.length}</button>
          ${r.items.map((it, i) =>
            `<button class="jd-chip" data-i="${i}" onclick="JdCoach.focusItem(${i})">${esc(it.label)}</button>`).join('')}
        </div>
        <div class="jd-chips-hint">역량을 누르면 그 역량만 봅니다. 다시 누르면 전체로 돌아와요.</div>
        ${r.notice ? `<div class="jd-notice">${esc(r.notice)}</div>` : ''}
        <div class="jd-disclaimer"><i class="ti ti-alert-circle"></i> ${esc(r.disclaimer)}</div>
      </div>
      <div class="jd-cards">${r.items.map(itemHtml).join('')}</div>`;

    _focused = null;        // 새 분석 결과는 항상 전체 보기로 시작한다
    bindDrafts(resultEl);
  }

  /* 작성칸 자동 저장. 글자마다 localStorage 를 때리지 않도록 600ms 묶어서 쓴다.
     저장은 조용히 되면 사용자가 저장됐는지 모른다 — 상태 문구를 같이 갱신한다. */
  function bindDrafts(root) {
    root.querySelectorAll('.jd-draft-text').forEach(ta => {
      const idx     = ta.id.replace('jd-draft-', '');
      const stateEl = root.querySelector(`#jd-draft-state-${idx}`);
      const countEl = root.querySelector(`#jd-draft-count-${idx}`);
      const label   = ta.dataset.label;
      let timer = null;

      const paintCount = () => {
        const n = ta.value.length;
        countEl.textContent = n ? `${n.toLocaleString()}자` : '';
      };
      paintCount();
      if (ta.value.trim()) stateEl.textContent = '저장된 초안을 불러왔어요';

      ta.addEventListener('input', () => {
        paintCount();
        stateEl.textContent = '작성 중…';
        clearTimeout(timer);
        timer = setTimeout(() => {
          saveDraft(label, ta.value);
          stateEl.textContent = '저장됨';
        }, 600);
      });
      // 탭을 옮기거나 페이지를 뜨면 대기 중인 저장을 흘려보내지 않는다
      ta.addEventListener('blur', () => {
        clearTimeout(timer);
        saveDraft(label, ta.value);
        if (ta.value.trim()) stateEl.textContent = '저장됨';
      });
    });
  }

  /* ── 요약 칩 → 그 역량만 보기 ────────────────────────────────
     예전에는 해당 카드로 스크롤만 했다. 역량이 7개면 카드 하나가 화면보다 길어서,
     스크롤로 옮겨가도 위아래에 다른 역량이 걸쳐 보여 "이 역량만" 읽기가 어려웠다.
     지금은 고른 카드만 남기고 나머지를 접는다. 같은 칩을 다시 누르면 전체로 돌아온다.

     ── 다시 그리지 않고 클래스만 토글한다 ──
     innerHTML 로 카드를 새로 그리면 **작성 중이던 초안이 날아간다**. 초안 자동저장은
     600ms 디바운스라 방금 친 글자는 아직 저장 전이다. 그래서 DOM 은 그대로 두고
     보이기만 바꾼다.

     선택자를 #jd-result 로 묶는 것도 중요하다 — 문항 카드(#jd-questions-result)에도
     같은 .jd-chip 클래스를 쓰는데, 그쪽은 누르는 물건이 아니다. */
  let _focused = null;          // 현재 필터 중인 역량 index (null = 전체)

  function focusItem(i) {
    const wrap = document.querySelector('#jd-result .jd-cards');
    if (!wrap) return;

    // 같은 칩을 다시 누르면 해제 — 되돌릴 방법을 못 찾는 상태를 만들지 않는다
    _focused = (i == null || _focused === i) ? null : i;

    const cards = [...wrap.querySelectorAll('.jd-card')];
    wrap.classList.toggle('is-filtered', _focused !== null);
    cards.forEach((c, idx) => c.classList.toggle('is-shown', idx === _focused));

    document.querySelectorAll('#jd-result .jd-chip').forEach(chip => {
      const ci = chip.dataset.i === '' ? null : Number(chip.dataset.i);
      chip.classList.toggle('is-on', ci === _focused);
    });

    // 필터를 걸면 결과 머리로 올려준다. 아래쪽 칩을 눌렀을 때 빈 화면처럼 보이지 않게.
    if (_focused !== null) {
      document.querySelector('#jd-result .jd-summary')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const api = {
    init, onEnter, focusItem,
    // 화면 없이 검증하는 규칙들 (test/jd-questions.test.js)
    classifyQuestion, competenciesFor, parseQuestions, questionDraftKey, QUESTION_TYPES,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node 테스트용
  root.JdCoach = api;

})(typeof window !== 'undefined' ? window : globalThis);
