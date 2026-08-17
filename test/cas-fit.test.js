/* 직무 적합도 채점 — backend/src/cas-fit.js

   CAS 가 '선배 비교' 에서 '업무특성 적합도' 로 바뀌었다(사용자 결정). 여기서 지키는 것은
   하나다 — **점수는 코드가 낸다.** AI 는 "내 활동이 이 특성을 뒷받침하는가" 만 답하고,
   그 매칭을 아래 규칙으로 환산한 값만 화면에 나간다. 그래야 같은 입력이면 같은 점수가
   나오고, 항목마다 왜 그 점수인지 짚을 수 있다(작업정리 6장·9장). */
const FIT = require('../backend/src/cas-fit.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

/* 실제 응답(버스운전원)에서 옮긴 모양 */
const traits = [
  { key: 'ability', label: '업무수행능력', what: '', items: [
    { name: '조작 및 통제', score: 99 }, { name: '시력', score: 97 }, { name: '움직임 통제', score: 95 }] },
  { key: 'knowledge', label: '지식', what: '', items: [
    { name: '운송', score: 95 }, { name: '지리', score: 86 }] },
];

// ── 1. 배점 ─────────────────────────────────────────────────
console.log('── 1. 축별 배점 ──');
ok('합이 1000점이다', FIT.TOTAL === 1000, `→ ${FIT.TOTAL}`);
/* 증명 가능한 축(능력·지식·활동)이 무겁고, 적성 검사 영역(성격·흥미·가치관)은 가볍다.
   성격을 무겁게 잡으면 "성실합니다" 같은 자기 주장이 점수가 된다. */
ok('증명 가능한 축이 더 무겁다',
   FIT.WEIGHTS.ability > FIT.WEIGHTS.character && FIT.WEIGHTS.knowledge > FIT.WEIGHTS.interest);
ok('가치관이 가장 가볍다',
   Math.min(...Object.values(FIT.WEIGHTS)) === FIT.WEIGHTS.value);

// ── 2. 근거가 없을 때 ────────────────────────────────────────
console.log('\n── 2. 근거가 없어도 0점은 아니다 ──');
/* 0 을 주면 신입은 거의 모든 항목이 0이라 총점이 바닥에 붙고, 화면이 "당신은 이 직업에
   안 맞습니다" 로 읽힌다. 실제로는 아직 증명하지 못했을 뿐이다. */
const empty = FIT.compute({ traits, matches: [] });
ok('매칭이 없어도 채점된다', empty !== null);
ok('바닥값이 적용된다', empty.percent === Math.round(FIT.BASE_FLOOR * 100),
   `→ ${empty.percent}% (BASE_FLOOR ${FIT.BASE_FLOOR})`);
ok('모든 축이 같은 비율', new Set(empty.axes.map(a => a.ratio)).size === 1);

// ── 3. 매칭이 점수를 올린다 ──────────────────────────────────
console.log('\n── 3. 강도가 점수에 반영된다 ──');
const strong = FIT.compute({ traits, matches: [
  { axis: 'ability', trait: '조작 및 통제', strength: 3, evidence: '로봇 제어', from: '로봇 동아리' }] });
const weak = FIT.compute({ traits, matches: [
  { axis: 'ability', trait: '조작 및 통제', strength: 1, evidence: '잠깐', from: '수업' }] });
ok('강도가 높을수록 점수가 높다', strong.total > weak.total, `→ ${strong.total} vs ${weak.total}`);
ok('매칭이 있으면 바닥값보다 높다', weak.total > empty.total);

/* **중요도로 가중하는 것이 핵심이다.** '조작 및 통제(99)' 와 '시력(97)' 을 같은 무게로
   세면 직업의 성격이 사라진다. */
const hi = FIT.compute({ traits, matches: [{ axis: 'knowledge', trait: '운송', strength: 3 }] });
const lo = FIT.compute({ traits, matches: [{ axis: 'knowledge', trait: '지리', strength: 3 }] });
ok('중요도가 높은 항목을 채우면 더 오른다', hi.total > lo.total, `→ 운송(95) ${hi.total} vs 지리(86) ${lo.total}`);

// ── 4. 모델이 흔들려도 점수는 안 흔들린다 ────────────────────
console.log('\n── 4. 같은 입력이면 같은 점수 ──');
const a1 = FIT.compute({ traits, matches: [{ axis: 'ability', trait: '시력', strength: 2 }] });
const a2 = FIT.compute({ traits, matches: [{ axis: 'ability', trait: '시력', strength: 2 }] });
ok('두 번 돌려도 같다', a1.total === a2.total);
/* 모델이 같은 항목을 두 번 내는 일이 잦다. 강한 쪽만 남긴다. */
const dup = FIT.compute({ traits, matches: [
  { axis: 'ability', trait: '시력', strength: 1 },
  { axis: 'ability', trait: '시력', strength: 3 }] });
const once = FIT.compute({ traits, matches: [{ axis: 'ability', trait: '시력', strength: 3 }] });
ok('같은 항목이 중복돼도 한 번만 센다', dup.total === once.total);
ok('강도 범위를 벗어나면 잘라낸다',
   FIT.compute({ traits, matches: [{ axis: 'ability', trait: '시력', strength: 99 }] }).total === once.total);
ok('모르는 축·항목은 무시한다',
   FIT.compute({ traits, matches: [{ axis: 'zzz', trait: '없는것', strength: 3 }] }).total === empty.total);

// ── 5. 빠진 축 ───────────────────────────────────────────────
console.log('\n── 5. 자료가 없는 축은 남은 축으로 나눈다 ──');
/* 빈 축을 0점으로 두면 자료가 부족한 직업일수록 점수가 낮아진다.
   그건 사람의 적합도가 아니라 데이터의 문제다. */
const partial = FIT.compute({ traits, matches: [] });
ok('두 축만 있어도 만점은 1000', partial.max === 1000);
ok('배점이 남은 축으로 재분배된다',
   partial.axes.reduce((n, a) => n + a.weight, 0) === 1000,
   `→ ${partial.axes.map(a => a.label + ' ' + a.weight).join(', ')}`);

// ── 6. 무엇부터 채울까 ───────────────────────────────────────
console.log('\n── 6. 점수만 주면 학생이 할 수 있는 일이 없다 ──');
ok('채울 항목을 알려준다', empty.gaps.length > 0);
ok('중요도가 높은 것이 먼저다', empty.gaps[0].importance >= empty.gaps[1].importance,
   `→ ${empty.gaps[0].name}(${empty.gaps[0].importance})`);
ok('채운 항목은 빠진다',
   !strong.gaps.some(g => g.name === '조작 및 통제'));
ok('어느 축인지 같이 준다', empty.gaps.every(g => g.axisLabel));

// ── 7. 등급 ──────────────────────────────────────────────────
console.log('\n── 7. 등급 ──');
ok('높으면 매우 적합', FIT.gradeOf(90) === '매우 적합');
ok('낮으면 준비 필요', FIT.gradeOf(20) === '준비 필요');
ok('경계값도 답이 있다', typeof FIT.gradeOf(0) === 'string' && typeof FIT.gradeOf(100) === 'string');

// ── 8. 빈 입력 ───────────────────────────────────────────────
console.log('\n── 8. 업무특성이 없으면 채점하지 않는다 ──');
ok('빈 traits 는 null', FIT.compute({ traits: [], matches: [] }) === null,
   '없는 자료로 점수를 지어내지 않는다');
ok('items 가 비어도 null', FIT.compute({ traits: [{ key: 'ability', items: [] }], matches: [] }) === null);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
