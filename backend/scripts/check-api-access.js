/* 기업규모 분류에 필요한 공공데이터 API 의 활용신청 승인 여부를 확인한다.

   data.go.kr 서비스키는 계정당 하나지만 API 마다 따로 활용신청을 해야 한다.
   승인 전에는 같은 키로도 인증 실패가 떨어져서 "키가 틀렸나?" 하고 헤매기 쉽다.
   활용신청 후 이 스크립트를 다시 돌려 승인됐는지 확인한다.

     node scripts/check-api-access.js

   ── 주의: 요청 주소가 API 마다 제각각이다 ──
   같은 공공데이터포털에 올라와 있어도 실제 호스트가 다르다. 아래 주소는 전부
   각 API 의 규격 문서에서 확인한 실제 주소다. 추측하면 404/500 이 나는데
   이게 '미승인' 과 구분이 안 돼서 한참 헤맨다.
     · 파일데이터 자동변환 → api.odcloud.kr
     · 공정위 기업집단포털 → apis.data.go.kr/1130000/... (예전엔 egroup.go.kr 로 잘못 알았음)
     · 일반 오픈API      → apis.data.go.kr
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const KEY = (process.env.DATA_GO_KR_SERVICE_KEY || '').trim();
const enc = encodeURIComponent(KEY);

const TARGETS = [
  {
    name: '공정위 · 지정된 대규모기업집단 소속회사',
    why: '대기업 판별',
    apply: 'https://www.data.go.kr/data/15091891/openapi.do',
    /* 호스트는 apis.data.go.kr, 오퍼레이션은 /appnGroupAffiListApi (상세명세 확인 완료).
       presentnYear 는 지정년월 YYYYMM(예: 202505) — 연도 4자리를 넣으면 HTTP 500 이 난다. */
    url: `https://apis.data.go.kr/1130000/appnGroupAffiList/appnGroupAffiListApi?ServiceKey=${enc}&pageNo=1&numOfRows=1&presentnYear=202505`,
  },
  {
    name: '재정경제부 · 공공기관 지정현황',
    why: '공공기관 판별',
    apply: 'https://www.data.go.kr/data/15088742/fileData.do',
    url: `https://api.odcloud.kr/api/15088742/v1/uddi:13bc783b-dc38-4ec4-868d-ddb01883e619?page=1&perPage=1&serviceKey=${enc}`,
  },
  {
    name: 'NCS (대조군 — 이미 승인된 API)',
    why: '키 자체가 유효한지 확인',
    apply: '(신청 완료)',
    url: `https://apis.data.go.kr/B490007/hrdkapi/NCS001?serviceKey=${enc}&numOfRows=1&pageNo=1&dataFormat=json`,
  },
];

/* 게이트웨이마다 실패를 알리는 방식이 다르다. status 만 봐서는 부족해서 본문을 읽는다.
     · egroup   : 200 + <resultCode>98</resultCode> 'serviceKey certification fail'
     · odcloud  : 404 + {"code":-3,"msg":"등록되지 않은 서비스 입니다."}
     · data.go.kr: 200 + SERVICE_KEY_IS_NOT_REGISTERED_ERROR */
function verdict(status, body) {
  const b = body.replace(/\s+/g, ' ');

  /* code 98 은 '미승인' 과 '승인됐지만 게이트웨이 미반영' 을 구분해주지 않는다.
     data.go.kr 마이페이지에 [승인] 으로 보이는데도 이게 뜨면 반영 대기다.
     egroup 은 별도 게이트웨이라 키 동기화가 최대 하루까지 걸린다. */
  if (/certification fail|<resultCode>\s*98/i.test(b))                 return ['인증 거부 — 미승인이거나 승인 반영 대기', '✗'];
  if (/등록되지\s*않은\s*서비스|"code"\s*:\s*-3/.test(b))               return ['인증 거부 — 미승인이거나 승인 반영 대기', '✗'];
  if (/SERVICE_KEY_IS_NOT_REGISTERED|등록되지\s*않은\s*인증키/i.test(b)) return ['키 미등록', '✗'];
  if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS/i.test(b))                   return ['쿼터 초과 (승인은 됨)', '!'];

  // 성공 신호
  if (/NORMAL_SERVICE/.test(b))                       return ['승인됨', '✓'];
  if (/"currentCount"|"totalCount"/.test(b))          return ['승인됨', '✓'];
  if (/<resultCode>\s*0*0\s*</.test(b))               return ['승인됨', '✓'];

  if (status === 404) return ['주소 불일치 (엔드포인트 확인 필요)', '?'];
  return [`알 수 없음 (HTTP ${status}) ${b.slice(0, 60)}`, '?'];
}

(async () => {
  if (!KEY) {
    console.error('DATA_GO_KR_SERVICE_KEY 가 .env 에 없습니다.');
    process.exit(1);
  }
  console.log(`서비스키: 설정됨 (${KEY.length}자)\n`);

  let blocked = 0;
  for (const t of TARGETS) {
    let status = 0, body = '';
    try {
      const res = await fetch(t.url);
      status = res.status;
      body = await res.text();
    } catch (e) {
      body = 'FETCH_ERROR ' + e.message;
    }
    const [label, mark] = verdict(status, body);
    if (mark === '✗') blocked++;
    console.log(`${mark} ${t.name}`);
    console.log(`   용도   : ${t.why}`);
    console.log(`   상태   : ${label}`);
    if (mark === '✗') console.log(`   활용신청: ${t.apply}`);
    console.log();
  }

  console.log(blocked === 0
    ? '전부 승인됐습니다. 배치 스크립트를 돌릴 수 있습니다.'
    : `${blocked}건이 아직 막혀 있습니다. 위 링크에서 활용신청 후 다시 실행해 주세요.`);
})();
