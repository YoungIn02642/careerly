// ════════════════════════════════════════════════════════════
//  C:road — 커리어 인사이트 (정보를 주고받는 커뮤니티 게시판)
//   • 목록(카테고리·페이지) → 상세(본문+댓글) → 글쓰기, 세 화면을 한 페이지 안에서
//     전환한다. 다른 로드맵/자소서 페이지처럼 컨테이너 하나를 innerHTML 로 갈아끼운다.
//   • 카테고리 목록은 서버가 단일 출처다(routes/insight.js CATEGORIES) — 여기서는
//     한 번 받아 캐시해 두고 화면에 그대로 쓴다.
// ════════════════════════════════════════════════════════════
window.Insight = (() => {
  let categories = [];      // [{id,label}], onEnter 에서 한 번 받는다
  let view = 'list';        // 'list' | 'detail' | 'write'
  let category = '';        // '' = 전체
  let page = 1;
  const LIMIT = 20;
  let listData = { posts: [], total: 0 };
  /* 검색 — q 가 비면 평소 목록이다.
     검색 중에는 서버가 공지를 위로 고정하지 않는다(routes/insight.js 주석).

     ── 범위 목록은 서버와 짝이다 ──
     id 는 `routes/insight.js` 의 SEARCH_SCOPES 와 정확히 같아야 한다. 한쪽만
     늘리면 모르는 값이 들어와 **조용히 기본값으로 떨어진다** — 사용자는 범위를
     골랐는데 결과가 안 바뀌는 것으로 보인다.

     기본값이 'all'(제목+내용)인 이유: 처음 온 사람은 범위를 고를 생각을 안 하므로
     가장 넓게 잡아 두는 편이 "왜 안 나오지" 를 줄인다. */
  const SCOPES = [
    ['all',     '제목+내용'],
    ['title',   '제목'],
    ['body',    '내용'],
    ['author',  '글쓴이'],
    ['comment', '댓글'],
  ];
  const scopeLabel = id => (SCOPES.find(([s]) => s === id) || SCOPES[0])[1];

  let q = '';
  let scope = 'all';
  let currentPostId = null;
  let detailData = null;    // { post, comments }
  let writeError = '';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = d => (d || '').slice(0, 16);
  const catLabel = id => categories.find(c => c.id === id)?.label || id;

  function root() { return document.getElementById('insight-root'); }

  /* 다른 화면이 "이 글을 열어라" 하고 넘길 때 쓰는 자리. 홈의 커리어 인사이트
     카드가 쓴다. 회사 찾기의 `careerly_company_open` 과 같은 규약이다 —
     navigate() 와 onEnter() 의 순서에 기대지 않으려고 키로 주고받는다. */
  const LS_OPEN = 'careerly_insight_open';

  async function onEnter() {
    if (!categories.length) {
      try { categories = (await DB.insightCategories()).categories; }
      catch { categories = []; }
    }
    view = 'list'; page = 1; category = ''; q = ''; scope = 'all';

    /* 넘겨받은 글이 있으면 목록 대신 그 글부터 연다. 키는 한 번 쓰고 지운다 —
       남겨 두면 다음에 인사이트를 눌렀을 때도 같은 글이 열려서, 목록으로
       돌아갈 수 없는 것처럼 보인다(회사 찾기에서 실제로 겪은 문제와 같다). */
    let handoff = null;
    try {
      handoff = localStorage.getItem(LS_OPEN);
      if (handoff) localStorage.removeItem(LS_OPEN);
    } catch { /* 프라이빗 모드 */ }

    if (handoff) { await openPost(handoff); return; }
    await loadList();
  }

  async function loadList() {
    const box = root();
    if (box) box.innerHTML = loadingHtml();
    try {
      listData = await DB.listInsights({ category, page, limit: LIMIT, q, scope });
    } catch (e) {
      if (box) box.innerHTML = errorHtml(e.message);
      return;
    }
    render();
  }

  function render() {
    const box = root();
    if (!box) return;
    if (view === 'detail') box.innerHTML = detailHtml();
    else if (view === 'write') box.innerHTML = writeHtml();
    else box.innerHTML = listHtml();
    bindEvents();
  }

  function loadingHtml() {
    return `<div class="insight-loading"><i class="ti ti-loader-2"></i> 불러오는 중…</div>`;
  }
  function errorHtml(msg) {
    return `<div class="insight-error"><i class="ti ti-alert-circle"></i> ${esc(msg)}</div>`;
  }

  // ── 목록 ────────────────────────────────────────────────────
  function listHtml() {
    const user = DB.currentUser();
    const tabs = [{ id: '', label: '전체' }, ...categories];
    const pages = Math.max(1, Math.ceil(listData.total / LIMIT));

    return `
      <div class="page-head">
        <div class="page-eyebrow">Career Insight</div>
        <h1 class="page-title">커리어 인사이트</h1>
        <p class="page-desc">취업·인턴·자격증처럼 <b>정보가 될 만한 것</b>을 서로 나누는 공간이에요.
          궁금한 걸 묻고, 아는 걸 나눠주세요.</p>
      </div>

      <div class="insight-toolbar">
        <div class="insight-tabs">
          ${tabs.map(t => `<button class="insight-tab ${category === t.id ? 'on' : ''}" data-cat="${esc(t.id)}">${esc(t.label)}</button>`).join('')}
        </div>
        ${user
          ? `<button class="btn-brand insight-write-btn" id="insight-write-open"><i class="ti ti-pencil"></i> 글쓰기</button>`
          : `<span class="insight-login-hint">로그인하면 글을 쓸 수 있어요</span>`}
      </div>

      <!-- 검색 — 범위 · 검색어 · 버튼 순서다. 게시판에서 흔히 쓰는 배치라
           설명 없이도 어디를 고르고 어디에 치는지 바로 읽힌다.

           범위를 버튼 두 개(제목만 / 제목+내용)로 두었었는데, 늘려야 할 범위가
           다섯이라 버튼으로는 줄이 넘친다. 목록에서 하나를 고르는 일이므로
           <select> 가 맞다 — 모바일에서 기본 선택기가 뜨는 이점도 있다. -->
      <div class="insight-search">
        <label class="insight-scope-wrap">
          <span class="sr-only">검색 범위</span>
          <select id="insight-scope" class="insight-scope-select">
            ${SCOPES.map(([id, label]) =>
              `<option value="${id}" ${scope === id ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <label class="insight-search-box">
          <input type="search" id="insight-q" value="${esc(q)}"
                 placeholder="검색어를 입력해주세요" aria-label="게시글 검색" />
        </label>
        <button class="insight-search-btn" id="insight-search-go">검색</button>
      </div>

      ${q ? `<div class="insight-search-note">
          <b>‘${esc(q)}’</b> ${esc(scopeLabel(scope))} 검색 결과 ${listData.total}건
          ${listData.total ? ' · 검색 중에는 공지를 위로 고정하지 않아요' : ''}
          <button class="insight-search-clear" id="insight-search-clear">
            <i class="ti ti-x"></i> 검색 해제</button>
        </div>` : ''}

      <div class="insight-list">
        ${listData.posts.length ? listData.posts.map(postRowHtml).join('') : emptyListHtml()}
      </div>

      ${pages > 1 ? pagerHtml(page, pages) : ''}
    `;
  }

  /* 공지는 카테고리 자리에 '공지' 배지를 놓고 줄 전체를 다르게 칠한다.
     같은 모양에 글자만 다르면 목록을 훑을 때 그냥 지나친다. */
  function postRowHtml(p) {
    return `
      <button class="insight-row ${p.isNotice ? 'is-notice' : ''}" data-open="${esc(p.id)}">
        <span class="insight-row-cat">${p.isNotice
          ? '<i class="ti ti-speakerphone"></i> 공지'
          : esc(catLabel(p.category))}</span>
        <span class="insight-row-body">
          <span class="insight-row-title">${esc(p.title)}
            ${p.commentCount ? `<span class="insight-row-cc">${p.commentCount}</span>` : ''}
          </span>
          <span class="insight-row-preview">${esc(p.preview)}</span>
        </span>
        <span class="insight-row-meta">
          <span>${esc(p.authorName)}</span>
          <span>${fmtDate(p.createdAt)}</span>
          <span><i class="ti ti-eye"></i> ${p.viewCount}</span>
        </span>
      </button>`;
  }

  function emptyListHtml() {
    /* 검색 결과가 없는 것과 글이 아직 없는 것은 사용자가 할 일이 다르다. */
    if (q) {
      return `<div class="empty-block"><div class="empty-icon">🔍</div>
        <div class="empty-title">‘${esc(q)}’ 검색 결과가 없어요</div>
        <div class="empty-desc">${scope === 'all'
          ? '다른 낱말로 찾아보거나 검색을 해제해 보세요.'
          : `지금은 <b>${esc(scopeLabel(scope))}</b>만 찾고 있어요. <b>제목+내용</b>으로 넓혀 보세요.`}
        </div></div>`;
    }
    return `<div class="empty-block"><div class="empty-icon">📭</div>
      <div class="empty-title">아직 글이 없어요</div>
      <div class="empty-desc">이 카테고리에 첫 글을 남겨보세요.</div></div>`;
  }

  function pagerHtml(cur, pages) {
    const nums = [];
    for (let n = Math.max(1, cur - 2); n <= Math.min(pages, cur + 2); n++) nums.push(n);
    return `<div class="pager">
      <button class="pg-arrow" ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}"><i class="ti ti-chevron-left"></i> 이전</button>
      ${nums.map(n => `<button class="pg-num ${n === cur ? 'on' : ''}" data-page="${n}">${n}</button>`).join('')}
      <button class="pg-arrow" ${cur === pages ? 'disabled' : ''} data-page="${cur + 1}">다음 <i class="ti ti-chevron-right"></i></button>
    </div>`;
  }

  // ── 상세 ────────────────────────────────────────────────────
  async function openPost(id) {
    currentPostId = id;
    view = 'detail';
    const box = root();
    if (box) box.innerHTML = loadingHtml();
    try {
      detailData = await DB.getInsight(id);
    } catch (e) {
      if (box) box.innerHTML = errorHtml(e.message);
      return;
    }
    render();
  }

  function detailHtml() {
    const { post, comments } = detailData;
    const user = DB.currentUser();
    const mine = user && user.id === post.authorId;

    return `
      <button class="insight-back" id="insight-back"><i class="ti ti-arrow-left"></i> 목록으로</button>
      <article class="insight-post">
        <div class="insight-post-cat">${esc(catLabel(post.category))}</div>
        <h1 class="insight-post-title">${esc(post.title)}</h1>
        <div class="insight-post-meta">
          <span>${esc(post.authorName)}</span>
          <span>${fmtDate(post.createdAt)}</span>
          <span><i class="ti ti-eye"></i> ${post.viewCount}</span>
        </div>
        <!-- 본문은 마크다운이다(사용자 지시). Markdown.render 가 **escape 를 먼저 하고**
             아는 문법만 태그로 바꾼다 — 여기서 esc() 를 한 번 더 씌우면 태그가 글자로 보인다.
             안전성의 근거는 test/markdown.test.js 의 XSS 절이다. -->
        <div class="insight-post-body insight-md">${Markdown.render(post.body)}</div>
        ${mine ? `<div class="insight-post-actions">
          <button class="topbar-link" id="insight-delete-post"><i class="ti ti-trash"></i> 삭제</button>
        </div>` : ''}
      </article>

      <div class="insight-comments">
        <div class="section-title">댓글 ${comments.length}개</div>
        <div class="insight-comment-list">
          ${comments.length ? comments.map(c => commentHtml(c, user)).join('') : `<div class="insight-no-comment">아직 댓글이 없어요.</div>`}
        </div>
        ${user ? `
        <div class="insight-comment-form">
          <textarea id="insight-comment-input" rows="2" maxlength="1000" placeholder="댓글을 남겨보세요"></textarea>
          <button class="btn-brand" id="insight-comment-submit"><i class="ti ti-send"></i> 등록</button>
        </div>` : `<div class="insight-login-hint">로그인하면 댓글을 남길 수 있어요</div>`}
      </div>
    `;
  }

  function commentHtml(c, user) {
    const mine = user && user.id === c.authorId;
    return `
      <div class="insight-comment" data-comment="${esc(c.id)}">
        <div class="insight-comment-head">
          <b>${esc(c.authorName)}</b><span>${fmtDate(c.createdAt)}</span>
          ${mine ? `<button class="insight-comment-del" data-del-comment="${esc(c.id)}"><i class="ti ti-x"></i></button>` : ''}
        </div>
        <div class="insight-comment-body">${esc(c.body)}</div>
      </div>`;
  }

  // ── 글쓰기 ──────────────────────────────────────────────────
  function openWrite() {
    if (!DB.currentUser()) return;
    view = 'write';
    writeError = '';
    render();
  }

  function writeHtml() {
    return `
      <button class="insight-back" id="insight-back"><i class="ti ti-arrow-left"></i> 목록으로</button>
      <div class="page-head">
        <h1 class="page-title">글쓰기</h1>
      </div>
      <div class="insight-write">
        <select id="insight-write-cat">
          ${categories.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('')}
        </select>
        <input type="text" id="insight-write-title" maxlength="200" placeholder="제목" />
        <textarea id="insight-write-body" rows="10" placeholder="내용을 적어주세요"></textarea>
        <!-- 쓸 수 있는 문법을 적어 둔다. 마크다운이 되는지 모르면 아무도 안 쓰고,
             모르고 쓴 별표가 굵게로 바뀌면 그건 그것대로 놀란다. -->
        <p class="insight-md-hint">
          <b>마크다운</b>으로 쓸 수 있어요 —
          <code>## 제목</code> · <code>**굵게**</code> · <code>- 목록</code> ·
          <code>&gt; 인용</code> · <code>---</code> · <code>[글자](https://…)</code>
        </p>
        ${DB.currentUser()?.isAdmin ? `
          <label class="insight-notice-toggle">
            <input type="checkbox" id="insight-write-notice" />
            <span><b>공지로 올리기</b> — 목록 맨 위에 고정되고 다른 색으로 표시됩니다. 관리자만 보이는 항목이에요.</span>
          </label>` : ''}
        ${writeError ? `<div class="error-box">${esc(writeError)}</div>` : ''}
        <div class="insight-write-actions">
          <button class="btn-save" id="insight-write-submit">등록</button>
          <button class="btn-cancel" id="insight-write-cancel">취소</button>
        </div>
      </div>
    `;
  }

  async function submitPost() {
    const cat = document.getElementById('insight-write-cat').value;
    const title = document.getElementById('insight-write-title').value.trim();
    const body = document.getElementById('insight-write-body').value.trim();
    const isNotice = Boolean(document.getElementById('insight-write-notice')?.checked);
    try {
      const { post } = await DB.createInsight({ category: cat, title, body, isNotice });
      await openPost(post.id);
    } catch (e) {
      writeError = e.message;
      render();
    }
  }

  // ── 이벤트 위임 ─────────────────────────────────────────────
  function bindEvents() {
    const box = root();
    if (!box) return;

    box.querySelectorAll('[data-cat]').forEach(btn => btn.addEventListener('click', () => {
      category = btn.dataset.cat; page = 1; loadList();
    }));

    // ── 검색 ──
    const qInput = box.querySelector('#insight-q');
    const scopeSel = box.querySelector('#insight-scope');
    /* 범위는 **검색을 누를 때 함께 읽는다.** 고르자마자 다시 찾으면, 검색어를
       치기도 전에 범위만 바꾼 사용자에게 같은 목록을 다시 받아오게 된다.
       고른 값은 화면을 다시 그려도 남아야 하므로 state 에도 즉시 반영한다. */
    scopeSel?.addEventListener('change', () => { scope = scopeSel.value; });
    const runSearch = () => {
      if (scopeSel) scope = scopeSel.value;
      q = (qInput?.value || '').trim();
      page = 1;
      loadList();
    };
    /* Enter 로도 검색된다. 한글 조합 중 Enter 는 글자를 확정하는 키라 넘긴다 —
       '취업'을 확정하려던 순간에 '취어'로 검색되면 안 된다. */
    qInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.isComposing) runSearch();
    });
    box.querySelector('#insight-search-go')?.addEventListener('click', runSearch);
    /* 검색 해제는 검색어만 지운다 — 고른 범위는 남긴다. 같은 범위로 다른 낱말을
       찾는 흐름이 흔한데, 범위까지 되돌리면 매번 다시 골라야 한다. */
    box.querySelector('#insight-search-clear')?.addEventListener('click', () => {
      q = ''; page = 1; loadList();
    });
    box.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => {
      const n = Number(btn.dataset.page);
      if (n >= 1) { page = n; loadList(); }
    }));
    box.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => openPost(btn.dataset.open)));

    document.getElementById('insight-write-open')?.addEventListener('click', openWrite);
    document.getElementById('insight-write-cancel')?.addEventListener('click', () => { view = 'list'; loadList(); });
    document.getElementById('insight-write-submit')?.addEventListener('click', submitPost);
    document.getElementById('insight-back')?.addEventListener('click', () => { view = 'list'; loadList(); });

    document.getElementById('insight-delete-post')?.addEventListener('click', async () => {
      if (!confirm('이 글을 삭제할까요? 되돌릴 수 없어요.')) return;
      try {
        await DB.deleteInsight(currentPostId);
        view = 'list'; loadList();
      } catch (e) { alert(e.message); }
    });

    document.getElementById('insight-comment-submit')?.addEventListener('click', async () => {
      const input = document.getElementById('insight-comment-input');
      const body = input.value.trim();
      if (!body) return;
      try {
        await DB.addInsightComment(currentPostId, body);
        await openPost(currentPostId);
      } catch (e) { alert(e.message); }
    });

    box.querySelectorAll('[data-del-comment]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('댓글을 삭제할까요?')) return;
      try {
        await DB.deleteInsightComment(currentPostId, btn.dataset.delComment);
        await openPost(currentPostId);
      } catch (e) { alert(e.message); }
    }));
  }

  return { onEnter, LS_OPEN };
})();
