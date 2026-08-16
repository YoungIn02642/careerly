/* 스펙업 화면이 쓰는 외부 API 두 개가 실제로 열려 있는지 확인한다.

     node scripts/check-specup-api.js

   check-api-access.js · check-news-api.js 와 같은 목적이다 — 서버를 띄우지 않고
   "키 문제인지, 활용신청 문제인지, 코드 문제인지" 를 갈라 준다. 이 저장소에서
   가장 많이 잡아먹은 시간이 그 셋을 구분하지 못한 시간이었다(작업정리 3-1).

   ── 성공하면 원본 item 을 그대로 찍는다 ──
   시험일정 API 는 활용신청 전이라 실제 응답을 아직 못 봤다. 공정위(entrprsNm)와
   고용24(coNm) 는 **명세서 표가 틀려서** 한참 헤맸다. 그래서 여기서 첫 item 을
   날것 그대로 출력한다. 승인되면 그 출력과 src/specup.js 의 toRound() 필드 이름을
   맞춰 볼 것.
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const specup = require('../src/specup');

const YEAR = Number(process.argv[2]) || new Date().getFullYear();

const line = () => console.log('─'.repeat(64));

async function checkExam() {
  console.log('\n① 국가자격 시험일정 (data.go.kr 15074408)');
  line();
  const key = (process.env.DATA_GO_KR_SERVICE_KEY || '').trim();
  if (!key) {
    console.log('  ✗ DATA_GO_KR_SERVICE_KEY 가 비어 있습니다.');
    console.log(`    → backend/.env 에 넣고 ${specup.EXAM_APPLY_URL} 에서 활용신청하세요.`);
    return;
  }
  console.log(`  키: ${key.slice(0, 8)}… (${key.length}자)`);

  const url = `${specup.EXAM_API}?serviceKey=${encodeURIComponent(key)}`
    + `&implYy=${YEAR}&numOfRows=3&pageNo=1&dataFormat=xml`;
  let res, body;
  try {
    res = await fetch(url);
    body = await res.text();
  } catch (e) {
    console.log(`  ✗ 호출 자체가 실패했습니다: ${e.message}`);
    return;
  }

  const err = specup.gatewayError(res.status, body);
  if (err) {
    console.log(`  ✗ ${err.error}  [${err.reason}]`);
    if (err.how) console.log(`    → ${err.how}`);
    return;
  }

  const items = specup.parseItems(body);
  if (!items.length) {
    console.log(`  △ 인증은 통과했는데 ${YEAR}년 항목이 0건입니다.`);
    console.log('    응답 앞부분:', body.replace(/\s+/g, ' ').slice(0, 300));
    return;
  }

  console.log(`  ✓ 승인됨 — ${YEAR}년 ${items.length}건 수신`);
  console.log('\n  [원본 item 1건 — 이 필드 이름이 specup.js toRound() 와 맞는지 볼 것]');
  console.log(JSON.stringify(items[0], null, 2).split('\n').map(l => '    ' + l).join('\n'));

  const round = specup.toRound(items[0]);
  console.log('\n  [해석 결과]');
  if (!round) {
    console.log('    ✗ 날짜를 하나도 못 읽었습니다 — 위 필드 이름과 toRound() 가 어긋납니다.');
  } else {
    console.log(`    종목코드 ${round.code ?? '(못 읽음)'} · ${round.name ?? '(이름 못 읽음)'}`);
    console.log(`    필기접수 ${round.regStart ?? '?'} ~ ${round.regEnd ?? '?'} · `
      + `시험 ${round.examStart ?? '?'} · 상태 ${specup.phaseOf(round)}`);
    if (!round.code) console.log('    ⚠ 종목코드를 못 읽으면 자격증과 이어붙일 수 없습니다.');
  }
}

async function checkYouth() {
  console.log('\n② 공모전·대외활동 (온통청년 청년정책)');
  line();
  const key = (process.env.YOUTH_API_KEY || '').trim();
  if (!key) {
    console.log('  ✗ YOUTH_API_KEY 가 비어 있습니다.');
    console.log(`    → ${specup.YOUTH_APPLY_URL} 에서 인증키를 발급받아 backend/.env 에 넣으세요.`);
    console.log('      (온통청년 회원가입 → 마이페이지 → OPEN API. data.go.kr 키와 다릅니다)');
    return;
  }
  console.log(`  키: ${key.slice(0, 8)}… (${key.length}자)`);

  try {
    const data = await specup.youthActivities({ topic: 'contest' });
    console.log(`  ✓ ${data.items.length}건 수신 (${data.source})`);
    data.items.slice(0, 3).forEach(a =>
      console.log(`    · ${a.name} — ${a.org || '주관 미상'} (마감 ${a.endDate || a.period || '미상'})`));
    if (!data.items.length) {
      console.log('    △ 인증은 통과했는데 걸러 낸 결과가 0건입니다.');
      console.log('      specup.js ACTIVITY_TOPICS 의 키워드를 넓혀야 할 수 있습니다.');
    }
  } catch (e) {
    const p = e.payload;
    console.log(`  ✗ ${p ? p.error : e.message}${p ? `  [${p.reason}]` : ''}`);
    if (p?.how) console.log(`    → ${p.how}`);
  }
}

(async () => {
  console.log(`스펙업 외부 API 점검 (시행년도 ${YEAR})`);
  await checkExam();
  await checkYouth();
  console.log('\n두 API 가 다 막혀 있어도 스펙업 화면은 동작합니다 —');
  console.log('선배 보유율·CAS 부족 항목은 우리 DB 로 계산하고, 이 둘은 "지금 접수 중" 을 덧붙이는 층입니다.\n');
})();
