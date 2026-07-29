/* 국가자격 종목 목록 수집 → data/qnet-certs.json
   스펙 입력 화면의 자격증 선택 목록(카탈로그) 캐시.

   출처: 한국산업인력공단_국가자격 종목 목록 정보 (data.go.kr 15003024)
         국가기술자격(기술사·기능장·기사·산업기사·기능사) + 국가전문자격 전 종목.
         실측 613종 (국가기술자격 513 · 국가전문자격 100).

   ── 이 API 의 규격 (실호출로 확인) ──
   · 호스트가 openapi.q-net.or.kr 이다. apis.data.go.kr 이 아니다 —
     그쪽으로 부르면 404 'API not found' 가 난다.
   · **HTTPS 를 지원하지 않는다.** https 로 부르면 fetch 자체가 실패한다(TLS 없음).
     다른 fetch-*.js 는 전부 https 라서 여기만 http 인 걸 이상하게 보고 고치지 말 것.
   · 파라미터는 serviceKey 하나뿐. 페이징이 없고 전 종목을 한 번에 준다(약 165KB).
   · 응답 XML: <item> 반복. jmcd/jmfldnm/qualgbcd/qualgbnm/seriescd/seriesnm/
     obligfldcd/obligfldnm/mdobligfldcd/mdobligfldnm.

   ── resultCode 99 는 실패가 아니라 '다시 걸어라' 다 ──
   승인된 키로도 5회 중 1회쯤 <resultCode>99</resultCode>
   'Failed to validate a newly established connection.' 이 떨어진다. 게이트웨이
   쪽 커넥션 문제고 재시도하면 같은 키로 바로 성공한다. 그래서 99 만 재시도한다.
   (미승인 키는 이 코드가 아니라 다른 인증 오류로 떨어지므로 구분된다.)

   ── seriesnm 을 '등급' 으로 쓰지 말 것 ──
   정보처리산업기사의 seriesnm 이 '기사' 다. 계열 코드는 등급이 아니라 시험 시행
   묶음이라, 등급은 종목명 뒤쪽('기사'/'산업기사'/'기능사')에서 따로 뽑는다.

     node scripts/fetch-qnet-certs.js
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const KEY = (process.env.DATA_GO_KR_SERVICE_KEY || '').trim();
const API = 'http://openapi.q-net.or.kr/api/service/rest/InquiryListNationalQualifcationSVC/getList';
const OUT = path.join(__dirname, '..', 'data', 'qnet-certs.json');
const MAX_RETRY = 5;

function tag(xml, name) {
  return xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? null;
}

function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const row = {};
    const fre = /<([a-zA-Z_][\w]*)>([\s\S]*?)<\/\1>/g;
    let f;
    while ((f = fre.exec(m[1]))) row[f[1]] = f[2].trim();
    items.push(row);
  }
  return items;
}

/* 종목명 끝에서 등급을 뽑는다. '산업기사' 가 '기사' 로 먼저 걸리지 않도록
   긴 것부터 검사한다. */
const GRADES = ['기술사', '기능장', '산업기사', '기사', '기능사'];
function gradeOf(name) {
  return GRADES.find(g => name.endsWith(g)) || null;
}

async function call() {
  let lastMsg = '';
  for (let i = 1; i <= MAX_RETRY; i++) {
    const res = await fetch(`${API}?serviceKey=${encodeURIComponent(KEY)}`);
    const xml = await res.text();
    const code = tag(xml, 'resultCode');
    if (code === '00' || code === '0') return parseItems(xml);

    lastMsg = `resultCode ${code}: ${tag(xml, 'resultMsg') || '알 수 없음'}`;
    if (code !== '99') throw new Error(lastMsg);   // 99 외에는 재시도해도 소용없다
    console.log(`  ↻ 재시도 ${i}/${MAX_RETRY} — ${lastMsg}`);
    await new Promise(s => setTimeout(s, 1500));
  }
  throw new Error(`${MAX_RETRY}회 재시도 실패 — ${lastMsg}`);
}

(async () => {
  if (!KEY) {
    console.error('DATA_GO_KR_SERVICE_KEY 가 .env 에 없습니다.');
    process.exit(1);
  }

  console.log('국가자격 종목 목록 조회 중…');
  const items = await call();
  if (!items.length) throw new Error('종목이 0건입니다 — 응답 형식이 바뀌었을 수 있습니다.');

  const certs = items.map(r => ({
    id: r.jmfldnm,                 // 종목명이 곧 스펙에 저장되는 값 (기존 저장분과 같은 형식)
    code: r.jmcd,
    kind: r.qualgbcd === 'T' ? 'national-tech' : 'national-pro',
    kindLabel: r.qualgbnm,
    grade: gradeOf(r.jmfldnm),
    field: r.obligfldnm,           // 대직무분야 — 학과·직무별로 추리는 데 쓴다
    fieldCode: r.obligfldcd,
    midField: r.mdobligfldnm,      // 중직무분야
    midFieldCode: r.mdobligfldcd,
  })).sort((a, b) => a.id.localeCompare(b.id, 'ko'));

  const out = {
    fetchedAt: new Date().toISOString(),
    source: '한국산업인력공단_국가자격 종목 목록 정보 (data.go.kr 15003024)',
    count: certs.length,
    certs,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

  const byKind = certs.reduce((m, c) => (m[c.kindLabel] = (m[c.kindLabel] || 0) + 1, m), {});
  console.log(`저장 완료 → ${path.relative(process.cwd(), OUT)}`);
  console.log(`  총 ${certs.length}종 ·`, Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(' · '));
})().catch(e => {
  console.error('실패:', e.message);
  process.exit(1);
});
