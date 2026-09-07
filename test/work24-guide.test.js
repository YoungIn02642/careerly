/* 고용24 직무별 자소서 작성가이드 → 직무기술서. 네트워크를 부르지 않는다.

   ── 이 테스트가 지키는 것 ──
   1) **엉뚱한 표를 읽지 않는다** — 목록 페이지에는 검색조건 표가 먼저 나오고, 상세
      페이지 아래에는 '같은 분야 다른 가이드' 목록이 또 붙는다. 거기까지 읽으면 남의
      회사 직무명이 이 사람의 직무기술서에 섞인다.
   2) **본문이 잘리지 않는다** — 잘라 낼 표시("관련 직무별 …")와 똑같은 말이 페이지
      위쪽 스크립트 주석에 들어 있다. 실제로 이것 때문에 빈 가이드가 나왔다.
   3) **머리말이 jd-competency.js 가 아는 말이다** — 모르는 머리말은 근거 문장으로
      뽑혀서 "[필요 역량]" 이 역량의 근거가 된다(18-7 실패 모드).

   HTML 은 실제 페이지(2026-09-05 엘지전자 [HS사업본부] HR)에서 구조만 남기고 줄인 것이다. */
const W = require('../backend/src/work24-guide.js');
const JD = require('../backend/src/jd-competency.js');

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const LIST_HTML = `<html><body>
<table class="search_table"><tbody><tr><th>검색조건</th>
  <td><select id="searchCoClcd"><option value="10">대기업</option></select></td></tr></tbody></table>
<p class="tit">전체 <span class="txt_total">1,853</span>건</p>
<table class="box_table">
<caption>공채년도,기업명,직무명,조회수을(를) 제공하는 표</caption>
<thead><tr><th>공채년도</th><th>기업명</th><th>직무명</th><th>조회수</th></tr></thead>
<tbody>
<tr>
  <td>2026 하반기 <br /><span class="tbl_label round red">공채 진행중</span></td>
  <td id="logo0"><img src="x" alt="엘지전자" /></td>
  <td><a href="javascript:void(0);" onclick="f_infoView({otpbEpaNo:'176486',
        otpbEmpnRcitNo:'1',
        sfidGuidNo:'1'});return false;">엘지전자</a></td>
  <td><a href="javascript:void(0);" onclick="f_infoView({otpbEpaNo:'176486',
        otpbEmpnRcitNo:'1',
        sfidGuidNo:'1'});return false;">[HS사업본부] HR</a></td>
  <td>22</td>
</tr>
<tr>
  <td>2025 상반기</td>
  <td id="logo1"><div class="img_box_tbl"></div></td>
  <td><a href="#" onclick="f_infoView({otpbEpaNo:'170001',otpbEmpnRcitNo:'2',sfidGuidNo:'1'});return false;">다우기술</a></td>
  <td><a href="#" onclick="f_infoView({otpbEpaNo:'170001',otpbEmpnRcitNo:'2',sfidGuidNo:'1'});return false;">[영업] 데이터센터</a></td>
  <td>9</td>
</tr>
</tbody></table></body></html>`;

const GUIDE_HTML = `<html><body>
<script>
/** 관련 직무별 자기소개서 작성 가이드 선택 이벤트 */
var f_infoView = function(param) { };
</script>
<section class="full_pop large pop_03" id="hpwkrd1150l02">
<div class="box_message_wrap">
  <p class="b1_sb"><strong class="point_color02">2026 하반기 엘지전자</strong></p>
  <p class="t2_sb"><a href="#" onclick="f_empInfoDetailPopup('176486')">2026년 하반기 신입사원 채용_HS사업본부(HR)</a></p>
  <p class="b1_r mt16">접수기간 : 2026.08.24 ~ 2026.09.13 23:00</p>
</div>
<div class="box_section">
<h2 class="t2_sb"><strong class="point_color02">[HS사업본부] HR 직무 자기소개서 작성 가이드</strong></h2>
<p><span class="pop_subtl t1_sb mt24"><strong>[HS사업본부] HR</strong></span>
  <button onclick="window.open('https://careers.lg.com/channel/detail/lge/story/541'); return false;">직무 상세정보 바로가기</button></p>
<div class="box_txt_list"><p>HR&nbsp;직무는&nbsp;사람을&nbsp;이해하고&nbsp;존중하는&nbsp;태도를&nbsp;바탕으로&nbsp;기여함
<br><br>주요&nbsp;업무
<br>-&nbsp;신입·경력&nbsp;채용&nbsp;기획&nbsp;및&nbsp;운영
<br>-&nbsp;인원·인건비&nbsp;운영&nbsp;및&nbsp;인력관리</p></div>
<h3 class="pop_subtl t3_sb mt24">필요 역량</h3>
<div class="box_txt_list"><div class="tbl_label_set mt08">
  <span class="tbl_label round">의사소통능력</span>
  <span class="tbl_label round">데이터 분석 역량</span>
</div></div>
<div class="mt16">
<h3 class="pop_subtl t3_sb mt24"></h3>
<ul class="box_list_area">
  <li class="txt_list type2">-&nbsp;&nbsp;다양한&nbsp;부서와&nbsp;소통할&nbsp;수&nbsp;있는&nbsp;의사소통능력<br></li>
  <li class="txt_list type2">-&nbsp;&nbsp;HR&nbsp;데이터를&nbsp;관리할&nbsp;수&nbsp;있는&nbsp;데이터&nbsp;분석&nbsp;역량</li>
</ul>
<h3 class="pop_subtl t3_sb mt24">전공 분야</h3>
<ul class="box_list_area"><li class="txt_list type2">-&nbsp;&nbsp;전공무관</li></ul>
<h3 class="pop_subtl t3_sb mt24">필수 사항</h3>
<ul class="box_list_area"><li class="txt_list type2">-&nbsp;&nbsp;사람과&nbsp;조직에&nbsp;대한&nbsp;관심이&nbsp;많으신&nbsp;분</li></ul>
<h3 class="pop_subtl t3_sb mt24">우대 사항</h3>
<ul class="box_list_area"><li class="txt_list type2">-&nbsp;&nbsp;통계&nbsp;분석&nbsp;또는&nbsp;AI&nbsp;활용&nbsp;경험이&nbsp;있으신&nbsp;분</li></ul>
</div>
<div class="box_table_wrap write"><table class="box_table mt24">
<caption>주요 Tip을(를) 제공하는 표</caption>
<tbody><tr><th scope="row"><p class="box_bot_tit">주요 Tip</p></th>
<td>내가&nbsp;가진&nbsp;강점을&nbsp;중심으로&nbsp;작성</td></tr>
<tr><td>&apos;왜&nbsp;그&nbsp;도구를&nbsp;선택했는가&apos;를&nbsp;중심으로&nbsp;작성</td></tr></tbody></table></div>
<h3 class="pop_subtl t3_sb mt24 tit">자소서 문항</h3>
<div class="box_border_type">
<div class="ico_txt memo_edit flex_item_s"><p class="b1_r">직무 이해도/지원동기<br>
  <strong>[지원동기]&nbsp;지원동기를&nbsp;작성해&nbsp;주세요.&nbsp;(1,000자)</strong></p></div>
<div class="ico_txt speaker flex_item_s mt08"><p class="b1_r f100">본&nbsp;항목은&nbsp;직무&nbsp;이해도를&nbsp;봅니다.</p></div>
<div class="ico_txt memo_edit flex_item_s"><p class="b1_r">디지털 역량<br>
  <strong>[디지털&nbsp;역량]&nbsp;문제를&nbsp;해결한&nbsp;경험을&nbsp;기술해&nbsp;주십시오.&nbsp;(1,000자)</strong></p></div>
<div class="ico_txt speaker flex_item_s mt08"><p class="b1_r f100">도구보다&nbsp;판단&nbsp;과정을&nbsp;봅니다.</p></div>
</div>
</div></section>
<h3>경영·회계·사무 관련 직무별 자기소개서 작성 가이드</h3>
<table class="box_table"><caption>공채년도,기업명,직무명,조회수을(를) 제공하는 표</caption>
<tbody><tr><td>2026 하반기</td><td></td>
<td><a href="#" onclick="f_infoView({otpbEpaNo:'999',otpbEmpnRcitNo:'1',sfidGuidNo:'1'});">케이티앤지</a></td>
<td><a href="#" onclick="f_infoView({otpbEpaNo:'999',otpbEmpnRcitNo:'1',sfidGuidNo:'1'});">브랜드 매니저</a></td>
<td>250</td></tr></tbody></table>
</body></html>`;

console.log('── 1. 목록 ──');
const list = W.parseList(LIST_HTML);
ok('전체 건수를 읽는다', list.total === 1853, `→ ${list.total}`);
ok('검색조건 표를 결과로 읽지 않는다', list.rows.length === 2, `→ ${list.rows.length}행`);
ok('회사·직무를 가른다',
   list.rows[0].company === '엘지전자' && list.rows[0].job === '[HS사업본부] HR',
   `→ ${list.rows[0].company} / ${list.rows[0].job}`);
ok('가이드 번호 셋을 다 챙긴다',
   list.rows[1].epa === '170001' && list.rows[1].rcit === '2' && list.rows[1].guid === '1');
ok('공채년도·반기', list.rows[0].year === '2026' && list.rows[0].half === '하반기');
ok('진행중 표시를 읽는다', list.rows[0].open === true && list.rows[1].open === false);
ok('조회수', list.rows[0].views === 22);

console.log('\n── 2. 가이드 한 건 ──');
const g = W.parseGuide(GUIDE_HTML);
ok('회사', g.company === '엘지전자', `→ ${g.company}`);
ok('직무', g.job === '[HS사업본부] HR', `→ ${g.job}`);
ok('공고명', /HS사업본부\(HR\)/.test(g.posting), `→ ${g.posting}`);
ok('접수기간에서 라벨을 뗀다', g.period === '2026.08.24 ~ 2026.09.13 23:00', `→ ${g.period}`);
ok('직무 상세 링크', g.link === 'https://careers.lg.com/channel/detail/lge/story/541');
/* 스크립트 주석의 "관련 직무별 …" 에서 잘리면 여기부터 전부 빈다. */
ok('본문이 스크립트 주석에서 잘리지 않는다', g.about.includes('주요 업무'), `→ ${g.about.length}자`);
ok('nbsp 를 공백으로 되돌린다', !/ /.test(g.about) && g.about.includes('신입·경력 채용 기획'));
ok('역량 키워드', g.keywords.join('|') === '의사소통능력|데이터 분석 역량', `→ ${g.keywords.join('|')}`);
/* 필요 역량 설명은 제목이 빈 h3 아래 붙는다 — 제목으로만 찾으면 통째로 사라진다. */
ok('제목 없는 역량 설명도 챙긴다', g.competencies.length === 2, `→ ${g.competencies.length}개`);
ok('항목 앞의 - 를 뗀다', g.competencies[0].startsWith('다양한'), `→ ${g.competencies[0]}`);
ok('전공·필수·우대', g.majors[0] === '전공무관'
  && /관심이 많으신/.test(g.required[0]) && /AI 활용 경험/.test(g.preferred[0]));
ok('주요 Tip', g.tips.length === 2 && g.tips[1].startsWith("'왜"), `→ ${g.tips.length}개`);
ok('문항 2개', g.questions.length === 2, `→ ${g.questions.length}개`);
ok('문항은 원문 그대로', g.questions[0].text === '[지원동기] 지원동기를 작성해 주세요. (1,000자)',
   `→ ${g.questions[0].text}`);
ok('문항 유형과 가이드를 가른다',
   g.questions[0].type === '직무 이해도/지원동기' && /직무 이해도를 봅니다/.test(g.questions[0].guide));
/* 아래쪽 '관련 가이드' 목록까지 읽으면 남의 회사가 섞인다. */
ok('다른 회사 가이드가 섞이지 않는다', !JSON.stringify(g).includes('케이티앤지'));

console.log('\n── 3. 직무기술서로 옮기기 ──');
const text = W.toJdText(g);
ok('모집분야에 회사·직무', text.startsWith('[모집분야] 엘지전자 · [HS사업본부] HR'));
ok('키워드와 설명이 한 덩이', (text.match(/\[필요역량\]/g) || []).length === 1);
ok('원문을 요약하지 않는다', text.includes('신입·경력 채용 기획 및 운영'));
ok('출처를 적는다', /\[출처\] 고용24 직무별 자소서 작성가이드 \(2026 하반기 공채\)/.test(text));
/* 문항별 작성 요령이 섞이면 고용24 의 작성 지침이 이 회사의 요구 역량으로 잡힌다. */
ok('문항·작성 요령은 넣지 않는다',
   !text.includes('지원동기를 작성해 주세요') && !text.includes('중심으로 작성'));

console.log('\n── 4. 머리말이 근거 문장으로 새지 않는다 ──');
/* jd-competency.js 가 모르는 머리말을 쓰면 "[필요역량]" 이 역량의 근거가 된다. */
const r = JD.ruleExtract(text);
const quotes = r.found.flatMap(h => h.quotes);
ok('머리말만 있는 줄이 근거가 되지 않는다',
   !quotes.some(q => /^\[?(전공\s*분야|필요\s*역량|필수\s*사항|우대\s*사항|주요\s*업무)\]?$/.test(q.trim())),
   `→ 근거 ${quotes.length}개`);
ok('역량이 잡힌다', r.found.length > 0, `→ ${r.found.map(h => h.id).join(', ')}`);

console.log('\n── 5. 주소는 우리가 만든다 ──');
ok('가이드 번호가 숫자가 아니면 주소를 안 만든다',
   W.guideUrl({ epa: '1; DROP', rcit: '1', guid: '1' }) === null
   && W.guideUrl({ epa: '176486', rcit: 'x', guid: '1' }) === null);
ok('번호가 맞으면 고용24 주소',
   (W.guideUrl({ epa: '176486', rcit: '1', guid: '1' }) || '')
     .startsWith('https://www.work24.go.kr/wk/r/d/1150/plcmtSrchList.do?'));
ok('검색어는 고용24 검색칸 이름으로 나간다',
   W.listUrl({ q: '엘지' }).includes(`searchEmpCoNm=${encodeURIComponent('엘지')}`));
ok('연도는 네 자리만 받는다',
   !W.listUrl({ year: '2026년' }).includes('searchOtpbEmpnYear')
   && W.listUrl({ year: '2026' }).includes('searchOtpbEmpnYear=2026'));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
