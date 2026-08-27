#!/usr/bin/env node
/* 상장사 규모(중소/중견)를 DART 매출로 확정한다.

   ── 왜 ──
   회사 찾기 목록을 상장사 전체로 넓히면서, 대기업·중견·공공 명단(company-classify)에
   없는 상장사는 '규모 미확인'으로 뒀다. '중소'로 단정하면 실제 중견을 잘못 적기
   때문이다(리노공업 매출 3,725억 → 중견인데 중소로 찍혔었다).

   상장사는 매출이 DART 에 공시되므로, **중소기업기본법 시행령 별표1의 주된 업종별
   평균매출액 기준**으로 중소/중견을 가른다. 매출이 그 상한을 넘으면 중견, 이하면 중소.
   (자산 5조 이상 대기업 판정은 여기서 하지 않는다 — 그건 공정위 명단이 이미 잡는다.)

   ── 산출물 ──
   backend/data/listed-sizes.json  { 정규화된회사명: 'small' | 'mid' | 'none' }
   'none' 은 **3년치 재무를 실제로 물어봤는데 매출이 없는 회사**다(상장폐지·휴면·
   기업인수목적회사(SPAC)·선박투자회사…). company-sectors 가 목록에서 뺀다.
   표에 아예 없는 회사는 '아직 안 물어봤다' 는 뜻이지 '죽었다' 가 아니다 —
   이 둘을 섞지 않는 것이 이 스크립트의 핵심이다(아래).

   ── 첫 판이 왜 틀렸나 (2026-08-28, 반드시 읽을 것) ──
   첫 판은 회사마다 financials() 를 부르며 `catch { miss++ }` 로 **오류와 '매출 없음'을
   같은 칸에 넣었다.** 동시 8로 3,102곳 × 최대 6호출을 때리다 DART 일일 한도(status
   020)에 걸렸고, 그 뒤로는 전부 '매출 없음' 으로 기록됐다. 그래서 알테오젠·HPSP·
   실리콘투·클래시스·더블유게임즈 같은 **멀쩡한 상장사 1,400여 곳이 '상장폐지' 로
   분류돼 목록에서 사라졌다.** 다음 날 무작위 40곳을 고유번호로 다시 물었더니 23곳에
   매출이 있었다. 지금 판은
     ① 오류를 결과로 쓰지 않는다 — 재시도하고, 한도 오류면 저장 후 **중단**한다
        (다음 날 다시 돌리면 이어서 채운다). 조용히 '없음' 으로 적지 않는다.
     ② 다중회사 API(fnlttMultiAcnt)로 **한 번에 50곳씩** 받는다. 회사당 최대 6호출이던
        것이 50곳당 6호출이 되어 한도에 닿을 일이 없다(3,102곳 ≈ 380호출).
     ③ 이름이 아니라 **고유번호(corp_code)로 직접** 부른다.

   ── 실행 ──
     node scripts/build-listed-sizes.js
   DART 인증키(.env DART_API_KEY)가 있어야 한다. 중간에 끊겨도 다시 돌리면 이어서 한다.
*/
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DART = require('../src/dart');
const CLASSIFY = require('../src/company-classify');

/* 중소기업기본법 시행령 별표1 — 주된 업종별 평균매출액 중소기업 상한(억원).
   KSIC 2자리(우리가 회사마다 들고 있는 값)로 근사한다. 정확히는 '주된 업종' 분류지만
   2자리로도 대부분 맞고, 못 맞춘 업종은 기본값(800억)으로 둔다 — 경계에서 조금
   보수적으로(중소로) 잡히는 쪽이라 '중견을 중소로 잘못 적는' 위험을 늘리지 않는다. */
const THRESHOLD_EOK = { // 억원
  // 1,500억
  14: 1500, 15: 1500, 17: 1500, 24: 1500, 28: 1500, 32: 1500,
  // 1,000억
  1: 1000, 2: 1000, 3: 1000, 5: 1000, 6: 1000, 7: 1000, 8: 1000,
  10: 1000, 12: 1000, 13: 1000, 16: 1000, 19: 1000, 20: 1000, 22: 1000,
  25: 1000, 26: 1000, 29: 1000, 30: 1000, 31: 1000, 35: 1000,
  41: 1000, 42: 1000, 45: 1000, 46: 1000, 47: 1000,
  // 800억
  11: 800, 18: 800, 21: 800, 23: 800, 33: 800, 37: 800, 38: 800, 39: 800,
  49: 800, 50: 800, 51: 800, 52: 800, 58: 800, 59: 800, 60: 800, 61: 800, 62: 800, 63: 800,
  // 600억
  34: 600, 71: 600, 72: 600, 73: 600, 74: 600, 75: 600, 76: 600, 90: 600, 91: 600,
  // 400억
  55: 400, 56: 400, 64: 400, 65: 400, 66: 400, 68: 400, 85: 400, 86: 400, 87: 400,
  94: 400, 95: 400, 96: 400,
};
const DEFAULT_EOK = 800;
const EOK = 1e8; // 1억 = 1e8 원

/* 다중회사 주요계정 — corp_code 를 쉼표로 이어 한 번에 받는다. 실측으로 50곳까지
   문제없이 온다(회사당 계정이 30줄쯤 오므로 그 이상은 응답만 커진다). */
const BATCH = 50;
/* 매출 계정 이름. 제조업은 '매출액', 금융·서비스는 '영업수익' 으로 낸다.
   (dart.js ACCOUNTS 와 같은 목록 — 그쪽은 3년 추이용이라 여기서 다시 적는다.) */
const REVENUE_NAMES = ['매출액', '수익(매출액)', '영업수익'];
const OUT = path.join(__dirname, '..', 'data', 'listed-sizes.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 사업보고서는 회계연도가 끝나고 3개월쯤 뒤에 올라온다. 최근 연도부터 내려가며 자료가
   있는 해를 찾고, 연결(CFS)이 없으면 개별(OFS)을 본다 — 종속회사가 없는 회사는
   연결재무제표를 아예 내지 않는다. */
function attempts(now = new Date().getFullYear()) {
  const out = [];
  for (let y = now - 1; y >= now - 3; y--) for (const div of ['CFS', 'OFS']) out.push({ y, div });
  return out;
}

/* 대상 — 업종코드가 있는 상장사 중 명단(대기업·중견·공공)에 없는 회사.
   company-sectors.sectors() 를 쓰지 않는다: 그쪽은 이 표를 **읽어서** 회사를 거르므로
   (표에 없으면 목록에서 뺀다) 대상 선정에 쓰면 첫 판의 오류가 그대로 굳는다. */
function targets() {
  const indPath = path.join(__dirname, '..', 'data', 'dart-industry.json');
  const byCode = (JSON.parse(fs.readFileSync(indPath, 'utf8')).byCode) || {};
  const seen = new Set();
  const out = [];
  for (const c of DART.allCorps()) {
    const key = CLASSIFY.normalize(c.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const industry = byCode[c.code];
    if (!industry) continue;                          // 업종코드가 없으면 목록에 못 올린다
    if (CLASSIFY.classify(c.name).matched) continue;  // 명단이 이미 규모를 안다
    out.push({ name: c.name, key, code: c.code, ksic: parseInt(String(industry).slice(0, 2), 10) });
  }
  return out;
}

/* 한 배치의 매출을 받는다 → { corp_code: 매출 }. 못 받은 회사는 키가 없다.
   오류는 **던진다**. '없음' 으로 바꿔 삼키지 않는다 — 첫 판이 그래서 틀렸다. */
async function revenuesOf(codes, { y, div }) {
  const d = await DART.callDart('fnlttMultiAcnt.json', {
    corp_code: codes.join(','), bsns_year: String(y), reprt_code: '11011', fs_div: div,
  });
  const rows = d && Array.isArray(d.list) ? d.list : [];
  const out = {};
  for (const r of rows) {
    if (!REVENUE_NAMES.includes(String(r.account_nm || '').trim())) continue;
    const v = DART.toNumber(r.thstrm_amount);
    if (typeof v === 'number' && v > 0 && !(r.corp_code in out)) out[r.corp_code] = v;
  }
  return out;
}

async function main() {
  if (!DART.isConfigured || !DART.isConfigured()) {
    console.error('DART 인증키(.env DART_API_KEY)가 없습니다. 재무를 받을 수 없어 중단합니다.');
    process.exit(1);
  }

  const all = targets();
  let out = {};
  try { out = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { out = {}; }
  const todo = all.filter(t => !(t.key in out));
  console.log(`대상 ${all.length}곳 · 남은 것 ${todo.length}곳 · 한 번에 ${BATCH}곳씩`);

  const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 0));
  const tries = attempts();
  let mid = 0, small = 0, none = 0, failed = 0;

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const rest = new Map(batch.map(t => [t.code, t]));   // 아직 매출을 못 받은 회사
    const rev = {};
    let broke = false;

    for (const a of tries) {
      if (!rest.size) break;
      let got = null;
      for (let n = 0; n < 3 && got === null; n++) {
        try { got = await revenuesOf([...rest.keys()], a); }
        catch (e) {
          /* 일일 한도(020 → 429)는 기다려도 안 풀린다. 여기까지 채운 표를 저장하고
             멈춘다 — 남은 회사를 '없음' 으로 적으면 살아 있는 회사가 목록에서 사라진다. */
          if (e.status === 429) {
            save();
            console.error(`\nDART 요청 한도에 걸렸습니다: ${e.message}`);
            console.error(`여기까지 저장했습니다(${Object.keys(out).length}곳). 한도가 풀린 뒤 다시 돌리면 이어서 채웁니다.`);
            process.exit(2);
          }
          if (n === 2) { console.warn(`  ! ${a.y}/${a.div} 배치 실패 — ${e.message} (이 배치는 표에 적지 않는다)`); broke = true; break; }
          await sleep(1000 * (n + 1));
        }
      }
      if (broke) break;
      for (const [code, v] of Object.entries(got || {})) { rev[code] = v; rest.delete(code); }
      await sleep(120);
    }
    if (broke) { failed += batch.length; continue; }     // 표에 적지 않는다 → 다음 실행에서 재시도

    for (const t of batch) {
      const v = rev[t.code];
      if (v == null) { out[t.key] = 'none'; none++; continue; }
      const capEok = THRESHOLD_EOK[t.ksic] || DEFAULT_EOK;
      const size = v > capEok * EOK ? 'mid' : 'small';
      out[t.key] = size;
      if (size === 'mid') mid++; else small++;
    }
    save();
    if ((i / BATCH) % 10 === 0) console.log(`  … ${Math.min(i + BATCH, todo.length)}/${todo.length} (중견 ${mid} · 중소 ${small} · 매출없음 ${none})`);
  }

  save();
  console.log(`\n완료 — 중견 ${mid} · 중소 ${small} · 매출없음(확인함) ${none}` + (failed ? ` · 못 받음(다음 실행에서 재시도) ${failed}` : ''));
  console.log(`표에 담긴 총 회사: ${Object.keys(out).length}곳 → ${OUT}`);
  process.exit(0);
}

main().catch(e => { console.error('실패:', e.message); process.exit(1); });
