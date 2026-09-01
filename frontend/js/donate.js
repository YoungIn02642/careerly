/* ══════════════════════════════════════════════════════════════
   자소서 기증 (#donate) — 동의 기반 합격 코퍼스(A 참조군)

   남의 글을 긁어오지 않는다. 합격한 본인이 **직접, 동의 아래** 기증한다
   (저작권·개인정보 때문 — 조사 결과는 대화 기록 참고). 저장 전에 개인정보를
   규칙으로 익명화하고(anonymize.js), 화면은 **저장되기 전에 무엇이 가려지는지**
   미리 보여준다(사람 확인 + 자동 마스킹). 실제 저장 본문은 서버가 다시 익명화한다.

   문장을 되팔지 않는다 — 쌓인 것은 **직무·문항유형별 통계**(건수·평균 길이·결과에
   수치 포함 비율)로만 자소서 코치에 붙는다. ══════════════════════════════════════ */
(root => {
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const isLoggedIn = () => !!(root.DB && DB.currentUser && DB.currentUser());
  const anonymize = (t, o) => (root.Anonymize ? Anonymize.anonymize(t, o) : { text: t, masked: [] });

  let _meta = null;                 // { jobFields, questionTypes }
  const STAR = [
    { k: 's', lab: '상황(S)', hint: '어떤 상황·배경이었나요?' },
    { k: 't', lab: '과제(T)', hint: '맡은 목표·과제는?' },
    { k: 'a', lab: '행동(A)', hint: '무엇을 어떤 순서로 했나요?' },
    { k: 'r', lab: '결과(R)', hint: '결과는? 되도록 수치로.' },
  ];
  const state = { job: '', qtype: '', star: { s: '', t: '', a: '', r: '' }, terms: '', consent: false };

  /* 가릴 말(이름·회사·학교) — 쉼표로 나눈다. 본인 이름·닉네임은 서버가 자동으로 더한다. */
  const termList = () => state.terms.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  const anonOpts = () => ({ terms: termList() });

  async function onEnter() {
    const host = $('#donate-body');
    if (!host) return;

    if (!isLoggedIn()) {
      host.innerHTML = `<div class="wf-card" style="text-align:center;padding:40px 20px">
        <h2>내 합격 자소서 기증하기</h2>
        <p class="jd-hint">합격한 내 자소서를 <b>익명으로</b> 남기면, 다른 취준생이 '이 직무 합격 답은
          어떻게 쓰는지' 통계로 참고할 수 있어요. 기증하려면 로그인이 필요합니다.</p>
        <button type="button" class="wf-btn" id="donate-login">로그인하러 가기</button></div>`;
      $('#donate-login')?.addEventListener('click', () => { if (typeof navigate === 'function') navigate('login'); });
      return;
    }

    host.innerHTML = '<div class="wf-card"><p class="jd-hint">불러오는 중…</p></div>';
    try { _meta = _meta || await DB.donationMeta(); }
    catch { host.innerHTML = '<div class="wf-card"><p class="jd-err">목록을 불러오지 못했어요.</p></div>'; return; }
    render();
  }

  function optionsHtml(list, sel) {
    return `<option value="">선택</option>` +
      list.map(o => `<option value="${esc(o.id)}" ${o.id === sel ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  }

  function render() {
    const host = $('#donate-body');
    host.innerHTML = `
      <div class="wf-card" style="margin-bottom:16px">
        <div class="co-sec-h"><h2>내 합격 자소서 기증</h2>
          <span class="co-src">개인정보는 저장 전에 자동으로 가려집니다 · 문장이 아니라 <b>통계</b>로만 쓰여요</span></div>

        <div class="donate-row">
          <label>직무 <select id="donate-job">${optionsHtml(_meta.jobFields, state.job)}</select></label>
          <label>문항 유형 <select id="donate-qtype">${optionsHtml(_meta.questionTypes, state.qtype)}</select></label>
        </div>
        <div id="donate-stats" class="donate-stats"></div>

        <div id="donate-star">
          ${STAR.map(f => `<label class="donate-star-cell">
            <span>${f.lab}</span>
            <textarea data-star="${f.k}" rows="2" placeholder="${esc(f.hint)}">${esc(state.star[f.k])}</textarea>
          </label>`).join('')}
        </div>

        <label class="donate-terms">
          <span>가릴 말 (이름·회사·학교) — 쉼표로 구분. 내 이름·닉네임은 자동으로 가려져요.</span>
          <input id="donate-terms" type="text" placeholder="예) 삼성전자, 한국대학교" value="${esc(state.terms)}">
        </label>

        <div class="donate-preview">
          <div class="co-sec-h"><h3 style="margin:0">저장되기 전 — 이렇게 가려집니다</h3>
            <span id="donate-masked" class="co-src"></span></div>
          <div id="donate-preview-body" class="donate-preview-body"></div>
        </div>

        <label class="donate-consent">
          <input type="checkbox" id="donate-consent" ${state.consent ? 'checked' : ''}>
          <span>이 자소서를 <b>익명 통계</b>로 활용하는 데 동의합니다. 원문 개인정보는 저장되지 않으며,
            문장이 그대로 다른 사람에게 노출되지 않습니다.</span>
        </label>

        <div class="donate-foot">
          <button type="button" class="wf-btn" id="donate-submit">기증하기</button>
          <span id="donate-msg" class="donate-msg"></span>
        </div>
      </div>
      <div id="donate-mine"></div>`;

    bind();
    paintPreview();
    paintStats();
    paintMine();
  }

  function bind() {
    $('#donate-job').addEventListener('change', e => { state.job = e.target.value; paintStats(); });
    $('#donate-qtype').addEventListener('change', e => { state.qtype = e.target.value; paintStats(); });
    document.querySelectorAll('#donate-star [data-star]').forEach(t =>
      t.addEventListener('input', () => { state.star[t.dataset.star] = t.value; paintPreview(); }));
    $('#donate-terms').addEventListener('input', e => { state.terms = e.target.value; paintPreview(); });
    $('#donate-consent').addEventListener('change', e => { state.consent = e.target.checked; });
    $('#donate-submit').addEventListener('click', submit);
  }

  /* 저장 전 익명화 미리보기 — 서버와 같은 규칙(anonymize.js)이라 '본 것 = 저장될 것'. */
  function paintPreview() {
    const body = $('#donate-preview-body');
    const maskEl = $('#donate-masked');
    if (!body) return;
    const opts = anonOpts();
    const counts = {};
    body.innerHTML = STAR.map(f => {
      const v = state.star[f.k].trim();
      if (!v) return '';
      const { text, masked } = anonymize(v, opts);
      for (const m of masked) counts[m.type] = (counts[m.type] || 0) + m.count;
      return `<div class="donate-pv-row"><b>${f.lab}</b><span>${esc(text) || '—'}</span></div>`;
    }).join('') || '<p class="jd-hint">위 STAR 칸을 채우면 여기에 익명화 결과가 보여요.</p>';
    const list = Object.entries(counts);
    maskEl.textContent = list.length ? list.map(([t, n]) => `${t} ${n}`).join(' · ') + ' 가림' : '가릴 개인정보 없음';
  }

  async function paintStats() {
    const el = $('#donate-stats');
    if (!el) return;
    if (!state.job) { el.innerHTML = ''; return; }
    try {
      const s = await DB.donationStats({ job: state.job, qtype: state.qtype });
      const jobLab = _meta.jobFields.find(j => j.id === state.job)?.label || state.job;
      const qLab = _meta.questionTypes.find(q => q.id === state.qtype)?.label;
      el.innerHTML = s.count
        ? `<i class="ti ti-chart-bar"></i> ${esc(jobLab)}${qLab ? ` · ${esc(qLab)}` : ''} 기증 <b>${s.count}건</b> ·
           평균 <b>${s.avgCharCount ?? '—'}자</b> · 결과(R)에 <b>수치 포함 ${s.pctNumberInResult ?? 0}%</b>`
        : `<i class="ti ti-info-circle"></i> ${esc(jobLab)}${qLab ? ` · ${esc(qLab)}` : ''} 기증이 아직 없어요 — 첫 기증자가 되어 주세요.`;
    } catch { el.innerHTML = ''; }
  }

  async function paintMine() {
    const el = $('#donate-mine');
    if (!el) return;
    let items = [];
    try { items = (await DB.donationsMine()).items || []; } catch { return; }
    if (!items.length) { el.innerHTML = ''; return; }
    const jobLab = id => _meta.jobFields.find(j => j.id === id)?.label || id;
    const qLab = id => _meta.questionTypes.find(q => q.id === id)?.label || id;
    el.innerHTML = `<div class="wf-card"><div class="co-sec-h"><h3 style="margin:0">내가 기증한 자소서 ${items.length}건</h3>
      <span class="co-src">문장은 저장되지만 다른 사람에겐 통계로만 보입니다</span></div>
      <ul class="donate-mine-list">${items.map(i => `<li>
        <b>${esc(jobLab(i.jobField))}</b> · ${esc(qLab(i.questionType))} · ${i.charCount}자
        ${i.hasNumberResult ? '<span class="wf-badge wf-badge--ok">R 수치 있음</span>' : ''}
        ${(i.masked || []).length ? `<span class="jd-hint">(${i.masked.map(m => `${esc(m.type)} ${m.count}`).join(', ')} 가림)</span>` : ''}
      </li>`).join('')}</ul></div>`;
  }

  async function submit() {
    const msg = $('#donate-msg');
    const btn = $('#donate-submit');
    if (!state.job) { msg.textContent = '직무를 선택해 주세요.'; return; }
    if (!state.qtype) { msg.textContent = '문항 유형을 선택해 주세요.'; return; }
    if (!state.consent) { msg.textContent = '익명 통계 활용에 동의해야 기증할 수 있어요.'; return; }
    const joined = STAR.map(f => state.star[f.k]).join(' ').replace(/\s+/g, '');
    if (joined.length < 20) { msg.textContent = '자소서 내용을 조금 더 적어 주세요(20자 이상).'; return; }

    btn.disabled = true;
    msg.textContent = '기증하는 중…';
    try {
      const r = await DB.donate({
        jobField: state.job, questionType: state.qtype,
        star: state.star, terms: termList(), consent: true,
      });
      const m = (r.masked || []).length ? ` (${r.masked.map(x => `${x.type} ${x.count}`).join(', ')} 가림)` : '';
      msg.innerHTML = `<span class="donate-ok">✓ 기증 완료 — 개인정보를 익명화해 저장했어요${esc(m)}.</span>`;
      state.star = { s: '', t: '', a: '', r: '' }; state.terms = ''; state.consent = false;
      render();
    } catch (e) {
      msg.textContent = e.message || '기증에 실패했어요.';
    } finally {
      btn.disabled = false;
    }
  }

  const api = { onEnter };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Donate = api;
})(typeof window !== 'undefined' ? window : globalThis);
