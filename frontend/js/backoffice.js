// ════════════════════════════════════════════════════════════
//  C:road — Backoffice (관리자용 데이터베이스 뷰)
//   • 회원 목록 + 스펙 제출 현황
//   • 학과별 집계 통계
//   • 데모 시드 / 전체 초기화
// ════════════════════════════════════════════════════════════
window.Backoffice = (() => {

  const DEPT_LABEL = {
    business: '경영학과', economics: '경제학과', accounting: '회계학과',
    cs: '컴퓨터공학과', stat: '통계학과', law: '법학과',
    psych: '심리학과', media: '미디어학과',
  };

  let activeTab = 'members';
  let aggDept   = '';   // 필터: 학과

  async function render(container) {
    // 회원 목록은 관리자 전용 엔드포인트라 캐시에 없다. 진입할 때마다 받아온다.
    // 운영 환경에서는 서버가 404 로 막으므로 빈 배열이 된다.
    await DB.refreshUsers();
    const users = DB.getUsers();
    const specs = DB.getAllSpecs();
    const rc = DB.countByRole();

    container.innerHTML = `
      <div class="bo-head">
        <div class="bo-head-row">
          <div>
            <h1>백오피스 · 회원 데이터베이스</h1>
            <p class="bo-sub">C:road 의 회원 정보 · 스펙 입력 데이터를 관리합니다.</p>
          </div>
          <div class="bo-actions">
            <button class="bo-btn-ghost" id="bo-seed">데모 데이터 시드</button>
            <button class="bo-btn-ghost" id="bo-seed-random">무작위 50명 추가</button>
            <button class="bo-btn-danger" id="bo-clear">전체 초기화</button>
          </div>
        </div>

        <div class="bo-kpi-row">
          <div class="bo-kpi"><div class="bo-kpi-label">전체 회원</div><div class="bo-kpi-value">${users.length}</div></div>
          <div class="bo-kpi"><div class="bo-kpi-label">👔 멘토</div><div class="bo-kpi-value">${rc.mentor}</div></div>
          <div class="bo-kpi"><div class="bo-kpi-label">🎓 멘티</div><div class="bo-kpi-value">${rc.mentee}</div></div>
          <div class="bo-kpi"><div class="bo-kpi-label">스펙 입력</div><div class="bo-kpi-value">${specs.length}</div></div>
        </div>
      </div>

      <div class="bo-tabs">
        <div class="bo-tab ${activeTab==='members'?'on':''}" data-tab="members">회원 정보 (${users.length})</div>
        <div class="bo-tab ${activeTab==='specs'?'on':''}"   data-tab="specs">스펙 데이터 (${specs.length})</div>
        <div class="bo-tab ${activeTab==='agg'?'on':''}"     data-tab="agg">집계 통계</div>
      </div>

      <div class="bo-body" id="bo-body"></div>
    `;

    container.querySelectorAll('.bo-tab').forEach(t => {
      t.addEventListener('click', () => { activeTab = t.dataset.tab; render(container); });
    });
    document.getElementById('bo-seed').onclick = async () => {
      if (!confirm('데모 회원 5명 + 스펙을 추가합니다. 진행할까요?')) return;
      try { await DB.seedDemo(); } catch (e) { return alert('추가 실패: ' + e.message); }
      render(container);
    };
    document.getElementById('bo-seed-random').onclick = async (e) => {
      const btn = e.currentTarget;
      if (!confirm('무작위 회원 50명(스펙 포함)을 추가합니다. 진행할까요?')) return;
      btn.disabled = true; btn.textContent = '추가 중…';
      try { const r = await DB.seedRandom(50); alert(r.message); }
      catch (err) { alert('추가 실패: ' + err.message); }
      finally { btn.disabled = false; btn.textContent = '무작위 50명 추가'; }
      render(container);
    };
    document.getElementById('bo-clear').onclick = async () => {
      if (!confirm('정말 모든 회원·스펙·세션 데이터를 삭제할까요? 되돌릴 수 없습니다.')) return;
      try { await DB.clearAll(); } catch (e) { return alert('삭제 실패: ' + e.message); }
      await render(container);
      updateNavAuth();
    };

    const body = document.getElementById('bo-body');
    if (activeTab === 'members') renderMembers(body, users, specs);
    if (activeTab === 'specs')   renderSpecs(body, users, specs);
    if (activeTab === 'agg')     renderAgg(body, specs);
  }

  // ── 회원 정보 ─────────────────────────────────────────────
  function renderMembers(body, users, specs) {
    if (!users.length) {
      body.innerHTML = emptyState('등록된 회원이 없습니다', '회원가입 또는 데모 시드로 데이터를 추가해보세요.');
      return;
    }
    body.innerHTML = `
      <div class="bo-table-wrap">
        <table class="bo-table">
          <thead>
            <tr>
              <th>유형</th><th>아이디</th><th>이름</th><th>이메일</th><th>별명</th>
              <th>가입일</th><th>스펙</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const has = specs.some(s => s.username === u.username);
              const roleChip = u.role === 'mentor'
                ? '<span class="bo-role bo-role--mentor">👔 멘토</span>'
                : u.role === 'mentee'
                ? '<span class="bo-role bo-role--mentee">🎓 멘티</span>'
                : '<span class="bo-role bo-role--none">—</span>';
              return `
                <tr>
                  <td>${roleChip}</td>
                  <td><code>${esc(u.username)}</code></td>
                  <td>${esc(u.name)}</td>
                  <td>${esc(u.email)}</td>
                  <td>${esc(u.nickname || '—')}</td>
                  <td class="bo-dim">${fmtDate(u.createdAt)}</td>
                  <td>${has ? '<span class="bo-chip-on">입력</span>' : '<span class="bo-chip-off">미입력</span>'}</td>
                  <td><button class="bo-row-del" data-user="${esc(u.username)}">삭제</button></td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    body.querySelectorAll('.bo-row-del').forEach(b => {
      b.onclick = async () => {
        if (!confirm(`${b.dataset.user} 회원을 삭제할까요? (스펙도 함께 삭제됨)`)) return;
        try { await DB.deleteUser(b.dataset.user); }
        catch (e) { return alert('삭제 실패: ' + e.message); }
        await render(document.getElementById('page-backoffice').querySelector('.bo-wrap'));
        updateNavAuth();
      };
    });
  }

  // ── 스펙 데이터 ──────────────────────────────────────────
  function renderSpecs(body, users, specs) {
    if (!specs.length) {
      body.innerHTML = emptyState('입력된 스펙 데이터가 없습니다', '회원이 스펙을 입력하면 여기 표시됩니다.');
      return;
    }
    body.innerHTML = `
      <div class="bo-table-wrap">
        <table class="bo-table">
          <thead>
            <tr>
              <th>회원</th><th>학과</th><th>희망분야</th><th>GPA</th>
              <th>자격증</th><th>TOEIC</th><th>OPIc</th><th>정성스펙</th><th>업데이트</th>
            </tr>
          </thead>
          <tbody>
            ${specs.map(s => {
              const user = users.find(u => u.username === s.username) || {};
              // 대표 활동 수 (구조화된 activities 우선, 옛 boolean qual 도 환산)
              const qualCount = (window.CAS ? CAS.normalizeActivities(s) : (s.activities || [])).length;
              return `
                <tr>
                  <td><b>${esc(user.name || s.username)}</b><div class="bo-dim">${esc(s.username)}</div></td>
                  <td>${DEPT_LABEL[s.dept] || s.dept || '—'}</td>
                  <td>${s.field || '—'}${s.job ? ' › ' + s.job : ''}</td>
                  <td>${s.gpa != null ? `${s.gpa} / ${s.gpaMax}` : '—'}</td>
                  <td>${(s.certs || []).length ? (s.certs || []).map(c => `<span class="bo-tag">${esc(c)}</span>`).join('') : '<span class="bo-dim">—</span>'}</td>
                  <td>${s.scores?.toeic ?? '—'}</td>
                  <td>${s.scores?.opic ?? '—'}</td>
                  <td><span class="bo-chip-on">${qualCount}개 활동</span></td>
                  <td class="bo-dim">${fmtDate(s.updatedAt)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // ── 집계 통계 ─────────────────────────────────────────────
  function renderAgg(body, specs) {
    if (!specs.length) {
      body.innerHTML = emptyState('집계할 데이터가 없습니다', '회원의 스펙이 입력되면 학과/직무별로 자동 집계됩니다.');
      return;
    }
    const depts = [...new Set(specs.map(s => s.dept).filter(Boolean))];
    const filtered = aggDept ? { dept: aggDept } : {};
    const agg = Aggregator.compute(filtered);

    body.innerHTML = `
      <div class="bo-agg-filter">
        <label>학과 필터:</label>
        <select id="bo-agg-dept">
          <option value="">전체 (${specs.length}명)</option>
          ${depts.map(d => `<option value="${d}" ${aggDept===d?'selected':''}>${DEPT_LABEL[d] || d} (${specs.filter(s=>s.dept===d).length}명)</option>`).join('')}
        </select>
      </div>

      ${agg.empty ? emptyState('해당 학과에 데이터가 없습니다','') : `
        <div class="bo-agg-grid">
          <div class="bo-agg-card">
            <div class="bo-agg-title">학점 평균</div>
            ${agg.gpa ? `
              <div class="bo-agg-big">${agg.gpa.avg} <span class="bo-dim">/ 4.5</span></div>
              <div class="bo-dim">범위 ${agg.gpa.min} ~ ${agg.gpa.max} · n=${agg.gpa.n}</div>
            ` : `<div class="bo-dim">학점 데이터 없음</div>`}
          </div>
          <div class="bo-agg-card">
            <div class="bo-agg-title">TOEIC 평균</div>
            ${agg.scores.toeic ? `
              <div class="bo-agg-big">${agg.scores.toeic.avg}</div>
              <div class="bo-dim">범위 ${agg.scores.toeic.min} ~ ${agg.scores.toeic.max} · n=${agg.scores.toeic.n}</div>
            ` : `<div class="bo-dim">데이터 없음</div>`}
          </div>
          <div class="bo-agg-card">
            <div class="bo-agg-title">OPIc 평균</div>
            ${agg.scores.opic ? `
              <div class="bo-agg-big">${agg.scores.opic.avg}</div>
              <div class="bo-dim">n=${agg.scores.opic.n}</div>
            ` : `<div class="bo-dim">데이터 없음</div>`}
          </div>
          <div class="bo-agg-card">
            <div class="bo-agg-title">TOEFL 평균</div>
            ${agg.scores.toefl ? `
              <div class="bo-agg-big">${agg.scores.toefl.avg}</div>
              <div class="bo-dim">범위 ${agg.scores.toefl.min} ~ ${agg.scores.toefl.max} · n=${agg.scores.toefl.n}</div>
            ` : `<div class="bo-dim">데이터 없음</div>`}
          </div>
        </div>

        <div class="bo-agg-block">
          <div class="bo-agg-title">자격증 보유율</div>
          ${agg.certs.length ? `
            <div class="bo-bar-list">
              ${agg.certs.map(c => `
                <div class="bo-bar-row">
                  <div class="bo-bar-label">${esc(c.name)}</div>
                  <div class="bo-bar-track"><div class="bo-bar-fill" style="width:${c.pct}%"></div></div>
                  <div class="bo-bar-pct">${c.pct}%</div>
                  <div class="bo-bar-n">${c.n}명</div>
                </div>`).join('')}
            </div>` : `<div class="bo-dim">자격증 데이터 없음</div>`}
        </div>

        <div class="bo-agg-block">
          <div class="bo-agg-title">정성 스펙 보유율</div>
          <div class="bo-bar-list">
            ${agg.qual.map(q => `
              <div class="bo-bar-row">
                <div class="bo-bar-label">${q.icon} ${q.label}</div>
                <div class="bo-bar-track"><div class="bo-bar-fill bo-bar-fill--alt" style="width:${q.pct}%"></div></div>
                <div class="bo-bar-pct">${q.pct}%</div>
                <div class="bo-bar-n">${q.n}명</div>
              </div>`).join('')}
          </div>
        </div>
      `}
    `;

    const ds = document.getElementById('bo-agg-dept');
    if (ds) ds.onchange = () => { aggDept = ds.value; render(document.getElementById('page-backoffice').querySelector('.bo-wrap')); };
  }

  // ── helpers ───────────────────────────────────────────────
  function emptyState(title, desc) {
    return `<div class="bo-empty"><div class="bo-empty-title">${title}</div><div class="bo-empty-desc">${desc}</div></div>`;
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, m =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  }
  function fmtDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  }

  return { render };
})();
