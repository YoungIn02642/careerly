/* 지방공기업·지방출자출연기관 CSV → data/local-public-orgs.json
   기업규모 분류(src/company-classify.js)의 '공기업' 판별을 메우는 세 번째 소스.

   왜 필요한가:
     기존 공공기관 캐시(scripts/fetch-public-orgs.js)가 쓰는 재정경제부
     지정현황 355건은 공공기관운영법 대상 — 즉 중앙정부 산하만 담는다.
     지방공기업법·지방출연기관법 대상인 지자체 산하 기관은 별도 고시라
     그 명단에 없고, 그래서 서울교통공사·서울시설공단·용인문화재단 같은
     누가 봐도 공기업인 곳이 기본값 '중소기업' 으로 떨어졌다.

   ── 다른 수집 스크립트와 다른 점 ──
     ftc-large-groups / public-orgs 는 오픈API 로 받지만, 이 두 데이터셋은
     활용신청·자동변환 API 가 없고 CSV 다운로드만 제공한다. 그래서 이 스크립트는
     네트워크를 타지 않고 사람이 받아둔 CSV 를 읽는다.

   ── 사용법 ──
     1) 아래 두 곳에서 CSV 를 내려받는다
          https://www.data.go.kr/data/15048282/fileData.do  지방공기업 설립현황
          https://www.data.go.kr/data/15048281/fileData.do  지방출자출연기관 설립현황
     2) backend/data/raw/ 에 그대로 넣는다 (파일명은 바꾸지 않아도 된다)
     3) node scripts/fetch-local-public-orgs.js

     받은 자리에서 바로 읽히려면 폴더나 파일을 인자로 준다:
       node scripts/fetch-local-public-orgs.js ~/Downloads
       node scripts/fetch-local-public-orgs.js a.csv b.csv

     파일명에 '출자'나 '출연'이 들어가면 지방출자출연기관, 아니면 지방공기업으로
     본다. 둘 다 화면에서는 '공기업' 한 칸으로 표시된다(사용자 결정).

   갱신은 1년에 한 번 고시가 새로 나올 때 CSV 만 갈아 끼우면 된다.
*/
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const DEST = path.join(__dirname, '..', 'data', 'local-public-orgs.json');

/* ── 인코딩 ────────────────────────────────────────────────
   data.go.kr CSV 는 EUC-KR(CP949) 이 많고 UTF-8 도 섞여 있다.
   UTF-8 로 엄격 디코딩해보고 깨지면 EUC-KR 로 간주한다. */
function decode(buf) {
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buf.subarray(3));   // UTF-8 BOM
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

/* ── CSV 파싱 ──────────────────────────────────────────────
   기관명에 쉼표가 든 경우("서울특별시 강남구도시관리공단, 강남")가 있어
   따옴표 안의 쉼표·줄바꿈을 지켜야 한다. 의존성을 늘리지 않으려고
   RFC4180 최소 규칙만 직접 구현한다. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }   // 이스케이프된 따옴표
        else quoted = false;
      } else field += c;
      continue;
    }

    if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* CRLF 의 CR 은 버린다 */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  return rows.filter(r => r.some(f => f.trim()));   // 빈 줄 제거
}

/* 컬럼명이 고시본마다 흔들린다(기관명 / 공사·공단명 / 법인명 …).
   스키마를 코드에 박는 대신 후보 패턴으로 첫 일치 컬럼을 집는다.
   이러면 내년 고시에서 컬럼명이 바뀌어도 대개 그대로 돈다. */
const NAME_PATTERNS   = [/기관\s*명/, /공사.*공단.*명/, /법인\s*명/, /기업\s*명/, /^명칭/, /명$/];
const TYPE_PATTERNS   = [/유형/, /구분/, /형태/];
const REGION_PATTERNS = [/시\s*도/, /지역/, /광역/, /자치단체/, /소재/];

function findCol(headers, patterns) {
  for (const re of patterns) {
    const i = headers.findIndex(h => re.test(h.replace(/\s/g, '') ) || re.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

function readCsvFile(file) {
  const rows = parseCsv(decode(fs.readFileSync(file)));
  if (!rows.length) return { headers: [], records: [] };

  /* 파일 첫 줄이 제목행("2025년 지방공기업 설립현황")인 경우가 있다.
     기관명 컬럼이 잡히는 첫 줄을 헤더로 본다. */
  let h = 0;
  while (h < rows.length && h < 5 && findCol(rows[h].map(s => s.trim()), NAME_PATTERNS) < 0) h++;
  if (h >= rows.length || h >= 5) h = 0;

  const headers = rows[h].map(s => s.trim());
  const records = rows.slice(h + 1).map(r => r.map(s => s.trim()));
  return { headers, records };
}

/* 인자로 폴더나 CSV 경로들을 받는다. 없으면 data/raw 를 본다.
   폴더를 주면 그 안의 CSV 중 이 데이터셋으로 보이는 것만 고른다 —
   Downloads 처럼 무관한 CSV 가 잔뜩 있는 폴더를 그대로 가리켜도 되도록. */
const RELEVANT = /지방공기업|출자|출연/;

function collectFiles(args) {
  if (!args.length) {
    if (!fs.existsSync(RAW_DIR)) {
      throw new Error(
        `${RAW_DIR} 가 없습니다.\n` +
        `  data.go.kr 15048282(지방공기업) / 15048281(지방출자출연기관) 에서 CSV 를 받아\n` +
        `  이 폴더에 넣거나, 받은 폴더를 인자로 주세요:\n` +
        `    node scripts/fetch-local-public-orgs.js ~/Downloads`
      );
    }
    args = [RAW_DIR];
  }

  const files = [];
  for (const a of args) {
    if (!fs.existsSync(a)) throw new Error(`경로를 찾을 수 없습니다: ${a}`);
    if (fs.statSync(a).isDirectory()) {
      fs.readdirSync(a)
        .filter(f => /\.csv$/i.test(f) && RELEVANT.test(f))
        .forEach(f => files.push(path.join(a, f)));
    } else {
      files.push(a);   // 파일을 직접 지정했으면 이름으로 거르지 않는다
    }
  }
  if (!files.length) throw new Error('읽을 CSV 를 찾지 못했습니다. 파일명에 지방공기업/출자/출연 이 들어가야 합니다.');
  return files;
}

function main() {
  const files = collectFiles(process.argv.slice(2));

  const organizations = [];
  const sourceFiles = [];
  const seen = new Set();

  for (const file of files) {
    const f = path.basename(file);
    const kind = /출자|출연/.test(f) ? '지방출자출연기관' : '지방공기업';
    const { headers, records } = readCsvFile(file);

    const iName   = findCol(headers, NAME_PATTERNS);
    const iType   = findCol(headers, TYPE_PATTERNS);
    const iRegion = findCol(headers, REGION_PATTERNS);

    console.log(`${f}  [${kind}]  ${records.length}행`);
    if (iName < 0) {
      console.warn(`  ⚠ 기관명 컬럼을 못 찾아 건너뜁니다. 실제 헤더: ${headers.join(' | ')}`);
      continue;
    }

    let kept = 0;
    records.forEach(r => {
      const name = (r[iName] || '').trim();
      if (!name) return;
      /* 같은 기관이 두 파일에 겹쳐 들어오는 경우가 있다(공단이 출연기관을 겸함) */
      if (seen.has(name)) return;
      seen.add(name);
      organizations.push({
        name,
        type: '공공기관',                              // 저장값 public → 화면 '공기업'
        kind,                                          // 지방공기업 / 지방출자출연기관
        raw: iType   >= 0 ? (r[iType]   || null) : null,   // '공사' '공단' '출연기관' 등
        region: iRegion >= 0 ? (r[iRegion] || null) : null, // '서울특별시' 등
      });
      kept += 1;
    });

    console.log(`  → 기관명 추출 ${kept}건 (기관명='${headers[iName]}')`);
    sourceFiles.push(f);
  }

  if (!organizations.length) throw new Error('추출된 기관이 없습니다. CSV 헤더를 확인하세요.');

  const out = {
    source: '행정안전부 지방공기업평가원_지방공기업/지방출자출연기관 설립현황 (data.go.kr 15048282, 15048281)',
    sourceFiles,
    fetchedAt: new Date().toISOString(),
    count: organizations.length,
    organizations,
  };
  fs.writeFileSync(DEST, JSON.stringify(out, null, 2));

  const byKind = {};
  organizations.forEach(o => { byKind[o.kind] = (byKind[o.kind] || 0) + 1; });
  console.log('\n저장:', DEST);
  console.log('기관 수:', organizations.length);
  Object.entries(byKind).forEach(([k, v]) => console.log('  ', k.padEnd(20), v));
}

try { main(); } catch (e) { console.error('실패:', e.message); process.exit(1); }
