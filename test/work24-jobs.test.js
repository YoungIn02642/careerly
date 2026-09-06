/* 고용24 채용공고 — 파서(src/work24-crawl.js) 와 캐시 조회(src/work24-jobs-cache.js)

   네트워크를 부르지 않는다. 아래 HTML 은 **2026-09-06 실제 응답에서 그대로 옮긴
   구조**다(회사명·번호만 짧게 줄였다). 구조를 지어내면 테스트만 통과하고 실제로는
   안 된다 — 공정위 API 때 명세를 추정했다가 통째로 틀렸다(작업정리 3-1).

   ── 이 테스트가 지키는 것 ──
   1) **행 두 종류를 다 읽는가.** 처음에는 비교검색 체크박스가 있는 행만 읽어서
      100건 중 14건을 버렸는데, 버려진 쪽이 하필 `대기업`·`중견` 공채였다.
      회귀하면 대기업 공고가 조용히 사라진다 — 에러 없이.
   2) **경력·학력을 자리로 가르지 않는가.** 한쪽이 비면 학력이 경력 자리로 밀린다.
   3) **못 읽은 행을 반쪽짜리로 통과시키지 않는가.**
*/
const fs = require('fs');
const path = require('path');
const CRAWL = require('../backend/src/work24-crawl.js');

const CACHE = path.join(__dirname, '..', 'backend', 'data', 'work24-jobs.json');
const BACKUP = CACHE + '.testbak';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name} ${extra}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const ymd = d => {
  const t = new Date(); t.setDate(t.getDate() + d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/* (1) 비교검색 체크박스가 있는 행 — 제목이 value 에 온전히 실려 온다 */
const rowChk = (o) => `<tr id="list${o.i}">
 <td class="al_left pd24"><div class="box_table_group gap_box08 column"><div class="cell">
  <div class="box_chk-group"><label><span>
   <input class="vtalm3" type="checkbox" id="chkboxWantedAuthNo${o.i}" value="${o.id}|VALIDATION|${o.co}|${o.title}">
   <a href="#none" class="cp_name underline_hover" onclick="fnOpenPopup('123');">${o.co}</a>
  </span></label></div></div>
  <div class="cell"><a href="/wk/a/b/1500/empDetailAuthView.do?wantedAuthNo=${o.id}&amp;infoTypeCd=VALIDATION&amp;infoTypeGroup=tb_workinfoworknet"
     class="t3_sb underline_hover" target="_new">${o.title.slice(0, 20)}...</a></div>
  <div class="cell"><p><span class="item sm logo_wrap"><img src="/wk/static/images/logo/saramin.png" alt="정보제공처 사람인"></span></p></div>
 </div></td>
 <td class="link pd24"><div class="flex1"><ul class="emp_info_dtl">
  <li class="dollar"><p><span class="item b1_sb">연봉 3,000 만원</span></p></li>
  <li class="member"><p><span class="item sm">${o.career}</span><span class="item sm">${o.edu}</span></p></li>
  <li class="site"><p>${o.region}</p></li>
 </ul></div></td>
 <td class="pd24"><strong id="dDayInfo${o.i}"></strong>
  <script type="text/javascript">var date='${o.close}'; var wantedYn = '${o.always ? 'Y' : 'N'}';</script>
  <p class="s1_r">마감일 : ${o.close}</p><p class="s1_r">등록일 : ${ymd(-2)}</p></td>
</tr>`;

/* (2) 체크박스가 없는 행 — 대기업·중견 공채가 이 모양으로 온다.
       제목이 화면에서 잘려 오는 것까지 실제와 같게 둔다. */
const rowOpen = (o) => `<tr id="list${o.i}">
 <td class="al_left pd24"><div class="box_table_group gap_box08 column"><div class="cell">
  <div class="box_chk-group"><label><span>
   <a href="#none" class="cp_name underline_hover" onclick="fnOpenPopup('310');">${o.co}</a>
   <span class="label_box ml08">${(o.labels || []).map(l => `<span class="tbl_label">${l}</span>`).join('')}</span>
  </span></label></div></div>
  <div class="cell"><a href="/wk/a/b/1500/empDetailAuthView.do?wantedAuthNo=${o.id}&amp;infoTypeCd=OEW&amp;infoTypeGroup=tb_workinfoopen"
     class="t3_sb underline_hover" target="_new">${o.title}</a></div>
 </div></td>
 <td class="link pd24"><div class="flex1"><ul class="emp_info_dtl">
  <li class="member"><p><span class="item sm">${o.career}</span><span class="item sm">${o.edu}</span></p></li>
  <li class="site"><p>${o.region}</p></li>
 </ul></div></td>
 <td class="pd24"><script type="text/javascript">var date='${o.close}'; var wantedYn = 'N';</script>
  <p class="s1_r">마감일 : ${o.close}</p><p class="s1_r">등록일 : ${ymd(-1)}</p></td>
</tr>`;

const page = (rows) => `<html><body>
 <span class="tit ml08">검색건수 <span class="txt_total">3,851</span>건</span>
 <table><tbody>${rows.join('')}</tbody></table></body></html>`;

const HTML = page([
  rowChk({ i: 1, id: 'K1302326', co: '(주)면사랑', title: '(주)면사랑 품질인증팀 신입사원 모집', career: '신입', edu: '대졸(4년)', region: '충북 진천', close: ymd(7) }),
  rowChk({ i: 2, id: 'K1302327', co: '우성엠텍', title: '자재 구매 및 관리 전문가를 모집합니다.', career: '경력1년', edu: '학력무관', region: '부산 강서구', close: ymd(60), always: true }),
  rowOpen({ i: 3, id: '176906', co: '에이치디현대오일뱅크', title: '2026년 하반기 신입사원 채용', career: '신입', edu: '대졸(4년)', region: '충남 서산', close: ymd(21), labels: ['대기업', '가족'] }),
  rowOpen({ i: 4, id: '176896', co: '만도브로제', title: '[R&D, 생산, 품질, Sales] 2026년 하반기 그룹 신입사...', career: '신입', edu: '대졸(4년)', region: '경기 평택', close: ymd(21), labels: ['중견'] }),
  /* 읽을 수 없는 행 — 회사명도 인증번호도 없다. 반쪽짜리로 통과하면 안 된다. */
  `<tr id="list5"><td>광고 자리</td></tr>`,
]);

(async () => {
  console.log('── 1. 목록 HTML 을 읽는다 ──');
  const r = CRAWL.parseList(HTML);
  ok('검색건수를 읽는다', r.total === 3851, `→ ${r.total}`);
  ok('행 5개 중 4개를 읽는다', r.rows === 5 && r.items.length === 4, `→ 행 ${r.rows} · 읽음 ${r.items.length}`);
  ok('읽을 수 없는 행은 버린다', r.dropped === 1);

  console.log('\n── 2. 행 두 종류를 다 읽는다 (대기업 공채가 사라지지 않는다) ──');
  const hd = r.items.find(j => j.company === '에이치디현대오일뱅크');
  ok('체크박스 없는 공채 행을 읽는다', Boolean(hd));
  ok('  인증번호를 상세 링크에서 꺼낸다', hd?.id === '176906', `→ ${hd?.id}`);
  ok('  기업규모 딱지를 옮긴다', hd?.labels.join(',') === '대기업,가족', `→ ${hd?.labels}`);
  ok('  주소의 &amp; 를 푼다', /infoTypeCd=OEW/.test(hd?.url || '') && !/&amp;/.test(hd?.url || ''));

  const cut = r.items.find(j => j.company === '만도브로제');
  ok('잘린 제목을 표시한다', cut?.titleTruncated === true);
  ok('  말줄임표는 떼어 둔다', !/\.\.\.$/.test(cut?.title || ''), `→ ${cut?.title}`);

  console.log('\n── 2-1. 속성 안의 엔티티를 푼다 ──');
  /* 체크박스 value 는 속성이라 엔티티가 그대로 들어 있다. 안 풀면 제목이
     `&#039;26년 …` 으로 화면까지 간다 (2026-09-07 사용자 화면에서 발견). */
  const ent = CRAWL.unescapeEntities("[경력] &#039;26년 AMOREPACIFIC 채용 &amp; 안내 &lt;주말&gt;");
  ok('작은따옴표(&#039;)를 푼다', /'26년/.test(ent), `→ ${ent}`);
  ok('  &amp; 를 마지막에 푼다 — &amp;lt; 가 태그가 되지 않는다',
    CRAWL.unescapeEntities('a&amp;lt;b') === 'a&lt;b', `→ ${CRAWL.unescapeEntities('a&amp;lt;b')}`);
  ok('  이미 풀린 글자는 그대로 둔다', CRAWL.unescapeEntities("'26년 채용") === "'26년 채용");

  const full = r.items.find(j => j.company === '(주)면사랑');
  ok('체크박스 행은 제목이 온전하다', full?.title === '(주)면사랑 품질인증팀 신입사원 모집', `→ ${full?.title}`);
  ok('  정보제공처를 남긴다', full?.provider === '사람인');

  console.log('\n── 3. 경력·학력을 자리가 아니라 글자로 가른다 ──');
  ok('신입/대졸', full?.career === '신입' && full?.edu === '대졸(4년)', `→ ${full?.career} / ${full?.edu}`);
  const w = r.items.find(j => j.company === '우성엠텍');
  ok('경력1년/학력무관', w?.career === '경력1년' && w?.edu === '학력무관', `→ ${w?.career} / ${w?.edu}`);

  console.log('\n── 4. 상시채용은 마감일이 있어도 D-day 를 띄우지 않는다 ──');
  ok('always 를 표시한다', w?.always === true);
  ok('  그래도 마감일은 버리지 않는다', /^\d{8}$/.test(w?.closeDate || ''), `→ ${w?.closeDate}`);

  console.log('\n── 5. 파서가 조용히 깨졌는지 본다 ──');
  ok('멀쩡하면 ok', CRAWL.sanity(r.items).ok === true);
  const broken = [{ url: null, closeDate: null, always: false }];
  ok('필드가 비면 ok 가 아니다', CRAWL.sanity(broken).ok === false);
  ok('빈 배열도 ok 가 아니다', CRAWL.sanity([]).ok === false);

  console.log('\n── 6. 수집 주소에 대졸 조건이 들어간다 ──');
  const u = CRAWL.listUrl(3);
  ok('페이지 번호', /pageIndex=3/.test(u));
  ok('학력 대졸', /academicGbn=04%2C05/.test(u), `→ ${u.slice(u.indexOf('?'))}`);
  /* 신입 필터는 **일부러 뺐다**(2026-09-07). 그걸 걸면 LG전자 47건이 2건, CJ제일제당
     82건이 0건이 되어 회사 리포트가 대부분 빈 칸이 됐다. 되살아나면 같은 일이 난다. */
  ok('경력 필터는 걸지 않는다', !/careerTypes/.test(u));

  /* ── 캐시 조회 ─────────────────────────────────────────────
     진짜 캐시가 있으면 잠시 치워 둔다 — 테스트가 남의 데이터를 건드리지 않는다. */
  console.log('\n── 7. 캐시에서 회사로 고른다 ──');
  const hadReal = fs.existsSync(CACHE);
  if (hadReal) fs.renameSync(CACHE, BACKUP);
  try {
    fs.writeFileSync(CACHE, JSON.stringify({
      fetchedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      count: r.items.length,
      filter: { note: '학력 대졸(2~3년·4년)' },
      items: r.items,
    }), 'utf8');

    delete require.cache[require.resolve('../backend/src/work24-jobs-cache.js')];
    const W = require('../backend/src/work24-jobs-cache.js');

    const hit = await W.companyJobs('에이치디현대오일뱅크');
    ok('회사명으로 찾는다', hit.items.length === 1, `→ ${hit.items.length}건`);
    ok('  source 가 work24', hit.source === 'work24');
    ok('  D-day 를 센다', hit.items[0]?.dday === 21, `→ D-${hit.items[0]?.dday}`);
    ok('  언제 받은 것인지 말한다', Math.round(hit.ageHours) === 3, `→ ${hit.ageHours?.toFixed(1)}시간`);

    /* 법인격 표기가 달라도 같은 회사다 — company-name.sameCompany 규칙 */
    const men = await W.companyJobs('면사랑');
    ok('법인격 표기가 달라도 같은 회사로 본다', men.items.length === 1);

    /* 부분 문자열로 남의 회사를 잡으면 안 된다 */
    const other = await W.companyJobs('현대');
    ok('부분 문자열로 남의 회사를 잡지 않는다', other.items.length === 0);

    const none = await W.companyJobs('삼성전자');
    ok('없으면 사유를 말한다', /대졸 조건/.test(none.reason || ''), `→ ${(none.reason || '').slice(0, 40)}…`);
    ok('  안 뽑는다는 뜻으로 읽히지 않게 한다', /조회되지 않습니다/.test(none.reason || ''));

    /* 상시채용은 마감으로 걸러지지 않는다 */
    const always = await W.companyJobs('우성엠텍');
    ok('상시채용도 열린 공고로 센다', always.items.length === 1 && always.items[0].dday === null);
  } finally {
    /* 여기서는 시험용 캐시만 지운다. **진짜 캐시는 아직 되돌리지 않는다** —
       아래 8번이 '캐시가 없을 때' 를 보는 자리라, 여기서 되돌리면 그 검사가
       진짜 캐시를 읽고 조용히 통과해 버린다(실제로 그렇게 짰다가 걸렸다). */
    try { if (fs.existsSync(CACHE)) fs.unlinkSync(CACHE); } catch {}
  }

  console.log('\n── 8. 캐시가 없으면 무엇을 하면 되는지 말한다 ──');
  try {
    delete require.cache[require.resolve('../backend/src/work24-jobs-cache.js')];
    const FRESH = require('../backend/src/work24-jobs-cache.js');
    const gone = await FRESH.companyJobs('아무회사');
    ok('죽지 않는다', Array.isArray(gone.items) && gone.items.length === 0);
    ok('configured=false', gone.configured === false);
    ok('무엇을 하면 되는지 알려준다', /fetch-work24-jobs/.test(gone.reason || ''), `→ ${gone.reason}`);
  } finally {
    if (hadReal) fs.renameSync(BACKUP, CACHE);
  }

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
