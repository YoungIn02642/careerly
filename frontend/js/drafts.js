/* ════════════════════════════════════════════════════════════
   C:road — 내 자소서 보관함 (#drafts)

   ── 왜 별도 페이지인가 (사용자 지시 2026-08-28) ──
   예전에는 자소서 코치 화면 **맨 아래**에 붙어 있었다. 쓰는 화면의 꼬리라서, 어제 쓴
   글을 보려면 공고 입력칸과 분석 결과를 다 지나 내려가야 했다. 글 목록은 쓰던 흐름의
   부산물이 아니라 **따로 찾아가는 자리**다. 그래서 자기 페이지로 옮기고, 코치 화면
   왼쪽 사이드바에서 들어간다.

   ── 저장소는 여기가 단일 출처다 ──
   초안 본문은 `careerly_jd_drafts_v1`(회사 → 항목 → { text, at }), 즐겨찾기는
   `careerly_jd_fav_v1`(회사::항목 목록)다. **jd-coach.js 도 이 파일의 store 를 통해서만
   읽고 쓴다** — 같은 localStorage 키를 두 파일이 각자 파싱하면 한쪽 모양만 바뀐다
   (실제로 초안 저장 형식이 문자열 → { text, at } 로 바뀐 적이 있다. unwrap 참고).

   서버에 두지 않는 이유는 예전 그대로다: 계정·동기화·삭제 정책이 따라붙는데 그 설계가
   아직 없다. **기기를 옮기면 안 따라온다는 한계는 화면에 적는다.** */
(function (root) {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const LS_DRAFTS = 'careerly_jd_drafts_v1';
  const LS_FAV = 'careerly_jd_fav_v1';

  /* 저장 형태가 두 가지다. 처음에는 문자열만 넣었는데(v1), "언제 쓴 글인지"를 보여주려면
     시각이 필요해 { text, at } 로 바꿨다(v2). 이미 저장해 둔 초안을 버릴 수 없으므로
     **읽을 때 두 모양을 다 받는다.** 다음에 저장될 때 자연스럽게 v2 가 된다. */
  function unwrap(v) {
    if (typeof v === 'string') return { text: v, at: null };
    if (v && typeof v === 'object') return { text: String(v.text || ''), at: v.at || null };
    return { text: '', at: null };
  }

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(LS_DRAFTS)) || {}; } catch { return {}; }
  }
  function loadFavs() {
    try { const v = JSON.parse(localStorage.getItem(LS_FAV)); return Array.isArray(v) ? v : []; }
    catch { return []; }
  }
  const keyOf = (company, label) => `${company}::${label}`;

  const store = {
    all: loadAll,
    get(company, label) { return unwrap(loadAll()[company]?.[label]).text; },

    /* 빈 글은 흔적을 남기지 않는다 — 지운 자리에 제목만 남으면 목록이 거짓말을 한다. */
    set(company, label, text) {
      const all = loadAll();
      all[company] = all[company] || {};
      if (String(text || '').trim()) all[company][label] = { text, at: Date.now() };
      else delete all[company][label];
      if (!Object.keys(all[company]).length) delete all[company];
      localStorage.setItem(LS_DRAFTS, JSON.stringify(all));
    },

    remove(company, label) {
      const all = loadAll();
      if (all[company]) {
        delete all[company][label];
        if (!Object.keys(all[company]).length) delete all[company];
      }
      localStorage.setItem(LS_DRAFTS, JSON.stringify(all));
      /* 즐겨찾기도 같이 지운다. 남겨 두면 없는 글이 별표를 달고 목록에 뜬다. */
      const favs = loadFavs().filter(k => k !== keyOf(company, label));
      localStorage.setItem(LS_FAV, JSON.stringify(favs));
    },

    isFav(company, label) { return loadFavs().includes(keyOf(company, label)); },
    toggleFav(company, label) {
      const k = keyOf(company, label);
      const favs = loadFavs();
      const at = favs.indexOf(k);
      if (at >= 0) favs.splice(at, 1); else favs.push(k);
      localStorage.setItem(LS_FAV, JSON.stringify(favs));
      return at < 0;
    },

    /* 회사별로 묶어 최근 순으로. 즐겨찾기가 하나라도 있는 회사가 먼저 온다 —
       즐겨찾기는 "다시 볼 글" 이라 목록 맨 위에 있어야 뜻이 있다. */
    entries() {
      const favs = loadFavs();
      return Object.entries(loadAll()).map(([company, items]) => {
        const drafts = Object.entries(items)
          .map(([label, v]) => ({ label, fav: favs.includes(keyOf(company, label)), ...unwrap(v) }))
          .filter(d => d.text.trim())
          .sort((a, b) => (b.fav - a.fav) || ((b.at || 0) - (a.at || 0)));
        return { company, drafts, fav: drafts.some(d => d.fav), at: drafts[0]?.at || 0 };
      }).filter(g => g.drafts.length)
        .sort((a, b) => (b.fav - a.fav) || (b.at - a.at));
    },

    count() {
      return store.entries().reduce((n, g) => n + g.drafts.length, 0);
    },
  };

  /* ── 화면 ─────────────────────────────────────────────────── */

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

  /* 회사명 색은 회사 리포트·코치 화면과 같은 규칙으로 고른다(같은 회사 = 같은 색). */
  const ACCENTS = ['#7a3dff', '#ed52cb', '#3b89ff', '#ff6b00', '#00a83a'];
  function accentOf(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 9973;
    return ACCENTS[h % ACCENTS.length];
  }

  let _open = null;        // 펼쳐 본 글 (회사::항목)
  let _favOnly = false;    // 즐겨찾기만 보기

  function render() {
    const box = $('#drafts-wrap');
    if (!box) return;
    const all = store.entries();
    const groups = _favOnly ? all.map(g => ({ ...g, drafts: g.drafts.filter(d => d.fav) })).filter(g => g.drafts.length) : all;
    const total = all.reduce((n, g) => n + g.drafts.length, 0);
    const favTotal = all.reduce((n, g) => n + g.drafts.filter(d => d.fav).length, 0);

    box.innerHTML = `
      <div class="jd-head">
        <div class="wf-eyebrow wf-eyebrow--lg">My cover letters</div>
        <h1>내 자소서 보관함</h1>
        <p>자소서 코치에서 쓴 초안이 회사별로 쌓입니다. 하나를 골라 <b>이어쓰기</b>로 돌아가거나,
          자주 보는 글에 <b>즐겨찾기</b>를 달아 두세요.
          <b>이 브라우저에만 저장</b>되니 기기를 옮기면 따라오지 않아요.</p>
      </div>

      ${total ? `
        <div class="dr-bar">
          <span class="dr-count"><b>${total.toLocaleString()}건</b> · 회사 ${all.length}곳</span>
          <button type="button" class="wf-btn wf-btn--sm ${_favOnly ? 'is-on' : ''}" data-fav-only>
            <i class="ti ti-star${_favOnly ? '-filled' : ''}"></i> 즐겨찾기만 (${favTotal})
          </button>
          <button type="button" class="wf-btn wf-btn--sm wf-btn--primary" onclick="navigate('jd')">
            <i class="ti ti-pencil"></i> 새 자소서 쓰기
          </button>
        </div>

        ${groups.length ? `<div class="dr-list">
          ${groups.map(g => `
            <section class="dr-group">
              <div class="dr-company">
                <span class="wf-avatar wf-avatar--sm" style="--co-color:${accentOf(g.company)}">${esc(g.company.charAt(0))}</span>
                <b>${esc(g.company)}</b>
                <span class="wf-badge wf-badge--mute">${g.drafts.length}건</span>
                <button type="button" class="wf-btn wf-btn--xs" data-go="${esc(g.company)}">
                  이 회사로 이어쓰기
                </button>
              </div>
              ${g.drafts.map(d => {
                const key = keyOf(g.company, d.label);
                const open = _open === key;
                return `<article class="dr-item ${open ? 'is-open' : ''} ${d.fav ? 'is-fav' : ''}">
                  <div class="dr-item-h">
                    <button type="button" class="dr-fav" data-fav="${esc(key)}"
                            aria-pressed="${d.fav}" title="즐겨찾기">
                      <i class="ti ti-star${d.fav ? '-filled' : ''}"></i>
                    </button>
                    <button type="button" class="dr-open" data-open="${esc(key)}">
                      <b>${esc(d.label)}</b>
                      <span class="dr-meta">${d.text.length.toLocaleString()}자${d.at ? ` · ${timeAgo(d.at)}` : ''}</span>
                      <i class="ti ti-chevron-down dr-chev"></i>
                    </button>
                  </div>
                  ${open ? `
                    <div class="dr-body">
                      <pre class="dr-text">${esc(d.text)}</pre>
                      <div class="dr-act">
                        <button type="button" class="wf-btn wf-btn--xs wf-btn--primary" data-go="${esc(g.company)}">이어쓰기</button>
                        <button type="button" class="wf-btn wf-btn--xs" data-copy="${esc(key)}">복사</button>
                        <button type="button" class="wf-btn wf-btn--xs dr-del" data-del="${esc(key)}">삭제</button>
                      </div>
                    </div>` : ''}
                </article>`;
              }).join('')}
            </section>`).join('')}
        </div>` : `<p class="dr-empty">즐겨찾기한 글이 없어요. 글 왼쪽의 별을 눌러 담아 두세요.</p>`}
      ` : `
        <div class="dr-blank">
          <i class="ti ti-file-text"></i>
          <b>아직 저장된 자소서가 없어요</b>
          <p>자소서 코치에서 초안을 쓰면 여기에 회사별로 쌓입니다.</p>
          <button type="button" class="wf-btn wf-btn--primary" onclick="navigate('jd')">자소서 코치로 가기</button>
        </div>`}`;

    bind(box);
  }

  function bind(box) {
    const on = (sel, ev, fn) => box.querySelectorAll(sel).forEach(el => el.addEventListener(ev, () => fn(el)));

    on('[data-fav-only]', 'click', () => { _favOnly = !_favOnly; render(); });

    on('[data-open]', 'click', el => {
      _open = _open === el.dataset.open ? null : el.dataset.open;
      render();
    });

    on('[data-fav]', 'click', el => {
      const [company, label] = el.dataset.fav.split('::');
      store.toggleFav(company, label);
      render();
    });

    on('[data-copy]', 'click', async el => {
      const [company, label] = el.dataset.copy.split('::');
      try {
        await navigator.clipboard.writeText(store.get(company, label));
        el.textContent = '복사됨';
        setTimeout(() => { el.textContent = '복사'; }, 1500);
      } catch { el.textContent = '복사 실패'; }
    });

    /* 지우면 되돌릴 수 없다 — 자소서는 다시 쓰기 어려운 글이라 한 번 묻는다. */
    on('[data-del]', 'click', el => {
      const [company, label] = el.dataset.del.split('::');
      if (!confirm(`${company} · ${label} 초안을 지울까요? 되돌릴 수 없어요.`)) return;
      store.remove(company, label);
      _open = null;
      render();
    });

    /* 이어쓰기 — 코치 화면으로 가면서 회사명을 넘긴다. 저장 칸(scope)이 회사명을
       따라가므로, 그 회사로 분석을 돌리면 예전 초안이 그대로 불러와진다.
       회사 칸을 채우는 일은 코치 화면이 한다(onEnter 가 이 키를 읽는다) — 여기서
       남의 화면의 DOM 을 건드리면 그 화면이 아직 안 그려졌을 때 조용히 실패한다. */
    on('[data-go]', 'click', el => {
      localStorage.setItem('careerly_selected_company', el.dataset.go);
      navigate('jd');
    });
  }

  function onEnter() { _open = null; render(); }

  const api = { onEnter, render, store, unwrap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node 테스트용
  root.Drafts = api;

})(typeof window !== 'undefined' ? window : globalThis);
