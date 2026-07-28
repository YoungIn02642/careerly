/* POST /api/cas/analyze
   반정형 스펙 텍스트(예시 양식)를 받아 LLM 으로 다음을 수행한다:
     1) 정성 활동을 CAS 폼의 정해진 enum(유형·기간·역할/단계·결과물)으로 정규화
     2) 유형 미기입·역할 미기입 등 빈칸을 맥락으로 추론(반정형 보정)
     3) 각 활동 원점수와 정성 총점(0~600)을 산정하고 근거를 남김
     4) 정량 스펙(학점/어학/자격증)도 구조화

   사용자 결정: "AI가 점수까지 산정" + "반정형 입력" + 무료 AI.
   원래 Gemini 로 붙였으나 사용자 구글 계정이 무료 티어 미지원(free_tier limit 0,
   프로젝트를 새로 만들어도 재발)이라 Groq 로 전환했고, 다시 **로컬 Ollama 기본**으로
   바꿨다(키·쿼터·네트워크 없이 동작). CAS_AI_PROVIDER=groq 로 두면 Groq 도 그대로 쓴다.

   채점 흔들림을 줄이려고 채점 루브릭(기본배점·배수표)을 cas.js 단일 출처에서
   읽어 그대로 프롬프트에 주입하고, JSON 강제 출력(response_format json_object)으로
   형식을 맞춘다. enum 은 서버에서 cas.js 기준으로 교정(coerce)한다.
   또한 cas.js 의 결정론 채점을 교차검증값으로 함께 반환한다. */
const express = require('express');
const CAS = require('../../../frontend/js/cas.js');   // 채점 루브릭·결정론 채점 재사용
const { ruleParse, parseDuration, outcomeFromText, durationFromSnippets, typicalDuration, normalizeRole } = require('../spec-parse');
const { classify: classifyCompany, CORP_TYPE_ID } = require('../company-classify');

const router = express.Router();

/* 프로바이더(Ollama/Groq) 호출은 ../ai-provider.js 로 빼두었다 — 직무역량 코치
   (routes/jdCoach.js)도 같은 겹을 쓴다. 모델 미설치 404·<think> 처리 등 8B 특유의
   처리가 그 안에 있다. */
const { callModel, modelLabel, PROVIDER } = require('../ai-provider');

/* cas.js 의 유효 enum 을 그대로 뽑아 프롬프트·교정에 쓴다(단일 출처). */
const TYPE_IDS   = CAS.ACTIVITY_TYPES.map(t => t.id);
const DURATIONS  = Object.keys(CAS.DURATION_MULT);
const ROLES      = Object.keys(CAS.ROLE_MULT);
const STAGES     = Object.keys(CAS.STAGE_MULT);
const OUTCOMES   = Object.keys(CAS.OUTCOME_MULT);

/* 루브릭을 사람이 읽는 표로 직렬화해 시스템 프롬프트에 넣는다. */
function rubricText() {
  const types = CAS.ACTIVITY_TYPES
    .map(t => `  - ${t.id} (${t.label}) 기본배점 ${t.base}, 역할축=${t.roleKind}`)
    .join('\n');
  const mult = (label, map) =>
    `  ${label}: ` + Object.entries(map).map(([k, v]) => `${k}×${v}`).join(', ');
  return [
    '유형별 기본배점(높을수록 가중치 큼 — 인턴십>공모전>프로젝트 순):',
    types,
    '활동 1건 원점수 = 기본배점 × 기간배수 × 역할(또는 연구단계)배수 × 결과물배수',
    mult('기간배수', CAS.DURATION_MULT),
    mult('역할배수', CAS.ROLE_MULT),
    mult('연구단계배수', CAS.STAGE_MULT),
    mult('결과물배수', CAS.OUTCOME_MULT),
  ].join('\n');
}

/* ⚠ 지금 이 프롬프트는 호출되지 않는다. 규칙 파서를 넣은 뒤로는 AI 에 "분류"만
   맡기므로 아래 SYSTEM_CLASSIFY 만 쓴다. 채점 루브릭을 프롬프트로 주입한 원형이라
   기록을 남길 목적으로 둔다 — 되살릴 때는 8B 가 곱셈을 틀린다는 것(rescore 주석)을
   먼저 읽을 것. */
const SYSTEM = `당신은 한국 대학생 커리어 플랫폼 careerly 의 CAS(Career Asset Score) 정성 스펙 분석기다.
사용자가 반정형(부분적으로만 구조화된) 스펙 텍스트를 주면, 아래 규칙으로 분석해 JSON 만 출력한다.

[정성 활동 정규화]
- 각 활동을 반드시 아래 정해진 enum 값으로만 매핑한다. 임의 값 금지.
  · type: ${TYPE_IDS.join(' | ')}
  · duration: ${DURATIONS.join(' | ')}
  · role(팀형/동아리형 활동만, 없으면 null): ${ROLES.join(' | ')}
  · stage(research 유형만, 없으면 null): ${STAGES.join(' | ')}
  · outcome: ${OUTCOMES.join(' | ')}
- 빈칸/미기입은 아래 규칙으로 채우고, 채운 항목은 assumed:true 로 표시한다.
  근거 없이 과하게 좋은 값으로 채우지 말 것.
  · 기간 미기입: 함께 주어지는 [참고자료]와 그 활동의 통상적인 운영 기간으로 추정한다
    (예: 해커톤·공모전 본선은 보통 1개월 미만, 대기업 하계 인턴십은 1~3개월).
  · 역할 미기입: 반드시 '팀원'(연구 유형이면 stage='학부연구생').
  · 성과·결과물 미기입: 반드시 '결과물 없음'. 단 '수상/입상/우수상' 등이 적혀 있으면 '수상'.
- '직무 미입력' 같이 점수와 무관한 자유서술은 무시한다.

[채점 루브릭 — 아래 표를 반드시 그대로 적용]
${rubricText()}
- 각 활동 rawScore 는 위 곱셈식으로 계산한다.
- 정성 총점(qualTotal, 0~600): 상위 최대 6개 활동 rawScore 합(qualRaw)을 합격자 평균
  원점수(기준 ${CAS.DEFAULT_QUAL_BENCH}) 대비 상대평가로 환산한다. 평균과 동률이면 만점의 80%,
  평균의 1.25배 이상이면 만점(600). 총점은 0~600 을 넘지 않는다.

[정량 파싱]
- gpa(학점), gpaMax(만점, 보통 4.5), certs(자격증 배열), lang(어학) 을 구조화한다.
  lang 은 { opic, toeic, toeicSpeaking, toefl } 중 해당되는 것만, 없으면 null.

[출력 형식] 아래 JSON 스키마를 정확히 따르고, 그 외 텍스트는 절대 출력하지 않는다:
{
  "activities": [
    { "type": <enum>, "name": <string>, "duration": <enum>,
      "role": <enum|null>, "stage": <enum|null>, "outcome": <enum>,
      "assumed": <boolean>, "rawScore": <number>, "reason": <짧은 한국어 근거> }
  ],
  "qualTotal": <number>,
  "qualRationale": <짧은 한국어 근거 — 총점 숫자를 언급하지 말고, 어떤 활동을 어떤 유형으로
                    보고 무엇을 강점/약점으로 판단했는지 서술한다. 화면에 뜨는 총점은
                    서버가 다시 계산한 값이라 여기 숫자를 적으면 서로 어긋난다>,
  "quant": {
    "gpa": <number|null>, "gpaMax": <number|null>, "certs": [<string>],
    "lang": { "opic": <string|null>, "toeic": <number|null>,
              "toeicSpeaking": <string|null>, "toefl": <number|null> }
  }
}`;


/* 규칙 파서가 못 읽은 줄만 맡기는 "분류 전용" 프롬프트.
   점수·루브릭·정량 스키마가 빠져 위 SYSTEM 의 1/5 길이다. CPU 추론에서는
   프롬프트 길이가 그대로 대기시간이라, 이것만으로 체감 속도가 크게 달라진다.
   점수는 어차피 서버가 cas.js 로 다시 매기므로 모델에게 시킬 이유가 없다. */
const SYSTEM_CLASSIFY = `한국 대학생이 쓴 경력 문장을 활동 단위로 나눠 분류하고 JSON 만 출력한다.
한 줄에 활동이 여러 개 들어 있을 수 있다(줄글 한 문단이 통째로 올 수 있다).
그럴 때는 활동마다 따로 항목을 만들고, 기간·역할·성과는 반드시 그 활동에 적힌 것만 쓴다
— 다른 활동의 기간이나 수상 실적을 끌어다 붙이지 않는다. 적혀 있지 않으면 null 로 둔다.
type: ${TYPE_IDS.join(' | ')}
duration: ${DURATIONS.join(' | ')} (안 적혀 있으면 null)
durationText: 원문에 적힌 기간 표현을 그대로 옮긴다 (예 "6개월간", "2년", 없으면 null)
role: ${ROLES.join(' | ')} (안 적혀 있으면 "팀원")
stage: ${STAGES.join(' | ')} (type=research 일 때만, 아니면 null)
outcome: ${OUTCOMES.join(' | ')} (안 적혀 있으면 "결과물 없음")
outcomeText: 그 성과의 근거가 된 원문 표현을 그대로 옮긴다 (예 "대상을 받았습니다", 없으면 null)
  — 원문에 없는 성과를 지어내지 않는다. 특히 "정규직 전환"은 그렇게 적혀 있을 때만 쓴다.
name 은 기간·역할·성과 표현을 뺀 활동 이름만 남긴다.
출력: {"activities":[{"type":..,"name":..,"duration":..,"durationText":..,"role":..,"stage":..,"outcome":..,"outcomeText":..,"assumed":true}]}`;

/* ── 기간 미기입 보완: 웹에서 그 활동을 찾아본다 ─────────────────
   "2026년 AI챔피언 해커톤 대회 우수상" 처럼 기간이 없는 줄은 모델이 순전히 상상으로
   기간을 정하게 된다. 활동명으로 웹 스니펫을 긁어 [참고자료]로 같이 넘기면 근거가 생긴다.
   키가 필요 없는 DuckDuckGo HTML 엔드포인트를 쓰고, 실패·지연은 조용히 무시한다
   (이 단계가 없어도 분석 자체는 통상 기간 추정으로 진행돼야 한다). */
const HAS_DURATION = /\d+\s*(개월|년|주|일)|반년|한\s*학기|장기|단기|미만|이상/;
const WEB_SEARCH   = process.env.CAS_WEB_SEARCH !== '0';
const WEB_TIMEOUT  = Number(process.env.CAS_WEB_TIMEOUT_MS || 6000);
const MAX_LOOKUPS  = 3;                      // 지연이 선형으로 늘어나므로 상한을 둔다

async function searchSnippets(query) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; careerly/1.0)' },
    signal: AbortSignal.timeout(WEB_TIMEOUT),
  });
  if (!r.ok) return [];
  const html = await r.text();
  return [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 20)
    .slice(0, 6);        // 기간은 최빈값으로 뽑으므로 표본이 몇 개는 있어야 한다
}

async function researchDurations(text) {
  if (!WEB_SEARCH) return '';

  const targets = text.split('\n')
    .map(l => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(l => l.length > 3 && !HAS_DURATION.test(l))
    .slice(0, MAX_LOOKUPS);
  if (!targets.length) return '';

  const blocks = await Promise.all(targets.map(async line => {
    try {
      const snips = await searchSnippets(`${line} 활동 기간`);
      return snips.length ? `· "${line}"\n${snips.map(s => `   - ${s}`).join('\n')}` : '';
    } catch { return ''; }        // 오프라인·차단 시에도 분석은 계속된다
  }));

  const body = blocks.filter(Boolean).join('\n');
  return body
    ? `\n\n[참고자료 — 기간이 적히지 않은 활동을 웹에서 찾아본 결과. 기간 추정에만 쓰고, `
      + `여기 없는 성과를 지어내지 말 것]\n${body}`
    : '';
}

/* 모델이 넘긴 활동의 enum 을 cas.js 기준으로 교정한다.
   유효하지 않은 값은 결정론 채점에서 0점 처리되므로, 유효 목록에 없으면 버린다. */
const inList = (v, list) => (v != null && list.includes(v) ? v : null);

/* 모델이 규칙을 어기고 역할·성과를 비워 보내는 일이 잦다. 비어 있으면 화면의 셀렉트가
   빈칸으로 남고 결정론 채점에서도 배수 1로 떨어지므로, 서버에서 기본값을 못박는다.
   (사용자 결정: 역할 미기입 → '팀원', 성과 미기입 → '결과물 없음') */
const DEFAULT_ROLE    = '팀원';
const DEFAULT_STAGE   = '학부연구생';
const DEFAULT_OUTCOME = '결과물 없음';

/* 성과는 배수로 점수를 직접 밀어올린다("전환, 정규직 합격"이 가장 크다). 그런데 모델은
   근거 없이 이걸 붙이는 일이 있다 — 실측: "6개월간 인턴을 하며 백엔드 개발을 했고" 뿐인
   문장에 5회 중 3회 '전환, 정규직 합격'을 달았다(점수 144 → 168).
   그래서 원문 근거(outcomeText)를 함께 받아, 근거가 없으면 성과를 인정하지 않는다.
   근거는 있는데 규칙이 분류하지 못하는 표현(예 "특허 출원")이면 모델 판단을 살린다 —
   막으려는 건 '없는 근거를 지어내는 것'이지 '드문 성과'가 아니다. */
function resolveOutcome(a) {
  const evidence = a?.outcomeText ? String(a.outcomeText).trim() : '';
  if (!evidence) return DEFAULT_OUTCOME;
  return outcomeFromText(evidence) || inList(a?.outcome, OUTCOMES) || DEFAULT_OUTCOME;
}

function coerceActivity(a) {
  const type = inList(a?.type, TYPE_IDS);
  if (!type) return null;                       // 유형이 유효하지 않으면 채점 불가

  const roleKind = CAS.ACTIVITY_TYPES.find(t => t.id === type)?.roleKind;
  const role  = inList(a?.role, ROLES);
  const stage = inList(a?.stage, STAGES);

  /* 기간 구간은 모델에게 고르게 하지 않는다 — 라벨이 경계에서 겹쳐서('3개월~6개월'과
     '6개월~1년' 둘 다 "6개월"을 포함) 같은 입력에도 답이 갈린다. 실측: "6개월간"에
     '6개월~1년'을 골랐다. 규칙 파서는 경계를 위쪽 포함으로 보므로 '3개월~6개월'이 맞다.
     모델에게는 원문 표현(durationText)만 받고 구간은 parseDuration 이 정한다. rescore() 와 같은 원칙. */
  const fromText = a?.durationText ? parseDuration(String(a.durationText)) : null;

  return {
    type,
    name: String(a?.name || '').trim(),
    duration: fromText || inList(a?.duration, DURATIONS),   // 기간은 추정 근거가 없으면 비워 둔다
    // 유형마다 고를 수 있는 역할이 다르다(연구=단계, 교환학생=없음, 동아리=임원진/동아리원).
    role:  normalizeRole(roleKind, role),
    stage: roleKind === 'stage' ? (stage || DEFAULT_STAGE) : null,
    outcome: resolveOutcome(a),
    assumed: !!a?.assumed,
    reason: String(a?.reason || ''),
  };
}

/* 모델이 낸 rawScore 는 믿지 않는다 — 로컬 8B 는 근거(reason)엔 곱셈 결과를 써놓고
   rawScore 엔 기본배점만 넣는 식으로 자주 어긋난다. enum 만 받고 점수는 cas.js 로 다시 낸다. */
function rescore(a) {
  return { ...a, rawScore: Math.round(CAS.scoreActivity(a) * 10) / 10 };
}

/* 규칙 파서가 유형은 잡았지만 기간이 없는 활동을 웹 스니펫 → 통상 기간 순으로 채운다.
   사용자 결정: "기간이 안 적혀 있으면 인터넷에서 찾아보고, 그래도 모르면 통상 기간". */
async function fillDurations(activities) {
  const missing = activities.filter(a => !a.duration).slice(0, MAX_LOOKUPS);

  await Promise.all(missing.map(async a => {
    try {
      const snips = await searchSnippets(`${a.name} 진행 기간`);
      const found = durationFromSnippets(snips);
      if (found) { a.duration = found; a.reason = `기간이 적혀 있지 않아 웹 검색으로 추정했습니다.`; }
    } catch { /* 오프라인이면 아래 통상 기간으로 넘어간다 */ }
  }));

  for (const a of activities) {
    if (!a.duration) {
      a.duration = typicalDuration(a);
      a.reason = '기간이 적혀 있지 않아 해당 활동의 통상 기간으로 추정했습니다.';
    }
  }
  return activities;
}

/* AI 를 건너뛰었거나 AI 가 총평을 안 줬을 때 쓰는 설명. 총점 숫자는 넣지 않는다
   (화면 총점은 서버가 다시 계산한 결정론 값이라 숫자를 적으면 어긋난다). */
function localRationale(activities) {
  if (!activities.length) return '';
  // 라벨이 '학부연구생·석사·박사'처럼 나열형인 유형이 있어 첫 항목만 쓴다.
  const label = id => ((CAS.ACTIVITY_TYPES.find(t => t.id === id) || {}).label || id).split('·')[0];
  const list = activities
    .map(a => `${a.name}(${label(a.type)}·${a.duration}·${a.stage || a.role || '-'}·${a.outcome})`)
    .join(', ');
  const guessed = activities.filter(a => a.assumed).length;
  return `입력하신 문장에서 ${activities.length}건의 활동을 인식했습니다: ${list}.`
    + (guessed ? ` 이 중 ${guessed}건은 기간·역할·성과가 적혀 있지 않아 추정값으로 채웠으니 확인해 주세요.` : '');
}

/* 인턴십은 회사 규모가 배수(cas.js COMPANY_MULT)로 들어간다. 활동명에서 회사를 찾아
   기존 company-classify 로 판정해 붙인다. "삼성전자 하계인턴" 처럼 활동명에 수식어가
   섞여 있으므로 어절을 앞에서부터 잘라가며 등록된 회사명을 찾는다.
   못 찾으면 tier 를 붙이지 않는다 → ×1.0 이라 기존 점수와 같다. */
function attachCompanyTier(activities) {
  for (const a of activities) {
    if (a.type !== 'internship' || a.companyTier) continue;

    const words = String(a.name || '').split(/\s+/).filter(Boolean);
    for (let n = words.length; n >= 1; n--) {
      const cand = words.slice(0, n).join(' ');
      const hit = classifyCompany(cand);
      if (hit && hit.matched) {
        a.companyTier = CORP_TYPE_ID[hit.type];
        a.companyName = cand;
        break;
      }
    }
  }
  return activities;
}

/* 같은 활동이 규칙·AI 양쪽에서 나오면 중복된다. 이름이 서로를 포함하면 같은 건으로 본다. */
const sameActivity = (a, b) => {
  const x = a.name.replace(/\s/g, ''), y = b.name.replace(/\s/g, '');
  return a.type === b.type && !!x && !!y && (x.includes(y) || y.includes(x));
};

router.post('/analyze', async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: '분석할 스펙 텍스트(text)가 없습니다.' });

  /* 1차: 규칙 파서. 로컬 8B 는 이런 짧은 한국어 줄도 type='other' 로 뭉개는 일이 잦아,
     확실히 알아볼 수 있는 줄은 AI 를 거치지 않는다(정확도 ↑, 응답 4분 → 즉시).
     AI 는 규칙이 못 읽은 줄과 총평에만 쓴다. */
  const rule = ruleParse(text);

  try {
    let activities = rule.activities;
    let ai = {};
    let aiError = null;

    /* 규칙이 모든 줄을 읽었으면 AI 호출 자체를 건너뛴다. 남은 줄이 있을 때만 AI 를 부른다. */
    if (rule.unparsedLines.length) {
      try {
        // 기간이 안 적힌 줄만 웹에서 찾아 참고자료로 덧붙인다(실패해도 그냥 진행).
        const research = await researchDurations(rule.unparsedLines.join('\n')).catch(() => '');
        ai = JSON.parse(await callModel(rule.unparsedLines.join('\n') + research, SYSTEM_CLASSIFY));

        const aiActs = (Array.isArray(ai.activities) ? ai.activities : [])
          .map(coerceActivity)
          .filter(Boolean)
          .filter(a => !activities.some(r => sameActivity(r, a)));
        activities = activities.concat(aiActs);

        /* 활동이 여러 개 섞여 있어 규칙이 단정하지 않은 줄이 있었다. AI 가 답했으므로
           그쪽을 쓰고 규칙의 예비 해석은 버린다. 단 AI 가 그 줄에서 아무것도 못 건졌으면
           예비라도 있는 편이 낫다(빈손으로 돌려주지 않는다). */
        if (!aiActs.length && rule.fallbackActivities.length) {
          activities = activities.concat(
            rule.fallbackActivities.filter(f => !activities.some(r => sameActivity(r, f))));
        }
      } catch (e) {
        /* AI 가 죽어도 규칙으로 읽은 활동은 돌려준다 — 전체 실패보다 낫다.
           단정하지 않기로 했던 줄도 이때는 예비 해석을 쓴다(없는 것보다 낫다).
           규칙도 아무것도 못 읽었을 때만 진짜 오류로 올린다. */
        activities = activities.concat(
          rule.fallbackActivities.filter(f => !activities.some(r => sameActivity(r, f))));
        if (!activities.length) throw e;
        aiError = e.message;
        console.warn('CAS analyze — AI 보조 실패, 규칙 결과만 반환:', e?.message);
      }
    }

    await fillDurations(activities);
    attachCompanyTier(activities);          // 인턴십 기업 규모 배수
    activities = activities.map(rescore);

    /* 화면에 띄우는 정성 총점은 이 값이다(프론트 spec-form.js).
       스펙을 저장하면 로드맵·레이더는 저장된 activities 로 computeQual 을 다시 돌리므로,
       결정론 값을 보여줘야 "입력할 때 본 점수"와 "저장 후 점수"가 일치한다.
       AI 총점은 상대평가 환산 산수를 자주 틀린다(같은 입력에 595/360). 활동 분류는
       믿을 만하고 그게 여기 입력으로 들어가므로, 버리는 건 AI 의 곱셈뿐이다. */
    const deterministic = CAS.computeQual({ spec: { activities } });

    /* 정량은 규칙으로 잡은 값이 우선(오탈자 없이 정확하다). AI 는 규칙이 비운 칸만 메운다. */
    const aiQuant = ai.quant || {};
    const quant = {
      gpa:    rule.quant.gpa    ?? aiQuant.gpa    ?? null,
      gpaMax: rule.quant.gpaMax ?? aiQuant.gpaMax ?? null,
      certs:  Array.isArray(aiQuant.certs) ? aiQuant.certs : [],
      lang:   rule.quant.lang   ?? aiQuant.lang   ?? null,
    };

    res.json({
      provider: PROVIDER,
      model: modelLabel(),
      activities,
      qual: {
        aiTotal: Math.max(0, Math.min(CAS.TOTAL_QUAL, Math.round(Number(ai.qualTotal) || 0))),
        deterministicTotal: deterministic.total,   // 화면 표시용 정본
        rationale: String(ai.qualRationale || '') || localRationale(activities),
        raw: deterministic.raw,
        benchRaw: deterministic.benchRaw,
      },
      quant,
      notice: aiError ? 'AI 보조 분석은 실패해서, 문장에서 직접 인식한 활동만 채웠어요.' : undefined,
    });
  } catch (e) {
    console.error('CAS analyze 실패:', e?.message);
    const status = e?.status || 502;
    // 503(설정이 덜 됨)·429(쿼터 초과)는 사용자가 할 일이 있으므로 문구를 그대로 보여준다.
    res.status(status).json({
      error: (status === 503 || status === 429) ? e.message : 'AI 분석에 실패했습니다.',
      detail: e?.message,
    });
  }
});

module.exports = router;
