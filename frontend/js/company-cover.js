// 회사 탐색과 지원동기 준비를 자소서 코치 입력부에서 분리한 화면.
window.CompanyCover = (() => {
  /* 잘 알려진 7곳은 업종·관점 문구를 미리 써 둔다 — 검색 없이 들어와도 바로 감이
     잡히게 하기 위해서다. 그 밖의 회사는 실제 기업 카탈로그(6,600여 개 — 스펙
     입력의 회사명 검색과 같은 API, /api/company/suggest)에서 찾는다. 추천에
     없다고 자소서를 못 쓰게 막을 이유가 없어서, 검색되는 회사는 뭐든 눌러서
     바로 이어서 쓸 수 있다(select() 의 폴백). */
  const FEATURED = [
    { name:'삼성전자', industry:'전자·반도체', color:'#2563eb', angle:'기술 변화와 대규모 제품·서비스가 지원 직무에 미치는 영향' },
    { name:'카카오', industry:'IT·플랫폼', color:'#f5c400', angle:'사용자 경험과 플랫폼 생태계 안에서 지원 직무가 만드는 변화' },
    { name:'네이버', industry:'IT·검색·콘텐츠', color:'#03c75a', angle:'기술과 콘텐츠를 연결해 사용자의 문제를 해결하는 방식' },
    { name:'현대자동차', industry:'자동차·모빌리티', color:'#1e3a8a', angle:'모빌리티 전환 과정에서 지원 직무가 맡을 구체적인 역할' },
    { name:'토스', industry:'핀테크', color:'#3182f6', angle:'복잡한 금융 경험을 단순하게 바꾸는 과정과 내 경험의 접점' },
    { name:'SK하이닉스', industry:'반도체', color:'#ef4444', angle:'반도체 경쟁력과 직무 전문성을 연결할 수 있는 실제 경험' },
    { name:'LG에너지솔루션', industry:'배터리', color:'#a50034', angle:'에너지 전환과 품질·기술 경쟁력에 기여할 수 있는 역량' },
  ];
  let selected = FEATURED[0];
  let bound = false;
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* 검색어가 없으면 추천 7곳을 보여준다. 검색어가 있으면 추천 중 걸리는 것을
     먼저 보여주고(관점 문구가 미리 있다), 실제 카탈로그 검색 결과 중 추천에
     없는 회사를 이어 붙인다 — 같은 회사가 두 번 뜨지 않게 한다. */
  async function paintList(query = '') {
    const box = document.getElementById('company-cover-list');
    if (!box) return;
    const q = query.trim();

    if (!q) { renderList(box, FEATURED); return; }

    box.dataset.q = q;
    const items = await DB.suggestCompanies(q, 8).catch(() => []);
    if (box.dataset.q !== q) return;   // 늦게 온 응답으로 방금 친 검색어를 덮지 않는다

    const featuredHit = FEATURED.filter(c => c.name.includes(q));
    const rest = items
      .filter(it => !featuredHit.some(c => c.name === it.name))
      .map(it => ({ name: it.name, industry: null, color: '#6d3aff' }));
    renderList(box, [...featuredHit, ...rest]);
  }

  function renderList(box, list) {
    box.innerHTML = list.length ? list.map(c => `
      <button class="company-sub ${c.name === selected.name ? 'is-on' : ''}" data-company="${esc(c.name)}">
        <span class="company-avatar" style="--company-color:${c.color}">${esc(c.name.charAt(0))}</span>
        <span class="company-sub-text"><b>${esc(c.name)}</b>${c.industry ? `<small>${esc(c.industry)}</small>` : ''}</span>
        <span class="company-live-dot" aria-hidden="true"></span>
      </button>`).join('') : `<div class="company-no-result">검색 결과가 없습니다.</div>`;
    box.querySelectorAll('[data-company]').forEach(btn => btn.addEventListener('click', () => select(btn.dataset.company)));
  }

  /* 추천 7곳이면 미리 써 둔 업종·관점을 그대로 쓴다. 그 밖의 회사는 일단
     일반적인 문구로 바로 그려 두고(기다리게 하지 않는다), 기업분류 API 로
     규모(대기업·중견기업…)를 확인되면 업종 자리만 조용히 바꿔 끼운다. */
  async function select(name) {
    const featured = FEATURED.find(c => c.name === name);
    if (featured) {
      selected = featured;
      paintList(document.getElementById('company-cover-search')?.value || '');
      paintResult();
      return;
    }

    selected = { name, industry: '검색한 회사', color: '#6d3aff',
      angle: '회사의 최근 움직임과 지원 직무, 내 경험의 접점' };
    paintList(document.getElementById('company-cover-search')?.value || '');
    paintResult();

    const r = await DB.classifyCompany(name).catch(() => null);
    /* 그새 다른 회사를 골랐으면(비동기로 기다리는 동안) 지금 값을 덮지 않는다. */
    if (r?.matched && selected.name === name) {
      selected.industry = r.label;
      paintResult();
    }
  }

  function paintResult() {
    const box = document.getElementById('company-cover-result');
    if (!box) return;
    box.innerHTML = `
      <article class="company-guide-card">
        <header class="company-guide-head">
          <span class="company-avatar company-avatar--large" style="--company-color:${selected.color}">${esc(selected.name.charAt(0))}</span>
          <div><span class="company-industry">${esc(selected.industry)}</span><h2>${esc(selected.name)} 지원동기 준비</h2></div>
        </header>
        <div class="company-guide-focus"><i class="ti ti-bulb"></i><div><b>먼저 잡을 관점</b><p>${esc(selected.angle)}</p></div></div>
        <div class="company-cover-steps">
          <div><span>1</span><b>회사 움직임 한 가지</b><p>최근 사업·제품·고객 변화 중 지원 직무와 관련된 사실 하나를 고릅니다.</p></div>
          <div><span>2</span><b>직무와 연결</b><p>그 변화에서 지원 직무가 해결해야 하는 문제를 한 문장으로 정의합니다.</p></div>
          <div><span>3</span><b>내 경험의 근거</b><p>비슷한 문제를 해결했던 프로젝트·인턴·활동 하나만 붙입니다.</p></div>
          <div><span>4</span><b>입사 후 기여</b><p>배우고 싶다는 말 대신 맡고 싶은 일과 만들고 싶은 결과로 끝냅니다.</p></div>
        </div>
        <div class="company-guide-actions">
          <button class="company-primary" id="company-to-coach"><i class="ti ti-pencil"></i> ${esc(selected.name)} 자소서 코치에서 이어쓰기</button>
          <span>선택한 회사명이 자소서 코치의 작은 보조 입력칸으로 전달됩니다.</span>
        </div>
      </article>`;
    document.getElementById('company-to-coach').addEventListener('click', () => {
      localStorage.setItem('careerly_selected_company', selected.name);
      navigate('jd');
    });
  }

  function onEnter() {
    const input = document.getElementById('company-cover-search');
    if (!bound && input) {
      let timer = null;
      input.addEventListener('input', e => {
        clearTimeout(timer);
        timer = setTimeout(() => paintList(e.target.value), 250);
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.value.trim()) select(e.target.value.trim());
      });
      bound = true;
    }
    paintList(input?.value || '');
    paintResult();
  }

  return { onEnter, select };
})();
