/* DART 공시대상 기업 고유번호 수집 → data/dart-corps.json
   기업분석의 '재무 · 경쟁사' 칸(src/dart.js)이 회사명을 고유번호로 바꿀 때 쓰는 색인.

   ── 왜 이 단계가 따로 필요한가 ──
   DART 의 모든 조회 API 는 회사명이 아니라 **고유번호(corp_code, 8자리)** 를 받는다.
   그 번호표를 주는 API 가 corpCode.xml 하나뿐이고, 전체 목록을 한 번에 내려준다.
   회사마다 검색을 부르는 API 는 없다 — 그래서 통째로 받아 캐시한다.

   ── 응답이 XML 이 아니라 ZIP 이다 (함정) ──
   이름은 corpCode.xml 인데 실제로는 **ZIP 바이너리**가 온다. 그대로 파싱하면
   깨진 글자만 나온다. 압축 해제 라이브러리를 새로 붙이지 않으려고 ZIP 중앙 디렉터리를
   직접 읽고 zlib 로 푼다(항목 1개짜리 단순 ZIP 이라 40줄이면 된다).
   → 의존성을 늘리지 않는 편이 낫다는 판단. 형식이 바뀌면 여기만 고치면 된다.

   ── 기본은 상장사만 ──
   전체는 10만 건이 넘는데 대부분 자소서와 무관한 법인(펀드·SPC·소규모 법인)이다.
   상장사(stock_code 가 있는 회사)만 남기면 2,700여 건으로 줄고, 다음 단계
   (build-dart-industry.js)의 API 호출도 그만큼 줄어든다. --all 로 전체를 받을 수 있다.

   사용:
     node scripts/fetch-dart-corps.js            # 상장사만
     node scripts/fetch-dart-corps.js --all      # 공시대상 전체
   env: DART_API_KEY (https://opendart.fss.or.kr 에서 무료 발급) */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const API_KEY = (process.env.DART_API_KEY || '').trim();
const OUT_PATH = path.join(__dirname, '..', 'data', 'dart-corps.json');
const ALL = process.argv.includes('--all');

/* ── ZIP 풀기 ────────────────────────────────────────────────
   중앙 디렉터리(EOCD)부터 읽는다. 로컬 헤더의 크기 필드는 스트리밍으로 만든 ZIP 에서
   0 으로 비어 있을 수 있어(데이터 디스크립터 사용) 믿을 수 없다. */
function unzipFirstFile(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('ZIP 형식이 아닙니다 (EOCD 를 찾지 못했습니다).');

  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cdOffset) !== 0x02014b50) throw new Error('ZIP 중앙 디렉터리가 손상됐습니다.');

  const method    = buf.readUInt16LE(cdOffset + 10);
  const compSize  = buf.readUInt32LE(cdOffset + 20);
  const fnLen     = buf.readUInt16LE(cdOffset + 28);
  const extraLen  = buf.readUInt16LE(cdOffset + 30);
  const cmtLen    = buf.readUInt16LE(cdOffset + 32);
  const localOff  = buf.readUInt32LE(cdOffset + 42);
  const fileName  = buf.toString('utf8', cdOffset + 46, cdOffset + 46 + fnLen);
  void extraLen; void cmtLen;

  if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error('ZIP 로컬 헤더가 손상됐습니다.');
  const lFnLen    = buf.readUInt16LE(localOff + 26);
  const lExtraLen = buf.readUInt16LE(localOff + 28);
  const dataStart = localOff + 30 + lFnLen + lExtraLen;
  const data = buf.subarray(dataStart, dataStart + compSize);

  console.log(`  ZIP 안의 파일: ${fileName} (${method === 8 ? 'deflate' : 'stored'}, ${compSize.toLocaleString()} bytes)`);
  return method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
}

/* ── XML 파싱 ────────────────────────────────────────────────
   <list> 반복 구조가 단순해서 정규식으로 충분하다(XML 파서를 붙일 이유가 없다).
   회사명에 &amp; 같은 실체참조가 들어오므로 푼다 — 안 풀면 'AT&amp;S' 가 그대로 남아
   회사명 매칭에서 영원히 빗나간다(news.js 에서 &#x27; 로 같은 문제를 겪었다). */
const unescapeXml = s => String(s || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/&amp;/g, '&')
  .trim();

const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? unescapeXml(m[1]) : '';
};

function parseCorps(xml) {
  const out = [];
  for (const m of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
    const b = m[1];
    const code = pick(b, 'corp_code');
    const name = pick(b, 'corp_name');
    if (!code || !name) continue;
    const stock = pick(b, 'stock_code');
    out.push({ code, name, stock: stock || null, industry: null });
  }
  return out;
}

async function main() {
  if (!API_KEY) {
    console.error('DART_API_KEY 가 없습니다. https://opendart.fss.or.kr 에서 발급받아 backend/.env 에 넣어 주세요.');
    process.exit(1);
  }

  console.log('DART 고유번호 목록을 받는 중…');
  const res = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(API_KEY)}`, {
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`요청 실패 ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  /* 키가 틀리면 ZIP 이 아니라 XML 에러 본문이 온다 — 그때는 사유를 그대로 보여준다. */
  if (buf.subarray(0, 2).toString() !== 'PK') {
    const text = buf.toString('utf8').slice(0, 300);
    throw new Error(`ZIP 이 아닙니다. 응답: ${text.replace(/\s+/g, ' ')}`);
  }
  console.log(`  받음: ${buf.length.toLocaleString()} bytes`);

  const all = parseCorps(unzipFirstFile(buf).toString('utf8'));
  const corps = ALL ? all : all.filter(c => c.stock);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    scope: ALL ? 'all' : 'listed',
    total: corps.length,
    corps,
  }, null, 2));

  console.log(`\n공시대상 전체 ${all.length.toLocaleString()}건 중 ${ALL ? '전부' : '상장사'} ${corps.length.toLocaleString()}건 저장`);
  console.log(`→ ${OUT_PATH}`);
  console.log('\n다음: node scripts/build-dart-industry.js   (업종코드를 채워야 경쟁사 비교가 동작합니다)');
}

main().catch(e => { console.error('실패:', e.message); process.exit(1); });
