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

  /* 즐겨찾기는 **자소서(회사) 단위**다(사용자 지시 2026-09-01). 예전에는 문항별
     (회사::항목)로 담았는데, 사람은 "이 회사 자소서" 를 다시 보지 문항 하나만 즐겨찾지
     않는다. 저장은 회사명만 넣고, 옛 '회사::항목' 값은 회사 즐겨찾기로 접어 읽는다. */
  function favCompanies() {
    return new Set(loadFavs().map(k => k.includes('::') ? k.split('::')[0] : k));
  }
  /* 그 회사의 옛/새 즐겨찾기 흔적을 모두 지운 목록을 돌려준다. */
  const favsWithout = company =>
    loadFavs().filter(k => k !== company && !k.startsWith(`${company}::`));

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
      /* 회사에 남은 글이 없으면 그 회사 즐겨찾기(자소서 단위)도 같이 지운다 —
         남겨 두면 없는 자소서가 별표를 달고 목록에 뜬다. */
      if (!all[company]) localStorage.setItem(LS_FAV, JSON.stringify(favsWithout(company)));
    },

    /* 회사(자소서) 하나를 통째로 지운다 — 보관함의 '자소서 단위' 삭제가 쓴다(2026-09-01).
       그 회사의 즐겨찾기도 같이 지운다. */
    removeCompany(company) {
      const all = loadAll();
      delete all[company];
      localStorage.setItem(LS_DRAFTS, JSON.stringify(all));
      localStorage.setItem(LS_FAV, JSON.stringify(favsWithout(company)));
    },

    isFav(company) { return favCompanies().has(company); },
    /* 자소서(회사) 단위 토글. 켤 때 회사명만 넣고, 옛 '회사::항목' 흔적은 지운다. */
    toggleFav(company) {
      const has = favCompanies().has(company);
      const favs = favsWithout(company);
      if (!has) favs.push(company);
      localStorage.setItem(LS_FAV, JSON.stringify(favs));
      return !has;
    },

    /* 회사별로 묶어 최근 순으로. 즐겨찾기한 회사가 먼저 온다 —
       즐겨찾기는 "다시 볼 자소서" 라 목록 맨 위에 있어야 뜻이 있다. */
    entries() {
      const favSet = favCompanies();
      return Object.entries(loadAll()).map(([company, items]) => {
        const drafts = Object.entries(items)
          .map(([label, v]) => ({ label, ...unwrap(v) }))
          .filter(d => d.text.trim())
          .sort((a, b) => (b.at || 0) - (a.at || 0));
        return { company, drafts, fav: favSet.has(company), at: drafts[0]?.at || 0 };
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
  /* ── 삭제(선택) 모드 (사용자 지시 2026-09-01) ─────────────────────────
     상단 '삭제'를 누르면 이 모드로 들어간다. 삭제 단위는 **자소서(회사) 하나 통째**다
     (사용자 지시) — 문항 1·2·3 을 따로 고르지 않고 그 회사의 자소서를 통으로 지운다.
     고른 것은 **회사명**의 Set 이다. */
  let _selMode = false;
  let _selected = new Set();

  /* 문항 미리보기 — 펼치면 내용을 보이되 **50자까지만**, 뒤는 …(사용자 지시 2026-09-01).
     공백은 한 칸으로 접어 한 줄로 보이게 한다(줄바꿈이 많은 초안이 세 줄로 벌어지지 않게). */
  function preview(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    return s.length > 50 ? `${esc(s.slice(0, 50))}…` : esc(s);
  }

  /* 모달 본문(#drafts-modal-body)에 그린다. 예전에는 #drafts 페이지의 #drafts-wrap 이었다
     (2026-09-01 모달로 대체). 페이지 머리(h1·설명)는 모달 헤더가 대신하므로 여기서는
     목록만 그린다. */
  function render() {
    const box = $('#drafts-modal-body');
    if (!box) return;
    const all = store.entries();
    const groups = _favOnly ? all.filter(g => g.fav) : all;
    const total = all.reduce((n, g) => n + g.drafts.length, 0);

    box.innerHTML = `
      ${total ? `
        <div class="dr-bar">
          <span class="dr-count"><b>${total.toLocaleString()}건</b> · 회사 ${all.length}곳</span>
          ${_selMode ? '' : `
            <button type="button" class="wf-btn wf-btn--sm ${_favOnly ? 'is-on' : ''}" data-fav-only>
              <i class="ti ti-star${_favOnly ? '-filled' : ''}"></i> 즐겨찾기
            </button>`}
          <button type="button" class="wf-btn wf-btn--sm dr-selbtn ${_selMode ? 'is-on' : ''}" data-sel-toggle>
            <i class="ti ti-trash"></i> ${_selMode ? '삭제 취소' : '삭제'}
          </button>
        </div>
        ${_selMode ? `
          <div class="dr-selhint">지울 <b>자소서</b>를 골라 주세요(회사 단위로 통째 삭제). <b>${_selected.size}개</b> 선택됨.</div>` : ''}

        ${groups.length ? `<div class="dr-list">
          ${groups.map(g => {
            const csel = _selected.has(g.company);
            return `
            <section class="dr-group ${_selMode && csel ? 'is-checked' : ''}">
              ${_selMode
                ? `<button type="button" class="dr-company dr-company--pick" data-check="${esc(g.company)}" aria-pressed="${csel}">
                     <span class="dr-check"><i class="ti ti-${csel ? 'square-check-filled' : 'square'}"></i></span>
                     <span class="wf-avatar wf-avatar--sm" style="--co-color:${accentOf(g.company)}">${esc(g.company.charAt(0))}</span>
                     <b>${esc(g.company)}</b>
                     <span class="wf-badge wf-badge--mute">${g.drafts.length}건</span>
                   </button>`
                : `<div class="dr-company ${g.fav ? 'is-fav' : ''}">
                     <button type="button" class="dr-fav" data-fav="${esc(g.company)}"
                             aria-pressed="${g.fav}" title="즐겨찾기">
                       <i class="ti ti-star${g.fav ? '-filled' : ''}"></i>
                     </button>
                     <span class="wf-avatar wf-avatar--sm" style="--co-color:${accentOf(g.company)}">${esc(g.company.charAt(0))}</span>
                     <b>${esc(g.company)}</b>
                     <span class="wf-badge wf-badge--mute">${g.drafts.length}건</span>
                     <button type="button" class="wf-btn wf-btn--xs" data-go="${esc(g.company)}">이 회사로 이어쓰기</button>
                   </div>`}
              ${g.drafts.map(d => {
                const key = keyOf(g.company, d.label);
                const open = _open === key;
                const meta = `<span class="dr-meta">${d.text.length.toLocaleString()}자${d.at ? ` · ${timeAgo(d.at)}` : ''}</span>`;
                /* 삭제 모드: 자소서를 회사 머리에서 통째로 고른다. 문항은 어떤 글인지 알아볼
                   수 있게 라벨만 읽기전용으로 보여준다(개별 선택 아님). */
                if (_selMode) {
                  return `<div class="dr-item dr-item--ro">
                    <span class="dr-open dr-open--static"><b>${esc(d.label)}</b>${meta}</span>
                  </div>`;
                }
                /* 일반 모드: 문항을 누르면(토글) 자신이 적은 내용을 미리보기로 편다(50자까지).
                   즐겨찾기는 문항이 아니라 **자소서(회사) 머리**에 있다(2026-09-01). */
                return `<article class="dr-item ${open ? 'is-open' : ''}">
                  <div class="dr-item-h">
                    <button type="button" class="dr-open" data-open="${esc(key)}" aria-expanded="${open}">
                      <b>${esc(d.label)}</b>
                      ${meta}
                      <i class="ti ti-chevron-down dr-chev"></i>
                    </button>
                  </div>
                  ${open ? `
                    <div class="dr-body">
                      <p class="dr-preview">${preview(d.text) || '<span class="dr-empty-in">아직 내용이 없어요</span>'}</p>
                      <div class="dr-act">
                        <button type="button" class="wf-btn wf-btn--xs wf-btn--primary" data-go="${esc(g.company)}">이어쓰기</button>
                        <button type="button" class="wf-btn wf-btn--xs" data-copy="${esc(key)}">복사</button>
                      </div>
                    </div>` : ''}
                </article>`;
              }).join('')}
            </section>`;
          }).join('')}
        </div>` : `<p class="dr-empty">즐겨찾기한 자소서가 없어요. 회사 이름 왼쪽의 별을 눌러 담아 두세요.</p>`}

        ${_selMode ? `
          <div class="dr-selbar">
            <button type="button" class="wf-btn wf-btn--sm" data-sel-all>
              ${_selected.size >= all.length && all.length ? '전체 해제' : '전체 선택'}
            </button>
            <span class="dr-selbar-sp"></span>
            <button type="button" class="wf-btn wf-btn--sm" data-sel-cancel>취소</button>
            <button type="button" class="wf-btn wf-btn--sm dr-del" data-sel-del
              ${_selected.size ? '' : 'disabled'}>
              <i class="ti ti-trash"></i> 선택 삭제${_selected.size ? ` (${_selected.size})` : ''}
            </button>
          </div>` : ''}
      ` : `
        <div class="dr-blank">
          <i class="ti ti-file-text"></i>
          <b>아직 저장된 자소서가 없어요</b>
          <p>자소서 코치에서 초안을 쓰면 여기에 회사별로 쌓입니다.</p>
          <button type="button" class="wf-btn wf-btn--primary" onclick="Drafts.close(); navigate('jd')">자소서 코치로 가기</button>
        </div>`}`;

    bind(box);
  }

  function bind(box) {
    const on = (sel, ev, fn) => box.querySelectorAll(sel).forEach(el => el.addEventListener(ev, () => fn(el)));

    on('[data-fav-only]', 'click', () => { _favOnly = !_favOnly; render(); });

    /* ── 삭제(선택) 모드 ──────────────────────────────────────────
       '삭제'로 켜고 끈다. 켜면 즐겨찾기 필터는 풀어 모든 글을 지울 후보로 보여준다 —
       필터가 걸려 있으면 "안 보이는 글은 왜 안 지워지지"가 된다. 끄면 고른 것도 비운다. */
    on('[data-sel-toggle]', 'click', () => {
      _selMode = !_selMode;
      _selected.clear();
      if (_selMode) { _favOnly = false; _open = null; }
      render();
    });
    on('[data-sel-cancel]', 'click', () => { _selMode = false; _selected.clear(); render(); });

    on('[data-check]', 'click', el => {
      const key = el.dataset.check;
      if (_selected.has(key)) _selected.delete(key); else _selected.add(key);
      render();
    });

    /* 전체 선택 ↔ 해제 — 지금 보이는 **회사(자소서)** 전부 기준. 이미 다 골랐으면 해제. */
    on('[data-sel-all]', 'click', () => {
      const companies = store.entries().map(g => g.company);
      if (companies.every(c => _selected.has(c))) _selected.clear();
      else companies.forEach(c => _selected.add(c));
      render();
    });

    /* 선택 삭제 — **자소서(회사) 통째**로 지운다. 되돌릴 수 없어 몇 개인지 밝혀 한 번 묻고,
       지운 뒤 모드를 나간다. */
    on('[data-sel-del]', 'click', () => {
      if (!_selected.size) return;
      if (!confirm(`선택한 자소서 ${_selected.size}개를 통째로 지울까요? 되돌릴 수 없어요.`)) return;
      for (const company of _selected) store.removeCompany(company);
      _selected.clear();
      _selMode = false;
      _open = null;
      render();
    });

    on('[data-open]', 'click', el => {
      _open = _open === el.dataset.open ? null : el.dataset.open;
      render();
    });

    on('[data-fav]', 'click', el => {
      store.toggleFav(el.dataset.fav);
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

    /* 이어쓰기 — **작성 화면(#write)** 으로 바로 간다(2026-09-01). 회사명을 넘기면
       작성 화면 onEnterWrite 가 그 회사로 화면을 세우고, 저장 칸(scope)이 회사명을
       따라가므로 예전 초안이 그대로 불러와진다. 회사 칸을 채우는 일은 작성 화면이
       한다 — 여기서 남의 화면 DOM 을 건드리면 아직 안 그려졌을 때 조용히 실패한다. */
    on('[data-go]', 'click', el => {
      localStorage.setItem('careerly_selected_company', el.dataset.go);
      close();
      navigate('write');
    });
  }

  /* ── 모달 열고 닫기 (2026-09-01) ──────────────────────────────
     페이지(#drafts)에서 모달(#drafts-modal)로 바뀌었다. 열 때마다 새로 그린다 —
     다른 화면에서 초안을 쓰다 열면 방금 쓴 글이 목록에 있어야 한다.
     openModal/closeModal 은 전역(mentoring.js) 이라 모달 규약을 공유한다. */
  function open() {
    _open = null;
    _selMode = false;
    _selected.clear();
    render();
    if (typeof openModal === 'function') openModal('drafts-modal');
  }
  function close() {
    if (typeof closeModal === 'function') closeModal('drafts-modal');
  }

  const api = { open, close, render, store, unwrap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node 테스트용
  root.Drafts = api;

})(typeof window !== 'undefined' ? window : globalThis);
