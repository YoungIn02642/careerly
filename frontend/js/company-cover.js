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
  /* ── 무엇을 하는 회사인가 ────────────────────────────────────
     "부문별 매출 비중은 API 에 없다" 는 것은 그대로지만, DART 가 정형으로 주는 값
     **둘**로 그 질문에 상당 부분 답할 수 있다(사용자 지시로 다시 뒤졌다).

       사업부문 : 사업보고서 직원현황의 fo_bbm. 회사가 인력을 어디에 두고 있는지가
                  곧 주력 사업이다. 부문이 하나뿐이면 '단일 사업' 이라는 정보다.
       관계사   : 타법인 출자 중 **투자목적이 '경영 참여'** 인 곳. 본체 밖으로 사업을
                  어디까지 벌려 뒀는지가 드러난다(해외 생산법인·소재 계열 등).
                  단순 투자(시세차익)는 뺐다 — 무슨 일을 하는 회사인지 말해 주지 않는다.

     매출 비중이 아니라 **인력과 지분**이라는 것을 화면에 적는다. 비중처럼 읽히면
     우리가 없는 값을 지어낸 셈이 된다. */
  function businessHtml() {
    const emp = analysis?.dart?.employees;
    const affs = analysis?.dart?.affiliates || [];
    const segs = emp?.segments || [];
    if (!segs.length && !affs.length) return '';

    const single = segs.length === 1;
    return `
      <div class="co-biz">
        <div class="co-biz-h">무엇을 하는 회사인가</div>
        ${segs.length ? `
          <div class="co-biz-row">
            <div class="co-biz-l">사업부문<span>${emp.year}년 인력 배치 기준</span></div>
            <div class="co-biz-v">
              ${segs.map(g => `<span class="co-seg">
                <b>${esc(g.name)}</b>
                <span>${g.count.toLocaleString()}명${single ? '' : ` · ${g.pct}%`}</span>
              </span>`).join('')}
              ${single ? `<span class="co-biz-note">부문이 하나예요 — 이 사업 한 갈래에 집중한 회사입니다.</span>` : ''}
            </div>
          </div>` : ''}
        ${affs.length ? `
          <div class="co-biz-row">
            <div class="co-biz-l">관계사<span>경영 참여 목적 출자</span></div>
            <div class="co-biz-v">
              ${affs.map(a => `<span class="co-aff">
                <b>${esc(a.name)}</b>${a.stake != null ? `<span>${a.stake}%</span>` : ''}
              </span>`).join('')}
              <span class="co-biz-note">지분을 갖고 경영에 참여하는 회사예요 — 본체 밖으로 사업을 어디까지 벌려 뒀는지 보여줍니다.</span>
            </div>
          </div>` : ''}
        <p class="co-biz-src">사업보고서의 <b>직원 현황(사업부문)</b>과 <b>타법인 출자현황</b>에서 가져온 값이에요.
          매출 비중이 아니라 <b>인력과 지분</b> 기준입니다.</p>
      </div>`;
  }

  /* ── 스킴 없는 주소를 그대로 href 에 넣지 않는다 ─────────────
     DART 개황은 홈페이지를 'www.jevisco.com' 처럼 **스킴 없이** 준다. 그대로 넣으면
     브라우저가 상대경로로 읽어 http://localhost:3000/www.jevisco.com 으로 가고,
     우리 서버의 404 JSON 이 뜬다(실측). 스킴이 없으면 https 를 붙인다. */
  function httpUrl(u) {
    const s = String(u || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (/^\/\//.test(s)) return 'https:' + s;
    return 'https://' + s.replace(/^\/+/, '');
  }

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
  /* 지금 펼친 기업분석 단계 (카드 하나).
     ── 왜 '개요' 로 시작하나 (사용자 지시) ──
     예전 기본값은 '최근 이슈' 였다. 기사가 지원동기에 가장 자주 쓰이는 근거라
     거기서 시작하게 뒀는데, **회사를 처음 연 사람에게는 순서가 뒤집힌 화면**이었다.
     어떤 회사인지도 모르는 상태에서 그 회사의 8월 주가 기사부터 읽게 된다.
     카드 번호도 01 개요 → 03 최근 이슈 순인데 세 번째가 열려 있었다. */
  let step     = 'overview';
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
    step = 'overview';        // 회사를 처음 열면 '어떤 회사인가' 부터 (위 주석)
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

    const rm = Roadmap.get();
    return `
      <div class="co-search-page">
        <div class="co-search-head">
          <div class="wf-eyebrow wf-eyebrow--lg">Company research</div>
          <h1>${rm ? `${Roadmap.withJosa(rm.jobName || rm.middleName, '로')} 어디에 지원할까요?` : '어느 회사에 지원하세요?'}</h1>
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
          ${jobFocusHtml()}
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

  /* ── 로드맵 3단계 · 이 직무를 주로 뽑는 계열 ────────────────
     직무를 골라 온 학생에게 778곳을 가나다순으로 통째로 내밀면 고를 근거가 없다.
     서버가 직무(KECO 2차 분류) → 계열 매핑을 준다(company-sectors.js sectorFocus).

     ── 무엇인지 정확히 적는다 ──
     이건 **"이 회사가 그 직무를 지금 뽑고 있다"가 아니다.** 업종 수준의 연결이고,
     실제 채용 여부는 회사 리포트의 공고 칸에서 확인한다. 그렇게 안 적으면 학생이
     '채용 중'으로 읽는다 — 없는 것을 있는 척하지 않는다는 이 화면의 원칙(머리주석)
     이 여기에도 그대로 적용된다.

     ── 좁히지 못하는 직무는 좁히지 않는다 ──
     경영·사무직과 영업·판매직은 전 업종이 뽑는다. 계열 몇 개를 억지로 골라 주면
     나머지를 후보에서 지워 버린다. 그때는 그 사실을 그대로 말하고 아래 계열 목록
     전체를 쓰게 둔다. */
  function jobFocusHtml() {
    const rm = Roadmap.get();
    if (!rm) return '';

    const focus = sectorData?.focus;
    const name = rm.jobName || rm.middleName;
    const goal = esc(name);
    /* 조사는 이름의 받침에 따라 갈린다 — '개발자를' / '기술직을'. '을(를)' 로 두면
       데이터로 만든 문장이라는 티가 그대로 난다(roadmap.js josa 주석). */
    const goalEul = Roadmap.withJosa(name, '을');
    const goalEun = Roadmap.withJosa(name, '은');
    const note = t => `<section><div class="co-note"><i class="ti ti-info-circle"></i> ${t}</div></section>`;

    if (!sectorData) return `<section><div class="co-loading">${goal} 관련 계열을 찾는 중…</div></section>`;
    if (!focus || !focus.matched) return '';

    if (focus.universal) {
      return note(`<b>${goalEun}</b> <b>업종을 가리지 않는 직무</b>예요.
        특정 계열로 좁히면 나머지 업종의 회사를 후보에서 지우게 되니 좁히지 않았어요 —
        아래 계열 목록에서 관심 있는 산업을 골라 보세요.`);
    }
    /* 업종은 아는데(KSIC 대분류) 그 업종에 상장사가 없는 경우 — 공무원이 그렇다.
       '모른다' 와 '알지만 민간에 없다' 는 다른 말이라, 아는 만큼은 말해 준다. */
    if (!focus.sectors.length) {
      const why = focus.sections?.length
        ? `<b>${esc(focus.sections.map(x => x.label).join(' · '))}</b>이라 상장 기업 목록에 해당하는 회사가 없어요.`
        : '공무원·군인 채용 경로라 민간 기업 계열로 이어지지 않아요.';
      return note(`<b>${goalEun}</b> ${why}
        그래도 회사를 정해 자소서를 쓰려면 아래에서 직접 찾아 주세요.`);
    }

    /* ── 직업으로 좁혔으면 그 업종의 회사만 남긴다 ───────────────
       계열(15개)은 화면에 올리려고 넓게 묶은 것이라, 그대로 보여주면 좁힌 뜻이
       흐려진다 — 실측: '교장' 을 교육 서비스업(85)으로 좁혀 놓고 계열 버킷을 통째로
       띄우는 바람에 강원랜드(카지노 91)가 같이 떴다. 16곳 → 9곳.
       2차 분류로 정한 경우(by:'middle')는 원래 넓게 보여주는 것이 맞으므로 그대로 둔다. */
    const exact = focus.by === 'job' && focus.sections?.length
      ? new Set(focus.sections.flatMap(x => x.codes || []))
      : null;
    const picked = (sectorData.sectors || [])
      .filter(s => focus.sectors.includes(s.name))
      .map(s => (exact
        ? { ...s, companies: s.companies.filter(c => exact.has(c.ksic)) }
        : s))
      .filter(s => s.companies.length);
    const total = picked.reduce((n, s) => n + s.companies.length, 0);
    if (!total) return '';

    return `
      <section class="co-focus">
        <div class="co-lane-h">
          <h2>${goalEul} 주로 뽑는 계열</h2>
          <span>${picked.length}개 계열 · ${total.toLocaleString()}곳</span>
        </div>
        <div class="co-note co-note--tight">
          <i class="ti ti-info-circle"></i>
          ${focus.by === 'job' && focus.sections?.length
            ? `이 직업은 한국표준산업분류상 <b>${esc(focus.sections.map(x => x.label).join(' · '))}</b>에 속해서 그 업종으로 좁혔어요. `
            : ''}<b>업종 기준</b>이에요 — "이 회사가 지금 ${goalEul} 뽑는다"는 뜻은 아닙니다.
          실제 채용 여부는 회사를 열면 나오는 <b>채용공고</b> 칸에서 확인하세요.
        </div>
        <div class="co-sectors">
          ${picked.map(s => {
            const open = openSector === s.name;
            const list = open ? s.companies : s.companies.slice(0, SECTOR_PREVIEW);
            return `<div class="co-sector is-focus ${open ? 'is-open' : ''}">
              <button type="button" class="co-sector-h" data-sector="${esc(s.name)}">
                <b>${esc(s.name)}</b>
                <span class="wf-badge wf-badge--ok">${s.companies.length}곳</span>
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

    /* 위 '주로 뽑는 계열' 에 이미 나온 것은 여기서 뺀다. 같은 계열이 두 번 뜨면
       목록이 길어지는 것보다 나쁜 일이 생긴다 — 펼침 상태(openSector)를 이름으로
       기억하므로 한쪽을 펼치면 다른 쪽도 같이 펼쳐져 고장으로 보인다. */
    const focused = new Set(sectorData.focus?.sectors || []);
    const rest = sectorData.sectors.filter(s => !focused.has(s.name));
    if (!rest.length) return '';
    const restTotal = rest.reduce((n, s) => n + s.companies.length, 0);

    return `<section>
      <div class="co-lane-h">
        <h2>${focused.size ? '다른 계열도 둘러보기' : '계열로 둘러보기'}</h2>
        <span>상장사 ${restTotal.toLocaleString()}곳 · 이름을 못 들어본 회사를 찾아보세요</span>
      </div>
      <div class="co-sectors">
        ${rest.map(s => {
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

    return head + cardsHtml() + detailHtml();
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
          <div class="co-fact-v"><a href="${esc(httpUrl(p.homepage))}" target="_blank" rel="noopener noreferrer">바로가기</a></div></div>` : ''}
        ${p.irUrl ? `<div class="co-fact"><div class="co-fact-l">IR 자료</div>
          <div class="co-fact-v"><a href="${esc(p.irUrl)}" target="_blank" rel="noopener noreferrer">사업부문별 매출 보기</a></div></div>` : ''}
      </div>
      ${businessHtml()}
      <p class="jd-hint"><b>사업부별 매출 비중은 API 로 받을 수 없습니다</b> — 전자공시(DART)와
        공공데이터포털 어느 쪽도 그 값을 열어두지 않았고, 사업보고서 본문에만 글로 적혀 있어요.
        ${p.irUrl
          ? '대신 위 <b>IR 자료</b> 링크에 그 표가 거의 항상 있습니다.'
          : '홈페이지의 사업 소개나 사업보고서 「II. 사업의 내용」에서 직접 확인하세요.'}</p>`;
  }

  /* 채용공고 — 우리가 회사별 공고를 들고 있지 않다. 있는 척하지 않고 찾는 경로를 준다.
     예전 '인재상' 칸을 이걸로 바꿨다: 인재상은 회사마다 비슷한 캐치프레이즈라
     자소서에 쓸 게 못 되고, 실제로 필요한 건 지금 열려 있는 공고의 자격요건이다. */
  /* ── 안내 문구는 소스마다 다르다 ────────────────────────────
     사람인·워크넷은 목록 API 가 **제목·조건만** 준다.
     잡알리오는 `aplyQlfcCn`(지원자격)·`prefCn`(우대사항)을 같이 준다.

     ── 다만 그것이 '역량'은 아니다 (실측) ──
     처음에는 "이제 복붙 없이 역량 분석이 된다"고 안내하려 했다. 532건에 돌려 보고
     접었다 — 공공기관 공고의 저 필드는 **응시 요건**이지 직무 역량 서술이 아니다.
     연령·학력·전공 제한, 마감일 기준, 법정 가점이 대부분이고, 정형문구를 걷어내도
     **절반은 역량이 하나도 안 잡힌다.** 민간 공고의 [자격요건]/[우대사항]과 성격이
     다르다.

     그래도 담는 값어치는 있다 — 학생이 **지원할 수 있는 공고인지**(연령·학력·자격증)
     판단하는 정보다. 그러니 있는 그대로 말한다: 자격 정보는 채워지고, 역량까지
     원하면 원문을 이어붙이라고. 되는 것처럼 말해 놓고 안 되면 그게 더 나쁘다. */
  const SOURCE_LABEL = { saramin: '사람인', worknet: '워크넷', alio: '공공기관 채용정보(잡알리오)' };

  function jobsHint(jobs) {
    const label = SOURCE_LABEL[jobs.source] || '채용 API';
    const withBody = (jobs.items || []).filter(j => j.qualification || j.preference).length;

    if (withBody) {
      return `<p class="jd-hint">${esc(label)} 기준입니다.
        이 공고들은 <b>지원자격·우대사항이 함께</b> 담겨요 — 연령·학력·자격증 요건을
        여기서 바로 확인할 수 있습니다.
        다만 공공기관 공고는 <b>응시 요건 위주</b>라 요구 역량은 잘 드러나지 않아요.
        역량까지 뽑으려면 공고를 열어 <b>본문을 이어붙이는 편</b>이 정확합니다.</p>`;
    }
    return `<p class="jd-hint">${esc(label)} 기준입니다.
      공고를 <b>담으면</b> 자소서 코치로 그대로 넘어가요. 요구 역량까지 뽑으려면
      공고를 열어 <b>본문을 복사해 붙여넣어야</b> 합니다 — 이 채용 API 는 제목·조건만 주고
      본문은 주지 않습니다.</p>`;
  }

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
                   data-qual="${esc(j.qualification || '')}" data-pref="${esc(j.preference || '')}"
                   >이 공고로 자소서 쓰기</button>`}
          </div>`;
        }).join('')}
      </div>
      ${jobsHint(jobs)}`
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


  /* '담은 공고' 칸은 없앴다 (사용자 지시) — 리포트 맨 위에 '이 회사 자소서 쓰러 가기'
     버튼이 이미 있어서, 같은 이동을 아래에서 한 번 더 묻는 칸이었다. 담는 동작 자체는
     채용공고 칸에 그대로 있고, 담으면 자소서 코치의 회사·공고 칸이 채워진다. */

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
        /* 있으면 같이 담는다 — 자소서 코치가 이걸로 공고 본문을 만든다(B20).
           없는 소스(사람인·워크넷)에서는 빈 값이라 예전과 똑같이 동작한다. */
        qualification: el.dataset.qual || '',
        preference: el.dataset.pref || '',
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
        /* 로드맵 3단계의 결론 — 스텝바와 4단계가 이 회사 이름을 쓴다.
           직무 없이 회사만 고른 경우(네비로 바로 들어온 사용자)는 흐름 상태를
           만들지 않는다. Roadmap.setCompany 가 알아서 무시한다. */
        Roadmap.setCompany(selected.name);
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
  /* 계열 목록은 화면을 막지 않는다 — 먼저 그리고, 도착하면 그 자리만 다시 그린다.

     로드맵 직무가 바뀌면 focus 도 달라지므로 다시 받는다. 캐시한 채로 두면
     직무를 바꿔도 예전 직무의 계열이 강조된 채 남는다(조용히 틀리는 쪽). */
  let sectorFor = null;                       // 지금 받아 둔 focus 의 직무 코드
  async function loadSectors() {
    /* 직업 코드까지 같이 보낸다 — 같은 2차 분류라도 직업에 따라 업종이 갈린다
       (관리직 안의 '교장' 과 '기업 임원'). 캐시 키도 둘을 합쳐서 본다. */
    const rm = Roadmap.get();
    const mid = rm?.middle || null;
    const job = rm?.job || null;
    const key = `${mid || ''}::${job || ''}`;
    if ((sectorData || sectorErr) && sectorFor === key) return;
    sectorFor = key;
    try {
      sectorData = await DB.companySectors(mid, job);
      sectorErr = (!sectorData.sectors?.length && sectorData.reason) ? sectorData.reason : null;
    } catch (e) {
      sectorErr = e.message;
    }
    if (!selected) paint();
  }

  function onEnter() {
    Roadmap.mount('rm-bar-company', 'company');
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
