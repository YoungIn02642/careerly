/* 계열별 기업 목록 — 회사 찾기 첫 화면의 재료.

   네트워크를 부르지 않는다. 캐시 파일(dart-corps.json · ftc-large-groups.json ·
   work24-companies.json)만 읽어 묶는 순수 로직이라 여기서 전부 검증된다. */
const S = require('../backend/src/company-sectors.js');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const r = S.sectors();

console.log('── 1. 업종코드 → 계열 ──');
ok('반도체(26x)를 반도체·디스플레이로 묶는다', S.sectorOfCode('264') === '반도체·디스플레이');
ok('소프트웨어(582xx)를 IT·소프트웨어로 묶는다', S.sectorOfCode('58221') === 'IT·소프트웨어');
ok('금융(66xxx)을 금융·보험으로 묶는다', S.sectorOfCode('66199') === '금융·보험');
ok('자동차(30x)를 자동차·운송장비로 묶는다', S.sectorOfCode('303') === '자동차·운송장비');
/* 2자리만 보고 판단하므로 길이가 달라도 같은 계열이어야 한다 */
ok('코드 길이가 달라도 같은 계열', S.sectorOfCode('26') === S.sectorOfCode('26429'));
ok('모르는 코드는 null (억지로 묶지 않는다)', S.sectorOfCode('99999') === null);
ok('빈 값도 null', S.sectorOfCode('') === null && S.sectorOfCode(null) === null);

console.log('\n── 2. 계열 목록 ──');
/* 캐시가 없는 환경(신규 클론)에서는 목록이 비고 사유가 온다 — 그때는 아래를 건너뛴다. */
if (!r.total) {
  console.log(`  SKIP  DART 기업 캐시가 없어 목록 검증은 건너뜁니다 (${r.reason || ''})`);
} else {
  ok('계열이 여러 개 나온다', r.sectors.length >= 10, `→ ${r.sectors.length}개`);
  ok('기업 수 합계가 각 계열의 합과 맞는다',
     r.total === r.sectors.reduce((n, s) => n + s.companies.length, 0), `→ ${r.total}곳`);
  ok('빈 계열은 목록에 넣지 않는다', r.sectors.every(s => s.companies.length > 0));
  ok('회사마다 이름이 있다', r.sectors.every(s => s.companies.every(c => c.name && c.name.trim())));

  /* 같은 회사가 두 계열에 동시에 들어가면 "몇 곳인가"를 셀 수 없다. */
  const all = r.sectors.flatMap(s => s.companies.map(c => c.name));
  ok('같은 회사가 두 계열에 겹치지 않는다', new Set(all).size === all.length,
     `→ ${all.length}곳 중 중복 ${all.length - new Set(all).size}건`);

  ok('계열 안은 아는 회사(명단) 먼저, 그 안에서 가나다순이다', r.sectors.every(s => {
    /* 상장사 전체를 보여주면서, 이름을 아는 명단 회사(known)를 앞에 두고 그 뒤로
       나머지 상장사를 붙인다. 두 그룹 각각은 가나다순이다. */
    const ks = s.companies.map(c => !!c.known);
    const firstUnknown = ks.indexOf(false);
    const knownBlockOk = firstUnknown === -1 || ks.slice(firstUnknown).every(k => k === false);
    const sorted = arr => arr.every((n, i) => i === 0 || arr[i - 1].localeCompare(n, 'ko') <= 0);
    const known = s.companies.filter(c => c.known).map(c => c.name);
    const unknown = s.companies.filter(c => !c.known).map(c => c.name);
    return knownBlockOk && sorted(known) && sorted(unknown);
  }));

  /* 이 화면의 목적이 "몰랐던 회사를 만나는 것"이라 목록이 너무 작으면 의미가 없다. */
  ok('첫 화면에 보여줄 만큼은 모인다', r.total >= 300, `→ ${r.total}곳`);

  /* 두 번 불러도 같은 결과여야 한다(캐시를 재사용한다). */
  ok('두 번째 호출이 같은 객체를 준다(캐시)', S.sectors() === r);
}

console.log('\n── 3. 직무(KECO 2차) → 계열 초점 ──');
/* 커리어 로드맵 4단계가 쓴다. 이 매핑이 틀리면 "이 직무를 주로 뽑는 계열" 이
   엉뚱한 곳을 가리키는데, 에러는 안 나고 목록만 이상해진다. */

/* 오타 하나가 '해당 계열 0곳' 으로만 보이므로 이름을 전수 대조한다. */
const names = new Set(S.SECTORS.map(([n]) => n));
const typos = Object.entries(S.SECTORS_BY_MIDDLE)
  .flatMap(([mid, list]) => list.filter(n => !names.has(n)).map(n => `${mid}:${n}`));
ok('매핑에 적힌 계열 이름이 전부 SECTORS 에 있다', typos.length === 0, `→ ${typos.join(', ') || '오타 없음'}`);

ok('정보통신 연구개발직(13) → IT·소프트웨어를 포함',
   S.sectorFocus('13').sectors.includes('IT·소프트웨어'));
ok('제조 연구개발직(15) → 자동차·반도체를 포함',
   S.sectorFocus('15').sectors.includes('자동차·운송장비') && S.sectorFocus('15').sectors.includes('반도체·디스플레이'));
ok('금융·보험직(03) → 금융·보험 한 곳', S.sectorFocus('03').sectors.join() === '금융·보험');
ok('건설·채굴직(70) → 건설·부동산', S.sectorFocus('70').sectors.join() === '건설·부동산');

/* universal 과 '모르는 직무' 를 구분하지 못하면 화면이 같은 빈 목록을 두 가지
   다른 뜻으로 쓰게 된다 — 하나는 "전 업종", 하나는 "우리가 모른다". */
ok('경영·사무직(02)은 universal — 억지로 좁히지 않는다',
   S.sectorFocus('02').universal === true && S.sectorFocus('02').sectors.length === 0);
ok('영업·판매직(61)도 universal', S.sectorFocus('61').universal === true);
ok('군인(25)은 아는 직무지만 민간 계열이 없다',
   S.sectorFocus('25').matched === true && S.sectorFocus('25').universal === false
   && S.sectorFocus('25').sectors.length === 0);
ok('모르는 코드는 matched:false', S.sectorFocus('99').matched === false);
ok('빈 값도 matched:false', S.sectorFocus('').matched === false && S.sectorFocus(null).matched === false);

/* 2차 분류는 34개(제조 단순직 89 포함 35개 중 직업 0개인 것 제외)다. 새 분류가
   들어왔는데 매핑을 안 채우면 그 직무만 조용히 '모르는 직무' 가 된다. */
ok('2차 분류를 빠짐없이 담았다', Object.keys(S.SECTORS_BY_MIDDLE).length >= 34,
   `→ ${Object.keys(S.SECTORS_BY_MIDDLE).length}개`);


// ── KECO 직업 ↔ KSIC 대분류 다리 ───────────────────────────────
console.log('\n── 직업 단위 보정 (사용자 지적: 교장인데 회사가 안 떴다) ──');

/* 관리직(01)에는 기업 임원·금융관리자·교장·정부 고위공무원이 한 칸에 들어 있다.
   칸 전체로 보면 '전 업종' 이 맞지만, 개별 직업에는 그 판단이 틀린다. */
const 교장 = S.sectorFocus('01', 'K000000838');
ok('교장은 더 이상 universal 이 아니다', 교장.universal === false,
   '예전에는 "업종을 가리지 않는 직무" 라는 안내만 뜨고 회사가 0곳이었다');
ok('교장은 교육 서비스업(P)으로 잇는다',
   교장.sections.length === 1 && 교장.sections[0].code === 'P');
ok('근거를 사람 말로 같이 준다', 교장.sections[0].label === '교육 서비스업',
   '계열 이름만 던지면 왜 그 계열인지 알 수 없다');
ok('계열이 실제로 나온다', 교장.sectors.length > 0, `→ ${교장.sectors.join(', ')}`);
ok('직업으로 정했다고 밝힌다', 교장.by === 'job');

/* 같은 칸(01)이라도 이름으로 업종을 알 수 없는 직업은 건드리지 않는다 —
   억지로 계열을 붙이면 나머지 업종의 회사를 후보에서 지운다. */
const 임원 = S.sectorFocus('01', 'K000000847');   // 기업 대표 및 기업 고위 임원
ok('업종을 알 수 없는 직업은 그대로 universal', 임원.universal === true);
ok('그때는 2차 분류로 정했다고 밝힌다', 임원.by === 'middle');

/* 직업 코드를 안 주면 예전과 똑같이 동작해야 한다 — 화면 어딘가는 아직 안 보낼 수 있다. */
const 코드없이 = S.sectorFocus('01');
ok('직업 코드가 없으면 예전 동작 그대로', 코드없이.universal === true && 코드없이.by === 'middle');
ok('2차 분류 매핑은 그대로 이긴다', S.sectorFocus('13').sectors.includes('IT·소프트웨어'));

console.log('\n── 업종은 아는데 상장사가 없는 경우 ──');
/* '모른다' 와 '알지만 민간에 없다' 는 다른 말이다. 후자는 아는 만큼 말해 준다. */
const 공무원 = S.sectorFocus('01', 'K000000933');  // 행정부고위공무원
ok('공무원도 matched 다', 공무원.matched === true);
ok('공공행정(O)으로 잇는다', 공무원.sections[0].code === 'O');
ok('그래도 계열은 비어 있다', 공무원.sectors.length === 0,
   'DART 상장사에 공공행정 업종이 없다 — 억지로 붙이지 않는다');
ok('universal 과는 구분된다', 공무원.universal === false);

console.log('\n── KSIC 대분류 → 계열 변환 ──');
ok('교육(P)은 의료·교육·기타서비스로', S.sectorsOfSections(['P']).includes('의료·교육·기타서비스'));
ok('금융(K)은 금융·보험으로', S.sectorsOfSections(['K']).join() === '금융·보험');
ok('제조(C)는 여러 계열로 퍼진다', S.sectorsOfSections(['C']).length >= 6);
ok('공공행정(O)은 아무 계열도 아니다', S.sectorsOfSections(['O']).length === 0);
ok('모르는 글자는 조용히 무시한다', S.sectorsOfSections(['Z']).length === 0);
/* 화면 순서(SECTORS 정의 순서)를 지켜야 계열 줄이 매번 다른 순서로 나오지 않는다. */
ok('계열 순서가 화면 순서를 따른다', (() => {
  const got = S.sectorsOfSections(['C']);
  const idx = got.map(n => S.SECTORS.findIndex(([x]) => x === n));
  return idx.every((v, i) => i === 0 || idx[i - 1] < v);
})());

console.log('\n── 매핑이 실제 데이터와 맞는가 ──');
/* 직업 코드를 손으로 적는 표라 오타가 나기 쉽고, 오타는 에러 없이 '보정 안 됨' 으로만
   보인다. 실제로 처음 적을 때 7개를 틀렸다(회계사·세무사·관세사·노무사·감정평가사·
   행정사·부동산중개사). 코드가 카탈로그에 있는지 여기서 못 박는다. */
const WAGE = require('../backend/data/wage-jobs.json');
const JOB_NAMES = new Map();
WAGE.majors.forEach(M => M.middles.forEach(m => m.jobs.forEach(j => JOB_NAMES.set(j.code, j.name))));

const jobCodes = Object.keys(S.SECTIONS_BY_JOB);
ok('보정 표가 비어 있지 않다', jobCodes.length > 0, `→ ${jobCodes.length}개`);
ok('모든 직업 코드가 실제 카탈로그에 있다',
   jobCodes.every(c => JOB_NAMES.has(c)),
   jobCodes.filter(c => !JOB_NAMES.has(c)).join(', ') || '전부 확인됨');
ok('모든 KSIC 대분류 글자가 표에 정의돼 있다',
   jobCodes.every(c => S.SECTIONS_BY_JOB[c].every(L => S.KSIC_SECTIONS[L])));
/* 상장사가 있는 업종으로 이었는데 계열이 0개면 매핑이 헛돈 것이다(O 만 예외). */
ok('공공행정 말고는 전부 계열이 나온다',
   jobCodes.every(c => {
     const ls = S.SECTIONS_BY_JOB[c];
     return ls.every(L => L === 'O') || S.sectorsOfSections(ls).length > 0;
   }));

/* KSIC 대분류끼리 2자리 코드가 겹치면 한 회사가 두 대분류에 속하게 된다. */
ok('대분류끼리 중분류 코드가 겹치지 않는다', (() => {
  const seen = new Set();
  for (const { codes } of Object.values(S.KSIC_SECTIONS)) {
    for (const c of codes) { if (seen.has(c)) return false; seen.add(c); }
  }
  return true;
})());

console.log('\n── 6. 기업규모 ──');
/* 1단계에서 고른 대·중견·중소·공으로 이 목록을 거르려면 회사마다 같은 축의 값이
   있어야 한다. 그 판정은 company-classify.js 하나에서만 나와야 한다 — 여기서
   기준을 새로 세우면 스펙에 저장되는 분류와 목록의 배지가 갈린다. */
const CLASSIFY = require('../backend/src/company-classify.js');
const allCos = r.sectors.flatMap(s => s.companies);

ok('회사마다 규모가 붙는다', allCos.every(c => 'size' in c));
ok('규모 값은 정해진 분류 안에서만 나온다(unknown=규모 미확인 포함)',
   allCos.every(c => c.size === null || ['large', 'mid', 'small', 'public', 'unknown'].includes(c.size)),
   `→ ${[...new Set(allCos.map(c => c.size))].join(', ')}`);
ok('규모별 곳수를 같이 준다',
   r.sizes && Object.values(r.sizes).reduce((a, b) => a + b, 0) === allCos.filter(c => c.size).length,
   `→ ${JSON.stringify(r.sizes)}`);
/* 이제 상장사 전체를 보여준다. 명단(공정위·고용24)에 잡힌 대기업·중견은 그 규모가
   붙고, 명단에 없는 상장사는 'unknown'(규모 미확인)이 된다 — 대다수가 여기 해당한다. */
ok('대기업·중견과 규모 미확인이 모두 있다',
   (r.sizes.large || 0) > 0 && (r.sizes.mid || 0) > 0 && (r.sizes.unknown || 0) > 0);

/* 분류가 목록 쪽에서 따로 계산되고 있지 않은지 — 표본으로 대조한다. */
ok('배지가 company-classify 판정과 같다', allCos.slice(0, 200).every(c => {
  const j = CLASSIFY.classify(c.name);
  /* 명단에 잡힌 회사만(matched) 그 규모를 붙이고, 명단에 없는 상장사는
     'unknown'(규모 미확인)으로 둔다 — '중소'로 단정하면 실제 중견을 잘못 적는다. */
  return c.size === (j.matched ? CLASSIFY.CORP_TYPE_ID[j.type] : 'unknown');
}));

/* 음차 미매칭 — 자동완성은 대기업이라고 하는데 그걸 골라 저장하면 중소기업이 되던 것.
   같은 명단을 classify 와 suggest 가 다르게 읽고 있었다. */
console.log('\n── 6-2. 알파벳 사명도 분류된다 ──');
for (const name of ['SK하이닉스', 'LG전자', 'KT', 'CJ제일제당', 'NAVER']) {
  const j = CLASSIFY.classify(name);
  ok(`${name} 이 명단에서 잡힌다`, j.matched && j.type === '대기업', `→ ${j.type}`);
}
ok('모르는 회사는 여전히 미등록이다',
   CLASSIFY.classify('듣도보도못한회사').matched === false,
   '못 찾은 것을 찾은 척하면 안 된다');

console.log('\n── 6-3. 지주회사를 금융에서 빼낸다 ──');
/* KSIC 는 지주회사를 금융업(64992)으로 분류한다. 통계로는 맞지만, 산업을 **고르는**
   축이 되면 화면이 거짓말을 한다 — 실측으로 '금융·보험' 68곳 중 33곳이 지주회사였고,
   금융을 고른 학생에게 농심홀딩스·하림지주(식품)·노루홀딩스(도료)·한진칼(항공)이
   나왔다. 순수 금융사는 29곳뿐이었다. */
const holdings = r.sectors.find(s => s.name === '지주회사');
const finance = r.sectors.find(s => s.name === '금융·보험');
ok('지주회사 계열이 생겼다', holdings && holdings.companies.length > 20, `→ ${holdings?.companies.length}곳`);

const hasName = n => holdings.companies.some(c => c.name === n);
for (const n of ['롯데지주', '농심홀딩스', '한진칼', '노루홀딩스', '코오롱', '하림지주']) {
  ok(`${n} 이 지주회사로 간다`, hasName(n));
}
ok('금융·보험에는 지주회사가 안 남는다',
   !finance.companies.some(c => /(홀딩스|지주)$/.test(c.name)),
   finance.companies.filter(c => /(홀딩스|지주)$/.test(c.name)).map(c => c.name).join(', ') || '없음');
ok('진짜 금융사는 그대로 있다',
   ['우리은행', '삼성증권', '삼성화재해상보험', '카카오뱅크', '삼성카드']
     .every(n => finance.companies.some(c => c.name === n)));
/* 649(3자리)로만 온 회사는 지주회사인지 코드로 알 수 없다 — 그 안에 벤처캐피탈이
   섞여 있다. 이름 규칙은 그 6곳에만 쓰고, 전체에 훑지 않는다. */
ok('벤처캐피탈을 지주회사로 끌고 가지 않는다', !hasName('미래에셋벤처투자'));
ok('회사가 두 계열에 겹치지 않는다', (() => {
  const seen = new Set();
  for (const s of r.sectors) for (const c of s.companies) {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
  }
  return true;
})());
ok('빼내도 총합은 그대로(상장사 전체)', r.total >= 3000, `→ ${r.total}곳`);

console.log('\n── 7. 공공기관 목록 ──');
/* 공공기관은 대부분 비상장이라 업종코드가 없어 계열 목록에 4곳밖에 못 들어간다.
   1단계에서 '공공기관' 을 고른 학생에게 4곳을 내밀면 안 되므로 따로 낸다. */
const pub = S.publicOrgs();
ok('공공기관 목록이 나온다', pub.total > 1000, `→ ${pub.total}곳`);
ok('중앙과 지방이 둘 다 들어 있다',
   pub.lanes.some(l => l.name === '공기업') && pub.lanes.some(l => l.name === '지방공기업'),
   `→ ${pub.lanes.map(l => `${l.name} ${l.companies.length}`).join(' · ')}`);
/* 실측 함정 — local-public-orgs.json 에는 organizations 말고 sourceFiles 도 있어서,
   "처음 걸리는 배열" 로 읽으면 파일 이름 두 줄을 기관 목록으로 집어 온다.
   예외도 안 나고 1,312곳이 조용히 사라진다. */
ok('지방 기관이 통째로 빠지지 않았다',
   pub.lanes.find(l => l.name === '지방출자출연기관')?.companies.length > 500);
ok('전부 공공기관 규모다', pub.lanes.every(l => l.companies.every(c => c.size === 'public')));
ok('법인격 표기를 다듬는다',
   pub.lanes.every(l => l.companies.every(c => !/^\(|주식회사|^재단법인/.test(c.name))));
ok('같은 기관을 두 번 담지 않는다', (() => {
  const seen = new Set();
  for (const l of pub.lanes) for (const c of l.companies) {
    const k = c.name.replace(/\s+/g, '');
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
})());
ok('유형·소관부처를 같이 남긴다',
   pub.lanes.find(l => l.name === '공기업').companies.every(c => c.note),
   '레인 이름만으로는 시장형·준시장형이 뭉개진다');

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
