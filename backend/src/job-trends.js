/* ══════════════════════════════════════════════════════════════
   직무 트렌드 — "이 직무 공고 N건 중 M% 가 이 역량을 요구한다"

   자소서 코치(jd-competency.js)는 공고 **한 장**을 읽는다. 여기는 같은 추출기를
   공고 **수천 장**에 돌려 역량별 요구 빈도를 낸다. 파서를 새로 만들지 않는 것이
   핵심이다 — 화면에서 뽑는 역량과 집계에서 세는 역량이 같은 코드에서 나와야
   "이 역량은 68%가 요구" 라는 문장이 화면의 카드와 어긋나지 않는다.

   이 숫자가 careerly 의 차별점이다. 일반 LLM 은 "요즘 데이터 분석이 중요합니다"
   까지만 말할 수 있고, "이 직무 공고 512건 중 68%" 는 말할 수 없다.

   ── 지금의 한계 (숨기지 말 것) ──
   워크넷 목록 API 응답에는 자격요건 본문이 없어서 **채용제목만으로 집계**한다.
   제목은 짧아서 실제보다 낮은 비율이 나온다(요구하지만 제목에 안 적힌 공고).
   그래서 화면 문구는 "공고 N건 중 M% 가 **제목에** 명시" 로 나가야 하고,
   표본이 적으면 아예 보여주지 않는다(MIN_SAMPLE).
   상세 API 필드를 확인하면 TEXT_FIELDS 만 늘리면 된다 →
   `node scripts/fetch-worknet-jobs.js --probe-detail=<구인인증번호>`
   ══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const JD = require('./jd-competency');

const TRENDS_PATH = path.join(__dirname, '..', 'data', 'job-trends.json');
const JOBS_PATH   = path.join(__dirname, '..', 'data', 'worknet-jobs.json');

/* 공고 한 건에서 역량 추출에 쓸 텍스트 필드. 상세 API 를 붙이면 여기에 추가한다. */
const TEXT_FIELDS = ['title'];

/* 표본이 적으면 비율을 보여주지 않는다. 공고 12건 중 8건을 '67%' 로 내보내면
   실제보다 훨씬 단단한 숫자로 읽힌다 — CAS 백분위를 5명 미만에서 숨기는 것과 같은 이유. */
const MIN_SAMPLE = 30;

const jobText = job => TEXT_FIELDS.map(f => job[f] || '').join('\n');

/* ── 집계 ───────────────────────────────────────────────────
   keyword(= NCS 중분류 이름) 별로 역량 요구 빈도를 센다.
   한 공고에서 같은 역량이 여러 번 걸려도 1건으로 센다(공고 수 기준 비율이라야
   "공고 100건 중 68건" 이라는 말이 성립한다). */
function aggregate(jobsFile) {
  const buckets = new Map();          // keyword → { total, counts: Map(id→n) }

  for (const job of jobsFile.jobs || []) {
    const key = job.keyword || '(전체)';
    if (!buckets.has(key)) buckets.set(key, { total: 0, counts: new Map() });
    const b = buckets.get(key);
    b.total++;

    const found = JD.ruleExtract(jobText(job)).found;
    for (const f of found) {
      b.counts.set(f.id, (b.counts.get(f.id) || 0) + 1);
    }
  }

  const trends = {};
  for (const [key, b] of buckets) {
    trends[key] = {
      sample: b.total,
      competencies: [...b.counts.entries()]
        .map(([id, n]) => ({
          id,
          label: JD.BY_ID[id]?.label || id,
          count: n,
          pct: Math.round((n / b.total) * 100),
        }))
        .sort((x, y) => y.count - x.count),
    };
  }

  return {
    source: jobsFile.source,
    basedOn: TEXT_FIELDS.join(', '),
    jobsFetchedAt: jobsFile.fetchedAt,
    builtAt: new Date().toISOString(),
    minSample: MIN_SAMPLE,
    totalJobs: (jobsFile.jobs || []).length,
    trends,
  };
}

function build() {
  if (!fs.existsSync(JOBS_PATH)) {
    throw new Error(`${JOBS_PATH} 가 없습니다. 먼저 scripts/fetch-worknet-jobs.js 를 실행하세요.`);
  }
  const out = aggregate(JSON.parse(fs.readFileSync(JOBS_PATH, 'utf8')));
  fs.writeFileSync(TRENDS_PATH, JSON.stringify(out, null, 2));
  return out;
}

/* ── 조회 ───────────────────────────────────────────────────
   캐시가 없으면 조용히 null. 트렌드는 있으면 좋은 보강이지 없으면 화면이 깨지는
   필수 데이터가 아니다(수집은 인증키 승인이 있어야 가능하다). */
let _cache = null;
function load() {
  if (_cache !== null) return _cache;
  try {
    _cache = fs.existsSync(TRENDS_PATH) ? JSON.parse(fs.readFileSync(TRENDS_PATH, 'utf8')) : false;
  } catch (e) {
    console.warn('[job-trends] 캐시를 읽지 못했습니다:', e.message);
    _cache = false;
  }
  return _cache;
}

/* 버킷(= NCS 중분류) 이름만으로는 공고와 매칭되지 않는다. 마케터 공고에
   "기획사무"라는 말이 적혀 있을 리 없기 때문이다. 그래서 그 중분류에 속한
   **소분류 이름까지 별칭으로** 쓴다 — "마케팅"·"홍보·광고"는 공고에 실제로 등장한다. */
let _aliases = null;
function aliasMap() {
  if (_aliases) return _aliases;
  _aliases = new Map();                       // 중분류명 → [별칭…]
  try {
    const taxo = require(path.join(__dirname, '..', 'data', 'ncs-taxonomy.json'));
    for (const major of taxo) {
      for (const mid of major.middles || []) {
        if (!mid.name) continue;
        const names = [mid.name, ...(mid.smalls || []).map(s => s.name || s)]
          .filter(n => typeof n === 'string' && n.length >= 2);
        _aliases.set(mid.name, [...new Set(names)]);
      }
    }
  } catch (e) {
    console.warn('[job-trends] NCS 분류를 읽지 못해 별칭 매칭을 건너뜁니다:', e.message);
  }
  return _aliases;
}

/* 공고 텍스트에서 어느 직무 버킷을 쓸지 고른다. 사용자가 직무를 따로 고르게 하지
   않으려고 공고 본문에서 찾는다. 못 찾으면 null — 엉뚱한 직무의 비율을 보여주느니
   안 보여주는 게 낫다(틀린 숫자가 없는 숫자보다 나쁘다). */
function pickBucket(jdText, hint) {
  const data = load();
  if (!data) return null;
  if (hint && data.trends[hint]) return hint;

  const text = String(jdText || '');
  const aliases = aliasMap();

  let best = null;
  for (const key of Object.keys(data.trends || {})) {
    for (const alias of aliases.get(key) || [key]) {
      if (!text.includes(alias)) continue;
      /* 같은 글에 여러 직무가 걸리면 더 구체적인(긴) 이름이 이겼다고 본다.
         "마케팅"(소분류)이 "사업관리"(중분류)보다 공고의 실제 직무에 가깝다. */
      if (!best || alias.length > best.len) best = { key, len: alias.length };
    }
  }
  return best?.key || null;
}

/* 역량 id → { pct, count, sample, bucket } · 근거가 약하면 null */
function marketFor(bucketKey, competencyId) {
  const data = load();
  if (!data || !bucketKey) return null;

  const bucket = data.trends[bucketKey];
  if (!bucket || bucket.sample < (data.minSample ?? MIN_SAMPLE)) return null;

  const hit = bucket.competencies.find(c => c.id === competencyId);
  if (!hit) return null;

  return {
    bucket: bucketKey,
    pct: hit.pct,
    count: hit.count,
    sample: bucket.sample,
    /* 흔한 요구인지 희소한 요구인지 — 자소서 전략이 갈리는 지점이다.
       흔하면 안 쓰면 감점, 희소하면 쓰면 차별점이 된다. */
    rarity: hit.pct >= 50 ? 'common' : hit.pct >= 20 ? 'normal' : 'rare',
  };
}

const meta = () => {
  const d = load();
  return d ? { basedOn: d.basedOn, builtAt: d.builtAt, totalJobs: d.totalJobs } : null;
};

module.exports = { build, aggregate, load, pickBucket, marketFor, meta, MIN_SAMPLE, TEXT_FIELDS };
