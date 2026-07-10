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

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
