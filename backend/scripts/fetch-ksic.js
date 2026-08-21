/* ════════════════════════════════════════════════════════════
   한국표준산업분류(KSIC) 코드 → 이름 표 만들기

   ── 왜 필요한가 ──
   DART 기업개황은 업종을 **코드로만** 준다(induty_code). '26429' 를 화면에 올릴
   수는 없으니 지금까지는 코드 앞 2자리로 계열 16개만 만들어 썼다. 그런데 계열은
   회사 찾기의 1단계라, 그 아래를 더 못 나누면 '화학·소재 144곳' 같은 벽이 된다.
   이름표가 있어야 소분류·세분류까지 내려갈 수 있다.

   ── 이름을 지어 붙이지 않는다 ──
   중분류 55개 정도는 손으로 적을 수 있지만 소분류 232개·세분류 495개는 못 적는다.
   틀리게 적으면 학생은 그걸 공식 업종명으로 믿는다. 그래서 표를 받아서 쓴다.

   ── 출처 ──
   github.com/FinanceData/KSIC — 통계청 통계분류포털(kssc.kostat.go.kr)의 KSIC
   9차·10차 코드집을 CSV 로 옮겨 둔 저장소. 공식 사이트가 OpenAPI 키를 따로 요구해서
   이쪽을 쓴다. **받은 뒤 우리 회사 데이터로 교차검증한다**(아래 verify).
   KSIC 자체는 국가 공공데이터다.

   ── 실행 ──
     node backend/scripts/fetch-ksic.js
   → backend/data/ksic-names.json
   ════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RAW = 'https://raw.githubusercontent.com/FinanceData/KSIC/master';
const OUT = path.join(__dirname, '..', 'data', 'ksic-names.json');

/* ── DART 코드가 어느 개정판인가 (실측으로 정한다) ────────────
   9차·10차를 둘 다 받아서 우리 회사들의 코드가 어느 쪽에 더 맞는지 센다.
   실측(2026-08-21): 고유 코드 631개 중 10차 613개(97.1%) · 9차 566개(89.7%),
   9차에만 있는 코드는 0개였다. → **10차를 쓴다.** */
const REVISIONS = ['09', '10'];

async function grab(rev) {
  const url = `${RAW}/KSIC_${rev}.csv.gz`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`KSIC_${rev} 내려받기 실패: HTTP ${res.status}`);
  const csv = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
  const map = new Map();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const [code, name] = line.split(/","/).map(s => s.replace(/^"|"$/g, '').trim());
    if (code && name) map.set(code, name);
  }
  return map;
}

/* ── 믿으면 안 되는 코드 (실측으로 찾았다) ────────────────────
   DART 의 업종코드는 회사가 **등록할 때의 개정판**으로 남아 있다. 대부분은 10차와
   맞지만 식료품(10) 계열은 옛 번호 그대로인 회사가 있어서, 표를 그냥 붙이면 화면이
   거짓말을 한다. 실측으로 확인한 것:

     DART 104 → 표는 '동물성 및 식물성 유지 제조업' · 실제 회사는 남양유업·빙그레·매일유업(낙농)
     DART 105 → 표는 '낙농제품 및 식용 빙과류'      · 실제 회사는 대한제분·대한제당(제분·제당)
     DART 106 → 표는 '곡물 가공품, 전분'           · 실제 회사는 크라운제과(과자)
     DART 108 → 표는 '동물용 사료 및 조제식품'       · 실제 회사는 오리온·농심·오뚜기·풀무원
     DART 109 → 10차 표에 아예 없음               · 실제 회사는 팜스토리·선진·한일사료(사료)

   한 칸씩 밀려 있다. 3자리 코드 85개를 회사 이름과 하나씩 대조해 봤고, 어긋난 것은
   이 다섯뿐이었다(나머지 80개는 정확했다 — 171 제지←한솔제지, 511 항공←대한항공,
   212 의약품←유한양행 …). 밀림을 우리가 되돌리지 않고 **이름을 붙이지 않는다** —
   보정은 추측이고, 여기서 틀리면 학생이 회사를 잘못 이해한 채로 자소서를 쓴다.
   해당 회사(28곳)는 화면에서 '세부 업종 미신고' 로 묶인다. */
const UNTRUSTED = ['104', '105', '106', '108', '109'];

async function main() {
  console.log('KSIC 코드집을 받는 중…');
  const [k9, k10] = await Promise.all(REVISIONS.map(grab));
  console.log(`  9차 ${k9.size}개 · 10차 ${k10.size}개`);

  /* 교차검증 — DART 코드가 실제로 10차와 맞는지 여기서 확인하고 숫자를 남긴다.
     dart-corps.json 이 없으면(빌드 전) 검증만 건너뛰고 표는 만든다. */
  let verify = null;
  try {
    const DART = require('../src/dart');
    const codes = [...new Set(DART.allCorps().filter(c => c.industry).map(c => String(c.industry)))];
    if (codes.length) {
      const hit = m => codes.filter(c => m.has(c)).length;
      verify = {
        dartCodes: codes.length,
        matched9: hit(k9),
        matched10: hit(k10),
        missing: codes.filter(c => !k10.has(c)).length,
      };
      console.log(`  교차검증: DART 고유코드 ${verify.dartCodes}개 중 10차 ${verify.matched10}개 · 9차 ${verify.matched9}개`);
      if (verify.matched10 < verify.matched9) {
        throw new Error('10차보다 9차가 더 맞습니다. REVISIONS 판단을 다시 보세요.');
      }
    }
  } catch (e) {
    if (/9차가 더 맞/.test(e.message)) throw e;
    console.log('  (DART 색인이 없어 교차검증은 건너뜁니다 — npm run build 뒤 다시 돌리면 됩니다)');
  }

  const names = {};
  for (const [code, name] of k10) names[code] = name;

  const out = {
    '//': 'KSIC 10차 코드→이름. scripts/fetch-ksic.js 가 만든다. 손으로 고치지 말 것.',
    source: 'github.com/FinanceData/KSIC (통계청 통계분류포털 KSIC 10차)',
    revision: '10',
    generatedAt: new Date().toISOString(),
    verify,
    untrusted: UNTRUSTED,
    untrustedWhy: 'DART 에 옛 개정판 번호로 남아 있어 이름이 회사와 어긋난다(식료품 계열). 화면에서는 이름을 붙이지 않는다.',
    names,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`저장: ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)}KB · 코드 ${Object.keys(names).length}개)`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
