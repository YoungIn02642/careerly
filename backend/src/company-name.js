/* ════════════════════════════════════════════════════════════
   회사명 대조와 마감일 계산 — 채용공고 경로가 공유하는 규칙

   사람인·워크넷 둘 다 "회사명으로 찾기" 파라미터가 없다. 키워드로 넘기면 공고제목·
   직무내용까지 뒤져서 남의 회사 공고가 섞여 온다. 받아온 뒤 회사명을 우리가 대조하는
   수밖에 없고, 그 규칙이 두 파일에 따로 있으면 한쪽만 고쳐져 어긋난다. 여기 하나로 둔다.
   ════════════════════════════════════════════════════════════ */

/* (주)·주식회사 같은 법인격 표기와 공백을 걷어낸다. 같은 회사가
   '(주)토스' · '토스 주식회사' · '토스' 로 제각각 올라오기 때문이다. */
const normalize = s => String(s || '')
  .replace(/\(주\)|\(유\)|\(재\)|\(사\)|주식회사|유한회사|재단법인|사단법인/g, '')
  .replace(/\s+/g, '')
  .toLowerCase();

/* **정확히 같을 때만** 같은 회사로 본다.
   부분 문자열을 허용하면 '토스' 로 찾을 때 '대한토스트' 가 걸리고, '삼성전자' 에
   '삼성전자로지텍' 이 걸린다. 남의 회사 공고를 자기 지원 회사 것으로 알고 자소서에
   붙여넣는 쪽이, 공고 몇 건을 놓치는 쪽보다 훨씬 나쁘다. 못 찾은 공고는 화면의
   '사람인에서 더 찾기' 링크가 받는다. */
function sameCompany(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  return x === y;
}

/* 마감일 → D-n. **달력 날짜 차이**로 센다.
   시각으로 빼면 오늘 마감인 공고가 D-1 로 나온다(자정까지 남은 시간이 0보다 크므로
   올림에서 1이 된다). 마감 당일은 D-0 이어야 한다.
   이미 지난 공고는 null — D-(-3) 을 띄우면 아직 지원할 수 있는 것처럼 보인다.

   들어오는 모양이 두 가지다: 워크넷은 'YYYYMMDD', 사람인은 ISO('2026-08-20T23:59:59+09:00').
   숫자만 뽑아 앞 8자리를 쓰면 둘 다 읽힌다. */
function dday(raw) {
  const s = String(raw || '').replace(/\D/g, '').slice(0, 8);
  if (s.length !== 8) return null;
  const y = Number(s.slice(0, 4)), m = Number(s.slice(4, 6)), d = Number(s.slice(6, 8));
  const end = new Date(y, m - 1, d);
  if (Number.isNaN(end.getTime()) || end.getMonth() !== m - 1) return null;   // 20261352 방어
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((end.getTime() - today.getTime()) / 86400000);
  return days >= 0 ? days : null;
}

module.exports = { normalize, sameCompany, dday };
