/* ════════════════════════════════════════════════════════════
   KSIC 업종 이름 조회

   data/ksic-names.json(= scripts/fetch-ksic.js 가 만든 표)을 읽어
   "코드 → 사람이 읽는 업종명" 하나만 담당한다.

   ── 왜 company-sectors.js 에 안 넣었나 ──
   거기는 **계열 16개**(취업 시장의 말로 묶은 것)를 만드는 곳이고, 여기는 통계청
   공식 명칭을 그대로 읽어 주는 곳이다. 둘을 섞으면 화면에 나온 이름이 우리가 묶은
   것인지 공식 분류인지 구분이 안 된다 — 그 구분이 곧 근거의 출처다.

   ── 없으면 조용히 null ──
   표가 없어도(빌드 전) 서버는 떠야 한다. 계열 목록은 코드 2자리만 쓰므로 이름표가
   없어도 지금까지처럼 돌아간다.
   ════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'ksic-names.json');

let _table = null;
function table() {
  if (_table) return _table;
  try {
    _table = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    _table = { names: {}, untrusted: [], revision: null, missing: true };
  }
  _table.untrustedSet = new Set(_table.untrusted || []);
  return _table;
}

const ready = () => !table().missing;
const revision = () => table().revision;

/* 코드 하나의 공식 이름. 믿을 수 없다고 표시된 코드는 **없는 것으로 친다** —
   틀린 이름을 주느니 안 주는 편이 낫다(fetch-ksic.js UNTRUSTED 주석). */
function nameOf(code) {
  const t = table();
  const c = String(code || '').trim();
  if (!c || t.untrustedSet.has(c)) return null;
  return t.names[c] || null;
}

/* 코드를 원하는 자릿수로 자른 뒤 이름을 찾는다.
   자릿수가 모자라면(회사가 그 깊이까지 신고하지 않았다) null 이다 — 실측으로 회사의
   36%가 3자리에서 끝나므로, 이 null 은 오류가 아니라 **흔한 정상**이다.
   화면은 이걸 '세부 업종 미신고' 로 따로 묶어야 한다. */
function levelOf(code, digits) {
  const c = String(code || '').trim();
  if (c.length < digits) return null;
  const key = c.slice(0, digits);
  const name = nameOf(key);
  return name ? { code: key, name } : null;
}

/* 회사가 신고한 만큼 가장 깊이 내려간 이름. 없으면 얕은 쪽으로 물러난다. */
function deepest(code, maxDigits = 5) {
  for (let d = Math.min(maxDigits, String(code || '').length); d >= 2; d--) {
    const hit = levelOf(code, d);
    if (hit) return hit;
  }
  return null;
}

module.exports = { ready, revision, nameOf, levelOf, deepest };
