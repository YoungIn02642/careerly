/* 사업보고서 원문 → '무엇을 하는 회사인가' 줄글 — 네트워크를 타지 않는다.

   이 모듈의 위험은 파싱 실패가 아니라 **부스러기를 회사 설명인 척 보여주는 것**이다.
   표를 걷어내면 그 표에 달려 있던 각주만 남는데, 길이는 문단만 해서 그대로 첫 줄로
   올라온다. 실제로 그렇게 됐다:
     현대자동차 → "※ 차량부문은 내부거래조정과 관련된 영업이익을 포함하고 있음."
     카카오     → "참고 1: 당기중 ㈜카카오헬스케어와 그 종속기업으로 구성된…"
     CJ제일제당 → "(*1) 부문간 내부매출액 제외기준입니다. (연결 기준)"
   회사 소개가 각주로 시작한 것이다. 그래서 여기서는 **무엇을 버리는가**를 주로 본다.

   XML 은 실제 응답에서 뽑은 모양 그대로다(태그 이름·속성 포함). */
const R = require('../backend/src/dart-report');
const zlib = require('zlib');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

/* ── 1. ZIP ────────────────────────────────────────────────── */
console.log('── 1. ZIP 읽기 ──');

/* DART 는 **스트리밍 ZIP** 으로 준다 — 로컬 헤더의 압축 크기가 0 이고 실제 크기는
   데이터 뒤 descriptor 에 있다. 그 모양을 그대로 만들어서, 중앙 디렉터리를 읽는지
   확인한다. 로컬 헤더만 훑는 구현이면 여기서 빈손이 된다. */
function streamingZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const [name, text] of entries) {
    const nameBuf = Buffer.from(name, 'latin1');
    const body = zlib.deflateRawSync(Buffer.from(text, 'utf8'));

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(0x0008, 6);           // bit 3 — 크기는 descriptor 에
    lh.writeUInt16LE(8, 8);                // deflate
    lh.writeUInt32LE(0, 18);               // 압축 크기 0 (여기가 함정이다)
    lh.writeUInt32LE(0, 22);               // 원본 크기 0
    lh.writeUInt16LE(nameBuf.length, 26);
    const dd = Buffer.alloc(16);
    dd.writeUInt32LE(0x08074b50, 0);
    dd.writeUInt32LE(body.length, 8);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(body.length, 20);     // 진짜 크기는 여기에만 있다
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);

    locals.push(lh, nameBuf, body, dd);
    central.push(ch, nameBuf);
    offset += 30 + nameBuf.length + body.length + 16;
  }

  const localBuf = Buffer.concat(locals);
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}

const zip = streamingZip([
  ['20260318001400_00760.xml', '<DOCUMENT><TITLE>독립된 감사인의 감사보고서</TITLE></DOCUMENT>'],
  ['20260318001400.xml', '<DOCUMENT><TITLE>II. 사업의 내용</TITLE></DOCUMENT>'],
]);
const files = R.unzip(zip);
ok('스트리밍 ZIP 에서도 엔트리를 다 읽는다', files.length === 2, `→ ${files.length}개`);

/* 첨부(감사보고서)를 본문으로 잘못 고르면 「사업의 내용」 을 영영 못 찾는다.
   실제로 한 번 그렇게 읽어서 감사보고서가 나왔다. */
const main = R.mainDocument(files, '20260318001400');
ok('첨부가 아니라 접수번호 파일을 본문으로 고른다', main.includes('사업의 내용'),
   `→ ${main.slice(0, 40)}`);

/* ── 2. 각주·부스러기 ──────────────────────────────────────── */
console.log('\n── 2. 표 각주를 문단으로 올리지 않는다 ──');

const 각주들 = [
  '※ 차량부문은 내부거래조정과 관련된 영업이익을 포함하고 있으며 매출액은 외부고객으로부터의 매출액을 의미합니다.',
  '참고 1: 당기중 ㈜카카오헬스케어와 그 종속기업으로 구성된 헬스케어사업부문의 매각절차를 완료하였습니다.',
  '(*1) 부문간 내부매출액 제외기준입니다. (연결 기준) 당기 중 연결회사는 종속기업 주식을 매도하였습니다.',
  '(주1) 상기 금액은 연결재무제표 기준으로 작성되었으며 내부거래를 제거한 후의 금액입니다.',
  '(단위: 백만원) 상기 표의 금액은 한국채택국제회계기준에 따라 작성된 연결재무제표 기준입니다.',
];
for (const line of 각주들) {
  const { paragraphs } = R.paragraphsOf(`<P><SPAN>${line}</SPAN></P>`);
  ok(`버린다: ${line.slice(0, 22)}…`, paragraphs.length === 0, paragraphs.length ? `→ ${paragraphs[0].slice(0, 40)}` : '');
}

const 본문 = '연결회사는 주요사업으로 도료 및 관련제품을 생산ㆍ판매하고 있으며, 접착제 및 합성수지의 제조ㆍ판매를 하고 있습니다.';
ok('보통 문단은 남긴다', R.paragraphsOf(`<P><SPAN>${본문}</SPAN></P>`).paragraphs.length === 1);
ok('짧은 줄(표 머리글 등)은 버린다', R.paragraphsOf('<P><SPAN>구  분</SPAN></P>').paragraphs.length === 0);

/* 표는 통째로 버리되, 버렸다는 사실은 남긴다 — 화면이 '원문에서 보기' 를 띄운다.
   말없이 지우면 학생은 우리가 보여준 것이 전부라고 믿는다. */
const withTable = R.paragraphsOf(`<P><SPAN>${본문}</SPAN></P><TABLE><TR><TD>매출</TD></TR></TABLE>`);
ok('표를 버렸다는 것을 알린다', withTable.hadTable === true && withTable.paragraphs.length === 1);

/* ── 3. 같은 문장 두 번 싣지 않기 ──────────────────────────── */
console.log('\n── 3. 절이 달라도 같은 문장은 한 번만 ──');
/* 강남제비스코는 '사업의 개요' 와 '주요 제품' 의 첫 문장이 거의 같다. 그대로 두면
   화면에 같은 문단이 연달아 두 번 뜬다. */
const seen = new Set();
const first = R.paragraphsOf(`<P><SPAN>${본문}</SPAN></P>`, seen);
const second = R.paragraphsOf(`<P><SPAN>${본문} 추가로 복합재료도 공급합니다.</SPAN></P>`, seen);
ok('첫 절은 싣는다', first.paragraphs.length === 1);
ok('뒤 절의 같은 문장은 뺀다', second.paragraphs.length === 0);
ok('뺐다는 것을 알린다', second.truncated === true);

/* ── 4. 절 찾기 ────────────────────────────────────────────── */
console.log('\n── 4. 「사업의 내용」 안에서만 찾는다 ──');

/* 제목 형태가 회사마다 다르다(실측):
     강남제비스코·삼성전자 → '1. 사업의 개요'
     카카오·현대자동차     → '1. (제조서비스업)사업의 개요'
   겸업사는 '(금융업)사업의 개요' 가 뒤에 또 온다 — 본업이 앞이므로 앞엣것을 쓴다. */
const doc = (title) => `<DOCUMENT>
  <TITLE ATOC="Y">I. 회사의 개요</TITLE><P><SPAN>여기는 회사 연혁이라 사업 내용이 아닙니다. 이 문단이 잡히면 안 됩니다.</SPAN></P>
  <TITLE ATOC="Y">II. 사업의 내용</TITLE>
  <TITLE ATOC="Y">${title}</TITLE><P><SPAN>${본문}</SPAN></P>
  <TITLE ATOC="Y">2. (금융업)사업의 개요</TITLE><P><SPAN>이쪽은 금융 겸업 설명이라 본업이 아닙니다. 앞엣것이 먼저 잡혀야 합니다.</SPAN></P>
  <TITLE ATOC="Y">III. 재무에 관한 사항</TITLE><P><SPAN>재무 설명 문단입니다. 사업의 내용 밖이라 잡히면 안 됩니다.</SPAN></P>
</DOCUMENT>`;

for (const title of ['1. 사업의 개요', '1. (제조서비스업)사업의 개요']) {
  const blocks = R.blocksOf(doc(title));
  ok(`제목 '${title}' 를 찾는다`, blocks.length === 1 && blocks[0].section === title,
     `→ ${blocks.map(b => b.section).join(', ') || '못 찾음'}`);
  ok('  본업 문단을 싣는다', blocks[0]?.paragraphs[0] === 본문);
  ok('  화면용 제목을 붙인다', blocks[0]?.title === '무엇을 하는 회사인가');
}

/* 「사업의 내용」 자체가 없는 문서(감사보고서 등)에서는 아무것도 만들지 않는다.
   억지로 아무 문단이나 집어 오면 회사 설명 자리에 감사 의견이 뜬다. */
ok('「사업의 내용」 이 없으면 빈손',
   R.blocksOf('<DOCUMENT><TITLE>독립된 감사인의 감사보고서</TITLE><P><SPAN>우리는 위 회사의 재무제표를 감사하였습니다. 감사의견은 적정입니다.</SPAN></P></DOCUMENT>').length === 0);

/* ── 5. 분량 ───────────────────────────────────────────────── */
console.log('\n── 5. 분량을 자른다 ──');
const long = Array.from({ length: 20 }, (_, i) =>
  `<P><SPAN>${i} 번째 문단입니다. ${'가나다라마바사아자차'.repeat(8)}</SPAN></P>`).join('');
const cut = R.paragraphsOf(long);
ok(`문단 수를 ${R.MAX_PARAS}개로 막는다`, cut.paragraphs.length <= R.MAX_PARAS, `→ ${cut.paragraphs.length}개`);
ok('잘랐다는 것을 알린다', cut.truncated === true);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
