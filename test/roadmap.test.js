/* 커리어 로드맵 흐름 상태 — frontend/js/roadmap.js

   화면 모듈이지만 흐름의 규칙(무엇을 저장하고, 직무가 바뀔 때 무엇을 버리는지)은
   순수 로직이라 여기서 검증한다. cas.js 와 같은 방식으로 node 에서 require 한다.

   DOM·localStorage·DB 는 최소한만 흉내 낸다 — 진짜를 붙이면 이 테스트가 브라우저
   테스트가 되고, 그러면 정작 확인하려던 규칙이 묻힌다. */

// ── 최소 환경 ───────────────────────────────────────────────
const store = new Map();
const g = globalThis;
g.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
let toasts = [];
g.toast = msg => toasts.push(msg);

/* DB 는 '로그인 안 함' 이 기본. 목표 직무 동기화를 볼 때만 갈아 끼운다. */
let savedPatches = [];
g.DB = {
  currentUser: () => null,
  getSpec: () => null,
  upsertSpec: async patch => { savedPatches.push(patch); },
};

/* KECO 트리 — 2차 분류 두 개, legacy 매핑이 있는 것과 없는 것. */
const TREE = {
  '1': {
    code: '1', name: '연구직 및 공학 기술직',
    middles: [
      { code: '13', name: '정보통신 연구개발직', wageRange: { avg: 5200 },
        legacy: { dept: ['cs'], field: ['backend'] },
        jobs: [{ code: 'K1', name: '백엔드 개발자', avgWage: 5400 }] },
      { code: '15', name: '제조 연구개발직', wageRange: { avg: 4800 },
        legacy: { dept: ['mech'] }, jobs: [] },
      { code: '11', name: '인문·사회과학 연구직', legacy: null, jobs: [] },   // legacy 없음
    ],
  },
};
g.KECO = {
  ready: () => true,
  byId: c => TREE[c] || null,
  middleById: (M, m) => (TREE[M]?.middles || []).find(x => x.code === m) || null,
  middleMatcher: (M, m) => {
    const mid = g.KECO.middleById(M, m);
    if (!mid?.legacy?.dept?.length) return null;
    return s => mid.legacy.dept.includes(s.dept)
      && (!mid.legacy.field?.length || mid.legacy.field.includes(s.field));
  },
};

const Roadmap = require('../frontend/js/roadmap.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};
/* 기업분류는 직무와 다른 키에 있으므로 clear() 로는 안 지워진다 — 따로 비운다.
   그 사실 자체가 규칙이라 여기서 드러나 있는 편이 낫다. */
const reset = () => {
  store.clear(); Roadmap.clear(); Roadmap.setCorpType(null); toasts = []; savedPatches = [];
};

const DEV = { major: '1', middle: '13', job: 'K1',
              majorName: '연구직 및 공학 기술직', middleName: '정보통신 연구개발직',
              jobName: '백엔드 개발자', avgWage: 5400 };

// ── 1. 저장과 복원 ──────────────────────────────────────────
console.log('── 1. 고른 직무를 들고 다닌다 ──');
reset();
ok('처음에는 목표 직무가 없다', Roadmap.get() === null && Roadmap.hasJob() === false);

Roadmap.setJob(DEV);
ok('고르면 상태가 생긴다', Roadmap.hasJob() === true);
ok('직업 이름까지 남는다', Roadmap.get().jobName === '백엔드 개발자');
ok('localStorage 에 남는다', store.has(Roadmap.LS_KEY));

/* 화면을 옮겨 다니는 동안 살아 있어야 흐름이 성립한다 —
   모듈이 다시 읽어도 같은 값이 나오는지 본다. */
const raw = JSON.parse(store.get(Roadmap.LS_KEY));
ok('저장된 값에 2차 분류가 들어 있다', raw.middle === '13');

// ── 2. 2차 분류가 없으면 상태로 치지 않는다 ─────────────────
console.log('\n── 2. 집계 못 하는 상태는 만들지 않는다 ──');
reset();
Roadmap.setJob({ major: '1', middle: '', job: 'K1', jobName: '백엔드 개발자' });
ok('2차 분류 없이는 저장되지 않는다', Roadmap.hasJob() === false,
   '집계 단위가 2차 분류라, 없으면 아무 화면도 계산할 수 없다');

// ── 3. 회사 ─────────────────────────────────────────────────
console.log('\n── 3. 3단계에서 고른 회사 ──');
reset();
ok('직무 없이 회사만 담기지 않는다', Roadmap.setCompany('삼성전자') === null && Roadmap.company() === null);

Roadmap.setJob(DEV);
Roadmap.setCompany('삼성전자');
ok('직무가 있으면 회사가 담긴다', Roadmap.company() === '삼성전자');

/* 직무가 바뀌면 그 직무를 보고 고른 회사는 근거를 잃는다. 남겨 두면 4단계에서
   "왜 이 회사지?" 가 된다. */
Roadmap.setJob({ ...DEV, middle: '15', middleName: '제조 연구개발직', job: null, jobName: '' });
ok('직무를 바꾸면 고른 회사를 버린다', Roadmap.company() === null);

Roadmap.setCompany('현대자동차');
Roadmap.setJob({ ...DEV, middle: '15', middleName: '제조 연구개발직', job: null, jobName: '' });
ok('같은 직무를 다시 고르면 회사는 그대로', Roadmap.company() === '현대자동차');

// ── 3-2. 기업분류 ───────────────────────────────────────────
/* 1단계(팀원 작업)가 고른 대·중견·중소·공을 3단계가 읽는다. 이 값이 직무 상태와
   같은 객체에 있으면 안 되는 이유를 여기서 지킨다 — setJob 이 회사를 버릴 때
   같이 휩쓸리거나, 직무를 고르기 전에는 저장 자체가 안 된다. */
console.log('\n── 3-2. 1단계에서 고른 기업분류 ──');
reset();
ok('고르기 전에는 null', Roadmap.corpType() === null && Roadmap.corpLabel() === null,
   'null 이면 3단계는 지금까지처럼 전체를 보여준다');

ok('아는 값만 받는다', Roadmap.setCorpType('mid') === 'mid' && Roadmap.corpType() === 'mid');
ok('라벨이 같이 나온다', Roadmap.corpLabel() === '중견기업');

ok('모르는 값은 비운다', Roadmap.setCorpType('대기업') === null && Roadmap.corpType() === null,
   '오타 하나가 "아무 회사도 안 나오는 목록" 이 되면 원인을 못 찾는다');

/* 직무를 고르기 전에도 저장돼야 한다 — 1단계에서 어느 쪽을 먼저 고를지 모른다. */
reset();
Roadmap.setCorpType('public');
ok('직무 없이도 기업분류는 남는다', Roadmap.hasJob() === false && Roadmap.corpType() === 'public');

Roadmap.setJob(DEV);
Roadmap.setCompany('삼성전자');
Roadmap.setJob({ ...DEV, middle: '15', middleName: '제조 연구개발직', job: null, jobName: '' });
ok('직무를 바꿔도 기업분류는 그대로', Roadmap.corpType() === 'public',
   '"대기업에 가고 싶다" 는 직무를 바꿔도 안 바뀐다');
ok('그때 회사는 여전히 버린다', Roadmap.company() === null);

ok('직무를 비워도 기업분류는 남는다',
   (Roadmap.clear(), Roadmap.corpType() === 'public'));

// ── 3-3. 담은 근거 ──────────────────────────────────────────
/* 3단계에서 담고 4단계가 쓴다. 예전에는 두 화면이 같은 localStorage 키를 각자
   파싱했고, 담는 대상이 '채용공고' 하나로 좁혀져 있었다 — 종류가 섞이면 4단계에서
   무엇을 어디에 쓸지 알 수 없었기 때문이다. 종류(kind)와 쓰임(use)이 그 답이다. */
console.log('\n── 3-3. 담은 근거 ──');
reset();
ok('안 담았으면 빈 목록', Roadmap.evidenceOf('삼성전자').length === 0);
ok('회사 이름이 없으면 빈 목록', Roadmap.evidenceOf('').length === 0);

Roadmap.addEvidence('삼성전자', { id: 'biz-0', kind: 'biz', text: '반도체를 만든다', source: '사업보고서' });
Roadmap.addEvidence('삼성전자', { id: 'news-1', kind: 'news', text: 'HBM 증설', source: '한국경제' });
Roadmap.addEvidence('삼성전자', { id: 'job-1', kind: 'job', text: '반도체 공정기술', source: '채용공고' });
ok('담긴다', Roadmap.evidenceOf('삼성전자').length === 3);

Roadmap.addEvidence('삼성전자', { id: 'biz-0', kind: 'biz', text: '다른 글' });
ok('같은 id 를 두 번 담지 않는다', Roadmap.evidenceOf('삼성전자').length === 3);

ok('회사별로 나뉜다', Roadmap.evidenceOf('카카오').length === 0);

/* 종류를 안 적고 담긴 옛 항목 — 그때는 담는 대상이 채용공고뿐이었다.
   지우면 사용자는 우리가 지운 줄 모르고 자기가 잘못한 줄 안다. */
store.set(Roadmap.LS_EVIDENCE, JSON.stringify({
  ...Roadmap.allEvidence(), 네이버: [{ id: 'old', text: '옛 공고' }],
}));
ok('kind 없는 옛 항목은 채용공고로 읽는다', Roadmap.evidenceOf('네이버')[0].kind === 'job');

/* 4단계가 "이 문항에 이 근거" 를 고르는 축. 종류마다 쓰이는 문항이 정해져 있다. */
const motive = Roadmap.evidenceFor('삼성전자', '지원동기').map(e => e.id).sort();
ok('지원동기에는 사업 내용과 기사가 간다', motive.join(',') === 'biz-0,news-1', `→ ${motive.join(',')}`);
const comp = Roadmap.evidenceFor('삼성전자', '직무역량').map(e => e.id);
ok('직무역량에는 채용공고가 간다', comp.join(',') === 'job-1', `→ ${comp.join(',')}`);
ok('모르는 문항 유형에는 아무것도 안 간다', Roadmap.evidenceFor('삼성전자', '없는유형').length === 0,
   '억지로 붙이면 학생이 엉뚱한 근거를 인용한다');

/* use 값은 jd-coach.js QUESTION_TYPES 의 label 과 글자까지 같아야 한다.
   한 글자만 달라도 에러 없이 '해당 근거 없음' 으로만 보인다. */
const QLABELS = ['지원동기', '협업·갈등', '도전·실패', '성장과정·가치관', '직무역량'];
ok('쓰임 이름이 실제 문항 유형 이름과 같다',
   Object.values(Roadmap.EVIDENCE_KINDS).every(k => k.use.every(u => QLABELS.includes(u))),
   Object.values(Roadmap.EVIDENCE_KINDS).flatMap(k => k.use).filter(u => !QLABELS.includes(u)).join(', ') || '전부 일치');
ok('종류마다 쓰임이 적혀 있다',
   Object.values(Roadmap.EVIDENCE_KINDS).every(k => k.label && k.use.length && k.hint),
   '쓰임 없이 담기만 넓히면 예전 상태로 돌아간다');
ok('EVIDENCE_ORDER 가 종류를 다 담는다',
   Roadmap.EVIDENCE_ORDER.length === Object.keys(Roadmap.EVIDENCE_KINDS).length
   && Roadmap.EVIDENCE_ORDER.every(k => Roadmap.EVIDENCE_KINDS[k]));

const groups = Roadmap.evidenceByKind('삼성전자');
ok('종류별 묶음은 정해진 순서로 나온다', groups.map(g => g.kind).join(',') === 'job,biz,news',
   `→ ${groups.map(g => g.kind).join(',')}`);
ok('빈 종류는 묶음에 안 나온다', groups.every(g => g.items.length > 0));

Roadmap.removeEvidence('삼성전자', 'news-1');
ok('하나만 뺄 수 있다', Roadmap.evidenceOf('삼성전자').map(e => e.id).join(',') === 'biz-0,job-1');
Roadmap.removeEvidence('삼성전자', 'biz-0');
Roadmap.removeEvidence('삼성전자', 'job-1');
ok('다 빼면 회사 칸도 지운다', !JSON.parse(store.get(Roadmap.LS_EVIDENCE)).삼성전자);

// ── 4. 집계 기준 ────────────────────────────────────────────
console.log('\n── 4. 벤치마크는 2차 분류 단위 ──');
reset();
Roadmap.setJob(DEV);
const b = Roadmap.bench();
ok('bench 가 나온다', !!b);
ok('certKey 가 로드맵과 같은 규약', b.certKey === 'keco:1:13', `→ ${b.certKey}`);
ok('라벨이 직무군임을 밝힌다', b.label === '정보통신 연구개발직 직무군', `→ ${b.label}`);
/* 직업 이름(백엔드 개발자)이 아니라 2차 분류로 집계한다 — 461개로 쪼개면
   표본이 한 자릿수가 된다(career.js renderRoadmap 주석과 같은 판단). */
ok('matcher 가 legacy 조건대로 고른다',
   b.where({ dept: 'cs', field: 'backend' }) === true
   && b.where({ dept: 'cs', field: 'frontend' }) === false
   && b.where({ dept: 'mech' }) === false);

reset();
Roadmap.setJob({ major: '1', middle: '11', middleName: '인문·사회과학 연구직' });
ok('legacy 매핑이 없는 2차 분류는 bench 가 null',
   Roadmap.bench() === null, '집계 대상이 없다 — 화면은 옛 기준으로 물러선다');

// ── 5. 직무군 갈아타기 ──────────────────────────────────────
console.log('\n── 5. CAS 에서 직무군만 바꾸기 ──');
reset();
Roadmap.setJob(DEV);
Roadmap.switchMiddle('15');
ok('2차 분류가 바뀐다', Roadmap.get().middle === '15');
ok('1차 분류는 그대로', Roadmap.get().major === '1');
/* '백엔드 개발자' 를 고른 채 직무군만 제조로 바꾸면 이름이 거짓말이 된다. */
ok('직업 선택은 비운다', Roadmap.get().job === null && Roadmap.get().jobName === '');
ok('바뀐 직무군 이름을 쓴다', Roadmap.get().middleName === '제조 연구개발직');

Roadmap.switchMiddle('99');
ok('없는 2차 분류로는 안 바뀐다', Roadmap.get().middle === '15');

/* ── 같은 것을 다시 고르면 손대지 않는다 ──────────────────────
   CAS 의 비교 직무 셀렉트는 change 로 불린다. 여기서 그냥 통과시키면 setJob 이
   직업 선택을 비워, 목표 칩의 '백엔드 개발자' 가 조용히 직무군 이름으로 뭉개진다. */
reset();
Roadmap.setJob(DEV);
Roadmap.switchMiddle('13');
ok('같은 직무군을 다시 고르면 직업 선택이 살아 있다',
   Roadmap.get().jobName === '백엔드 개발자' && Roadmap.get().job === 'K1');

/* ── 1차 분류까지 옮길 수 있어야 한다 ─────────────────────────
   비교 직무 셀렉트는 형제 2차 분류만이 아니라 35개 직무군 전부를 담는다.
   형제만 담으면 형제가 하나뿐인 분류에서 고를 것이 없고(그게 그 칸이 비어 보이던
   원인 중 하나였다), 목표 직무가 아직 없는 사람은 시작점조차 없다. */
reset();
Roadmap.setJob(DEV);
Roadmap.switchMiddle('15', '1');
ok('major 를 같이 주면 그 분류로 옮긴다',
   Roadmap.get().major === '1' && Roadmap.get().middle === '15');

reset();
ok('목표가 없어도 셀렉트로 처음 고를 수 있다',
   Roadmap.switchMiddle('13', '1') !== null && Roadmap.get().middle === '13',
   '예전에는 기존 목표가 없으면 그냥 무시했다');

Roadmap.clear();
ok('major 를 모르면 아무 일도 하지 않는다', Roadmap.switchMiddle('13') === null);

// ── 5-1. 목표 칩의 '바꾸기' ─────────────────────────────────
/* navigate('career') 로 가는 링크라, 직무 찾기 화면에서는 지금 보는 화면으로
   다시 오는 버튼이 된다. 아무 일도 안 일어나서 "눌렀는데 안 되네" 로 읽힌다. */
console.log('\n── 5-1. 직무 찾기에서는 목표 칩에 링크를 붙이지 않는다 ──');
reset();
Roadmap.setJob(DEV);
ok('직무 찾기(job)에는 바꾸기가 없다', !Roadmap.stepBar('job').includes('바꾸기'));
ok('CAS(me)에는 바꾸기가 있다', Roadmap.stepBar('me').includes('바꾸기'));
ok('회사(company)에도 바꾸기가 있다', Roadmap.stepBar('company').includes('바꾸기'));

reset();
ok('목표가 없을 때도 직무 찾기에는 고르기 링크가 없다',
   !Roadmap.stepBar('job').includes('고르기'), '이미 고르는 화면에 있다');
ok('목표가 없으면 다른 화면에는 고르기 링크가 있다',
   Roadmap.stepBar('me').includes('고르기'));

// ── 6. 스텝바 ───────────────────────────────────────────────
console.log('\n── 6. 스텝바 ──');
reset();
const empty = Roadmap.stepBar('job');
ok('네 단계가 다 있다', Roadmap.STEPS.length === 4);
ok('직무 전에는 뒤 단계가 흐리다', (empty.match(/is-waiting/g) || []).length === 3);
ok('목표가 없으면 그렇게 적는다', empty.includes('목표 직무 없음'));

Roadmap.setJob(DEV);
const withJob = Roadmap.stepBar('company');
ok('목표 직무 이름이 스텝바에 뜬다', withJob.includes('백엔드 개발자'));
ok('직무를 고르면 흐린 칸이 사라진다', !withJob.includes('is-waiting'));
ok('지금 단계가 표시된다', withJob.includes('is-active'));

Roadmap.setCompany('삼성전자');
ok('고른 회사도 스텝바에 뜬다', Roadmap.stepBar('cover').includes('삼성전자'));

/* 체크는 남은 흔적으로만 붙인다. 3단계(회사)를 골랐다고 2단계(내 위치)까지
   지난 것으로 찍으면, 네비로 바로 들어온 사람에게 하지 않은 일이 완료로 보인다. */
{
  const bar = Roadmap.stepBar('cover');           // 직무·회사 있음 · 스펙 없음
  const cells = bar.split('rm-step-sep');
  ok('직무를 골랐으면 1단계에 체크', cells[0].includes('is-done'));
  ok('스펙이 없으면 2단계는 체크 안 함', !cells[1].includes('is-done'),
     '회사를 골랐다는 이유로 지나지 않은 칸을 완료로 찍지 않는다');
  ok('회사를 골랐으면 3단계에 체크', cells[2].includes('is-done'));
}

/* 이름에 <> 가 들어간 회사·직무가 실제로 있지는 않지만, 스텝바는 사용자 입력
   (회사명)을 그대로 싣는 자리라 이스케이프가 빠지면 그대로 주입된다. */
Roadmap.setCompany('<img src=x onerror=alert(1)>');
ok('회사명을 이스케이프한다', !Roadmap.stepBar('cover').includes('<img src=x'));

// ── 6-1. 조사 ───────────────────────────────────────────────
console.log('\n── 6-1. 조사는 받침으로 고른다 ──');
/* 직무·회사 이름을 문장에 끼우는 자리가 여럿이라, '을(를)' 로 두면
   '응용소프트웨어개발자을(를)' 이 그대로 화면에 나간다(실제로 나갔다). */
ok('받침 없음 → 를', Roadmap.josa('응용소프트웨어개발자', '을') === '를');
ok('받침 있음 → 을', Roadmap.josa('공학기술직', '을') === '을');
ok('받침 없음 → 는', Roadmap.josa('개발자', '은') === '는');
ok('받침 있음 → 은', Roadmap.josa('사무직', '은') === '은');
ok('받침 없음 → 로', Roadmap.josa('개발자', '로') === '로');
ok('받침 있음 → 으로', Roadmap.josa('기술직', '로') === '으로');
/* 'ㄹ' 받침만 예외다 — '서울으로' 가 아니라 '서울로'. */
ok('ㄹ 받침 → 로 (서울로)', Roadmap.josa('서울', '로') === '로', '받침이 있어도 ㄹ 은 예외');
ok('ㄹ 받침이어도 을/를 은 정상', Roadmap.josa('서울', '을') === '을');
/* 한글로 안 끝나면 받침을 알 수 없다 — 찍어서 틀리느니 둘 다 적는다. */
ok('영문 사명은 둘 다 적는다', Roadmap.josa('SK', '을') === '를(을)', `→ ${Roadmap.josa('SK', '을')}`);
ok('빈 값도 죽지 않는다', typeof Roadmap.josa('', '을') === 'string');
ok('withJosa 는 이스케이프까지 한다',
   Roadmap.withJosa('<b>개발자', '을') === '&lt;b&gt;개발자를', `→ ${Roadmap.withJosa('<b>개발자', '을')}`);

// ── 7. 다음 단계 ────────────────────────────────────────────
console.log('\n── 7. 다음 단계 이름 ──');
ok('1단계 다음은 지금 내 위치', Roadmap.nextLabel('job').startsWith('지금 내 위치'));
ok('2단계 다음은 지원할 회사', Roadmap.nextLabel('me').startsWith('지원할 회사'));
ok('마지막 단계 다음은 없다', Roadmap.nextLabel('cover') === null);

// ── 8. 목표 직무를 스펙에 반영 ──────────────────────────────
/* syncGoalToSpec 은 async 다. upsertSpec 호출 자체는 동기적으로 일어나지만
   toast 는 await 뒤라, 큐가 한 바퀴 돌아야 보인다. */
const settle = () => new Promise(r => setImmediate(r));

(async () => {
  console.log('\n── 8. 목표 직무 저장 (남이 고른 것을 지우지 않는다) ──');
  reset();
  g.DB.currentUser = () => ({ username: 'me' });

  /* ① 같은 1차 분류 — 스펙 폼에서 고른 다른 2차 분류를 지우면 안 된다. */
  g.DB.getSpec = () => ({ jobMajor: '1', jobMiddles: ['15'] });
  Roadmap.setJob(DEV);
  await settle();
  ok('같은 1차 분류면 기존 선택에 더한다',
     savedPatches.length === 1
     && savedPatches[0].jobMiddles.includes('15')
     && savedPatches[0].jobMiddles.includes('13'),
     `→ ${JSON.stringify(savedPatches[0]?.jobMiddles)}`);
  ok('더할 때도 알린다', toasts.some(t => t.includes('추가했어요')), `→ ${toasts[0] || '없음'}`);

  /* ② 다른 1차 분류 — 진짜 목표 변경이라 교체하되 말없이 하지 않는다. */
  reset();
  g.DB.getSpec = () => ({ jobMajor: '2', jobMiddles: ['21', '22'] });
  Roadmap.setJob(DEV);
  await settle();
  ok('1차 분류가 다르면 교체한다',
     savedPatches[0]?.jobMajor === '1' && savedPatches[0]?.jobMiddles.join() === '13');
  ok('교체는 화면에 알린다', toasts.some(t => t.includes('바꿨어요')), `→ ${toasts[0] || '없음'}`);
  ok('되돌리는 곳을 함께 알린다', toasts.some(t => t.includes('마이페이지')));

  /* ③ 이미 목표에 들어 있으면 서버를 부르지 않는다 — 로드맵을 열 때마다 저장하면
        화면을 옮길 때마다 쓸데없는 쓰기가 한 번씩 난다. */
  reset();
  g.DB.getSpec = () => ({ jobMajor: '1', jobMiddles: ['13'] });
  Roadmap.setJob(DEV);
  await settle();
  ok('이미 목표면 저장하지 않는다', savedPatches.length === 0);

  /* ④ 저장 실패 — 흐름은 이어지되 조용히 넘어가지 않는다. 조용하면 기기를
        바꿨을 때 목표가 사라진 이유를 알 수 없다. */
  reset();
  g.DB.getSpec = () => null;
  g.DB.upsertSpec = async () => { throw new Error('offline'); };
  Roadmap.setJob(DEV);
  await settle();
  ok('저장에 실패해도 흐름은 이어진다', Roadmap.hasJob() === true);
  ok('실패를 알린다', toasts.some(t => t.includes('저장하지 못했어요')), `→ ${toasts[0] || '없음'}`);
  g.DB.upsertSpec = async patch => { savedPatches.push(patch); };

  /* ⑤ 비로그인 — 흐름은 그대로 돌아가고 서버만 안 부른다. */
  reset();
  g.DB.currentUser = () => null;
  Roadmap.setJob(DEV);
  await settle();
  ok('비로그인은 서버를 부르지 않는다', savedPatches.length === 0);
  ok('비로그인도 흐름 상태는 남는다', Roadmap.hasJob() === true);

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
