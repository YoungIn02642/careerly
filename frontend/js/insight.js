// ════════════════════════════════════════════════════════════
//  CAREERLY — 커리어 인사이트 (정보를 주고받는 커뮤니티 게시판)
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
  /* 검색 — q 가 비면 평소 목록이다. scope 는 '제목만' | '제목+내용'.
     검색 중에는 서버가 공지를 위로 고정하지 않는다(routes/insight.js 주석). */
  let q = '';
  let scope = 'title';
  let currentPostId = null;
  let detailData = null;    // { post, comments }
  let writeError = '';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = d => (d || '').slice(0, 16);
  const catLabel = id => categories.find(c => c.id === id)?.label || id;

  function root() { return document.getElementById('insight-root'); }

  async function onEnter() {
    if (!categories.length) {
      try { categories = (await DB.insightCategories()).categories; }
      catch { categories = []; }
    }
    view = 'list'; page = 1; category = ''; q = ''; scope = 'title';
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

      <!-- 검색 — 범위를 사용자가 고른다. 제목만 보면 정확하고, 본문까지 보면
           더 많이 걸린다. 어느 쪽이 나은지는 찾는 사람이 안다. -->
      <div class="insight-search">
        <label class="insight-search-box">
          <i class="ti ti-search"></i>
          <input type="search" id="insight-q" value="${esc(q)}"
                 placeholder="검색어를 입력하세요" aria-label="게시글 검색" />
        </label>
        <div class="insight-scope" role="group" aria-label="검색 범위">
          <button class="insight-scope-btn ${scope === 'title' ? 'on' : ''}" data-scope="title">제목만</button>
          <button class="insight-scope-btn ${scope === 'all' ? 'on' : ''}" data-scope="all">제목+내용</button>
        </div>
        <button class="btn-save insight-search-btn" id="insight-search-go">검색</button>
        ${q ? `<button class="insight-search-clear" id="insight-search-clear">
                 <i class="ti ti-x"></i> 검색 해제</button>` : ''}
      </div>

      ${q ? `<div class="insight-search-note">
          <b>‘${esc(q)}’</b> ${scope === 'all' ? '제목+내용' : '제목'} 검색 결과 ${listData.total}건
          ${listData.total ? ' · 검색 중에는 공지를 위로 고정하지 않아요' : ''}
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
        <div class="empty-desc">${scope === 'title'
          ? '제목만 찾고 있어요. <b>제목+내용</b>으로 넓혀 보세요.'
          : '다른 낱말로 찾아보거나 검색을 해제해 보세요.'}</div></div>`;
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
        <div class="insight-post-body">${esc(post.body)}</div>
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
    const runSearch = () => {
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
    box.querySelector('#insight-search-clear')?.addEventListener('click', () => {
      q = ''; page = 1; loadList();
    });
    /* 범위를 바꾸면 곧바로 다시 찾는다 — 이미 검색 중일 때만.
       검색어가 없는데 다시 부르면 같은 목록을 또 받아온다. */
    box.querySelectorAll('[data-scope]').forEach(btn => btn.addEventListener('click', () => {
      scope = btn.dataset.scope;
      if (q) { page = 1; loadList(); } else { render(); }
    }));
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

  return { onEnter };
})();
