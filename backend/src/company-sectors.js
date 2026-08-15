/* ════════════════════════════════════════════════════════════
   계열(업종)별 기업 목록 — 회사 찾기 첫 화면

   ── 왜 필요한가 ──
   예전 첫 화면은 손으로 적어 둔 8곳(삼성전자·카카오…)만 보여줬다. 이미 아는 회사라
   "골라서 시작"은 되지만 **몰랐던 회사를 만나지는 못한다.** 학생이 지원할 수 있는
   회사는 훨씬 많고, 대개 이름을 못 들어봐서 후보에서 빠진다.

   ── 무엇을 보여주나 ──
   DART 상장사 캐시(약 4,000곳)를 업종코드로 묶는다. 다만 전부 보여주면 이름도 처음
   보는 소형주가 대부분이라 오히려 고르기 어렵다. 그래서 **공정위 대규모기업집단 ·
   고용24 공채기업 목록에 이름이 있는 회사만** 남긴다(785곳). 학생이 실제로 지원할
   만한 규모이면서, 그 안에 모르는 회사가 충분히 많다.

   ── 업종코드를 그대로 쓰지 않는 이유 ──
   KSIC 는 631가지나 되고 '264'(반도체) 같은 숫자라 화면에 못 올린다. 취업 시장에서
   쓰는 말로 15개 계열에 다시 묶는다. 표준분류의 대분류(제조업·정보통신업…)를 쓰지
   않은 것도 같은 이유다 — '제조업' 하나에 식품과 반도체가 같이 들어가서, 학생이
   자기 진로와 맞는지 판단할 수 없다.
   ════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const DART = require('./dart');

const DATA = path.join(__dirname, '..', 'data');

/* [계열 이름, KSIC 중분류 2자리 코드들]
   순서가 화면 순서다 — 지원자가 많은 계열을 앞에 둔다. */
const SECTORS = [
  ['반도체·디스플레이',   [26]],
  ['IT·소프트웨어',       [58, 62, 63]],
  ['자동차·운송장비',     [30, 31]],
  ['제약·바이오',         [21]],
  ['금융·보험',           [64, 65, 66]],
  ['화학·소재',           [20, 22, 23, 24, 25]],
  ['전자·전기장비',       [27, 28]],
  ['기계·정밀',           [29]],
  ['식품·생활소비재',     [1, 2, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 32, 33]],
  ['유통·물류',           [45, 46, 47, 49, 50, 51, 52]],
  ['통신·미디어',         [59, 60, 61]],
  ['건설·부동산',         [41, 42, 68]],
  ['전문서비스',          [70, 71, 72, 73, 74, 75, 76]],
  ['에너지·환경',         [5, 6, 7, 8, 35, 36, 37, 38, 39]],
  ['의료·교육·기타서비스', [55, 56, 85, 86, 87, 90, 91, 94, 95, 96]],
];

const SECTOR_OF = new Map();
for (const [name, codes] of SECTORS) for (const c of codes) SECTOR_OF.set(c, name);

/* ── 직무(KECO 2차 분류) → 그 직무를 주로 뽑는 계열 ──────────────
   커리어 로드맵 4단계('지원할 회사')가 쓴다. 직무를 골라 온 학생에게 785곳을
   가나다순으로 통째로 보여주면 고를 근거가 없다.

   ── 왜 여기(백엔드)에 두는가 ──
   계열 이름의 단일 출처가 위의 SECTORS 다. 매핑을 프론트에 복사하면 계열 하나를
   고치는 순간 둘이 갈리고, 갈린 것은 에러 없이 '빈 목록'으로만 보인다.

   ── 이건 채용공고가 아니다 ──
   "이 계열 회사가 그 직무를 뽑고 있다"가 아니라 **"이 직무는 주로 이 계열에 있다"**
   는 업종 수준의 연결이다. 실제 채용 여부는 회사 리포트의 공고 칸에서 확인한다
   (사람인 키가 들어오면 그 칸이 채워진다 — saramin-jobs.js).

   ── universal ──
   경영·사무직과 영업·판매직은 **모든 업종이 뽑는다.** 여기에 계열 몇 개를 억지로
   적으면 나머지 업종을 후보에서 지워 버린다. 그래서 좁히지 않고, 좁히지 않는다는
   사실을 화면이 그대로 말하게 한다(3-1 공정위 API 때처럼 추정해서 박지 않는다).

   값이 빈 배열인 것은 '민간 계열로 이어지지 않는 직무'다(공무원·군인). 이때도
   칸을 지우지 않고 왜 비었는지 적는다(16-5 와 같은 원칙). */
const UNIVERSAL_MIDDLES = new Set(['01', '02', '61']);

const SECTORS_BY_MIDDLE = {
  '01': [],                                             // 관리직(임원) — 전 업종이지만 신입 자리가 아니다
  '02': [],                                             // 경영·행정·사무직 — universal
  '03': ['금융·보험'],
  '11': ['전문서비스', '의료·교육·기타서비스'],
  '12': ['제약·바이오', '화학·소재', '에너지·환경'],
  '13': ['IT·소프트웨어', '통신·미디어', '반도체·디스플레이', '전자·전기장비'],
  '14': ['건설·부동산', '에너지·환경'],
  '15': ['자동차·운송장비', '기계·정밀', '반도체·디스플레이', '전자·전기장비', '화학·소재'],
  '21': ['의료·교육·기타서비스'],
  '22': ['전문서비스'],
  '23': ['의료·교육·기타서비스'],
  '24': [],                                             // 경찰·소방·교도 — 공무원 채용이라 민간 계열이 없다
  '25': [],                                             // 군인 — 같은 이유
  '30': ['의료·교육·기타서비스', '제약·바이오'],
  '41': ['통신·미디어', 'IT·소프트웨어'],
  '42': ['의료·교육·기타서비스'],
  '51': ['식품·생활소비재', '의료·교육·기타서비스'],
  '52': ['의료·교육·기타서비스', '유통·물류'],
  '53': ['식품·생활소비재', '의료·교육·기타서비스'],
  '54': ['전문서비스'],
  '55': ['의료·교육·기타서비스'],
  '56': ['전문서비스', '의료·교육·기타서비스'],
  '61': [],                                             // 영업·판매직 — universal
  '62': ['유통·물류'],
  '70': ['건설·부동산'],
  '81': ['기계·정밀', '자동차·운송장비'],
  '82': ['화학·소재', '기계·정밀'],
  '83': ['전자·전기장비', '반도체·디스플레이'],
  '84': ['통신·미디어', 'IT·소프트웨어'],
  '85': ['화학·소재', '에너지·환경'],
  '86': ['식품·생활소비재'],
  '87': ['식품·생활소비재'],
  '88': ['식품·생활소비재'],
  '89': ['식품·생활소비재', '기계·정밀'],
  '90': ['식품·생활소비재', '에너지·환경'],
};

/* 매핑에 적힌 계열 이름이 SECTORS 에 실제로 있는지는 테스트가 지킨다 —
   오타 하나가 '해당 계열 0곳' 으로만 보이고 에러는 안 난다. */
const SECTOR_NAMES = new Set(SECTORS.map(([n]) => n));

/* 직무 하나의 계열 초점.
     matched   : 아는 직무인가 (모르는 코드에 빈 배열을 주면 universal 과 구분되지 않는다)
     universal : 전 업종 공통이라 일부러 좁히지 않았다
     sectors   : 좁힐 계열 (universal 이거나 민간 경로가 없으면 빈 배열) */
function sectorFocus(middleCode) {
  const code = String(middleCode || '').trim();
  const list = SECTORS_BY_MIDDLE[code];
  if (!list) return { middle: code, matched: false, universal: false, sectors: [] };
  return {
    middle: code,
    matched: true,
    universal: UNIVERSAL_MIDDLES.has(code),
    sectors: list.filter(n => SECTOR_NAMES.has(n)),
  };
}

/* 회사명 대조는 법인격 표기와 공백을 걷어내고 본다 — 같은 회사가 '(주)토스',
   '토스 주식회사' 로 제각각 올라온다(company-name.js 와 같은 규칙). */
const norm = s => String(s || '')
  .replace(/\(주\)|\(유\)|\(재\)|\(사\)|주식회사|유한회사/g, '')
  .replace(/\s+/g, '')
  .toLowerCase();

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); }
  catch { return null; }
}
const asArray = j => (Array.isArray(j) ? j
  : (j && (j.companies || j.groups || Object.values(j).find(Array.isArray))) || []);

let _cache = null;

/* 캐시를 한 번 만들고 재사용한다. 파일 셋을 매 요청마다 읽고 785곳을 다시 묶을 이유가
   없다(수집 스크립트를 돌리기 전에는 내용도 안 바뀐다). */
function build() {
  /* 파일을 직접 읽지 않는다 — 업종코드는 다른 파일(dart-industry.json)에 있고
     그걸 붙이는 일은 dart.js 가 한다. 예전에는 여기서 dart-corps.json 을 직접 읽었는데,
     색인을 깃에서 빼면서 업종코드가 사라진 것을 이쪽만 모르고 0곳을 냈다. */
  const corps = DART.allCorps();
  if (!corps.length) return { sectors: [], total: 0, reason: 'DART 기업 색인이 없습니다. 저장소 루트에서 npm run build 를 실행하세요(깃에 넣지 않는 파일입니다).' };

  const known = new Set([
    ...asArray(readJson('ftc-large-groups.json')).map(x => norm(x.name)),
    ...asArray(readJson('work24-companies.json')).map(x => norm(x.name)),
  ]);

  /* ── 같은 이름을 두 번 넣지 않는다 ──────────────────────────
     DART 에는 이름이 같은 법인이 둘씩 있다 — 합병 전후, 상장폐지된 옛 법인이
     그대로 남아 있어서다. 실측 7건: 삼성물산(000830·028260), 미래에셋증권,
     두산건설, 에스와이…

     그냥 두면 목록에 같은 이름이 두 번 뜨는데, **눌렀을 때 열리는 회사는 하나뿐**
     이다(dart.js findCorp 는 캐시에서 먼저 나온 것을 쓴다). 그래서 여기서도
     **먼저 나온 것만** 남긴다 — 목록에 보이는 것과 눌러서 열리는 것이 같아야 한다. */
  const buckets = new Map(SECTORS.map(([n]) => [n, []]));
  const taken = new Set();
  for (const c of corps) {
    const key = norm(c.name);
    if (!c.industry || !known.has(key) || taken.has(key)) continue;
    const sector = SECTOR_OF.get(parseInt(String(c.industry).slice(0, 2), 10));
    if (!sector) continue;
    taken.add(key);
    buckets.get(sector).push({ name: c.name, stock: c.stock || null });
  }

  /* 가나다순으로 둔다. 매출 순이 더 좋겠지만 785곳의 재무를 받아오려면 DART 를
     수천 번 불러야 한다 — 첫 화면이 그만큼 느려질 값어치는 없다. */
  const sectors = SECTORS
    .map(([name]) => ({
      name,
      companies: buckets.get(name).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    }))
    .filter(s => s.companies.length);

  return { sectors, total: sectors.reduce((n, s) => n + s.companies.length, 0), reason: null };
}

function sectors() {
  if (!_cache) _cache = build();
  return _cache;
}

/* 회사 하나가 어느 계열인지 — 리포트 화면에서 업종코드(264) 대신 보여준다. */
function sectorOfCode(industryCode) {
  const div = parseInt(String(industryCode || '').slice(0, 2), 10);
  return SECTOR_OF.get(div) || null;
}

module.exports = {
  sectors, sectorOfCode, sectorFocus,
  SECTORS, SECTORS_BY_MIDDLE, UNIVERSAL_MIDDLES,
  _build: build,
};
