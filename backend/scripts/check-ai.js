/* AI 프로바이더 점검 — .env 설정만으로 AI 분석이 실제로 동작하는지 확인한다.

     node scripts/check-ai.js

   서버를 띄우지 않고 src/ai-provider.js 를 직접 불러 한 번 호출해 본다.
   화면에서 "AI 분석에 실패했습니다"를 보고 원인을 추측하는 대신, 여기서
   프로바이더·모델·응답을 눈으로 확인하는 용도다. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { callModel, modelLabel, PROVIDER, GROQ_MODEL, draftProvider, draftModel } = require('../src/ai-provider');
const GEMINI = require('../src/ai-gemini');

(async () => {
  {
    const key = (process.env.GROQ_API_KEY || '').trim();
    console.log(`프로바이더      = ${PROVIDER}`);
    console.log(`GROQ_MODEL      = ${GROQ_MODEL}`);
    console.log(`GROQ_API_KEY    = ${key ? `${key.slice(0, 4)}… (${key.length}자)` : '(비어 있음)'}`);
    if (!key) {
      console.log('\n✗ 키가 없습니다. https://console.groq.com/keys 에서 발급(무료·카드 불필요) 후');
      console.log('  backend/.env 의 GROQ_API_KEY= 뒤에 붙여넣고 다시 실행하세요.');
      return;
    }
  }
  console.log();

  /* 실제 기능과 같은 모양의 요청 — JSON 강제 출력이 통하는지까지 본다. */
  const started = Date.now();
  let raw;
  try {
    raw = await callModel(
      '카카오에서 6개월 인턴을 했고, 교내 창업 공모전에서 대상을 받았습니다.',
      '너는 한국 대학생의 경력 문장에서 활동을 뽑는다. '
      + '반드시 {"activities":[{"type":"...","name":"..."}]} 형태의 JSON 만 출력한다.',
      { num_predict: 256 },
    );
  } catch (e) {
    console.log(`✗ 호출 실패 (status ${e?.status || '-'})`);
    console.log(`  ${e.message}`);
    return;
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`✓ 응답 도착 — 모델 ${modelLabel()} · ${secs}초`);
  try {
    const parsed = JSON.parse(raw);
    console.log('✓ JSON 파싱 성공');
    (parsed.activities || []).forEach(a => console.log(`   · ${a.type} — ${a.name}`));
    if (!parsed.activities) console.log(`   (activities 키 없음) ${raw.slice(0, 200)}`);
  } catch {
    console.log(`✗ JSON 이 아닌 응답: ${String(raw).slice(0, 200)}`);
    return;
  }

  console.log();
  console.log('이제 스펙 입력의 "AI로 한 번에 입력", 자소서 코치 AI 보강이 동작합니다.');
  if (secs > 10) {
    console.log('(Groq 치고 느립니다 — 네트워크나 쿼터 대기를 의심해 보세요.)');
  }

  /* ── 자소서 초안 라우팅 점검 ────────────────────────────────
     초안(/api/jd/draft·/motive)은 GEMINI_API_KEY 가 있으면 Gemini 로 간다.
     무엇으로 가는지, Gemini 라면 실제로 되는지까지 눈으로 확인한다. */
  console.log();
  console.log(`자소서 초안 라우팅 = ${draftProvider()} / ${draftModel()}`);
  if (!GEMINI.isConfigured()) {
    console.log('  GEMINI_API_KEY 가 없어 초안도 Groq 로 씁니다(정상). Gemini 로 바꾸려면');
    console.log('  https://aistudio.google.com/apikey 에서 발급 후 .env 의 GEMINI_API_KEY= 에 넣으세요.');
    return;
  }
  const gStart = Date.now();
  try {
    const graw = await GEMINI.callModel(
      '데이터 분석 인턴 경험을 한 문단으로.',
      '반드시 {"draft":"..."} 형태의 한국어 JSON 만 출력한다.',
      { num_predict: 400 },
    );
    const gsecs = ((Date.now() - gStart) / 1000).toFixed(1);
    JSON.parse(graw);
    console.log(`✓ Gemini 응답·JSON 파싱 성공 — 모델 ${GEMINI.modelLabel()} · ${gsecs}초`);
    console.log('  자소서 AI 초안이 Gemini 로 동작합니다.');
  } catch (e) {
    console.log(`✗ Gemini 호출 실패 (status ${e?.status || '-'})`);
    console.log(`  ${e.message}`);
    console.log('  (키 문제면 초안이 이 오류로 막힙니다 — 고치거나 GEMINI_API_KEY 를 비우면 Groq 로 돌아갑니다.)');
  }
})();
