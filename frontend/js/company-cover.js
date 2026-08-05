// 회사 탐색과 지원동기 준비를 자소서 코치 입력부에서 분리한 화면.
window.CompanyCover = (() => {
  const COMPANIES = [
    { name:'삼성전자', industry:'전자·반도체', color:'#2563eb', angle:'기술 변화와 대규모 제품·서비스가 지원 직무에 미치는 영향' },
    { name:'카카오', industry:'IT·플랫폼', color:'#f5c400', angle:'사용자 경험과 플랫폼 생태계 안에서 지원 직무가 만드는 변화' },
    { name:'네이버', industry:'IT·검색·콘텐츠', color:'#03c75a', angle:'기술과 콘텐츠를 연결해 사용자의 문제를 해결하는 방식' },
    { name:'현대자동차', industry:'자동차·모빌리티', color:'#1e3a8a', angle:'모빌리티 전환 과정에서 지원 직무가 맡을 구체적인 역할' },
    { name:'토스', industry:'핀테크', color:'#3182f6', angle:'복잡한 금융 경험을 단순하게 바꾸는 과정과 내 경험의 접점' },
    { name:'SK하이닉스', industry:'반도체', color:'#ef4444', angle:'반도체 경쟁력과 직무 전문성을 연결할 수 있는 실제 경험' },
    { name:'LG에너지솔루션', industry:'배터리', color:'#a50034', angle:'에너지 전환과 품질·기술 경쟁력에 기여할 수 있는 역량' },
  ];
  let selected = COMPANIES[0];
  let bound = false;
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function paintList(query = '') {
    const box = document.getElementById('company-cover-list');
    if (!box) return;
    const q = query.trim().toLowerCase();
    const list = COMPANIES.filter(c => !q || `${c.name} ${c.industry}`.toLowerCase().includes(q));
    box.innerHTML = list.length ? list.map(c => `
      <button class="company-sub ${c.name === selected.name ? 'is-on' : ''}" data-company="${esc(c.name)}">
        <span class="company-avatar" style="--company-color:${c.color}">${esc(c.name.charAt(0))}</span>
        <span class="company-sub-text"><b>${esc(c.name)}</b><small>${esc(c.industry)}</small></span>
        <span class="company-live-dot" aria-hidden="true"></span>
      </button>`).join('') : `<div class="company-no-result">검색 결과가 없습니다.</div>`;
    box.querySelectorAll('[data-company]').forEach(btn => btn.addEventListener('click', () => select(btn.dataset.company)));
  }

  function select(name) {
    selected = COMPANIES.find(c => c.name === name) || { name, industry:'검색한 회사', color:'#6d3aff', angle:'회사의 최근 움직임과 지원 직무, 내 경험의 접점' };
    paintList(document.getElementById('company-cover-search')?.value || '');
    paintResult();
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
      input.addEventListener('input', e => paintList(e.target.value));
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
