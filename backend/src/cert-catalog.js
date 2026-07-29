/* 자격증 카탈로그 — 스펙 입력 화면의 선택 목록 단일 출처.

   두 갈래를 합쳐서 낸다.

   1) 국가자격 613종 — data/qnet-certs.json (scripts/fetch-qnet-certs.js 가 수집)
   2) 민간·해외 자격 — 아래 PRIVATE_CERTS. 손으로 관리한다.

   ── 왜 민간자격을 손으로 들고 있나 ──
   국가자격 API 에 취업에서 실제로 쓰이는 자격이 다 있지 않다. 실측으로 확인한 구멍:
     · SQLD·ADsP    — 한국데이터산업진흥원. 민간공인이라 큐넷 목록에 없다.
     · 컴퓨터활용능력 — **국가기술자격인데도 없다.** 대한상공회의소 시행분이라
                       큐넷 API 가 다루지 않는다. 워드프로세서·전산회계도 같다.
     · AWS SAA·CKA·CFA·CPA — 해외 벤더/협회 자격. 국내 API 범위 밖이다.
   민간자격 전체 목록(한국직업능력연구원)은 3만 건이 넘는 등록제 데이터라
   그대로 붙이면 선택 목록이 못 쓰게 된다. 그래서 '채용에서 실제로 쓰이는 것' 만 추린다.

   여기에 자격을 추가할 때 id 는 **학생이 이력서에 적는 그대로** 쓴다.
   이 값이 스펙에 그대로 저장되고 보유율 집계의 키가 된다(aggregation.js).
*/
const fs = require('fs');
const path = require('path');

const QNET_PATH = path.join(__dirname, '..', 'data', 'qnet-certs.json');

const PRIVATE_CERTS = [
  // 데이터
  { id: 'SQLD',                 field: '정보통신', desc: '데이터 직무 필수급' },
  { id: 'SQLP',                 field: '정보통신', desc: 'SQLD 상위' },
  { id: 'ADsP',                 field: '정보통신', desc: '데이터 분석 입문' },
  { id: 'ADP',                  field: '정보통신', desc: 'ADsP 상위' },
  { id: '빅데이터분석기사',      field: '정보통신', desc: '국가기술자격 · 데이터 분석' },
  // 클라우드·인프라
  { id: 'AWS SAA',              field: '정보통신', desc: '클라우드 직무 강점' },
  { id: 'AWS SAP',              field: '정보통신', desc: 'AWS 상위' },
  { id: 'CKA',                  field: '정보통신', desc: 'DevOps · 쿠버네티스' },
  { id: 'AZ-104',               field: '정보통신', desc: 'Azure 인프라' },
  // 사무 (대한상공회의소 — 큐넷 API 에 없다)
  { id: '컴퓨터활용능력 1급',    field: '경영.회계.사무', desc: '공기업 가산점' },
  { id: '컴퓨터활용능력 2급',    field: '경영.회계.사무' },
  { id: '워드프로세서',          field: '경영.회계.사무' },
  // 회계·세무
  { id: '재경관리사',            field: '경영.회계.사무', desc: '재무회계 입문' },
  { id: '전산세무 1급',          field: '경영.회계.사무' },
  { id: '전산회계 1급',          field: '경영.회계.사무' },
  { id: 'TAT 1급',              field: '경영.회계.사무' },
  { id: 'CPA (공인회계사)',      field: '경영.회계.사무', desc: '회계법인 · 컨설팅' },
  // 금융
  { id: '금융투자분석사',        field: '경영.회계.사무', desc: 'IB · 증권' },
  { id: '투자자산운용사',        field: '경영.회계.사무', desc: '자산운용사 필수급' },
  { id: '증권투자권유자문인력',  field: '경영.회계.사무' },
  { id: '펀드투자권유자문인력',  field: '경영.회계.사무' },
  { id: 'CFA Level 1',          field: '경영.회계.사무', desc: '글로벌 금융' },
  { id: 'CFA Level 2',          field: '경영.회계.사무' },
  { id: 'FRM (재무위험관리사)',  field: '경영.회계.사무', desc: '리스크 관리' },
  { id: 'AFPK',                 field: '경영.회계.사무', desc: '은행 창구 · PB' },
  { id: 'CFP',                  field: '경영.회계.사무', desc: 'AFPK 상위' },
  // 마케팅·디자인
  { id: '구글애널리틱스(GA4)',   field: '문화.예술.디자인.방송', desc: '디지털 마케팅' },
  { id: '구글 광고(Google Ads)', field: '문화.예술.디자인.방송' },
  { id: 'GAIQ',                 field: '문화.예술.디자인.방송' },
  // 법무
  { id: '변호사 시험',           field: '경영.회계.사무' },
];

let cache = null;

/* 국가자격 캐시가 없어도 서버는 떠야 한다 — 민간자격만으로라도 화면이 동작하고,
   운영자는 콘솔 경고를 보고 fetch 스크립트를 돌리면 된다. */
function loadNational() {
  try {
    const raw = JSON.parse(fs.readFileSync(QNET_PATH, 'utf8'));
    return (raw.certs || []).map(c => ({
      id: c.id, code: c.code, kind: c.kind, kindLabel: c.kindLabel,
      grade: c.grade, field: c.field, midField: c.midField,
    }));
  } catch {
    console.warn('[cert-catalog] data/qnet-certs.json 이 없습니다. '
      + '`node scripts/fetch-qnet-certs.js` 로 국가자격 목록을 받아주세요. (민간자격만 제공)');
    return [];
  }
}

function catalog() {
  if (cache) return cache;

  const national = loadNational();
  const seen = new Set(national.map(c => c.id));
  const priv = PRIVATE_CERTS
    // 국가자격 목록에 이미 있으면(빅데이터분석기사 등) 중복 항목을 만들지 않는다
    .filter(c => !seen.has(c.id))
    .map(c => ({ ...c, kind: 'private', kindLabel: '민간·해외자격', grade: null }));

  const certs = [...national, ...priv].sort((a, b) => a.id.localeCompare(b.id, 'ko'));
  cache = { count: certs.length, certs };
  return cache;
}

/* ── 검색 ─────────────────────────────────────────────────────
   /api/company/suggest · /api/majors/suggest 와 같은 규약.
   영문 약어(SQLD·AWS)가 섞여 있어 대소문자를 무시하고 찾는다. */
function searchCerts(query, limit = 8) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  const starts = [], contains = [];
  for (const c of catalog().certs) {
    const at = c.id.toLowerCase().indexOf(q);
    if (at < 0) continue;
    const row = {
      name: c.id,
      /* 화면 부가정보. 발급기관이 원본에 없어 자격 구분·직무분야로 대신한다
         (없는 정보를 지어내지 않는다 — 직접 입력할 때만 발급기관을 받는다). */
      sub: [c.kindLabel, c.field].filter(Boolean).join(' · '),
    };
    (at === 0 ? starts : contains).push(row);
  }
  return [...starts, ...contains].slice(0, limit);
}

module.exports = { catalog, searchCerts, PRIVATE_CERTS };
