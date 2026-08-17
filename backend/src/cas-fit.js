/* ══════════════════════════════════════════════════════════════
   CAS = 직무 적합도 1000점 — 업무특성 기준 채점

   ── 무엇이 바뀌었나 (사용자 결정) ──
   예전 CAS 는 "같은 직무로 간 선배들보다 내가 높은가" 였다. 이제는
   **"이 직업이 실제로 요구하는 것을 내가 갖췄는가"** 다. 기준이 선배 평균에서
   임금직업정보시스템의 업무특성으로 바뀌었다.

   선배 비교가 나쁜 기준이어서가 아니라, 답하는 질문이 다르다:
     선배 비교 → "내가 남들보다 앞서 있나"  (표본이 적으면 아예 답을 못 한다)
     업무특성   → "이 일에 내가 맞나"        (선배가 0명이어도 답할 수 있다)
   후자가 로드맵 2단계('지금 내 위치')가 원래 묻고 싶던 것이다.

   ── AI 는 매칭만, 점수는 코드가 낸다 (사용자 결정) ──
   이 저장소의 원칙이다(작업정리 6장·9장). 모델에는
     "내 활동 A 가 업무특성 B 를 얼마나 뒷받침하는가"
   만 물어 **근거 문장과 강도(0~3)** 를 받고, 그걸 아래 가중치표로 환산해 점수를 만든다.
   같은 입력이면 같은 점수가 나오고, 왜 그 점수인지 항목마다 짚을 수 있다.
   모델이 "780점" 이라고 말해도 우리는 그 숫자를 쓰지 않는다.

   ── 축마다 무게가 다른 이유 ──
   업무특성 7축이 다 같은 성격이 아니다.
     능력·지식·활동 : 활동·자격증·수업으로 **증명할 수 있다** → 무겁게
     환경           : 겪어 봤는지가 드러난다(실외·교대·마감) → 중간
     성격·흥미·가치관: 적성 검사의 영역이라 스펙으로 증명되지 않는다 → 가볍게
   성격·흥미를 무겁게 잡으면 "성실합니다" 같은 자기 주장이 점수가 된다. 그건 CAS 가
   처음부터 피하려던 것이다.
   ══════════════════════════════════════════════════════════════ */

/* 축별 배점 (합 1000). wage-traits.AXES 의 key 와 1:1. */
const WEIGHTS = {
  ability:   260,
  knowledge: 240,
  activity:  200,
  env:       120,
  character:  80,
  interest:   60,
  value:      40,
};
const TOTAL = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);   // 1000

/* 모델이 매기는 강도 → 그 항목을 얼마나 채운 것으로 볼지(0~1).
   ── 왜 4단계인가 ──
   0/1 이면 "조금 해봤다" 를 표현할 수 없고, 10단계면 모델이 3과 4를 일관되게
   구분하지 못한다(실측: 같은 입력에 3↔5 가 오갔다). 4단계는 모델이 안정적으로
   고르면서 부분 점수도 표현된다. */
const STRENGTH = { 0: 0, 1: 0.35, 2: 0.7, 3: 1 };

/* 근거가 없는 항목에 주는 최소 점수. 0 을 주면 신입은 거의 모든 항목이 0이라
   총점이 바닥에 붙어 화면이 "당신은 이 직업에 안 맞습니다" 로 읽힌다. 실제로는
   **아직 증명하지 못했을 뿐**이라, 그 차이를 점수에 담는다. */
const BASE_FLOOR = 0.15;

const clamp01 = n => Math.max(0, Math.min(1, n));

/* ── 한 축의 점수 ────────────────────────────────────────────────
   항목마다 (그 항목의 중요도) × (내가 얼마나 채웠는가) 를 곱해 더하고, 축의 만점으로
   정규화한다. **중요도로 가중하는 것이 핵심이다** — 버스운전원의 '조작 및 통제(99)'
   와 '경제와 회계(59)' 를 같은 무게로 세면 직업의 성격이 사라진다. */
function scoreAxis(items, matchByName, weight) {
  const rows = (items || []).filter(i => Number.isFinite(i.score) && i.score > 0);
  if (!rows.length) return null;

  const max = rows.reduce((n, i) => n + i.score, 0);
  let got = 0;
  const detail = [];

  for (const item of rows) {
    const m = matchByName.get(item.name);
    const strength = m ? (STRENGTH[m.strength] ?? 0) : 0;
    const filled = clamp01(Math.max(strength, BASE_FLOOR));
    got += item.score * filled;
    detail.push({
      name: item.name,
      importance: item.score,
      strength: m ? m.strength : 0,
      /* 근거는 모델이 고른 **사용자의 활동 이름과 한 줄 설명**이다. 없으면 빈 값 —
         지어내지 않는다. 화면은 근거 없는 항목을 '아직 못 채운 것' 으로 보여준다. */
      evidence: m?.evidence || '',
      from: m?.from || '',
    });
  }

  return {
    /* 만점 대비 비율을 축 배점에 곱한다. 반올림은 마지막에 한 번만 —
       축마다 반올림하면 합이 1000을 넘거나 모자란다. */
    ratio: max ? got / max : 0,
    points: weight * (max ? got / max : 0),
    detail: detail.sort((a, b) => b.importance - a.importance),
  };
}

/* ── 총점 ────────────────────────────────────────────────────────
   traits : wage-traits.topTraits() 결과 ([{ key, label, items }])
   matches: 모델이 낸 매칭 [{ axis, trait, strength, evidence, from }]
   축이 빠져 있으면(그 직업에 그 자료가 없으면) 그 축의 배점을 **남은 축에 나눠 준다** —
   빈 축을 0점으로 두면 자료가 부족한 직업일수록 점수가 낮아진다. 그건 사람의
   적합도가 아니라 데이터의 문제다. */
function compute({ traits, matches }) {
  const byAxis = new Map();
  for (const m of matches || []) {
    const axis = String(m?.axis || '').trim();
    const trait = String(m?.trait || '').trim();
    if (!axis || !trait) continue;
    if (!byAxis.has(axis)) byAxis.set(axis, new Map());
    /* 같은 항목이 두 번 오면 강한 쪽을 남긴다(모델이 종종 중복해서 낸다). */
    const cur = byAxis.get(axis).get(trait);
    const next = {
      strength: Math.max(0, Math.min(3, Number(m.strength) || 0)),
      evidence: String(m.evidence || '').trim(),
      from: String(m.from || '').trim(),
    };
    if (!cur || next.strength > cur.strength) byAxis.get(axis).set(trait, next);
  }

  const present = (traits || []).filter(a => a.items?.length);
  if (!present.length) return null;

  const weightSum = present.reduce((n, a) => n + (WEIGHTS[a.key] || 0), 0);
  const scale = weightSum ? TOTAL / weightSum : 1;   // 빠진 축의 배점을 나머지로 옮긴다

  const axes = [];
  let total = 0;
  for (const a of present) {
    const weight = (WEIGHTS[a.key] || 0) * scale;
    const s = scoreAxis(a.items, byAxis.get(a.key) || new Map(), weight);
    if (!s) continue;
    total += s.points;
    axes.push({
      key: a.key, label: a.label, what: a.what,
      weight: Math.round(weight),
      points: Math.round(s.points),
      ratio: Math.round(s.ratio * 100),
      detail: s.detail,
    });
  }

  const rounded = Math.round(total);
  const percent = Math.round((rounded / TOTAL) * 100);
  return {
    total: rounded,
    max: TOTAL,
    /* 백분율·등급도 여기서 낸다. 라우트가 따로 계산하면 화면마다 반올림이 갈리고,
       '점수는 코드가 낸다' 는 규칙의 경계도 흐려진다. */
    percent,
    grade: gradeOf(percent),
    axes,
    /* 무엇을 채우면 점수가 오르는지 — 중요도가 높은데 근거가 없는 항목부터.
       "점수가 낮다" 만 보여주면 학생이 할 수 있는 일이 없다. */
    gaps: topGaps(axes),
  };
}

/* 중요도 × 못 채운 정도가 큰 순. 축을 가로질러 섞는 이유는 학생이 축 단위로
   움직이지 않기 때문이다 — '무엇부터 할까' 한 줄이면 된다. */
function topGaps(axes, limit = 6) {
  const rows = [];
  for (const a of axes) {
    for (const d of a.detail) {
      const missing = 1 - clamp01(Math.max(STRENGTH[d.strength] ?? 0, BASE_FLOOR));
      if (missing <= 0) continue;
      rows.push({
        axis: a.key, axisLabel: a.label, name: d.name,
        importance: d.importance,
        loss: d.importance * missing * (a.weight / 1000),
      });
    }
  }
  return rows.sort((a, b) => b.loss - a.loss).slice(0, limit)
    .map(({ loss, ...r }) => r);
}

/* 등급 — 예전 CAS 와 같은 말을 쓴다. 학생이 두 점수를 같은 자로 읽게 하려는 것이다. */
const GRADES = [
  { min: 85, label: '매우 적합' },
  { min: 70, label: '적합' },
  { min: 50, label: '보통' },
  { min: 0,  label: '준비 필요' },
];
const gradeOf = pct => (GRADES.find(g => pct >= g.min) || GRADES[GRADES.length - 1]).label;

module.exports = { compute, scoreAxis, topGaps, gradeOf, WEIGHTS, TOTAL, STRENGTH, BASE_FLOOR, GRADES };
