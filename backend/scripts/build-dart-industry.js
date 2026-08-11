/* DART 업종코드 채우기 → data/dart-industry.json
   경쟁사 비교("같은 업종의 다른 회사")와 계열별 둘러보기가 이 값으로 돈다.

   ── 결과는 깃에 넣는다 (이름 색인과 반대다) ──
   이름 색인(dart-corps.json, 6MB)은 DART 가 통째로 주는 원본이라 빌드에서 받고
   깃에는 안 넣는다. 업종코드는 **회사마다 API 를 한 번씩 불러 만든 값**이라
   (호출 3,981번·약 8분) 다시 만드는 비용이 크고 크기는 72KB 다. 그래서 깃에 넣는다.
   한 파일에 같이 뒀다가 색인을 깃에서 빼는 순간 업종코드가 같이 사라져서,
   배포에서 계열별 둘러보기가 0곳이 되고 경쟁사가 빈 채로 나갔다.

   ── 왜 별도 스크립트인가 ──
   DART 에는 "이 업종의 회사 목록" API 가 없다. 업종코드는 기업개황(company.json)을
   **회사마다 한 번씩** 불러야 알 수 있어서, 상장사 2,700여 건이면 호출도 2,700번이다.
   고유번호 수집(1회 다운로드)과 성격이 완전히 달라 파일을 갈랐다 —
   실패하거나 중단돼도 고유번호까지 다시 받게 하지 않는다.

   ── 중단해도 된다 ──
   한 건 끝날 때마다가 아니라 SAVE_EVERY 건마다 파일에 쓴다. 다시 실행하면 이미 채워진
   회사는 건너뛰므로(--force 로 무시), 끊긴 지점부터 이어진다.
   DART 일일 한도는 20,000건이라 상장사 전체는 하루 안에 끝난다. 한도를 넘기면(020)
   즉시 멈추고 지금까지 채운 것을 저장한다 — 계속 던져봐야 전부 실패한다.

   사용:
     node scripts/build-dart-industry.js               # 빈 것만 채운다
     node scripts/build-dart-industry.js --limit=200   # 200건만
     node scripts/build-dart-industry.js --force       # 전부 다시
   env: DART_API_KEY */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const DART = require('../src/dart');

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : dflt;
};
const LIMIT = Number(arg('limit', 0)) || Infinity;
const FORCE = process.argv.includes('--force');

/* 호출 간격. DART 는 초당 제한을 명시하지 않지만 연속 호출로 차단된 사례가 흔해
   보수적으로 둔다. 2,700건 × 120ms ≈ 5분 — 한 번만 돌리면 되는 작업이라 충분히 빠르다. */
const DELAY_MS = Number(process.env.DART_DELAY_MS || 120);
const SAVE_EVERY = 100;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  if (!DART.isConfigured()) {
    console.error('DART_API_KEY 가 없습니다. backend/.env 에 넣어 주세요.');
    process.exit(1);
  }
  if (!fs.existsSync(DART.CORPS_PATH)) {
    console.error(`${DART.CORPS_PATH} 가 없습니다. 먼저 scripts/fetch-dart-corps.js 를 실행하세요.`);
    process.exit(1);
  }

  const corps = DART.allCorps();
  /* 상장사만 채운다. 색인이 공시대상 전체(11만여 건)로 바뀌면서 전부 돌리면
     DART 일일 한도(20,000건)로 엿새가 걸린다. 업종코드를 쓰는 곳은 경쟁사 목록과
     계열별 둘러보기인데 둘 다 상장사만 본다(비상장은 매출 비교가 불가능하다).
     비상장사도 채우려면 --unlisted. */
  const scope = process.argv.includes('--unlisted') ? corps : corps.filter(c => c.stock);
  const todo = scope.filter(c => FORCE || !c.industry).slice(0, LIMIT);

  console.log(`대상 ${todo.length.toLocaleString()}건 / 상장사 ${corps.filter(c => c.stock).length.toLocaleString()}건 / 전체 ${corps.length.toLocaleString()}건`);
  if (!todo.length) { console.log('채울 것이 없습니다. --force 로 다시 받을 수 있습니다.'); return; }

  /* 이미 채워 둔 것 위에 얹는다 — --limit 으로 나눠 돌려도 앞의 결과가 남아야 한다. */
  const byCode = { ...((JSON.parse(fs.existsSync(DART.INDUSTRY_PATH)
    ? fs.readFileSync(DART.INDUSTRY_PATH, 'utf8') : '{}') || {}).byCode || {}) };
  for (const c of corps) if (c.industry) byCode[c.code] = c.industry;

  const save = () => {
    fs.writeFileSync(DART.INDUSTRY_PATH, JSON.stringify({
      '//': 'DART 업종코드(KSIC). 회사마다 기업개황 API 를 한 번씩 불러 만든 값이라 깃에 넣는다. '
          + '이름 색인(dart-corps.json)은 6MB 라 빌드에서 받는다 — build-dart-industry.js 머리주석 참고.',
      generatedAt: new Date().toISOString(),
      total: Object.keys(byCode).length,
      byCode,
    }, null, 0));
  };

  let done = 0, filled = 0, missing = 0;
  for (const corp of todo) {
    try {
      const p = await DART.profile(corp.code);
      if (p?.industryCode) { corp.industry = p.industryCode; byCode[corp.code] = p.industryCode; filled++; }
      else missing++;
    } catch (e) {
      if (e.dartStatus === '020') {                 // 일일 한도 초과 — 더 던져봐야 소용없다
        console.error(`\n일일 호출 한도를 넘었습니다. 지금까지 ${filled}건 저장하고 멈춥니다.`);
        break;
      }
      missing++;
      console.warn(`  ${corp.name}: ${e.message}`);
    }
    done++;
    if (done % SAVE_EVERY === 0) { save(); console.log(`  …${done}/${todo.length} (채움 ${filled})`); }
    await sleep(DELAY_MS);
  }

  save();
  console.log(`\n완료 — 이번에 ${filled}건 채움, ${missing}건 없음`);
  console.log(`업종코드 보유 ${Object.keys(byCode).length.toLocaleString()}건 (상장사 ${corps.filter(c => c.stock).length.toLocaleString()}건 중)`);
  console.log(`→ ${DART.INDUSTRY_PATH}`);
  console.log('\n이 파일은 깃에 커밋한다 — 다시 만들려면 API 를 회사마다 한 번씩 불러야 한다.');
}

main().catch(e => { console.error('실패:', e.message); process.exit(1); });
