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
    view = 'list'; page = 1; category = '';
    await loadList();
  }

  async function loadList() {
    const box = root();
    if (box) box.innerHTML = loadingHtml();
    try {
      listData = await DB.listInsights({ category, page, limit: LIMIT });
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

      <div class="insight-list">
        ${listData.posts.length ? listData.posts.map(postRowHtml).join('') : emptyListHtml()}
      </div>

      ${pages > 1 ? pagerHtml(page, pages) : ''}
    `;
  }

  function postRowHtml(p) {
    return `
      <button class="insight-row" data-open="${esc(p.id)}">
        <span class="insight-row-cat">${esc(catLabel(p.category))}</span>
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
    try {
      const { post } = await DB.createInsight({ category: cat, title, body });
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
