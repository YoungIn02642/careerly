/* ════════════════════════════════════════════════════════════
   회사 찾기 (#page-company)

   한 페이지가 상태 두 개를 쓴다.
     · 아직 회사를 안 골랐을 때 — 화면 가운데 검색창 하나(사이드바 없음).
       예전에는 짙은 사이드바가 286px 을 먹으면서 검색창 하나만 담고 있었고,
       본문에는 회사를 바꿔도 안 바뀌는 안내문 4칸이 있었다. 둘 다 없앴다.
     · 회사를 고른 뒤 — 왼쪽 목록 + 오른쪽 기업 리포트.

   ── 이 화면이 존재하는 이유를 숫자로 세운다 ──
   리포트 우상단의 '지원동기 근거 n/5' 게이지가 그것이다. 기사·실적을 읽는 것이
   목적이 아니라 **자소서에 인용할 사실을 담는 것**이 목적이라, 담은 개수를 센다.
   담은 근거는 자소서 코치 1번 칸(#jd-evidence)에 그대로 나타난다.

   ── 없는 값을 지어내지 않는다 ──
   사원수·채용중 공고 수 같은 건 지금 API 에 없다. 화면을 채우자고 만들어 넣으면
   학생이 그걸 자소서에 쓴다. 있는 것(DART 재무·업종코드, 뉴스)만 보여주고,
   없는 칸은 왜 없는지를 적는다.
   ════════════════════════════════════════════════════════════ */
window.CompanyCover = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* 디자인 시스템의 유채색 5종. 면을 채우는 용도로만 쓴다(버튼 배경으로 쓰지 않는다).
     회사명을 해시해 고르므로 같은 회사는 언제나 같은 색이다. */
  const ACCENTS = ['#7a3dff', '#ed52cb', '#3b89ff', '#ff6b00', '#00a83a'];
  function accentOf(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 9973;
    return ACCENTS[h % ACCENTS.length];
  }

  /* 검색 없이 들어와도 누를 것이 있게 두는 목록. 업종은 미리 적어 둔 값이고,
     그 밖의 회사는 카탈로그 검색(/api/company/suggest)에서 찾는다. */
  const FEATURED = [
    { name: '삼성전자',       industry: '전자·반도체' },
    { name: '카카오',         industry: 'IT·플랫폼' },
    { name: '네이버',         industry: 'IT·검색·콘텐츠' },
    { name: '현대자동차',     industry: '자동차·모빌리티' },
    { name: '토스',           industry: '핀테크' },
    { name: 'SK하이닉스',     industry: '반도체' },
    { name: 'LG에너지솔루션', industry: '배터리' },
    { name: 'CJ제일제당',     industry: '식품·바이오' },
  ];

  const LS_RECENT   = 'careerly_recent_companies_v1';
  const LS_EVIDENCE = 'careerly_company_evidence_v1';

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };

  const recent = () => readJson(LS_RECENT, []).filter(Boolean);
  function pushRecent(name) {
    const list = [name, ...recent().filter(n => n !== name)].slice(0, 8);
    localStorage.setItem(LS_RECENT, JSON.stringify(list));
  }

  /* 담은 근거 — 회사별로 나눠 담는다. 자소서 코치가 같은 키를 읽는다. */
  const allEvidence = () => readJson(LS_EVIDENCE, {});
  const evidenceOf = name => allEvidence()[name] || [];
  function saveEvidence(name, list) {
    const all = allEvidence();
    if (list.length) all[name] = list; else delete all[name];
    localStorage.setItem(LS_EVIDENCE, JSON.stringify(all));
  }
  /* 담는 대상은 '지원할 공고' 하나다(채용공고 칸에만 담기가 있다). 예전에는 기사·
     실적·직원수에도 담기가 있어 '근거 n/5' 로 셌는데, 담은 것들이 서로 다른 종류라
     자소서 코치로 넘어가서 무엇에 쓰라는 것인지 알 수 없었다. */

  let selected = null;      // { name, industry }
  let analysis = null;      // DB.companyAnalysis 결과
  let step     = 'issue';   // 지금 펼친 기업분석 단계 (카드 하나)
  let loading  = false;
  let error    = null;
  let query    = '';
  let suggestions = [];
  let reqSeq   = 0;         // 늦게 온 응답으로 지금 화면을 덮지 않기 위한 순번

  /* 계열별 기업 — 첫 화면에서 한 번만 받는다(캐시 파일이라 서버도 빠르다). */
  let sectorData = null;
  let sectorErr = null;
  let openSector = null;    // 펼친 계열 이름

  const root = () => document.getElementById('company-root');

  /* ── 검색 ────────────────────────────────────────────────── */
  /* ── 자동완성 ────────────────────────────────────────────────
     **화면을 다시 그리지 않는다.** 예전에는 글자마다 paint() 로 #company-root 를
     통째로 innerHTML 했는데, 그러면 입력창 DOM 이 매번 새로 만들어진다. 한글은
     조합 중(ㅅ→사→삼)에 input 이벤트가 계속 나오므로, 그 사이 입력창이 교체되면
     **조합이 깨져서 글자가 사라진다** — 영문은 멀쩡한데 한글만 안 되던 이유다.
     그래서 여기서는 드롭다운 목록만 갈아 끼우고 입력창은 손대지 않는다. */
  async function runSuggest(q) {
    query = q;
    const seq = ++reqSeq;
    if (q.trim().length < 1) { suggestions = []; paintSuggest(); return; }

    const hits = FEATURED.filter(c => c.name.includes(q.trim()));
    const found = await DB.suggestCompanies(q.trim(), 8).catch(() => []);
    if (seq !== reqSeq) return;                       // 그새 더 친 글자가 있다

    const rest = found
      .filter(it => !hits.some(c => c.name === it.name))
      .map(it => ({ name: it.name, industry: null }));
    suggestions = [...hits, ...rest].slice(0, 8);
    paintSuggest();
  }

  /* 드롭다운만 다시 그린다. 입력창·나머지 화면은 그대로 둔다. */
  function paintSuggest() {
    const box = document.querySelector('.co-suggest');
    if (!box) return;
    box.outerHTML = suggestHtml();
    const fresh = document.querySelector('.co-suggest');
    if (fresh) bindPick(fresh);
  }

  async function select(name) {
    const featured = FEATURED.find(c => c.name === name);
    selected = { name, industry: featured?.industry || null };
    analysis = null; error = null; loading = true;
    step = 'issue';           // 기사가 가장 자주 쓰이는 근거라 여기서 시작한다
    suggestions = []; query = '';
    pushRecent(name);
    paint();

    const seq = ++reqSeq;
    /* 업종은 리포트를 기다리게 하지 않는다 — 따로 받아 조용히 끼워 넣는다. */
    if (!selected.industry) {
      DB.classifyCompany(name).then(r => {
        if (seq === reqSeq && r?.matched && selected?.name === name) {
          selected.industry = r.label; paint();
        }
      }).catch(() => {});
    }

    try {
      const a = await DB.companyAnalysis(name);
      if (seq !== reqSeq || selected?.name !== name) return;
      analysis = a;
    } catch (e) {
      if (seq !== reqSeq || selected?.name !== name) return;
      error = e.message;
    } finally {
      if (seq === reqSeq) { loading = false; paint(); }
    }
  }

  function back() { selected = null; analysis = null; error = null; paint(); }

  /* ── 근거 담기 ───────────────────────────────────────────── */
  function pick(item) {
    const list = evidenceOf(selected.name);
    if (list.some(e => e.id === item.id)) return;
    saveEvidence(selected.name, [...list, item]);
    paint();
  }
  function unpick(id) {
    saveEvidence(selected.name, evidenceOf(selected.name).filter(e => e.id !== id));
    paint();
  }
  const isPicked = id => evidenceOf(selected.name).some(e => e.id === id);

  /* ══ 그리기 ══════════════════════════════════════════════ */
  function paint() {
    const box = root();
    if (!box) return;
    box.innerHTML = selected ? reportHtml() : searchHtml();
    bind(box);
  }

  /* ── 상태 1 · 검색 우선 ──────────────────────────────────── */
  function searchHtml() {
    const rec = recent();
    const evAll = allEvidence();

    const tile = (c, sub) => `
      <button type="button" class="co-tile" data-pick="${esc(c.name)}">
        <span class="co-tile-h">
          <span class="wf-avatar wf-avatar--sm" style="--co-color:${accentOf(c.name)}">${esc(c.name.charAt(0))}</span>
          <b>${esc(c.name)}</b>
        </span>
        <span class="co-tile-sub">${esc(c.industry || sub || '기업 리포트 보기')}</span>
        <span class="co-tile-foot">${
          (evAll[c.name] || []).length
            ? `<span class="wf-badge wf-badge--ok">공고 ${evAll[c.name].length}건 담김</span>`
            : `<span class="wf-badge wf-badge--mute">기업 리포트</span>`}</span>
      </button>`;

    return `
      <div class="co-search-page">
        <div class="co-search-head">
          <div class="wf-eyebrow wf-eyebrow--lg">Company research</div>
          <h1>어느 회사에 지원하세요?</h1>
          <p>회사를 고르면 실적·최근 기사에서 자소서 지원동기에 그대로 인용할 수 있는
             사실만 모아 드려요.</p>
        </div>

        <div class="co-searchbar">
          <div class="co-searchbar-in">
            <i class="ti ti-search"></i>
            <input id="co-q" type="search" autocomplete="off" placeholder="회사명을 입력하세요"
                   value="${esc(query)}" aria-label="회사명 검색" />
          </div>
          ${suggestHtml()}
        </div>

        <div class="co-lanes">
          ${rec.length ? `
            <section>
              <div class="co-lane-h"><h2>최근 본 회사</h2><span>${rec.length}곳</span></div>
              <div class="co-lane-grid">${rec.slice(0, 4).map(n => tile({ name: n }, '다시 열기')).join('')}</div>
            </section>` : ''}
          <section>
            <div class="co-lane-h"><h2>많이 찾는 회사</h2><span>골라서 바로 시작할 수 있어요</span></div>
            <div class="co-lane-grid">${FEATURED.slice(0, 8).map(c => tile(c)).join('')}</div>
          </section>

          ${sectorsHtml()}
        </div>
      </div>`;
  }

  /* ── 계열별 기업 ───────────────────────────────────────────
     "이미 아는 회사 8곳" 만 보여주면 학생은 아는 데만 지원한다. 계열로 묶어 펼치면
     **몰랐던 회사**를 만난다 — 이 화면을 만든 이유가 그것이다.
     한 계열에 많게는 145곳이라 처음에는 접어 두고, 눌러야 펼친다. */
  const SECTOR_PREVIEW = 12;

  function sectorsHtml() {
    if (sectorErr) {
      return `<section><div class="co-note"><i class="ti ti-info-circle"></i> ${esc(sectorErr)}</div></section>`;
    }
    if (!sectorData) return `<section><div class="co-loading">계열별 기업을 불러오는 중…</div></section>`;
    if (!sectorData.sectors?.length) return '';

    return `<section>
      <div class="co-lane-h">
        <h2>계열로 둘러보기</h2>
        <span>상장사 ${sectorData.total.toLocaleString()}곳 · 이름을 못 들어본 회사를 찾아보세요</span>
      </div>
      <div class="co-sectors">
        ${sectorData.sectors.map(s => {
          const open = openSector === s.name;
          const list = open ? s.companies : s.companies.slice(0, SECTOR_PREVIEW);
          return `<div class="co-sector ${open ? 'is-open' : ''}">
            <button type="button" class="co-sector-h" data-sector="${esc(s.name)}">
              <b>${esc(s.name)}</b>
              <span class="wf-badge wf-badge--mute">${s.companies.length}곳</span>
              <i class="ti ti-chevron-down"></i>
            </button>
            <div class="co-sector-body">
              ${list.map(c => `<button type="button" class="co-chip" data-pick="${esc(c.name)}">${esc(c.name)}</button>`).join('')}
              ${!open && s.companies.length > SECTOR_PREVIEW
                ? `<button type="button" class="co-chip co-chip--more" data-sector="${esc(s.name)}">+${s.companies.length - SECTOR_PREVIEW}곳 더</button>`
                : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>`;
  }

  function suggestHtml() {
    if (!suggestions.length) return '<div class="co-suggest" hidden></div>';
    return `<div class="co-suggest">
      ${suggestions.map(c => `
        <button type="button" data-pick="${esc(c.name)}">
          <span class="wf-avatar wf-avatar--sm" style="--co-color:${accentOf(c.name)}">${esc(c.name.charAt(0))}</span>
          <span class="co-suggest-t">
            <b>${esc(c.name)}</b>
            ${c.industry ? `<small>${esc(c.industry)}</small>` : ''}
          </span>
        </button>`).join('')}
      <div class="co-suggest-hint">Enter 를 누르면 첫 번째 회사를 엽니다</div>
    </div>`;
  }

  /* ── 상태 2 · 기업 리포트 ────────────────────────────────── */
  function reportHtml() {
    return `<div class="co-report">
      ${sideHtml()}
      <div class="co-main">${mainHtml()}</div>
    </div>`;
  }

  function sideHtml() {
    const rec = recent();
    const evAll = allEvidence();
    const row = name => `
      <button type="button" class="co-side-item ${name === selected.name ? 'is-on' : ''}" data-pick="${esc(name)}">
        <span class="wf-avatar wf-avatar--sm" style="--co-color:${accentOf(name)}">${esc(name.charAt(0))}</span>
        <span class="co-side-t">
          <b>${esc(name)}</b>
          <small>${(evAll[name] || []).length ? `공고 ${(evAll[name] || []).length}건 담김` : '기업 리포트'}</small>
        </span>
      </button>`;

    const others = FEATURED.map(c => c.name).filter(n => !rec.includes(n)).slice(0, 6);

    return `<aside class="co-side">
      <!-- 리포트를 보는 중에도 같은 자동완성이 뜬다. 예전에는 이 칸이 Enter 로만
           동작해서(목록이 흔들리는 걸 피하려던 것) "자동완성이 안 된다"로 읽혔다.
           흔들림은 드롭다운을 띄우는 것으로 충분히 막을 수 있다 — 목록 자체는 그대로 둔다. -->
      <div class="co-side-search">
        <label class="co-side-srch">
          <i class="ti ti-search"></i>
          <input id="co-side-q" type="search" autocomplete="off" placeholder="회사명 검색" aria-label="회사명 검색" />
        </label>
        ${suggestHtml()}
      </div>
      ${rec.length ? `
        <div class="co-side-sec">
          <span class="wf-eyebrow">최근 본 회사</span>
          <div class="co-side-list">${rec.map(row).join('')}</div>
        </div>` : ''}
      ${others.length ? `
        <div class="co-side-sec">
          <span class="wf-eyebrow">많이 찾는 회사</span>
          <div class="co-side-list">${others.map(row).join('')}</div>
        </div>` : ''}
      <div class="co-side-sec">
        <button type="button" class="wf-btn wf-btn--sm wf-btn--block" data-back>다른 회사 검색</button>
      </div>
    </aside>`;
  }

  function mainHtml() {
    const ev = evidenceOf(selected.name);

    const head = `
      <div class="co-hero">
        <span class="wf-avatar wf-avatar--lg" style="--co-color:${accentOf(selected.name)}">${esc(selected.name.charAt(0))}</span>
        <div class="co-hero-t">
          <div class="wf-eyebrow">Company report</div>
          <h1>${esc(selected.name)}</h1>
          <div class="co-hero-meta">
            ${selected.industry ? `<span class="wf-badge wf-badge--mute">${esc(selected.industry)}</span>` : ''}
            ${analysis?.dart?.profile?.established
              ? `<span>${esc(String(analysis.dart.profile.established).slice(0, 4))}년 설립</span>` : ''}
            ${analysis?.dart?.profile?.industryCode
              ? `<span>업종코드 ${esc(analysis.dart.profile.industryCode)}</span>` : ''}
          </div>
        </div>
        <div class="co-gauge">
          <div class="co-gauge-h">
            <span class="wf-eyebrow">담은 공고</span>
            <b>${ev.length}<span>건</span></b>
          </div>
          <div class="co-bar ${ev.length ? 'co-bar--ok' : ''}"><i style="width:${ev.length ? 100 : 0}%"></i></div>
          <p class="co-gauge-note">${ev.length
            ? '자소서 코치로 넘어가면 회사·공고 칸이 채워져 있어요.'
            : '<b>채용공고</b> 칸에서 지원할 공고를 담으세요.'}</p>
          <!-- 다음 행동. 예전에는 5번 카드를 눌러야 나왔는데, 그 칸까지 가는 사람이
               드물어서 게이지 바로 아래로 올렸다 — 리포트 어디를 보고 있든 눈에 든다. -->
          <button type="button" class="wf-btn wf-btn--primary wf-btn--sm wf-btn--block"
                  style="margin-top:12px" data-tocoach>
            이 회사 자소서 쓰러 가기
          </button>
        </div>
      </div>`;

    if (loading) return head + `<div class="co-loading">기사와 공시 자료를 찾는 중…</div>`;
    if (error) {
      return head + `<div class="jd-err">${esc(error)}</div>
        <div class="co-sec"><button type="button" class="wf-btn" data-pick="${esc(selected.name)}">다시 시도</button></div>`;
    }
    if (!analysis) return head;

    return head + cardsHtml() + detailHtml() + evidenceHtml();
  }

  /* ── 기업분석 5단계 카드 ─────────────────────────────────────
     카드 얼굴에는 그 칸의 '지금 값'을 하나만 올린다(매출·기사 수·경쟁사 수).
     자세한 내용은 눌러야 아래에 펼쳐진다 — 다섯 칸을 통째로 스크롤하지 않게. */
  const STEP_META = {
    overview:   { label: '개요',        ask: '어떤 회사이고 규모는 어느 정도인가' },
    financial:  { label: '재무·실적',   ask: '최근 3년이 어느 방향인가' },
    issue:      { label: '최근 이슈',   ask: '지금 무엇을 하고 있는가' },
    recruit:    { label: '채용공고',    ask: '이 직무에 무엇을 요구하는가' },
    competitor: { label: '경쟁사',      ask: '같은 시장의 다른 회사는' },
  };

  /* 3년치 꺾은선. 값 자체보다 방향이 자소서 재료라 눈금은 그리지 않는다. */
  function sparkHtml(series, direction) {
    const pts = (series || []).map(s => s.amount).filter(v => typeof v === 'number').reverse();
    if (pts.length < 2) return '';
    const min = Math.min(...pts), max = Math.max(...pts);
    const span = max - min || 1;
    const w = 62, h = 24;
    const coords = pts.map((v, i) => [
      (i / (pts.length - 1)) * (w - 4) + 2,
      h - 3 - ((v - min) / span) * (h - 6),
    ]);
    const color = direction === 'up' ? '#00a83a' : direction === 'down' ? '#ee1d36' : '#898989';
    const last = coords[coords.length - 1];
    return `<svg class="co-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline points="${coords.map(c => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ')}"
        fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.4" fill="${color}"/>
    </svg>`;
  }

  const arrowOf = d => d === 'up' ? '▲' : d === 'down' ? '▼' : '—';

  /* 카드 얼굴의 지표. 없으면 '자료 없음' 이라고 적고 비워 두지 않는다 —
     빈 칸을 숨기면 그 칸이 필요 없다고 오해한다. */
  function metricOf(key) {
    const dart = analysis.dart;
    const fin = dart?.financials;

    if (key === 'overview') {
      /* 규모를 한 눈에 세우는 값으로 직원 수를 쓴다. 없으면 설립연도로 물러난다 —
         둘 다 없으면 지어내지 않고 '공시 자료 없음' 이라고 적는다. */
      const emp = dart?.employees;
      if (emp) {
        return `<div class="co-card-v">${emp.count.toLocaleString()}<small>명</small></div>
          <div class="co-card-d co-card-d--flat">${emp.year}년 사업보고서</div>`;
      }
      const est = dart?.profile?.established;
      if (!est && !dart?.profile?.industryCode) return `<div class="co-card-none">공시 자료 없음</div>`;
      return `<div class="co-card-v">${est ? esc(String(est).slice(0, 4)) : '—'}<small>년 설립</small></div>
        <div class="co-card-d co-card-d--flat">${dart.profile.listed ? '상장' : '비상장'}</div>`;
    }
    if (key === 'recruit') {
      const n = analysis.jobs?.items?.length || 0;
      if (!n) return `<div class="co-card-none">워크넷에 열린 공고 없음<br>채용 사이트에서 직접 찾으세요</div>`;
      const soon = analysis.jobs.items.filter(j => j.dday !== null).sort((a, b) => a.dday - b.dday)[0];
      return `<div class="co-card-v">${n}<small>건</small></div>
        <div class="co-card-d co-card-d--flat">${soon ? `가장 이른 마감 D-${soon.dday}` : '워크넷 기준'}</div>`;
    }
    if (key === 'financial') {
      const rev = fin?.accounts?.revenue;
      if (!rev) return `<div class="co-card-none">DART 공시 없음</div>`;
      const t = rev.trend;
      return `<div class="co-card-v">${esc(rev.series?.[0]?.readable || '—')}</div>
        ${t ? `<div class="co-card-d co-card-d--${t.direction}">${arrowOf(t.direction)} ${Math.abs(t.pct)}%</div>` : ''}
        ${sparkHtml(rev.series, t?.direction)}`;
    }
    if (key === 'competitor') {
      const n = dart?.competitors?.length || 0;
      return n ? `<div class="co-card-v">${n}<small>곳</small></div>
        <div class="co-card-d co-card-d--flat">업종코드 동일</div>`
        : `<div class="co-card-none">확인된 곳 없음</div>`;
    }
    if (key === 'issue') {
      const n = newsItems().length;
      const kw = analysis.news?.keywords?.[0];
      return n ? `<div class="co-card-v">${n}<small>건</small></div>
        ${kw ? `<div class="co-card-d co-card-d--flat">${esc(kw.term)}</div>` : ''}`
        : `<div class="co-card-none">수집된 기사 없음</div>`;
    }
    return '';
  }

  function cardsHtml() {
    const steps = analysis.steps || [];
    return `<div class="co-sec">
      <div class="co-sec-h"><h2>이 회사에 대해 확인된 것</h2>
        <span class="co-src">칸을 누르면 아래에 자세히 나옵니다</span></div>
      <div class="co-cards">
        ${steps.map(s => {
          const meta = STEP_META[s.key] || { label: s.label, ask: s.asks };
          return `<button type="button" class="co-card ${s.key === step ? 'is-on' : ''}" data-step="${esc(s.key)}">
            <span class="co-card-top">
              <span class="co-card-n">0${s.no}</span>
              <span class="co-card-l">${esc(meta.label)}</span>
            </span>
            <span class="co-card-ask">${esc(meta.ask)}</span>
            <span class="co-card-metric">${metricOf(s.key)}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  }

  /* ── 고른 칸의 자세한 내용 ───────────────────────────────── */
  function detailHtml() {
    const s = (analysis.steps || []).find(x => x.key === step);
    if (!s) return '';
    const meta = STEP_META[s.key] || { label: s.label };
    const body = {
      overview: overviewDetail, financial: financeDetail,
      issue: issueDetail, recruit: recruitDetail, competitor: competitorDetail,
    }[s.key];

    return `<div class="co-detail">
      <div class="co-detail-h">
        <h3>${esc(meta.label)}</h3>
        <span>${esc(s.asks)}</span>
      </div>
      ${body ? body(s) : ''}
    </div>`;
  }

  function overviewDetail(s) {
    const p = analysis.dart?.profile;
    const emp = analysis.dart?.employees;
    if (!p) return `<p class="co-step-note">${esc(s.note)}${s.link
      ? ` <a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">홈페이지 열기</a>` : ''}</p>`;

    const est = p.established
      ? `${p.established.slice(0, 4)}.${p.established.slice(4, 6)}.${p.established.slice(6, 8)}`
      : '—';
    /* 규모 지표는 위에 크게 세운다(A-1 안의 지표 카드와 같은 얼개) — 자소서에
       "몇 명 규모의 회사에서 무엇을 하고 싶다"고 쓸 때 바로 인용하는 값들이다.
       담기 버튼을 붙여 근거로 가져갈 수 있게 한다. */
    const won = n => n >= 1e8 ? `${(n / 1e8).toFixed(1)}억원`
      : n >= 1e4 ? `${Math.round(n / 1e4).toLocaleString()}만원` : `${n.toLocaleString()}원`;

    const stats = [];
    if (emp) {
      stats.push({
        label: '직원 수', value: emp.count.toLocaleString(), unit: '명',
        sub: emp.regular ? `정규직 ${emp.regular.toLocaleString()}명` : `${emp.year}년 기준`,
        id: 'emp-count', text: `직원 수 ${emp.count.toLocaleString()}명 (${emp.year}년 사업보고서)`,
      });
      if (emp.tenureYears) stats.push({
        label: '평균 근속연수', value: emp.tenureYears, unit: '년',
        sub: '길수록 이직이 적다는 뜻', id: 'emp-tenure',
        text: `평균 근속연수 ${emp.tenureYears}년 (${emp.year}년 사업보고서)`,
      });
      if (emp.avgPay) stats.push({
        label: '1인 평균 급여', value: won(emp.avgPay), unit: '',
        sub: `${emp.year}년 연간 기준`, id: 'emp-pay',
        text: `1인 평균 급여 ${won(emp.avgPay)} (${emp.year}년 사업보고서)`,
      });
    }

    const facts = [
      ['계열', p.sector || (p.industryCode ? `업종코드 ${p.industryCode}` : '—')],
      ['설립일', est],
      ['대표자', p.ceo || '—'],
      ['상장', p.listed ? `${p.market || '상장'} ${p.stockCode || ''}`.trim() : '비상장'],
      ['결산월', p.settlementMonth ? `${p.settlementMonth}월` : '—'],
      ['본사', p.address || '—'],
    ];

    return `
      ${stats.length ? `<div class="co-stats">
        ${stats.map(s => `<div class="co-stat">
          <div class="co-stat-l">${esc(s.label)}</div>
          <div class="co-stat-v">${esc(String(s.value))}${s.unit ? `<small>${esc(s.unit)}</small>` : ''}</div>
          <div class="co-stat-sub">${esc(s.sub)}</div>
        </div>`).join('')}
      </div>` : ''}

      <div class="co-facts" style="margin-top:${stats.length ? '12px' : '0'}">
        ${facts.map(([l, v]) => `<div class="co-fact">
          <div class="co-fact-l">${esc(l)}</div><div class="co-fact-v">${esc(v)}</div></div>`).join('')}
        ${p.homepage ? `<div class="co-fact"><div class="co-fact-l">홈페이지</div>
          <div class="co-fact-v"><a href="${esc(p.homepage)}" target="_blank" rel="noopener noreferrer">바로가기</a></div></div>` : ''}
        ${p.irUrl ? `<div class="co-fact"><div class="co-fact-l">IR 자료</div>
          <div class="co-fact-v"><a href="${esc(p.irUrl)}" target="_blank" rel="noopener noreferrer">사업부문별 매출 보기</a></div></div>` : ''}
      </div>
      <p class="jd-hint"><b>사업부별 매출 비중은 API 로 받을 수 없습니다</b> — 전자공시(DART)와
        공공데이터포털 어느 쪽도 그 값을 열어두지 않았고, 사업보고서 본문에만 글로 적혀 있어요.
        ${p.irUrl
          ? '대신 위 <b>IR 자료</b> 링크에 그 표가 거의 항상 있습니다.'
          : '홈페이지의 사업 소개나 사업보고서 「II. 사업의 내용」에서 직접 확인하세요.'}</p>`;
  }

  /* 채용공고 — 우리가 회사별 공고를 들고 있지 않다. 있는 척하지 않고 찾는 경로를 준다.
     예전 '인재상' 칸을 이걸로 바꿨다: 인재상은 회사마다 비슷한 캐치프레이즈라
     자소서에 쓸 게 못 되고, 실제로 필요한 건 지금 열려 있는 공고의 자격요건이다. */
  function recruitDetail(s) {
    const n = encodeURIComponent(selected.name);
    const jobs = analysis.jobs || {};
    const sites = [
      ['사람인', `https://www.saramin.co.kr/zf_user/search?searchword=${n}`],
      ['잡코리아', `https://www.jobkorea.co.kr/Search/?stext=${n}`],
      ['워크넷', `https://www.work24.go.kr/wk/a/b/1200/retriveDtlEmpSrchList.do?searchWord=${n}`],
    ];

    /* 담기는 **여기에만** 있다. 예전에는 기사·실적·직원수에도 붙어 있었는데, 담은
       것들이 서로 다른 종류라 자소서 코치로 넘어가서 무엇에 쓰라는 것인지 알 수
       없었다. 지금은 담는 대상이 '지원할 공고' 하나로 정해져 있고, 넘어가면 그
       공고가 자소서 코치의 회사·공고 칸에 바로 들어간다. */
    const list = jobs.items?.length ? `
      <div class="co-jobs">
        ${jobs.items.map(j => {
          const id = `job-${j.id || j.title}`;
          return `<div class="co-job">
            <div class="co-job-t">
              ${j.url
                ? `<a href="${esc(j.url)}" target="_blank" rel="noopener noreferrer">${esc(j.title)}</a>`
                : `<b>${esc(j.title)}</b>`}
              <small>${[j.company, j.region, j.career, j.edu].filter(Boolean).map(esc).join(' · ')}</small>
            </div>
            ${j.dday !== null
              ? `<span class="wf-badge ${j.dday <= 7 ? 'wf-badge--error' : 'wf-badge--mute'}">D-${j.dday}</span>`
              : `<span class="wf-badge wf-badge--mute">상시</span>`}
            ${isPicked(id)
              ? `<span class="wf-badge wf-badge--ok"><i class="ti ti-check"></i> 담김</span>`
              : `<button type="button" class="wf-btn wf-btn--xs wf-btn--primary"
                   data-add="${esc(id)}" data-title="${esc(j.title)}" data-url="${esc(j.url || '')}"
                   data-career="${esc(j.career || '')}" data-edu="${esc(j.edu || '')}"
                   data-region="${esc(j.region || '')}" data-dday="${j.dday ?? ''}"
                   >이 공고로 자소서 쓰기</button>`}
          </div>`;
        }).join('')}
      </div>
      <p class="jd-hint">${esc(jobs.source === 'saramin' ? '사람인' : '워크넷')} 기준입니다.
        공고를 <b>담으면</b> 자소서 코치로 그대로 넘어가요. 요구 역량까지 뽑으려면
        공고를 열어 <b>본문을 복사해 붙여넣어야</b> 합니다 — 채용 API 는 제목·조건만 주고
        본문은 주지 않습니다.</p>`
      : `<div class="co-note"><i class="ti ti-info-circle"></i>
           ${esc(jobs.reason || '이 회사 이름으로 열린 공고가 없습니다.')}
           대기업 공채는 자사 채용 사이트로만 올라오는 일이 많아, 없는 것이 정상인 경우도 있어요.</div>`;

    return `
      ${list}
      <div class="co-kw" style="margin-top:16px">
        ${sites.map(([label, url]) =>
          `<a class="wf-btn wf-btn--sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}에서 더 찾기</a>`).join('')}
      </div>
      <p class="jd-hint">회사 인재상 문구는 자소서에 쓰지 마세요 —
        어느 회사에나 있는 말이라 읽는 사람에게 아무 정보가 되지 않습니다.</p>`;
  }

  function financeDetail(s) {
    const fin = analysis.dart?.financials;
    if (!fin) {
      return `<div class="co-note"><i class="ti ti-info-circle"></i>
        재무 자료가 없습니다 — ${esc(analysis.dartReason || analysis.dart?.note || s.note)}</div>`;
    }
    const rows = Object.entries(fin.accounts).map(([key, acc]) => {
      const t = acc.trend;
      const label = analysis.dart.labels[key] || key;
      const now = acc.series?.[0];
      const id = `fin-${key}`;
      const text = t
        ? `${label} ${now?.readable || ''} · 전년비 ${t.direction === 'up' ? '+' : t.direction === 'down' ? '−' : ''}${Math.abs(t.pct)}%`
        : `${label} ${now?.readable || ''}`;
      return `<tr>
        <th>${esc(label)}</th>
        ${acc.series.map(x => `<td>${x.readable ? esc(x.readable) : '—'}<span>${x.year}</span></td>`).join('')}
        <td class="co-trend--${t ? t.direction : 'none'}">${t ? `${arrowOf(t.direction)} ${Math.abs(t.pct)}%` : '—'}</td>
      </tr>`;
    }).join('');

    return `
      <div class="co-tblwrap">
        <table class="co-tbl">
          <thead><tr><th style="text-align:left">계정</th><th>당기</th><th>전기</th><th>전전기</th><th>전년비</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="jd-hint">${fin.baseYear}년 사업보고서 · ${fin.fsDiv === 'CFS' ? '연결' : '개별'} 기준.
        역성장 구간이면 "무엇을 하려는 회사인가"가, 성장 구간이면 "무엇을 더 키우려 하는가"가
        자소서의 재료가 됩니다.</p>`;
  }

  function competitorDetail(s) {
    const list = analysis.dart?.competitors;
    if (!list?.length) return `<p class="co-step-note">${esc(s.note)}</p>`;

    const mine = analysis.dart?.financials?.accounts?.revenue?.series?.[0]?.amount || null;
    const won = n => n >= 1e12 ? `${(n / 1e12).toFixed(1)}조원` : `${Math.round(n / 1e8).toLocaleString()}억원`;
    const sized = list.some(c => c.sized);

    return `
      <div class="co-rivals">
        ${list.map(c => {
          const ratio = c.revenue && mine ? c.revenue / mine : null;
          return `<div class="co-rival">
            <span class="wf-avatar wf-avatar--sm" style="--co-color:${accentOf(c.name)}">${esc(c.name.charAt(0))}</span>
            <div class="co-rival-t">
              <b>${esc(c.name)}</b>
              <small>${c.revenue
                ? `매출 ${won(c.revenue)}${ratio ? ` · 우리의 ${ratio >= 1 ? `${ratio.toFixed(1)}배` : `${Math.round(ratio * 100)}%`}` : ''}`
                : '매출 자료 없음 (신규 상장이거나 결산이 늦은 회사)'}</small>
            </div>
            <button type="button" class="wf-btn wf-btn--xs" data-pick="${esc(c.name)}">리포트 보기</button>
          </div>`;
        }).join('')}
      </div>
      <p class="jd-hint">${sized
        ? `표준산업분류가 같은 상장사 중 <b>매출이 0.3~3배 범위</b>인 회사만 남겼습니다 —
           업종코드만 보면 덩치가 수백 배 다른 회사가 섞여서, 그대로 믿고 쓰면 면접에서 무너집니다.`
        : `이 회사는 매출 자료가 없어 규모 비교를 못 했습니다. 아래는 <b>업종코드만 같은</b> 회사예요.`}
        그래도 <b>실제 경쟁 관계인지는 직접 확인하세요</b> — 같은 업종·비슷한 규모라도 파는 물건이 다를 수 있습니다.</p>`;
  }

  /* 기사 목록 — 중복 제거는 **서버가 한다**(news.js 의 cluster(): 같은 사건을 다룬
     기사를 단어 자카드로 묶어 대표 한 건만 내려보낸다). 여기서 또 거르면 같은 규칙이
     두 곳에 생겨 어긋나므로 그대로 쓴다. 6건째부터는 네이버 뉴스로 보낸다 —
     우리가 들고 있을 이유가 없다. */
  const newsItems = () => analysis?.news?.items || [];

  function issueDetail(s) {
    const items = newsItems();
    if (!items.length) {
      return `<div class="co-note"><i class="ti ti-info-circle"></i>
        ${esc(analysis.newsError || s.note)}</div>`;
    }
    const kws = (analysis.news.keywords || []).slice(0, 8);
    const naver = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(selected.name)}`;

    return `
      <div class="co-news">
        ${items.map((it, i) => {
          const id = `news-${(it.url || it.title).slice(-40)}`;
          return `<div class="co-news-item">
            <div class="co-news-t">
              <a href="${esc(it.url || '#')}" target="_blank" rel="noopener noreferrer">${esc(it.title)}</a>
              <div class="co-news-meta">${esc(it.date || '')}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:14px">
        <a class="wf-btn wf-btn--sm" href="${esc(naver)}" target="_blank" rel="noopener noreferrer">
          네이버 뉴스에서 더 보기
        </a>
      </div>
      ${kws.length ? `
        <div style="margin-top:20px">
          <span class="wf-eyebrow">기사에서 반복된 말</span>
          <div class="co-kw">${kws.map(k =>
            `<span class="co-kw-item">${esc(k.term)}<b>${k.count}</b></span>`).join('')}</div>
          <p class="jd-hint">몇 건의 기사에서 나온 말인지를 같이 적었습니다.
            근거를 못 짚는 키워드는 자소서에 쓰지 마세요 — 면접에서 되물으면 답할 수 없습니다.</p>
        </div>` : ''}`;
  }


  /* 담은 근거 — 리포트 위쪽에 둔다. 담는 순간 결과가 보여야 계속 담는다. */
  /* 담은 공고 — 이 화면의 결과물이다. 담기는 채용공고 칸에만 있으므로
     여기 쌓이는 것도 공고 하나뿐이고, 넘어가면 자소서 코치가 그대로 받는다. */
  function evidenceHtml() {
    const ev = evidenceOf(selected.name);
    return `<div class="co-sec">
      <div class="co-sec-h">
        <h2>담은 공고</h2>
        <span class="co-src">자소서 코치로 그대로 넘어갑니다</span>
      </div>
      ${ev.length ? `
        <div class="co-picked">
          ${ev.map(e => `<div class="co-picked-item">
            <span>
              <b>${esc(e.text)}</b>
              ${[e.region, e.career, e.edu].filter(Boolean).length
                ? `<br><span style="color:var(--wf-mute)">${[e.region, e.career, e.edu].filter(Boolean).map(esc).join(' · ')}</span>`
                : ''}
              ${e.dday !== '' && e.dday != null ? ` <span class="wf-badge wf-badge--mute">D-${esc(String(e.dday))}</span>` : ''}
            </span>
            <button type="button" data-unpick="${esc(e.id)}" aria-label="공고 빼기">
              <i class="ti ti-x"></i></button>
          </div>`).join('')}
        </div>
        <div class="co-sec" style="margin-top:14px">
          <button type="button" class="wf-btn wf-btn--primary" data-tocoach>
            이 공고로 자소서 쓰러 가기
          </button>
        </div>`
        : `<p class="co-picked-empty">아직 담은 공고가 없어요. <b>채용공고</b> 칸에서
             <b>이 공고로 자소서 쓰기</b>를 누르면 여기에 담기고, 자소서 코치의 회사·공고 칸이
             자동으로 채워집니다.</p>`}
    </div>`;
  }

  /* ── 이벤트 ──────────────────────────────────────────────── */
  /* 회사를 고르는 버튼만 따로 묶는다 — 드롭다운은 입력 도중 자기만 다시 그려서
     bind() 전체를 부를 수 없기 때문이다. */
  function bindPick(scope) {
    scope.querySelectorAll('[data-pick]').forEach(el =>
      el.addEventListener('click', () => select(el.dataset.pick)));
  }

  function bind(box) {
    bindPick(box);
    box.querySelectorAll('[data-unpick]').forEach(el =>
      el.addEventListener('click', () => unpick(el.dataset.unpick)));
    box.querySelectorAll('[data-add]').forEach(el =>
      el.addEventListener('click', () => pick({
        id: el.dataset.add,
        text: el.dataset.title,
        url: el.dataset.url || '',
        career: el.dataset.career || '',
        edu: el.dataset.edu || '',
        region: el.dataset.region || '',
        dday: el.dataset.dday === '' ? null : Number(el.dataset.dday),
      })));

    // 계열 펼치기/접기
    box.querySelectorAll('[data-sector]').forEach(el =>
      el.addEventListener('click', () => {
        openSector = openSector === el.dataset.sector ? null : el.dataset.sector;
        paint();
      }));

    // 기업분석 5단계 카드 — 누른 칸만 아래에 펼친다
    box.querySelectorAll('[data-step]').forEach(el =>
      el.addEventListener('click', () => { step = el.dataset.step; paint(); }));

    const backBtn = box.querySelector('[data-back]');
    if (backBtn) backBtn.addEventListener('click', back);

    box.querySelectorAll('[data-tocoach]').forEach(el =>
      el.addEventListener('click', () => {
        localStorage.setItem('careerly_selected_company', selected.name);
        navigate('jd');
      }));

    /* 검색창은 두 자리(검색 화면 가운데 · 리포트 사이드바)에 있지만 규칙은 하나다.
       입력창은 화면이 그려질 때 한 번만 만들어지고 그 뒤로는 건드리지 않는다
       (자동완성이 입력창을 다시 만들면 한글 조합이 깨진다 — runSuggest 주석 참고). */
    bindSearch(box.querySelector('#co-q'));
    bindSearch(box.querySelector('#co-side-q'));
  }

  function bindSearch(q) {
    if (!q) return;
    let timer = null;
    let composing = false;

    /* IME 조합 중에는 검색을 보내지 않는다. '삼'을 치는 동안 ㅅ·사·삼 세 번이
       날아가는데, 중간 글자로 부른 결과는 어차피 버려진다. 조합이 끝날 때 한 번만. */
    q.addEventListener('compositionstart', () => { composing = true; });
    q.addEventListener('compositionend', e => {
      composing = false;
      clearTimeout(timer);
      const v = e.target.value;
      timer = setTimeout(() => runSuggest(v), 180);
    });

    q.addEventListener('input', e => {
      if (composing) return;
      clearTimeout(timer);
      const v = e.target.value;
      timer = setTimeout(() => runSuggest(v), 220);
    });

    q.addEventListener('keydown', e => {
      /* 조합 중 Enter 는 글자를 확정하는 키다. 여기서 회사를 열면 '삼성'을
         확정하려던 순간에 엉뚱한 회사로 들어간다(e.isComposing 으로 걸러낸다). */
      if (e.key !== 'Enter' || e.isComposing) return;
      const first = suggestions[0]?.name || e.target.value.trim();
      if (first) select(first);
    });

    /* 검색 화면에서만 값을 되살린다 — 리포트 사이드바는 늘 빈 칸으로 시작한다. */
    if (query && q.id === 'co-q') {
      q.value = query; q.focus(); q.setSelectionRange(query.length, query.length);
    }
  }

  /* 페이지 진입 — 자소서 코치에서 회사명을 들고 왔으면 그 회사를 연다. */
  /* 계열 목록은 화면을 막지 않는다 — 먼저 그리고, 도착하면 그 자리만 다시 그린다. */
  async function loadSectors() {
    if (sectorData || sectorErr) return;
    try {
      sectorData = await DB.companySectors();
      if (!sectorData.sectors?.length && sectorData.reason) sectorErr = sectorData.reason;
    } catch (e) {
      sectorErr = e.message;
    }
    if (!selected) paint();
  }

  function onEnter() {
    loadSectors();
    const handoff = localStorage.getItem('careerly_company_open');
    if (handoff) {
      localStorage.removeItem('careerly_company_open');
      select(handoff);
      return;
    }
    if (selected) { paint(); return; }
    query = ''; suggestions = [];
    paint();
  }

  return { onEnter, select, evidenceOf };
})();
