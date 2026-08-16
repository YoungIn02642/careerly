/* ════════════════════════════════════════════════════════════
   커리어 로드맵 — 흐름 상태 (C:road)

   로드맵은 화면 하나가 아니라 **네 화면을 가로지르는 흐름**이다.

     ① 직무 찾기(#career) → ② 지금 내 위치(#dashboard·CAS)
       → ③ 지원할 회사(#company) → ④ 자소서 코치(#jd)

   ②에서 부족한 것이 보이면 스펙 채우기(#mypage/spec)로 갔다가 ②로 돌아온다.
   앞으로 가는 단계가 아니라 **되돌아오는 곁가지**라 스텝바에 칸을 주지 않는다 —
   칸을 주면 "스펙을 채워야 다음으로 갈 수 있다"로 읽힌다.

   ── 이 파일이 필요한 이유 ──
   네 화면이 각자 자기 상태만 들고 있으면 흐름이 성립하지 않는다. 실제로 지금까지
   career.js 의 고른 직무를 CAS 가 몰랐고, CAS 는 자기 나름의 '비교 직무' 를 따로
   골랐다. 같은 사람이 같은 순간에 두 직무를 목표로 갖는 셈이라, 두 화면의 숫자가
   왜 다른지 설명할 수 없었다. **고른 직무를 한 곳에 두는 것**이 이 파일의 전부다.

   ── 저장 위치가 둘인 이유 ──
   | 무엇 | 어디에 | 왜 |
   |---|---|---|
   | 1차·2차 분류 (목표 직무) | **서버** (`spec.jobMajor` / `jobMiddles`) | 기기를 바꿔도 목표는 남아야 한다. 스펙 입력 폼과 같은 칸이라 새 컬럼이 필요 없다 |
   | 직업 코드·이름, 고른 회사 | 브라우저 (localStorage) | 화면 이동 중의 문맥이다. 통계·집계에 쓰이지 않으므로 서버에 둘 이유가 없다 |

   ── 해상도를 속이지 않는다 ──
   직무 찾기는 직업 461개 단위지만, **선배 스펙 통계와 CAS 벤치마크는 2차 분류
   (35개) 단위**다. 461개로 쪼개면 표본이 한 자릿수로 내려가 평균이 뜻을 잃는다
   (career.js renderRoadmap 주석과 같은 판단). 그래서 bench() 는 2차 분류로 집계하고,
   화면은 "○○ 직무군 기준" 이라고 그대로 적는다.
   ════════════════════════════════════════════════════════════ */
(function (root) {

  const LS_KEY = 'careerly_roadmap_v1';

  /* 스텝바의 칸. page 는 app.js 의 PAGES 값이다. */
  const STEPS = [
    { id: 'job',     no: 1, label: '직무 찾기',    page: 'career',    hint: '관심 직무를 고르고 필요한 스펙을 봅니다' },
    { id: 'me',      no: 2, label: '지금 내 위치', page: 'dashboard', hint: '그 직무 선배와 비교한 내 CAS 점수' },
    { id: 'company', no: 3, label: '지원할 회사',  page: 'company',   hint: '그 직무를 뽑는 계열에서 회사를 고릅니다' },
    { id: 'cover',   no: 4, label: '자소서 코치',  page: 'jd',        hint: '고른 회사·공고로 자소서를 씁니다' },
  ];

  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ── 조사 ────────────────────────────────────────────────────
     직무·회사 이름을 문장에 끼워 넣는 자리가 여럿이다. '을(를)' 로 적어 두면
     **'응용소프트웨어개발자을(를)'** 처럼 읽힌다 — 데이터로 문장을 만드는 화면에서
     이 표기가 남아 있으면 만든 티가 그대로 난다.

     받침(종성)으로 고른다. 한글 음절은 0xAC00 부터 28개씩 묶여 있어서
     (코드 - 0xAC00) % 28 이 0이면 받침이 없다. 8은 'ㄹ' — '(으)로' 만 예외로
     'ㄹ' 받침을 받침 없는 것처럼 다룬다('서울로', '개발로').

     한글로 끝나지 않으면(영문 사명 'SK', 숫자) 받침을 알 수 없으므로 둘 다 적는다 —
     찍어서 틀리느니 '(를)' 을 남기는 편이 낫다. */
  const JOSA = {
    을: ['를', '을'], 은: ['는', '은'], 이: ['가', '이'], 과: ['와', '과'], 로: ['로', '으로'],
  };
  function josa(word, kind) {
    const pair = JOSA[kind];
    if (!pair) return '';
    const ch = String(word ?? '').trim().slice(-1);
    const code = ch.charCodeAt(0);
    if (!(code >= 0xac00 && code <= 0xd7a3)) return `${pair[0]}(${pair[1]})`;
    const jong = (code - 0xac00) % 28;
    const hasBatchim = kind === '로' ? (jong !== 0 && jong !== 8) : jong !== 0;
    return pair[hasBatchim ? 1 : 0];
  }
  /* 이름 + 조사를 한 덩어리로. 호출부가 esc 를 잊지 않게 여기서 같이 한다. */
  const withJosa = (word, kind) => `${esc(word)}${josa(word, kind)}`;

  // ── 상태 ────────────────────────────────────────────────────
  let state = null;

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY));
      return raw && raw.middle ? raw : null;     // 2차 분류가 없으면 집계를 못 한다 = 없는 것과 같다
    } catch { return null; }
  }
  function write(next) {
    state = next;
    try {
      if (next) localStorage.setItem(LS_KEY, JSON.stringify(next));
      else localStorage.removeItem(LS_KEY);
    } catch { /* 사파리 프라이빗 모드 등 — 이번 세션 동안은 메모리로 버틴다 */ }
  }

  const get = () => (state !== null ? state : (state = read()));
  const hasJob = () => Boolean(get());
  const company = () => get()?.company || null;

  /* 직무를 고른다. 로드맵 1단계의 결론이자 나머지 세 단계 전부의 입력이다.

     회사는 같이 지우는데, 직무가 바뀌면 예전 직무를 보고 고른 회사는 근거를 잃기
     때문이다. 남겨 두면 4단계에서 "왜 이 회사지?" 가 된다. */
  function setJob({ major, middle, job, majorName, middleName, jobName, avgWage }) {
    if (!middle) return get();
    const prev = get();
    const changedJob = !prev || prev.middle !== middle || prev.job !== job;
    write({
      major: String(major ?? ''), middle: String(middle), job: job ? String(job) : null,
      majorName: majorName || '', middleName: middleName || '', jobName: jobName || '',
      avgWage: avgWage ?? null,
      company: changedJob ? null : (prev?.company ?? null),
      at: Date.now(),
    });
    syncGoalToSpec();
    return state;
  }

  function setCompany(name) {
    const cur = get();
    if (!cur) return null;                        // 직무 없이 회사만 있는 상태는 만들지 않는다
    write({ ...cur, company: name || null });
    return state;
  }

  function clear() { write(null); }

  /* ── 목표 직무를 스펙에 반영 ──────────────────────────────────
     로그인·스펙이 없으면 조용히 건너뛴다(로드맵은 비로그인도 돌아간다).

     ── 남이 고른 것을 말없이 지우지 않는다 ──
     스펙 입력 폼의 '세부직무' 는 다중선택이다. 로드맵에서 고른 하나로 통째로
     덮어쓰면 거기서 고른 나머지가 사라지는데, 에러가 안 나서 다시 열어 볼 때까지
     모른다(6-3 '조용히 틀리는 곳'과 같은 부류). 그래서
       · 같은 1차 분류 안이면 → 기존 목록에 **더한다**
       · 1차 분류가 바뀌면    → 그건 진짜 목표 변경이므로 교체하고 **화면에 알린다**
     둘 다 되돌리는 곳(마이페이지)을 함께 안내한다. */
  async function syncGoalToSpec() {
    const cur = get();
    const me = root.DB?.currentUser?.();
    if (!cur || !me) return;

    const spec = root.DB.getSpec(me.username);
    const sameMajor = spec?.jobMajor && String(spec.jobMajor) === cur.major;
    const prevMids = Array.isArray(spec?.jobMiddles) ? spec.jobMiddles.map(String) : [];

    if (sameMajor && prevMids.includes(cur.middle)) return;   // 이미 목표에 들어 있다

    const nextMids = sameMajor ? [...new Set([...prevMids, cur.middle])] : [cur.middle];
    try {
      await root.DB.upsertSpec({ jobMajor: cur.major, jobMiddles: nextMids });
      const label = cur.middleName || '이 직무';
      if (typeof root.toast === 'function') {
        root.toast(sameMajor
          ? `목표 직무에 '${label}' 을(를) 추가했어요.`
          : `목표 직무를 '${label}' 으로 바꿨어요. 마이페이지 > 스펙에서 되돌릴 수 있어요.`);
      }
    } catch {
      /* 저장에 실패해도 이번 세션의 흐름은 그대로 간다(localStorage 에는 남았다).
         알리기는 한다 — 조용히 실패하면 기기를 바꿨을 때 목표가 사라진 이유를 모른다. */
      if (typeof root.toast === 'function') {
        root.toast('목표 직무를 서버에 저장하지 못했어요. 이 브라우저에서는 그대로 이어집니다.', { icon: false });
      }
    }
  }

  /* ── 집계 기준 ────────────────────────────────────────────────
     career.js STEP 03 과 **같은 함수**로 같은 선배 표본을 고른다. 두 화면이 다른
     모집단을 쓰면 "로드맵에서는 평균 이상인데 CAS 는 낮다" 같은 설명 불가능한
     상태가 된다(cas-hero.js 가 레이더와 벤치마크를 맞춰 둔 것과 같은 이유).

     KECO 트리를 아직 안 받았으면 null. 호출부는 KECO.load() 를 먼저 하거나,
     null 일 때의 화면(옛 학과 기준)을 그대로 쓰면 된다. */
  function bench() {
    const cur = get();
    if (!cur || !root.KECO?.ready?.()) return null;
    const where = root.KECO.middleMatcher(cur.major, cur.middle);
    if (!where) return null;                       // legacy 매핑이 없는 2차 분류 — 집계 대상이 없다
    return {
      where,
      certKey: `keco:${cur.major}:${cur.middle}`,
      middle: cur.middle,
      middleName: cur.middleName,
      jobName: cur.jobName,
      label: `${cur.middleName} 직무군`,
    };
  }

  /* 목표 직무군을 갈아 끼운다. 직업 단위 선택은 비운다 — '반도체공학기술자' 를 고른
     채 직무군만 금융으로 바꾸면 이름이 거짓말이 된다.

     ── majorCode 를 받는 이유 ──
     CAS 의 '비교 직무' 셀렉트는 같은 1차 분류의 형제만이 아니라 **35개 직무군 전부**를
     담는다. 형제만 담으면 형제가 하나뿐인 분류에서는 고를 것이 없고(그게 그 칸이
     비어 보이던 원인 중 하나였다), 목표 직무가 아직 없는 사람은 시작점조차 없다.
     그래서 1차 분류까지 옮길 수 있게 하고, 안 주면 예전처럼 지금 1차 분류 안에서만
     바꾼다. */
  function switchMiddle(middleCode, majorCode) {
    const cur = get();
    if (!root.KECO?.ready?.()) return cur;
    const majorId = majorCode || cur?.major;
    if (!majorId) return cur;

    const maj = root.KECO.byId(majorId);
    const m = root.KECO.middleById(majorId, middleCode);
    if (!maj || !m) return cur;
    /* 고른 것을 다시 고른 경우 — 그냥 통과시키면 아래 setJob 이 직업 선택을 비워서
       목표 칩의 '백엔드 개발자' 가 조용히 '정보통신 연구개발직' 으로 뭉개진다. */
    if (cur && cur.major === majorId && cur.middle === m.code) return cur;

    return setJob({
      major: maj.code, middle: m.code, job: null,
      majorName: maj.name, middleName: m.name, jobName: '',
      avgWage: m.wageRange?.avg ?? null,
    });
  }

  // ── 스텝바 ──────────────────────────────────────────────────
  /* 네 화면 맨 위에 같은 줄이 뜬다. 어디에 있든 흐름 안의 위치가 보이는 것이
     '유기적으로 이어진다' 의 실체다.

     ── 앞 단계를 잠그지 않는다 ──
     직무를 안 골랐어도 다음 칸을 누를 수 있다. 상단 네비에 CAS·회사 찾기가 그대로
     있어서, 스텝바만 막으면 "네비로는 되는데 여기서는 안 되는" 화면이 된다.
     대신 흐릿하게 두고, 각 화면이 "직무를 고르면 이 직무 기준으로 계산해 드려요"
     라고 스스로 안내한다. */
  /* 어느 칸에 체크를 붙일지 — **추측하지 않고 남은 흔적으로만** 정한다.
     "회사를 골랐으니 2단계도 지났겠지" 같은 추론을 넣으면, 네비로 3단계에 바로
     들어온 사람에게 하지도 않은 일이 완료로 찍힌다.

     | 단계 | 완료의 근거 |
     |---|---|
     | 1 직무 찾기 | 고른 직무가 있다 |
     | 2 지금 내 위치 | 내 스펙이 입력돼 있다(= 점수를 낼 수 있는 상태) |
     | 3 지원할 회사 | 고른 회사가 있다 |
     | 4 자소서 코치 | **아직 근거가 없다** — 초안 저장이 붙으면 그때(B19) */
  function doneMap(cur) {
    let hasSpec = false;
    try {
      const me = root.DB?.currentUser?.();
      hasSpec = Boolean(me && root.DB.getSpec(me.username)?.dept);
    } catch { /* DB 가 아직 없으면 미완료로 둔다 */ }
    return { job: Boolean(cur), me: hasSpec, company: Boolean(cur?.company), cover: false };
  }

  function stepBar(activeId) {
    const cur = get();
    const activeNo = (STEPS.find(s => s.id === activeId) || {}).no || 0;
    const isDone = doneMap(cur);

    const cells = STEPS.map(s => {
      const done = isDone[s.id] && s.no < activeNo;
      const cls = [
        'rm-step',
        s.id === activeId ? 'is-active' : '',
        done ? 'is-done' : '',
        !cur && s.no > 1 ? 'is-waiting' : '',
      ].filter(Boolean).join(' ');
      return `
        <button type="button" class="${cls}" onclick="navigate('${s.page}')" title="${esc(s.hint)}">
          <span class="rm-step-no">${done ? '<i class="ti ti-check"></i>' : s.no}</span>
          <span class="rm-step-label">${esc(s.label)}</span>
        </button>`;
    }).join('<span class="rm-step-sep" aria-hidden="true"></span>');

    return `
      <nav class="rm-bar" aria-label="커리어 로드맵 단계">
        <div class="rm-bar-inner">
          <span class="rm-bar-title">커리어 로드맵</span>
          <div class="rm-steps">${cells}</div>
          ${goalChip(cur, activeId)}
        </div>
      </nav>`;
  }

  /* 지금 목표가 무엇인지 스텝바 오른쪽에 붙인다. 네 화면 어디서든 같은 문장이
     보여야 "이 화면이 그 직무 얘기를 하고 있다" 가 성립한다.

     ── '바꾸기' 는 직무 찾기 화면에서는 뺀다 (사용자 지시) ──
     그 링크가 하는 일이 navigate('career') 인데, 직무 찾기(#career)에서 누르면
     지금 보고 있는 화면으로 다시 온다. 아무 일도 안 일어나는 버튼이라 "눌렀는데
     안 되네" 로 읽히고, 바로 아래에 분류를 고르는 격자가 이미 깔려 있어서 안내로도
     필요 없다. 나머지 세 화면(CAS·회사·자소서)에서는 여기가 유일한 되돌아가는
     길이므로 그대로 둔다. */
  function goalChip(cur, activeId) {
    const onJobPage = activeId === 'job';
    if (!cur) {
      return `<span class="rm-goal rm-goal--empty">
        <i class="ti ti-target"></i> 목표 직무 없음
        ${onJobPage ? '' : `<a onclick="navigate('career')">고르기</a>`}
      </span>`;
    }
    const name = cur.jobName || cur.middleName;
    const sub = cur.jobName && cur.middleName && cur.jobName !== cur.middleName
      ? `<span class="rm-goal-sub">${esc(cur.middleName)} 직무군</span>` : '';
    return `<span class="rm-goal">
      <i class="ti ti-target"></i>
      <b>${esc(name)}</b>${sub}
      ${cur.company ? `<span class="rm-goal-co">· ${esc(cur.company)}</span>` : ''}
      ${onJobPage ? '' : `<a onclick="navigate('career')">바꾸기</a>`}
    </span>`;
  }

  /* 페이지 맨 위에 스텝바를 끼운다. 화면마다 `<div class="rm-bar-host">` 하나만
     두면 되고, 페이지를 다시 그릴 때마다 호출해도 안전하다(통째로 교체한다). */
  function mount(hostId, activeId) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = stepBar(activeId);
  }

  /* 다음 단계로 가는 버튼의 문구 — 화면마다 손으로 적으면 흐름 이름이 갈린다. */
  function nextLabel(fromId) {
    const i = STEPS.findIndex(s => s.id === fromId);
    const n = STEPS[i + 1];
    return n ? `${n.label}(으)로 →` : null;
  }
  function goNext(fromId) {
    const i = STEPS.findIndex(s => s.id === fromId);
    const n = STEPS[i + 1];
    if (n && typeof root.navigate === 'function') root.navigate(n.page);
  }

  const api = {
    STEPS, LS_KEY,
    get, hasJob, company, setJob, setCompany, clear,
    bench, switchMiddle, syncGoalToSpec,
    stepBar, mount, goalChip, nextLabel, goNext,
    josa, withJosa,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node 테스트용
  root.Roadmap = api;

})(typeof window !== 'undefined' ? window : globalThis);
