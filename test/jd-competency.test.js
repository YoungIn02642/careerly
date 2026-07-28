/* 자소서 코치 — 역량 추출·소재 배분 테스트
   AI 는 여기서 다루지 않는다(호출하지 않으므로 결정론적이다). 이 파일이 지키는 것은
   "같은 공고를 넣으면 같은 가이드가 나온다"와 "약한 근거로 역량을 지어내지 않는다"다. */
const JD = require('../backend/src/jd-competency');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

const JD_TEXT = `[주요업무]
- 채널별 마케팅 성과 데이터 분석 및 리포트 작성
- 유관부서와 협업하여 프로모션 기획 및 실행
[자격요건]
- 데이터를 근거로 문제를 정의하고 개선안을 제안할 수 있는 분
- 엑셀, SQL 등 데이터 도구 활용 가능자
[우대사항]
- 고객 니즈 파악 및 UX 개선 경험
- 영어 커뮤니케이션 가능자`;

const ACTS = [
  { type: 'internship',     name: '카카오 데이터팀 인턴', duration: '3개월~6개월', role: '팀원', outcome: '결과물 없음' },
  { type: 'competition',    name: '교내 마케팅 공모전',   duration: '1개월 미만',  role: '팀장', outcome: '수상' },
  { type: 'extracurricular',name: '네이버 서포터즈',      duration: '6개월~1년',   role: '팀원', outcome: '결과물 없음' },
  { type: 'exchange',       name: '교환학생(캐나다)',     duration: '6개월~1년',   role: null,   outcome: '결과물 없음' },
];

const build = (found, acts, hasSpec = true) =>
  JD.spreadMaterials(found.map(e => JD.buildGuide({ ...e, source: 'rule' }, acts, hasSpec)));

console.log('── 1. 구역 머리말을 근거로 세지 않는가 ──');
const heads = JD.splitSentences('[자격요건]\n주요업무\n우대사항 :\n데이터 분석 경험자');
ok('머리말만 있는 줄은 버린다', heads.length === 1 && heads[0].includes('데이터'), `→ ${JSON.stringify(heads)}`);
ok('"[자격요건]" 때문에 전공지식이 잡히지 않는다',
   !JD.ruleExtract('[자격요건]\n성실한 분').found.some(f => f.id === 'expertise'));

console.log('\n── 2. 역량 추출 ──');
const r = JD.ruleExtract(JD_TEXT);
const ids = r.found.map(f => f.id);
ok('데이터 분석력이 1순위', ids[0] === 'data-analysis', `→ ${ids.join(', ')}`);
ok('협업이 잡힌다',   ids.includes('collaboration'));
ok('고객지향이 잡힌다', ids.includes('customer'));
ok('글로벌이 잡힌다(우대사항도 읽는다)', ids.includes('global'));
ok('기획력이 잡힌다("기획"은 업무 이름이라 약하게 세지 않는다)', ids.includes('planning'));
// 약한 키워드 하나(=0.4)만 걸린 역량은 근거로 보지 않는다
ok('"실행" 하나로 실행력을 만들지 않는다', !ids.includes('execution'));
ok('"제안" 하나로 주도성을 만들지 않는다', !ids.includes('ownership'));
ok('근거 문장을 원문 그대로 남긴다',
   r.found[0].quotes.some(q => JD_TEXT.includes(q)), `→ ${r.found[0].quotes[0]}`);
ok('공고에 없는 역량은 만들지 않는다', !ids.includes('service') && !ids.includes('resilience'));

console.log('\n── 3. 소재 배분 (같은 활동을 모든 역량에 추천하지 않는가) ──');
const items = build(r.found.slice(0, 6), ACTS);
const tops = items.map(i => i.mine[0]?.name).filter(Boolean);
const uniqueTops = new Set(tops);
ok('배점 1위 활동이 모든 카드를 차지하지 않는다', uniqueTops.size >= 3, `→ ${[...uniqueTops].join(' / ')}`);
ok('소재가 겹치면 겹침을 밝힌다',
   items.filter(i => i.reuse).every(i => i.lead.includes('겹치지 않게')));
ok('처음 배정된 카드는 겹침 문구가 없다',
   items.filter(i => i.mine.length && !i.reuse).every(i => i.lead.includes('가장 강한 소재')));
ok('결정론 — 같은 입력이면 같은 결과',
   JSON.stringify(build(JD.ruleExtract(JD_TEXT).found.slice(0, 6), ACTS)) === JSON.stringify(items));

console.log('\n── 4. 스펙이 없을 때도 화면이 성립하는가 ──');
const guest = build(r.found.slice(0, 3), [], false);
ok('비로그인도 골격 가이드를 받는다', guest.every(i => i.frame && i.frame.includes('①')));
ok('비로그인에는 스펙 입력 안내를 준다', guest.every(i => /스펙을 입력하면/.test(i.gap || '')));
const onlyVolunteer = build(r.found.slice(0, 1), [{ type: 'volunteer', name: '봉사', duration: '6개월~1년', role: '팀원', outcome: '결과물 없음' }]);
ok('근거 활동이 없으면 무엇이 근거가 되는지 알려준다',
   /근거로 쓸 활동이 아직 없습니다/.test(onlyVolunteer[0].gap || ''), `→ ${onlyVolunteer[0].gap}`);

console.log('\n── 5. 가이드 내용이 비어 있지 않은가 ──');
for (const arc of JD.ARCHETYPES) {
  const g = JD.buildGuide({ id: arc.id, quotes: [], matched: [] }, [], false);
  const full = g && g.frame.includes('①') && g.numbers.length && g.avoid.length && g.reads && g.followup;
  if (!full) { ok(`${arc.label} 가이드 완성`, false); break; }
}
ok(`역량 원형 ${JD.ARCHETYPES.length}종 모두 골격·숫자·감점·면접질문을 갖췄다`,
   JD.ARCHETYPES.every(arc => {
     const g = JD.buildGuide({ id: arc.id, quotes: [], matched: [] }, [], false);
     return g.frame.includes('①') && g.numbers.length > 0 && g.avoid.length > 0 && !!g.reads && !!g.followup;
   }));
ok('원형 id 에 중복이 없다', new Set(JD.ARCHETYPE_IDS).size === JD.ARCHETYPE_IDS.length);

console.log('\n── 6. AI 가 모르는 역량을 들고 왔을 때 ──');
const custom = JD.buildCustom({ label: '반도체 공정 이해', quotes: ['반도체 8대 공정 이해도 보유자'] });
ok('가이드를 지어내지 않고 직접 확인하라고 넘긴다',
   custom.custom === true && /역량 사전에 없는/.test(custom.lead));
ok('그래도 최소 골격은 준다', custom.frame.includes('①'));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
