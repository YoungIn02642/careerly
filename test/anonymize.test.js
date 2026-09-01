/* 자소서 기증 익명화 테스트
   저장 전에 개인정보를 지우는 규칙이다 — 여기서 새면 개인정보가 코퍼스에 그대로 들어간다.
   화면 없이 규칙(정규식·가릴 말 목록)에 문장을 직접 넣어 '무엇을 가리고 무엇을 남기는가'만 본다. */
const A = require('../frontend/js/anonymize.js');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL '), name, extra); };

const anon = (t, o) => A.anonymize(t, o).text;

console.log('── 1. 형태가 뚜렷한 개인정보는 자동으로 가린다 ──');
ok('이메일', anon('연락은 hong.gil@abc.co.kr 로 주세요') === '연락은 [이메일] 로 주세요');
ok('휴대폰(하이픈)', anon('제 번호는 010-1234-5678 입니다') === '제 번호는 [전화번호] 입니다');
ok('휴대폰(점)', anon('010.1234.5678') === '[전화번호]');
ok('일반전화', anon('사무실 02-123-4567 로') === '사무실 [전화번호] 로');
ok('주민등록번호', anon('990101-1234567') === '[주민등록번호]');
ok('링크', anon('포트폴리오 https://me.example.com/p?a=1 참고') === '포트폴리오 [링크] 참고');

console.log('\n── 2. 구분자 없는 숫자는 전화로 오인하지 않는다 ──');
ok('타임스탬프 유지', anon('빌드 번호 20250101120000 확인') === '빌드 번호 20250101120000 확인');
ok('성과 수치 유지', anon('전환율이 12%에서 4%로 줄었습니다') === '전환율이 12%에서 4%로 줄었습니다');

console.log('\n── 3. 가릴 말(이름·회사·학교)은 넘긴 목록으로 중립 태그로 가린다 ──');
ok('이름', anon('저는 홍길동입니다', { terms: ['홍길동'] }) === '저는 [비공개]입니다');
ok('회사', anon('삼성전자 인턴을 했습니다', { terms: ['삼성전자'] }) === '[비공개] 인턴을 했습니다');
ok('학교', anon('한국대학교 컴퓨터공학과', { terms: ['한국대학교'] }) === '[비공개] 컴퓨터공학과');
ok('긴 것 먼저(부분겹침)', anon('서울대와 서울대학교', { terms: ['서울대', '서울대학교'] }) === '[비공개]와 [비공개]');
ok('한 글자 목록은 무시', anon('김 대리와 회의', { terms: ['김'] }) === '김 대리와 회의');
ok('names·orgs 도 합쳐서 가린다(하위호환)', anon('홍길동 삼성전자', { names: ['홍길동'], orgs: ['삼성전자'] }) === '[비공개] [비공개]');

console.log('\n── 4. masked 요약을 정확히 센다 ──');
const r = A.anonymize('저는 홍길동, 010-1234-5678, a@b.com 입니다', { terms: ['홍길동'] });
const byType = Object.fromEntries(r.masked.map(m => [m.type, m.count]));
ok('가린 말 1', byType['가린 말'] === 1, JSON.stringify(r.masked));
ok('전화 1', byType['전화번호'] === 1);
ok('이메일 1', byType['이메일'] === 1);

console.log('\n── 5. hasResidual — 자동 규칙에 걸리는 게 남았는지 ──');
ok('개인정보 남음 → true', A.hasResidual('메일 a@b.com 남음') === true);
ok('깨끗하면 false', A.hasResidual('설문 9명에게 물어 상위 15개를 뽑았습니다') === false);
/* 정규식 전역 플래그의 lastIndex 가 호출 간에 새지 않아야 한다(두 번 불러도 같은 답). */
ok('두 번 불러도 같다', A.hasResidual('메일 a@b.com') === A.hasResidual('메일 a@b.com'));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail) process.exit(1);
