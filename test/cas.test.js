const CAS = require('../frontend/js/cas.js');
let pass = 0, fail = 0;
const ok = (name, cond, extra='') => { cond ? pass++ : fail++; console.log((cond?'  PASS ':'  FAIL '), name, extra); };
const pct = w => (w*100).toFixed(1) + '%';

console.log('── 1. 가중치 재분배 ──');
const priv = CAS.resolveWeights('private', true);
ok('사기업·전공관련: 40/35/25', Math.abs(priv.gpa-.40)<1e-9 && Math.abs(priv.lang-.35)<1e-9 && Math.abs(priv.cert-.25)<1e-9,
   `→ ${pct(priv.gpa)}/${pct(priv.lang)}/${pct(priv.cert)}`);

const pub = CAS.resolveWeights('public', true);
ok('공기업: 학점 0, 합 1', pub.gpa === 0 && Math.abs(pub.gpa+pub.lang+pub.cert-1)<1e-9,
   `→ 어학 ${pct(pub.lang)}, 자격증 ${pct(pub.cert)}`);
ok('공기업 재분배가 원비율(35:25) 유지', Math.abs(pub.lang/pub.cert - 35/25)<1e-9);

const off = CAS.resolveWeights('private', false);
ok('전공무관: 학점 ×0.5 후 합 1', Math.abs(off.gpa+off.lang+off.cert-1)<1e-9,
   `→ ${pct(off.gpa)}/${pct(off.lang)}/${pct(off.cert)}`);
ok('전공무관 학점이 전공관련보다 낮음', off.gpa < priv.gpa, `${pct(off.gpa)} < ${pct(priv.gpa)}`);

console.log('\n── 2. 어학 환산표 (회의록: OPIc IH ≈ TOEIC 850 ≈ TS IM3 ≈ 80) ──');
ok('TOEIC 850 = 80', CAS.langIndex({toeic:850}) === 80);
ok('OPIc IH = 80',   CAS.langIndex({opic:'IH'}) === 80);
ok('여러 시험 중 최고값 채택', CAS.langIndex({toeic:600, opic:'AL'}) === 92, `→ ${CAS.langIndex({toeic:600, opic:'AL'})}`);
ok('어학 미제출 → null', CAS.langIndex({}) === null);

console.log('\n── 3. 상대 채점 ──');
ok('평균과 동률 → 0.80', Math.abs(CAS.relativeScore(3.85, 3.85) - 0.8) < 1e-9);
ok('평균의 1.25배 → 만점', CAS.relativeScore(5, 4) === 1);
ok('평균의 2배도 만점 초과 없음', CAS.relativeScore(8, 4) === 1);
ok('평균의 절반 → 0.40', Math.abs(CAS.relativeScore(2, 4) - 0.4) < 1e-9);
ok('벤치마크 없으면 null', CAS.relativeScore(3.5, null) === null);

console.log('\n── 4. 자격증: 무관 자격증이 무의미해지는가 ──');
const bench = { count: 10, certs: [
  { id:'정보처리기사', pct:92 }, { id:'SQLD', pct:74 }, { id:'AWS SAA', pct:41 }, { id:'제빵기능사', pct:2 },
]};
const top3 = 92+74+41;
ok('상위3개 전부 보유 → 만점', CAS.certScore(['정보처리기사','SQLD','AWS SAA'], bench, []) === 1);
const irrelevant = CAS.certScore(['제빵기능사'], bench, []);
ok('무관 자격증만 → 거의 0', irrelevant < 0.02, `→ ${(irrelevant*100).toFixed(1)}%`);
const relevant = CAS.certScore(['정보처리기사'], bench, []);
ok('관련 자격증 1개 > 무관 1개', relevant > irrelevant * 10, `${(relevant*100).toFixed(1)}% vs ${(irrelevant*100).toFixed(1)}%`);
ok('자격증 없음 → 0', CAS.certScore([], bench, []) === 0);

console.log('\n── 5. 표본 부족 시 카탈로그 사전확률 ──');
const tiny = { count: 2, certs: [{ id:'정보처리기사', pct:100 }] };
const cat = ['정보처리기사','SQLD','AWS SAA'];
const withPrior = CAS.certScore(['정보처리기사'], tiny, cat);
ok('n<5 → 보유율 대신 카탈로그 사용 (만점 아님)', withPrior < 1, `→ ${(withPrior*100).toFixed(1)}%`);
ok('n<5, 카탈로그 밖 자격증은 저평가', CAS.certScore(['제빵기능사'], tiny, cat) < 0.05);

console.log('\n── 6. 통합: 만점 초과·미달 없음 ──');
const full = CAS.computeQuant({
  spec: { gpa: 4.5, gpaMax: 4.5, scores:{opic:'AL'}, certs:['정보처리기사','SQLD','AWS SAA'] },
  benchmark: { count:10, gpa:{avg:3.0}, scores:{ opic:{avg:'IL'} }, certs: bench.certs },
  target:'private', majorRelevant:true,
});
ok('만점 초과 안 함', full.total <= 400, `→ ${full.total}/400`);
const empty = CAS.computeQuant({ spec:{}, benchmark:{count:0}, target:'private' });
ok('데이터 없음 → 0점, 예외 없음', empty.total === 0, `→ ${empty.total}/400`);
ok('공기업이면 학점 배점 0', CAS.computeQuant({spec:{gpa:4.5,gpaMax:4.5},benchmark:{count:10,gpa:{avg:3}},target:'public'}).parts.gpa.max === 0);

console.log('\n── 7. 정성: 유형 가중치 우선순위 ──');
const A = (type, extra={}) => ({ type, ...extra });
// 같은 조건(기간·성과 없음)일 때 유형 기본배점 순위: 인턴십 > 공모전 ≈ 대외활동 > 프로젝트 > … > 기타
ok('인턴십이 가장 높다',
   CAS.scoreActivity(A('internship')) > CAS.scoreActivity(A('competition')));
ok('공모전 > 프로젝트', CAS.scoreActivity(A('competition')) > CAS.scoreActivity(A('project')));
ok('대외활동 > 프로젝트', CAS.scoreActivity(A('extracurricular')) > CAS.scoreActivity(A('project')));
ok('공모전·대외활동 > 봉사활동',
   CAS.scoreActivity(A('competition')) > CAS.scoreActivity(A('volunteer')) &&
   CAS.scoreActivity(A('extracurricular')) > CAS.scoreActivity(A('volunteer')));

console.log('\n── 8. 정성: 기간·역할·성과 배수 ──');
ok('기간이 길수록 높다',
   CAS.scoreActivity(A('internship',{duration:'1년이상'})) >
   CAS.scoreActivity(A('internship',{duration:'1~3개월'})));
ok('전환·정규직 합격 성과가 가장 크게 가산',
   CAS.scoreActivity(A('internship',{outcome:'전환, 정규직 합격'})) >
   CAS.scoreActivity(A('internship',{outcome:'수상'})));
ok('팀장이 팀원보다 높다',
   CAS.scoreActivity(A('project',{role:'팀장'})) > CAS.scoreActivity(A('project',{role:'팀원'})));
ok('연구: 박사 > 석사 > 학부연구생',
   CAS.scoreActivity(A('research',{stage:'박사'})) > CAS.scoreActivity(A('research',{stage:'석사'})) &&
   CAS.scoreActivity(A('research',{stage:'석사'})) > CAS.scoreActivity(A('research',{stage:'학부연구생'})));

console.log('\n── 9. 정성: computeQual 만점/상대채점 ──');
const qStrong = CAS.computeQual({ spec: { activities: [
  A('internship',{duration:'1년이상', outcome:'전환, 정규직 합격'}),
  A('internship',{duration:'6개월~1년', outcome:'전환, 정규직 합격'}),
  A('competition',{role:'팀장', outcome:'수상'}),
]}, benchRaw: 295 });
ok('강한 정성 프로필 → 만점(600) 초과 없음', qStrong.total <= 600 && qStrong.total >= 480, `→ ${qStrong.total}/600`);
// 합격자 평균 원점수(benchRaw)와 동률인 프로필은 만점의 80%가 되어야 한다(정량과 동일 철학)
const avgActs = [ A('internship',{duration:'3개월~6개월'}), A('extracurricular',{duration:'3개월~6개월'}), A('project') ];
const avgRaw = CAS.qualRaw(avgActs);
const qAvg = CAS.computeQual({ spec: { activities: avgActs }, benchRaw: avgRaw });
ok('합격자 평균과 동률 → 만점의 80%', Math.abs(qAvg.total - 480) < 2, `→ ${qAvg.total}/600 (raw ${avgRaw})`);
ok('평균 미만 프로필 → 80% 미만',
   CAS.computeQual({ spec:{ activities: avgActs }, benchRaw: avgRaw*1.3 }).total < 480);
ok('활동 없음 → 0점, 예외 없음', CAS.computeQual({ spec:{}, benchRaw:295 }).total === 0);
ok('옛 boolean qual 도 채점됨(활동 환산)',
   CAS.computeQual({ spec:{ qual:{ internship:true, extracurricular:true } } }).total > 0);

console.log('\n── 10. 정량+정성 통합 1000점 ──');
const totalFull = CAS.computeTotal({ quant:{ total:400, max:400 }, qual:{ total:600, max:600 } });
ok('통합 만점 1000', totalFull.total === 1000 && totalFull.max === 1000, `→ ${totalFull.total}/${totalFull.max}`);

console.log('\n── 11. 정량:정성 동적 비율 ──');
// 성취도가 같으면 기본 4:6
const even = CAS.computeTotal({ quant:{ total:200, max:400 }, qual:{ total:300, max:600 } });
ok('성취도 동률 → 4:6', even.quantWeight === 0.4 && even.qualWeight === 0.6,
   `→ ${even.quantWeight}:${even.qualWeight}`);
// 정성이 성취도에서 크게 앞서면 정성 비중이 3:7까지 이동
const qualStrong = CAS.computeTotal({ quant:{ total:80, max:400 }, qual:{ total:540, max:600 } });
ok('정성 우세 → 3:7', qualStrong.quantWeight === 0.3 && qualStrong.qualWeight === 0.7,
   `→ ${qualStrong.quantWeight}:${qualStrong.qualWeight}`);
// 정량이 성취도에서 크게 앞서면 5:5까지 이동
const quantStrong = CAS.computeTotal({ quant:{ total:400, max:400 }, qual:{ total:60, max:600 } });
ok('정량 우세 → 5:5', quantStrong.quantWeight === 0.5 && quantStrong.qualWeight === 0.5,
   `→ ${quantStrong.quantWeight}:${quantStrong.qualWeight}`);
// 비중이 바뀌어도 총점은 항상 1000점 척도 안 (동률 만점이면 1000)
ok('동적 비율에서도 상한 1000 유지', CAS.computeTotal({ quant:{ total:400, max:400 }, qual:{ total:600, max:600 } }).total === 1000);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
