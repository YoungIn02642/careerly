/* ════════════════════════════════════════════════════════════
   CAREERLY — 자소서 코치 (직무기술서 → 요구역량 → 작성 가이드)

   화면 규칙 두 개만 지키면 이 페이지는 신뢰를 잃지 않는다:
     1) 역량마다 **공고 원문 근거 문장**을 같이 보여준다. 자동 추출은 반드시
        오탐이 섞이는데, 근거가 보이면 사용자가 스스로 걸러낼 수 있다.
     2) 완성된 자소서 문장을 주지 않는다는 것을 화면에 적어 둔다(서버가 문구를 준다).
        대필로 오해하면 그대로 베껴 쓰고, 유사도 검사에 걸린다.
   ════════════════════════════════════════════════════════════ */
window.JdCoach = (() => {
  const $ = sel => document.querySelector(sel);

  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* lead 문구에만 **강조** 를 쓴다(서버가 활동 이름을 그렇게 감싼다).
     escape 를 먼저 하고 나서 강조를 풀어야 XSS 가 되지 않는다. */
  const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  let _last = null;         // 마지막 결과 — 다시 그릴 때 재요청하지 않는다

  const SAMPLE = `[주요업무]
- 채널별 마케팅 성과 데이터 분석 및 리포트 작성
- 유관부서와 협업하여 프로모션 기획 및 실행
[자격요건]
- 데이터를 근거로 문제를 정의하고 개선안을 제안할 수 있는 분
- 엑셀·SQL 등 데이터 도구 활용 가능자
[우대사항]
- 고객 니즈 파악 및 UX 개선 경험
- 영어 커뮤니케이션 가능자`;

  function init() {
    const runBtn = $('#jd-run');
    if (runBtn) runBtn.addEventListener('click', run);

    const newsBtn = $('#jd-news-run');
    if (newsBtn) newsBtn.addEventListener('click', runNews);
    const companyEl = $('#jd-company');
    if (companyEl) companyEl.addEventListener('keydown', e => { if (e.key === 'Enter') runNews(); });

    const sampleBtn = $('#jd-sample');
    if (sampleBtn) sampleBtn.addEventListener('click', () => {
      $('#jd-text').value = SAMPLE;
      $('#jd-text').focus();
    });
  }

  /* 페이지에 들어올 때마다 — 로그인 상태에 따라 안내가 달라진다. */
  function onEnter() {
    const spec = DB.currentUser() ? DB.getSpec(DB.currentUser().username) : null;
    const n = spec?.activities?.length || 0;
    const box = $('#jd-spec-note');
    if (!box) return;

    if (n) {
      box.className = 'jd-note jd-note--on';
      box.innerHTML = `<i class="ti ti-check"></i> 내 활동 <b>${n}건</b>을 불러왔어요. `
        + `역량마다 어떤 경험을 소재로 쓸지까지 함께 알려드립니다.`;
    } else if (DB.currentUser()) {
      box.className = 'jd-note';
      box.innerHTML = `<i class="ti ti-info-circle"></i> 아직 입력한 활동이 없어요. `
        + `<span class="jd-link" onclick="navigate('mypage')">마이페이지에서 스펙을 입력</span>하면 `
        + `"이 역량은 어떤 경험으로 쓰라"까지 짚어드립니다.`;
    } else {
      box.className = 'jd-note';
      box.innerHTML = `<i class="ti ti-info-circle"></i> `
        + `<span class="jd-link" onclick="navigate('login')">로그인</span>하면 내 활동을 역량에 연결해 드려요. `
        + `로그인 없이도 작성 가이드는 그대로 사용할 수 있습니다.`;
    }
  }

  async function run() {
    const text     = $('#jd-text').value.trim();
    const btn      = $('#jd-run');
    const statusEl = $('#jd-status');
    const resultEl = $('#jd-result');
    const useAi    = $('#jd-use-ai')?.checked !== false;

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

    try {
      _last = await DB.coachJd(text, { useAi });
      statusEl.textContent = '';
      render(_last);
    } catch (e) {
      statusEl.textContent = '';
      resultEl.hidden = false;
      resultEl.innerHTML = `<div class="jd-err">${esc(e.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
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
          ${r.items.map((it, i) => `<button class="jd-chip" onclick="JdCoach.jump(${i})">${esc(it.label)}</button>`).join('')}
        </div>
        ${r.notice ? `<div class="jd-notice">${esc(r.notice)}</div>` : ''}
        <div class="jd-disclaimer"><i class="ti ti-alert-circle"></i> ${esc(r.disclaimer)}</div>
      </div>
      <div class="jd-cards">${r.items.map(itemHtml).join('')}</div>`;
  }

  // ── 이 회사, 지금 (지원동기 소재) ──────────────────────────
  /* 기사를 요약하지 않는다. 제목·링크를 그대로 보여주고 원문을 읽게 한다.
     요약을 AI 에 시키면 없는 사실이 섞여 들어가고, 자소서에 지어낸 사실을 쓰면
     면접에서 그대로 무너진다(서버 news.js 머리주석과 같은 이유). */
  async function runNews() {
    const name     = $('#jd-company').value.trim();
    const btn      = $('#jd-news-run');
    const statusEl = $('#jd-news-status');
    const resultEl = $('#jd-news-result');

    if (name.length < 2) {
      statusEl.textContent = '회사명을 2글자 이상 입력해 주세요.';
      return;
    }

    btn.disabled = true;
    statusEl.textContent = '최근 소식을 찾는 중…';
    resultEl.hidden = true;

    try {
      const r = await DB.companyNews(name);
      statusEl.textContent = '';
      renderNews(r);
    } catch (e) {
      statusEl.textContent = '';
      resultEl.hidden = false;
      resultEl.innerHTML = `<div class="jd-err">${esc(e.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  }

  function renderNews(r) {
    const resultEl = $('#jd-news-result');
    resultEl.hidden = false;

    if (!r.items.length) {
      resultEl.innerHTML = `<div class="jd-news-empty">
          <b>${esc(r.company)}</b> 관련 기사를 찾지 못했어요.
          회사 정식 명칭으로 다시 검색해 보세요(예: "아주" → "아주산업").
        </div>`;
      return;
    }

    /* 키워드마다 몇 번째 기사에서 나왔는지 함께 보여준다. 근거를 못 짚는 키워드는
       학생이 검증할 수 없고, 검증 못 한 표현을 자소서에 쓰면 위험하다. */
    const chips = r.keywords.map(k =>
      `<span class="jd-kw" title="기사 ${k.articles.map(i => i + 1).join(', ')}번에 등장">
         ${esc(k.term)}<b>${k.count}건</b>
       </span>`).join('');

    const articles = r.items.map((it, i) => `
      <li class="jd-article">
        <span class="jd-article-n">${i + 1}</span>
        <div class="jd-article-body">
          <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.title)}</a>
          ${it.summary ? `<div class="jd-article-sum">${esc(it.summary.slice(0, 140))}</div>` : ''}
          ${it.date ? `<div class="jd-article-date">${esc(it.date)}</div>` : ''}
        </div>
      </li>`).join('');

    const g = r.guide;
    resultEl.innerHTML = `
      ${r.keywords.length ? `<div class="jd-block">
          <div class="jd-block-h"><i class="ti ti-tags"></i> 자소서에 쓸 키워드</div>
          <div class="jd-kws">${chips}</div>
          <div class="jd-kw-note">${esc(r.keywordNote)}</div>
        </div>` : ''}

      <div class="jd-block">
        <div class="jd-block-h"><i class="ti ti-news"></i> 최근 기사 ${r.items.length}건</div>
        <ul class="jd-articles">${articles}</ul>
      </div>

      <div class="jd-block jd-block--frame">
        <div class="jd-block-h"><i class="ti ti-list-numbers"></i> 지원동기, 이 순서로 쓰세요</div>
        <p class="jd-frame">${esc(g.frame)}</p>
      </div>

      <div class="jd-block">
        <div class="jd-block-h"><i class="ti ti-bulb"></i> 쓸 때 주의</div>
        <ul class="jd-list">${g.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>

      <div class="jd-block jd-block--avoid">
        <div class="jd-block-h"><i class="ti ti-circle-x"></i> 이렇게 쓰면 감점</div>
        <ul class="jd-list">${g.avoid.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>

      <div class="jd-followup">
        <i class="ti ti-messages"></i> 이렇게 쓰면 면접에서 이걸 물어봅니다 —
        <b>“${esc(g.followup)}”</b>
      </div>

      <div class="jd-disclaimer"><i class="ti ti-alert-circle"></i> ${esc(r.disclaimer)}</div>`;
  }

  /* 요약 칩 → 해당 카드로 스크롤. 역량이 7개면 스크롤이 길어 목차가 필요하다. */
  function jump(i) {
    const card = document.querySelectorAll('#jd-result .jd-card')[i];
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('is-flash');
    void card.offsetWidth;                  // 같은 칩을 다시 눌러도 깜빡이게 리플로우
    card.classList.add('is-flash');
  }

  return { init, onEnter, jump, runNews };
})();
