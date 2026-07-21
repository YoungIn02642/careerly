/* 대규모기업집단 소속회사 수집 → data/ftc-large-groups.json
   기업규모 분류(src/company-classify.js)의 '대기업' 판별 캐시.

   출처: 공정거래위원회_기업집단포털_지정된 대규모기업집단 소속회사 조회 (data.go.kr 15091891)
         공정거래법상 매년 지정되는 공시대상기업집단(자산 5조 이상)의 소속회사.
         '대기업' 의 법적 근거가 이 명단이다. 삼성전자 같은 모회사뿐 아니라
         SK쉴더스·롯데GRS 처럼 이름만으론 알 수 없는 계열사까지 잡힌다.

   ── 이 API 의 규격 (상세명세 확인 완료) ──
   · 호스트는 apis.data.go.kr (HTTPS). egroup.go.kr 이 아니다 — 예전 추정이 틀렸었다.
   · 오퍼레이션 경로: /appnGroupAffiListApi (.do 없음)
   · 파라미터: ServiceKey(대문자 S), pageNo, numOfRows, presentnYear
   · presentnYear 는 '연도' 가 아니라 지정년월 YYYYMM 이다(예: 202505). 지정은 매년 5월.
     여기에 연도 4자리(2026)를 넣으면 HTTP 500 'Unexpected errors' 가 난다.
   · unityGrupCode(기업집단코드)는 선택. 안 주면 전체 소속회사가 조회된다.
   · 응답 XML: <appnGroupAffi> 반복. 회사명은 <entrprsNm>, 그 외 jurirno/bizrno/rprsntvNm/fondDe/grinil.
   · 성공은 <resultCode>00</resultCode>.

     node scripts/fetch-ftc-groups.js            # 최신 지정년월 자동 탐색
     node scripts/fetch-ftc-groups.js 202505     # 지정년월(YYYYMM) 직접 지정
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const KEY = (process.env.DATA_GO_KR_SERVICE_KEY || '').trim();
const API = 'https://apis.data.go.kr/1130000/appnGroupAffiList/appnGroupAffiListApi';
const PER_PAGE = 500;

/* 의존성을 늘리지 않으려고 XML 파서를 붙이지 않았다. 이 응답은 중첩이 없는
   평평한 <appnGroupAffi> 목록이라 태그 추출로 충분하다. 구조가 복잡해지면 그때 파서를 넣는다. */
function parseItems(xml) {
  const items = [];
  const re = /<appnGroupAffi>([\s\S]*?)<\/appnGroupAffi>/g;
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

function tag(xml, name) {
  return xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? null;
}

async function call(presentnYear, pageNo) {
  const url = `${API}?ServiceKey=${encodeURIComponent(KEY)}&pageNo=${pageNo}&numOfRows=${PER_PAGE}&presentnYear=${presentnYear}`;
  const res = await fetch(url);
  const xml = await res.text();
  const code = tag(xml, 'resultCode');
  if (code && code !== '00' && code !== '0') {
    throw new Error(`resultCode ${code}: ${tag(xml, 'resultMsg') || '알 수 없음'}`);
  }
  return { xml, items: parseItems(xml), total: Number(tag(xml, 'totalCount') || 0) };
}

/* 지정은 매년 5월. presentnYear 는 YYYYMM 이다. 인자로 안 주면 올해 5월부터
   거꾸로 훑어 데이터가 나오는 지정년월을 쓴다. */
async function resolveYear(explicit) {
  if (explicit) return explicit;
  const thisYear = new Date().getFullYear();
  for (const y of [thisYear, thisYear - 1, thisYear - 2]) {
    const ym = `${y}05`;
    try {
      const r = await call(ym, 1);
      if (r.items.length) return ym;
    } catch (e) {
      if (/98|certification/i.test(e.message)) throw e;   // 인증 문제는 년월을 바꿔도 소용없다
    }
  }
  throw new Error('데이터가 있는 지정년월을 찾지 못했습니다. YYYYMM 을 직접 지정해 보세요.');
}

/* 상세명세로 확정된 응답 필드명. 소속회사명은 entrprsNm.
   이 API 응답에는 기업집단명 필드가 없다(소속회사만 평평하게 내려온다). */
const pickName  = r => r.entrprsNm || null;
const pickGroup = () => null;

(async () => {
  if (!KEY) throw new Error('DATA_GO_KR_SERVICE_KEY 가 .env 에 없습니다.');

  const year = await resolveYear(process.argv[2]);
  console.log('지정년월:', year);

  const rows = [];
  for (let page = 1; page <= 50; page++) {
    const r = await call(year, page);
    rows.push(...r.items);
    console.log(`  page ${page}: ${r.items.length}건 (누적 ${rows.length}/${r.total || '?'})`);
    if (!r.items.length || (r.total && rows.length >= r.total)) break;
  }

  const companies = rows
    .map(r => ({ name: (pickName(r) || '').trim(), group: pickGroup(r), raw: r }))
    .filter(c => c.name);

  if (!companies.length) {
    console.error('소속회사명을 못 뽑았습니다. 응답 필드명이 예상과 다를 수 있습니다.');
    console.error('첫 행 필드:', JSON.stringify(rows[0] || {}, null, 2).slice(0, 500));
    process.exit(1);
  }

  const out = {
    source: '공정거래위원회 지정된 대규모기업집단 소속회사 (data.go.kr 15091891)',
    presentnYear: year,
    fetchedAt: new Date().toISOString(),
    count: companies.length,
    companies: companies.map(({ name, group }) => ({ name, group })),
  };

  const dest = path.join(__dirname, '..', 'data', 'ftc-large-groups.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));

  console.log('\n저장:', dest);
  console.log('소속회사:', companies.length, '건');
})().catch(e => {
  console.error('실패:', e.message);
  if (/98|certification/i.test(e.message)) {
    console.error('\n→ 활용신청이 아직 게이트웨이에 반영되지 않았습니다.');
    console.error('  data.go.kr 에 [승인] 으로 보여도 egroup 은 별도 게이트웨이라 최대 하루 걸립니다.');
    console.error('  node scripts/check-api-access.js 로 상태를 확인하세요.');
  }
  process.exit(1);
});
