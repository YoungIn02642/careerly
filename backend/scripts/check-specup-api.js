/* 스펙업 화면이 쓰는 외부 API 두 개가 실제로 열려 있는지 확인한다.

     node scripts/check-specup-api.js

   check-api-access.js · check-news-api.js 와 같은 목적이다 — 서버를 띄우지 않고
   "키 문제인지, 활용신청 문제인지, 코드 문제인지" 를 갈라 준다. 이 저장소에서
   가장 많이 잡아먹은 시간이 그 셋을 구분하지 못한 시간이었다(작업정리 3-1).

   ── 원본 item 을 그대로 찍는다 ──
   승인 전 명세서만 보고 짠 코드가 세 군데 틀렸는데, 이 출력 덕에 첫 호출에서 다
   드러났다(specup.js 머리주석 '실호출로 바로잡은 것'). 규격이 또 바뀔 수 있으니
   출력은 그대로 둔다 — 파서를 고치기 전에 여기부터 본다.
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

  /* 종목을 하나 걸어서 부른다. 응답에는 종목 정보가 없고 요청의 jmCd 로만 걸러지므로,
     종목 없이 부르면 '이 자격의 일정' 인지 확인할 수가 없다. */
  const PROBE = process.argv[3] || '정보처리기사';
  const meta = specup.codeOf(PROBE);
  if (!meta) {
    console.log(`  ✗ '${PROBE}' 를 data/qnet-certs.json 에서 못 찾았습니다.`);
    return;
  }
  console.log(`  대조 종목: ${PROBE} (jmCd=${meta.code})`);

  const url = `${specup.EXAM_API}?serviceKey=${encodeURIComponent(key)}`
    + `&implYy=${YEAR}&jmCd=${meta.code}&numOfRows=${specup.EXAM_PER_PAGE}&pageNo=1&dataFormat=xml`;
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
  console.log('\n  [원본 item 1건 — 파서를 고치기 전에 여기부터 볼 것]');
  console.log(JSON.stringify(items[0], null, 2).split('\n').map(l => '    ' + l).join('\n'));

  const rounds = items.map(specup.toRound).filter(Boolean);
  console.log(`\n  [해석 결과] 회차 ${rounds.length}건 → 단계 ${specup.stagesOf(rounds).length}개`);
  if (!rounds.length) {
    console.log('    ✗ 날짜를 하나도 못 읽었습니다 — 위 필드 이름과 toRound() 가 어긋납니다.');
    return;
  }
  specup.stagesOf(rounds).slice(0, 6).forEach(s =>
    console.log(`    ${String(s.stage)} · ${s.label ?? '(라벨 없음)'}`
      + ` · 접수 ${s.regStart ?? '-'}~${s.regEnd ?? '-'}`
      + ` · 시험 ${s.examStart ?? '-'} · [${s.phase}]`));

  /* 화면이 실제로 받는 모양까지 한 번 태워 본다 — 파싱은 됐는데 고르기에서
     틀리는 경우를 여기서 잡는다. */
  const view = await specup.certSchedules([PROBE, 'SQLD']);
  console.log('\n  [화면에 내려가는 모양]');
  view.items.forEach(i => {
    if (!i.matched) return console.log(`    ${i.name}: ${i.note}`);
    if (!i.round)   return console.log(`    ${i.name}: ${i.note}`);
    const r = i.round;
    console.log(`    ${i.name}: ${r.stage} ${r.label} · ${r.phase}`
      + ` · 접수 ${r.regStart ?? '-'}~${r.regEnd ?? '-'}`
      + (r.daysToRegEnd != null ? ` (마감 D-${r.daysToRegEnd})` : '')
      + (r.daysToRegStart != null && r.phase === 'upcoming' ? ` (시작까지 ${r.daysToRegStart}일)` : ''));
  });
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
