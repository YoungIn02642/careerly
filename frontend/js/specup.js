// ════════════════════════════════════════════════════════════
//  C:road — 스펙업 (#specup) · 로드맵 2단계에서 갈라지는 곁가지
//
//  ── 왜 '스펙 입력' 과 다른 화면인가 ──
//  CAS 2단계의 '스펙 채우기' 버튼은 지금까지 마이페이지 **스펙 입력 폼**으로 갔다.
//  그런데 거기는 *이미 한 것을 적는* 곳이다. 부족한 항목을 보고 넘어온 학생에게
//  빈 입력 폼을 주면 "없는 걸 어디서 채우라는 거지" 로 끝난다.
//  이 화면은 그 자리를 대신해 **지금 실제로 신청할 수 있는 것**을 보여준다.
//
//  ── 무엇을 보여줄지 정하는 근거 (사용자 지시: 선배·직무 기준) ──
//    ① 부족한 것 우선 — CAS GAP 판정 그대로 (mentoring.js window.Gap)
//       "선배 보유율 40% 이상인데 내게 없는 것". 우리가 중요하다고 정한 게 아니라
//       **같은 직무로 간 선배들이 실제로 갖고 있는 것**이다.
//    ② 부족한 게 없으면 — 그 직무군 선배 보유율 상위 항목을 그대로 보여준다.
//       빈 화면 대신 "선배들이 많이 한 것" 이 남아야 다음에 할 일이 보인다.
//    ③ 거기에 '지금 접수 중' 을 덧붙인다 — 국가자격 시험일정 · 공모전 모집공고.
//
//  ── 판정 기준을 새로 만들지 않는다 ──
//  '부족' 의 정의는 mentoring.js 가 단일 출처고(window.Gap), 비교 모집단은
//  cas-hero.js 가 정한다(CASHero.resolveContext). 여기서 따로 계산하면 CAS 에서
//  3개라던 것이 여기서 5개가 되는 식으로 갈린다.
//
//  ── 외부 데이터가 없어도 화면은 살아 있다 ──
//  시험일정·공모전 API 는 각각 활용신청/키 발급이 필요하다(backend/src/specup.js).
//  둘 다 막혀 있어도 ①②는 우리 DB 로 나오고, ③ 자리에는 "무엇을 하면 열리는지"가
//  뜬다. 빈 칸을 남기면 고장으로 읽힌다.
// ════════════════════════════════════════════════════════════
window.SpecUp = (() => {

  const TABS = [
    { id: 'cert',     label: '자격증',           icon: 'ti-certificate' },
    { id: 'lang',     label: '어학',             icon: 'ti-language' },
    { id: 'contest',  label: '공모전·대회',      icon: 'ti-trophy' },
    { id: 'activity', label: '대외활동·서포터즈', icon: 'ti-users-group' },
  ];

  let tab = 'cert';

  /* 외부 호출 상태는 탭마다 따로 들고 있다. 탭을 옮길 때마다 다시 부르면 개발계정
     하루 1,000건이 금방 닳는다(backend/src/specup.js 캐시와 같은 이유). */
  let examState = null;                 // { loading } | 서버 응답
  const actState = {};                  // topic → { loading } | 서버 응답
  let lastCertKey = '';                 // 어떤 자격증 목록으로 일정을 받았는지

  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const host = () => document.getElementById('specup-wrap');

  // ── 진입 ────────────────────────────────────────────────────
  function onEnter() {
    /* 직무 분류(200KB)가 없으면 목표 직무군 기준 집계를 못 한다. CAS 화면과 같은
       통로로 받아 온다 — 받아지면 CASHero 가 render 를 다시 부르지만 이 화면은
       그 대상이 아니므로 여기서도 한 번 더 그린다. */
    if (window.CASHero?.ensureKeco) CASHero.ensureKeco();
    render();
    if (!KECO.ready()) KECO.load().then(render).catch(() => { /* 학과 기준으로 간다 */ });
  }

  function switchTab(id) {
    tab = TABS.some(t => t.id === id) ? id : 'cert';
    render();
  }

  // ── 문맥 ────────────────────────────────────────────────────
  /* CAS 와 **같은 모집단**을 쓴다. 다르면 "CAS 에선 부족하다더니 여기선 없다" 가 된다. */
  function resolve() {
    const r = window.CASHero?.resolveContext?.();
    if (!r) return { ok: false, msg: '점수 엔진을 불러오지 못했어요.', help: '' };
    return r;
  }

  // ── 렌더 ────────────────────────────────────────────────────
  function render() {
    const el = host();
    if (!el) return;
    Roadmap.mount('rm-bar-specup', 'me');

    const resolved = resolve();
    el.innerHTML = head(resolved) + tabBar() + `<div class="sup-body">${body(resolved)}</div>`;
  }

  function head(resolved) {
    const rm = Roadmap.get();
    const goal = rm ? (rm.jobName || rm.middleName) : null;
    const scope = resolved.ok ? resolved.ctx.scopeLabel : goal;
    const n = resolved.ok ? resolved.ctx.agg.count : null;

    const desc = resolved.ok
      ? `<b>${esc(scope)}</b> 선배 <b>${n}명</b>이 실제로 가진 것 가운데 내게 없는 항목부터 보여드려요.
         우리가 중요하다고 정한 목록이 아니라 <b>선배 보유율</b>로 고른 것이에요.`
      : `${esc(resolved.msg || '')} ${esc(resolved.help || '')}`;

    return `
      <div class="page-head">
        <div class="page-eyebrow">커리어 로드맵 2단계 · 스펙 채우기</div>
        <h1 class="page-title">무엇부터 채울까요</h1>
        <p class="page-desc">${desc}</p>
      </div>
      ${resolved.ok ? summary(resolved.ctx) : ''}`;
  }

  /* 세 갈래(자격증·활동·성과)의 부족 개수를 한 줄로. CAS 화면의 갈림길이 쓰는
     숫자와 같은 함수에서 나온다. */
  function summary(ctx) {
    const G = window.Gap;
    if (!G) return '';
    const state = G.gapContext(ctx);
    if (!state.ok) {
      return `<div class="sup-note sup-note--muted">
        <i class="ti ti-info-circle"></i>
        <div><b>${esc(state.title)}</b><br>${esc(state.desc)}</div>
      </div>`;
    }
    const rows = [
      ['cert',     '자격증'],
      ['activity', '활동·경험'],
      ['award',    '수상·성과'],
    ].map(([type, label]) => {
      const n = G.computeGaps(type, state.ctx).length;
      return `<div class="sup-kpi ${n ? '' : 'is-ok'}">
        <div class="sup-kpi-n">${n}</div><div class="sup-kpi-l">${label}</div></div>`;
    }).join('');

    return `<div class="sup-kpis">${rows}<div class="sup-kpi-note">
      선배 보유율 ${G.RATE.cert}%(수상은 ${G.RATE.award}%) 이상인 항목 중 내게 없는 것의 수예요.
    </div></div>`;
  }

  function tabBar() {
    return `<div class="sup-tabs">${TABS.map(t => `
      <button type="button" class="sup-tab ${tab === t.id ? 'on' : ''}"
              onclick="SpecUp.switchTab('${t.id}')">
        <i class="ti ${t.icon}"></i>${t.label}
      </button>`).join('')}</div>`;
  }

  function body(resolved) {
    if (tab === 'contest' || tab === 'activity') return activityTab(resolved, tab);
    if (!resolved.ok) return blocked(resolved);
    if (tab === 'lang') return langTab(resolved.ctx);
    return certTab(resolved.ctx);
  }

  /* 로그인·스펙이 없어 판정을 못 하는 상태. 공모전 탭은 이 상태에서도 볼 수 있으므로
     길을 막지 않고 두 갈래를 같이 준다. */
  function blocked(resolved) {
    return `
      <div class="sup-empty">
        <div class="sup-empty-ic">🔒</div>
        <div class="sup-empty-title">${esc(resolved.msg || '아직 판정할 수 없어요')}</div>
        <div class="sup-empty-desc">${esc(resolved.help || '')}</div>
        <div class="sup-empty-actions">
          <button type="button" class="btn-brand" onclick="navigateTo('mypage','spec')">
            <i class="ti ti-file-pencil"></i> 내 스펙 입력하기
          </button>
          <button type="button" class="sup-ghost" onclick="SpecUp.switchTab('contest')">
            지금 모집 중인 공모전 보기
          </button>
        </div>
      </div>`;
  }

  // ── ① 자격증 ────────────────────────────────────────────────
  function certTab(ctx) {
    const G = window.Gap;
    const state = G ? G.gapContext(ctx) : { ok: false };
    const gaps = state.ok ? G.computeGaps('cert', state.ctx) : [];

    /* 부족한 게 없어도 빈 화면을 주지 않는다 — 선배 보유율 상위를 그대로 보여준다.
       '더 할 게 없다' 와 '보여줄 게 없다' 는 다른 말이다.

       ── 이 목록에서도 '아직 없는 것' 이 먼저다 ──
       실측(정보통신 직무군)에서 상위 6개 중 3개가 이미 보유한 자격이라, 채울 것을
       찾으러 온 화면의 절반이 '보유' 배지로 찼다. 보유한 것을 지우지는 않는다 —
       "선배들이 많이 가진 것" 이라는 목록의 뜻이 달라지기 때문이다. 순서만 바꾼다. */
    const fallback = !gaps.length;
    const rows = fallback
      ? (ctx.agg.certs || []).filter(c => c.pct > 0)
          .map(c => ({ name: c.name, pct: c.pct, mine: (ctx.spec.certs || []).includes(c.id) }))
          .sort((a, b) => (a.mine === b.mine ? 0 : a.mine ? 1 : -1) || b.pct - a.pct)
          .slice(0, 6)
      : gaps.map(g => ({ name: g.name, pct: g.pct, mine: false }));

    if (!rows.length) {
      return notice('📭', '이 직무군은 자격증 데이터가 아직 없어요',
        '선배 스펙이 쌓이면 어떤 자격증을 많이 갖고 있는지 보여드릴게요.');
    }

    requestExams(rows.map(r => r.name));

    const banner = fallback
      ? notice('✅', '선배 평균만큼 채웠어요',
          '부족한 자격증은 없어요. 아래는 이 직무군 선배들이 많이 가진 자격증이에요.', true)
      : '';

    return banner + `
      <div class="sup-list">${rows.map(certRow).join('')}</div>
      ${examFoot()}`;
  }

  function certRow(r) {
    const sched = examOf(r.name);
    return `
      <div class="sup-item">
        <div class="sup-item-ic">📜</div>
        <div class="sup-item-body">
          <div class="sup-item-name">${esc(r.name)}
            ${r.mine ? `<span class="sup-tag sup-tag--have">보유</span>` : ''}
          </div>
          <div class="sup-item-desc">선배 <b>${r.pct}%</b>가 보유${r.mine ? '' : ' · 나는 미보유'}</div>
          ${sched}
        </div>
        <a class="sup-item-go" href="https://www.q-net.or.kr" target="_blank" rel="noopener">
          큐넷 <i class="ti ti-external-link"></i>
        </a>
      </div>`;
  }

  /* 한 자격의 시험일정 줄. **모르면 모른다고 적는다** — 일정이 안 뜨는 것과
     시험이 없는 것은 다르다. */
  function examOf(name) {
    if (!examState) return '';
    if (examState.loading) return `<div class="sup-sched sup-sched--wait">시험일정 확인 중…</div>`;
    if (!examState.ok) return '';                       // 안내는 examFoot() 이 한 번만 한다

    const item = (examState.items || []).find(i => i.name === name);
    if (!item) return '';
    /* ── 못 찾은 종목은 짧게 한 줄 ────────────────────────────
       실측(정보통신 직무군)에서 6줄 중 5줄이 민간자격이라, 줄마다 같은 두 문장을
       반복해 **화면이 통째로 경고문이 됐다.** 이유 설명은 목록 아래 각주로 한 번만
       하고(examFoot), 여기서는 사실만 짧게 적는다. */
    if (!item.matched) return `<div class="sup-sched sup-sched--none">국가자격 일정표에 없는 종목이에요<sup>*</sup></div>`;
    if (!item.round)   return `<div class="sup-sched sup-sched--none">${esc(item.note || '남은 회차가 없어요')}</div>`;

    const r = item.round;
    const which = roundLabel(r);

    if (r.phase === 'open') {
      const d = r.daysToRegEnd;
      return `<div class="sup-sched sup-sched--open">
        <b>지금 ${esc(which)} 접수 중</b> · ${esc(r.regStart)} ~ ${esc(r.regEnd)}
        ${d != null ? `<span class="sup-dday">${d === 0 ? '오늘 마감' : `D-${d}`}</span>` : ''}
        ${r.examStart ? ` · 시험 ${esc(r.examStart)}` : ''}
      </div>`;
    }
    if (r.phase === 'upcoming') {
      const d = r.daysToRegStart;
      return `<div class="sup-sched sup-sched--soon">
        ${esc(which)} 접수 시작 ${esc(r.regStart)}${d != null ? ` (${d}일 뒤)` : ''}
        ${r.examStart ? ` · 시험 ${esc(r.examStart)}` : ''}
      </div>`;
    }
    /* 접수는 끝났고 시험을 기다리는 회차. 이번엔 못 넣는다는 뜻이므로 그렇게 적는다 —
       '시험 8/7' 만 보여주면 아직 신청할 수 있는 것처럼 읽힌다. */
    return `<div class="sup-sched">
      ${esc(which)} 접수 마감${r.examStart ? ` · 시험 ${esc(r.examStart)}` : ''} · 다음 회차를 기다려야 해요
    </div>`;
  }

  /* '국가기술자격 기사 (2026년도 제3회)' → '필기 2026년도 제3회'.
     자격구분(국가기술자격/전문자격)은 자격증 이름에서 이미 드러나므로 접고, 회차만
     남긴다 — 어느 회차인지가 안 보이면 날짜가 어디서 온 값인지 알 수 없다. */
  function roundLabel(r) {
    const inner = /\(([^)]+)\)\s*$/.exec(r.label || '');
    const seq = inner ? inner[1] : (r.label || '').replace(/^(국가기술자격|전문자격)\s*/, '');
    return [r.stage, seq].filter(Boolean).join(' ');
  }

  /* 일정을 못 받았을 때의 안내는 목록 아래에 **한 번만** 붙인다. 자격증마다 같은
     문구를 반복하면 화면이 경고문으로 덮인다. */
  function examFoot() {
    if (!examState || examState.loading) return '';

    if (examState.ok) {
      /* 못 찾은 종목이 있으면 그 이유를 여기서 **한 번만** 설명한다. */
      const missed = (examState.items || []).filter(i => !i.matched).map(i => i.name);
      return `<div class="sup-src">
        시험일정: ${esc(examState.source || '')} · ${examState.year}년 필기 기준
        (실기는 필기 합격자만 접수할 수 있어 보여주지 않아요)
        ${missed.length ? `<br><sup>*</sup> ${esc(missed.join(' · '))} 는 국가자격 시험일정에서 못 찾았어요 —
          민간자격이거나 종목 목록에 빠진 종목이라, 시행기관 공지를 확인해 주세요.` : ''}
      </div>`;
    }
    return `<div class="sup-note">
      <i class="ti ti-calendar-off"></i>
      <div><b>${esc(examState.error)}</b>
        ${examState.how ? `<br><span class="sup-note-how">${esc(examState.how)}</span>` : ''}
        <br><span class="sup-note-how">일정이 없어도 위 목록(선배 보유율)은 그대로예요.</span>
      </div>
    </div>`;
  }

  /* 같은 자격증 목록이면 다시 부르지 않는다. render() 는 탭을 옮길 때마다 돈다. */
  function requestExams(names) {
    const key = names.slice().sort().join('|');
    if (key === lastCertKey) return;
    lastCertKey = key;
    examState = { loading: true };
    DB.specupExams(names).then(res => {
      examState = res;
      if (tab === 'cert') render();
    });
  }

  // ── ② 어학 ──────────────────────────────────────────────────
  /* 어학은 '있다/없다' 가 아니라 **점수 차이**라 GAP 판정 대상이 아니다(성적은
     보유율로 세면 뜻이 흐려진다). 그래서 선배 평균과 내 점수를 나란히 놓고
     차이만 말한다.

     ── 시험 일정 API 가 없다 ──
     TOEIC·OPIc·TOEIC Speaking 은 시행기관(YBM·크레듀)이 공개 API 를 열지 않는다.
     국가자격 시험일정에도 없다. 없는 것을 있는 척 정적 표로 박아 두면 다음 달에
     조용히 틀린 날짜가 된다 — 이 저장소가 제일 경계하는 부류라 넣지 않았다.
     대신 공식 접수 페이지로 바로 보낸다. */
  const LANG_ROWS = [
    { key: 'toeic',         label: 'TOEIC',          unit: '점',   url: 'https://exam.toeic.co.kr' },
    { key: 'toeicSpeaking', label: 'TOEIC Speaking', unit: '',     url: 'https://exam.toeic.co.kr' },
    { key: 'opic',          label: 'OPIc',           unit: '',     url: 'https://www.opic.or.kr' },
    { key: 'toefl',         label: 'TOEFL',          unit: '점',   url: 'https://www.ets.org/toefl' },
  ];

  function langTab(ctx) {
    const mine = ctx.spec.scores || {};
    const peer = ctx.agg.scores || {};

    const rows = LANG_ROWS.map(l => {
      const p = peer[l.key];
      const m = mine[l.key];
      if (!p && m == null) return '';                 // 선배도 나도 없는 시험은 굳이 줄을 만들지 않는다

      const gap = (typeof p?.avg === 'number' && typeof m === 'number') ? p.avg - m : null;
      const status = m == null
        ? { cls: 'lack', text: '미응시' }
        : gap == null
          ? { cls: '', text: '보유' }
          : gap > 0 ? { cls: 'lack', text: `${gap}${l.unit} 부족` } : { cls: 'ok', text: '평균 이상' };

      return `
        <div class="sup-item">
          <div class="sup-item-ic">🗣️</div>
          <div class="sup-item-body">
            <div class="sup-item-name">${l.label}
              <span class="sup-tag ${status.cls === 'ok' ? 'sup-tag--have' : ''}">${esc(status.text)}</span>
            </div>
            <div class="sup-item-desc">
              선배 평균 <b>${p ? esc(String(p.avg)) + l.unit : '자료 없음'}</b>${p ? ` (n=${p.n})` : ''}
              · 내 점수 <b>${m == null ? '없음' : esc(String(m)) + l.unit}</b>
            </div>
          </div>
          <a class="sup-item-go" href="${l.url}" target="_blank" rel="noopener">
            접수 <i class="ti ti-external-link"></i>
          </a>
        </div>`;
    }).filter(Boolean).join('');

    if (!rows) {
      return notice('📭', '어학 데이터가 아직 없어요',
        '이 직무군 선배 중 어학 성적을 입력한 사람이 없어서 목표치를 낼 수 없어요.');
    }

    return `
      <div class="sup-list">${rows}</div>
      <div class="sup-src">
        목표치는 <b>${esc(ctx.scopeLabel)} 선배 평균</b>이에요. 어학시험은 시행기관이 공개 API 를
        열지 않아 접수 일정을 자동으로 가져오지 못합니다 — 위 ‘접수’ 로 공식 페이지에서 확인하세요.
      </div>`;
  }

  // ── ③ 공모전 · 대외활동 ─────────────────────────────────────
  /* 위쪽에는 **우리 데이터**(선배 보유율 기준 부족 활동), 아래쪽에 **모집 중인 공고**.
     공고만 늘어놓으면 "그래서 나한테 뭐가 필요한데" 가 빠진다. */
  function activityTab(resolved, topic) {
    const st = actState[topic];
    if (!st) requestActivities(topic);

    const guide = resolved.ok ? activityGuide(resolved.ctx, topic) : '';
    return guide + activityList(topic);
  }

  function activityGuide(ctx, topic) {
    const G = window.Gap;
    const state = G ? G.gapContext(ctx) : { ok: false };
    if (!state.ok) return '';

    /* 공모전 탭은 '공모전·대회' 유형만, 대외활동 탭은 나머지 참여형 활동을 본다.
       유형 id 는 CAS.ACTIVITY_TYPES 가 단일 출처다. */
    const want = topic === 'contest'
      ? ['competition']
      : ['extracurricular', 'club', 'campus', 'volunteer'];
    const gaps = G.computeGaps('activity', state.ctx);

    /* ── 이 탭과 무관한 유형으로 채우지 않는다 ────────────────────
       처음에는 해당 유형이 하나도 없으면 부족 활동 전체로 물러섰다. 그랬더니
       **'공모전·대회' 탭에 "인턴십 44% · 프로젝트 61%" 가 떴다**(실측). 탭 제목이
       말하는 것과 아래 내용이 다르면, 학생은 이 화면이 무엇을 근거로 고른 목록인지
       알 수 없게 된다. 이 유형이 부족하지 않으면 이 줄은 그냥 안 그린다 —
       아래 모집 공고는 그대로 보여주므로 화면이 비지 않는다. */
    const rows = gaps.filter(g => want.some(w => matchesType(g, w))).slice(0, 3);
    if (!rows.length) return '';

    return `<div class="sup-note sup-note--why">
      <i class="ti ti-target-arrow"></i>
      <div><b>${esc(ctx.scopeLabel)} 선배가 많이 한 활동 중 내게 없는 것</b><br>
        ${rows.map(g => `${esc(g.name)} <span class="sup-why-pct">선배 ${g.pct}%</span>`).join(' · ')}
      </div>
    </div>`;
  }

  /* GAP 행에는 유형 id 가 없고 라벨만 있다. 라벨은 CAS.ACTIVITY_TYPES 에서 오므로
     거기서 되짚는다 — 라벨 문자열을 여기에 박아 두면 배점표를 고칠 때 갈린다. */
  function matchesType(gapRow, typeId) {
    const t = (window.CAS?.ACTIVITY_TYPES || []).find(x => x.id === typeId);
    return Boolean(t && t.label === gapRow.name);
  }

  function activityList(topic) {
    const st = actState[topic];
    if (!st || st.loading) {
      return `<div class="sup-empty"><div class="sup-empty-ic">⏳</div>
        <div class="sup-empty-title">모집 공고를 불러오는 중…</div></div>`;
    }
    if (!st.ok) {
      return `<div class="sup-note">
        <i class="ti ti-plug-connected-x"></i>
        <div><b>${esc(st.error)}</b>
          ${st.how ? `<br><span class="sup-note-how">${esc(st.how)}</span>` : ''}
          <br><span class="sup-note-how">
            공모전·대외활동만 모아 주는 전국 단위 공개 API 는 없어서, 온통청년(한국고용정보원)
            청년정책 목록에서 골라 씁니다 — 자세한 조사 결과는 docs/외부API-연동구조.md 에 있어요.
          </span>
        </div>
      </div>`;
    }
    if (!st.items.length) {
      return notice('📭', '지금 걸린 공고가 없어요',
        '키워드로 걸러 낸 결과라 시기에 따라 비어 있을 수 있어요.');
    }

    return `
      <div class="sup-list">${st.items.slice(0, 20).map(actRow).join('')}</div>
      <div class="sup-src">출처: ${esc(st.source)}</div>`;
  }

  function actRow(a) {
    const dday = a.endDate ? ` · 마감 ${esc(a.endDate)}` : (a.period ? ' · 상시' : '');
    return `
      <div class="sup-item">
        <div class="sup-item-ic">🏆</div>
        <div class="sup-item-body">
          <div class="sup-item-name">${esc(a.name)}</div>
          <div class="sup-item-desc">${esc(a.org || '주관 미상')}${dday}</div>
          ${a.summary ? `<div class="sup-item-sub">${esc(a.summary)}</div>` : ''}
          ${a.keywords.length
            ? `<div class="sup-chips">${a.keywords.map(k => `<span class="sup-chip">${esc(k)}</span>`).join('')}</div>`
            : ''}
        </div>
        ${a.url
          ? `<a class="sup-item-go" href="${esc(a.url)}" target="_blank" rel="noopener">
               신청 <i class="ti ti-external-link"></i></a>`
          : ''}
      </div>`;
  }

  function requestActivities(topic) {
    actState[topic] = { loading: true };
    DB.specupActivities(topic).then(res => {
      actState[topic] = res;
      if (tab === topic) render();
    });
  }

  // ── 조각 ────────────────────────────────────────────────────
  function notice(icon, title, desc, ok) {
    return `<div class="sup-empty ${ok ? 'sup-empty--ok' : ''}">
      <div class="sup-empty-ic">${icon}</div>
      <div class="sup-empty-title">${esc(title)}</div>
      <div class="sup-empty-desc">${esc(desc)}</div>
    </div>`;
  }

  return { onEnter, switchTab, render };
})();
