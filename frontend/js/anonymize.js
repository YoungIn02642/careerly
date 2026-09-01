/* ══════════════════════════════════════════════════════════════
   자소서 기증 — 규칙 기반 익명화  (프론트·백엔드 단일 출처)

   ── 왜 규칙 기반인가 ──
   합격 자소서를 '동의 기반으로 기증' 받아 통계 참조군(A 코퍼스)으로 쓰려면,
   저장 전에 **개인을 특정할 수 있는 정보**를 지워야 한다(개인정보보호법). AI 로
   지우면 무엇을 왜 지웠는지 검증할 수 없고 오탐이 조용히 샌다 — 그래서 cas.js 처럼
   **규칙으로** 지우고, 무엇을 몇 개 가렸는지(masked)를 같이 돌려줘 화면이 보여준다.

   ── 이름·회사·학교는 규칙만으로 못 잡는다 ──
   한국어 이름은 형태만으로 일반 명사와 구분되지 않는다(오탐·미탐 둘 다 난다).
   그래서 이 모듈은 ① 형태가 뚜렷한 것(이메일·전화·주민번호·링크)은 자동으로 지우고,
   ② 이름·회사·학교처럼 사람이 알려줘야 하는 것은 **호출부가 넘긴 목록(terms)** 으로
   지운다. 화면은 익명화 결과를 **미리 보여주고 사용자가 더 가릴 말을 추가**하게 한다
   (사람 확인 + 자동 마스킹). 저장되는 본문은 **언제나 서버가 다시 익명화한 것**이다.

   ── 단일 출처 (cas.js 와 같은 이중 노출) ──
   백엔드(routes/donations.js)와 프론트(donate.js 미리보기)가 **같은 규칙**을 써야
   "미리 본 것"과 "저장된 것"이 갈리지 않는다. node 에서는 module.exports,
   브라우저에서는 window.Anonymize.
   ══════════════════════════════════════════════════════════════ */
(root => {
  /* 정규식으로 뚜렷하게 잡히는 개인정보. 순서가 규칙의 일부다 —
     이메일·링크를 전화보다 먼저 지운다(둘 다 숫자를 품어 전화 규칙에 잘못 걸린다). */
  const RULES = [
    { type: '링크', re: /https?:\/\/[^\s<>()]+/gi, tag: '[링크]' },
    { type: '이메일', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, tag: '[이메일]' },
    { type: '주민등록번호', re: /\b\d{6}\s*[-]\s*[1-4]\d{6}\b/g, tag: '[주민등록번호]' },
    /* 휴대폰·일반전화. 하이픈/점/공백 구분자를 허용하되, 구분자가 하나도 없는
       11자리 연속 숫자까지 지우면 '20250101120000' 같은 값도 전화로 오인하므로
       구분자가 있는 형태만 지운다(자소서에는 보통 010-1234-5678 로 적힌다). */
    { type: '전화번호', re: /\b01[016789][-.\s]\d{3,4}[-.\s]\d{4}\b/g, tag: '[전화번호]' },
    { type: '전화번호', re: /\b0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}\b/g, tag: '[전화번호]' },
  ];

  const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* 호출부가 넘긴 '가릴 말'(이름·회사·학교). 입력칸이 하나라 종류를 구분하지 않고
     **중립 태그 [비공개]** 하나로 가린다 — 회사명을 [이름]으로 라벨하면 "저장 전 이렇게
     가려집니다" 미리보기가 거짓말이 된다. 두 글자 미만은 무시하고(한 글자를 지우면 본문이
     곳곳 뚫린다), 긴 것부터 지운다(회사명이 학교명을 품는 경우 대비). */
  function termRules(terms) {
    return (terms || [])
      .map(t => String(t || '').trim())
      .filter(t => t.length >= 2)
      .sort((a, b) => b.length - a.length)
      .map(t => ({ type: '가린 말', re: new RegExp(escapeRe(t), 'g'), tag: '[비공개]' }));
  }

  /* text 를 익명화한다.
     opts.terms(권장) / opts.names / opts.orgs : 사용자가 알려준 가릴 말(이름·회사·학교).
       셋 다 합쳐 같은 규칙으로 가린다(입력칸이 하나다).
     반환: { text, masked:[{type,count}] } — masked 는 화면이 "무엇을 가렸는지" 로 쓴다. */
  function anonymize(text, opts = {}) {
    let out = String(text ?? '');
    const counts = {};
    const terms = [...(opts.terms || []), ...(opts.names || []), ...(opts.orgs || [])];
    const rules = [
      ...termRules(terms),
      ...RULES,
    ];
    for (const r of rules) {
      out = out.replace(r.re, () => { counts[r.type] = (counts[r.type] || 0) + 1; return r.tag; });
    }
    const masked = Object.entries(counts).map(([type, count]) => ({ type, count }));
    return { text: out, masked };
  }

  /* 익명화가 아직 덜 됐는지 — 자동 규칙에 걸리는 개인정보가 남아 있으면 true.
     (이름·회사는 여기서 못 잡는다 — 그건 사용자가 미리보기에서 확인한다.) */
  function hasResidual(text) {
    return RULES.some(r => { r.re.lastIndex = 0; return r.re.test(String(text ?? '')); });
  }

  const api = { anonymize, hasResidual, RULES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node·백엔드용
  root.Anonymize = api;
})(typeof window !== 'undefined' ? window : globalThis);
