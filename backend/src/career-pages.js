/* ════════════════════════════════════════════════════════════
   회사 자사 채용페이지 링크

   ── 왜 넣었나 (팀 논의 2026-08-21) ──
   공고 칸에는 사람인·잡코리아·워크넷 '더 찾기' 링크만 있었다. 그런데 그 셋은
   **우리와 기능이 겹치는 서비스**다(회사 탐색·공고·합격 자소서까지 있다).
   거기로 보내면 학생이 굳이 돌아올 이유가 없다 — 우리가 못 하는 일을 부탁하는 게
   아니라 상위 호환 서비스에 사용자를 넘기는 셈이다.

   자사 채용페이지는 공고만 있고 **자소서를 봐주지 않는다.** 돌아올 이유가 남는다.
   게다가 대기업 공채는 실제로 자사 사이트에만 올라오는 일이 많아 **학생에게도 그쪽이
   더 정확하다** — 우리 이익과 사용자 이익이 같은 방향인 흔치 않은 경우다.

   ── 그런데 공고를 긁어오지는 않는다 ──
   회사마다 사이트가 다르니 파서가 회사 수만큼 필요하고, 개편 한 번에 **조용히**
   깨진다. 요즘 채용페이지는 ATS 를 iframe 으로 얹거나 JS 로 그려서 정적 요청으로는
   빈 HTML 만 온다. 무엇보다 공고는 마감이 생명이라, 긁는 순간 **마감된 공고를 띄우는
   책임**이 우리 것이 된다. 그래서 여기 있는 것은 링크 하나뿐이다.

   ── 표는 주소를 찍어서 만들지 않는다 ──
   `/recruit`·`/careers` 를 찍으면 맞을 때도 있지만 틀리면 404 를 학생에게 보여주게
   되고, 그게 사람인 링크보다 나쁘다. 넣기 전에 scripts/check-career-pages.js 로
   실제로 열리는지 확인한다.

   ── 채우는 방법이 둘이 됐다 (2026-09-07, 사용자 결정) ──
   대기업 545곳 중 26곳뿐이라 손으로만 채우면 안 끝난다(25-6). 그래서
   `scripts/find-career-pages.js` 를 뒀는데, **여기도 주소를 찍지 않는다**:

     ① 회사 홈페이지를 DART 기업개황(hm_url)에서 얻고
     ② 그 홈페이지에 **실제로 걸려 있는 링크** 중 채용으로 보이는 것을 고르고
     ③ 열어 보고 채용 페이지가 맞을 때만 넣는다

   링크가 없는 회사는 그냥 건너뛴다 — 만들어 내지 않는다. 그리고 **사람이 넣은 값을
   덮지 않는다**(25-3 에서 그룹 통합 포털을 눈으로 확인해 넣었다).

   없는 회사는 **null 이다.** 화면이 기존 검색 링크로 물러난다 — 지어내지 않는다.
   ════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { normalize } = require('./company-name');

const FILE = path.join(__dirname, '..', 'data', 'career-pages.json');

/* 표는 한 번 읽어 둔다. 손으로 고치는 파일이라 요청마다 읽을 이유가 없다
   (고쳤으면 서버를 다시 띄운다 — 카탈로그와 같은 규약). */
let _byNorm = null;

function load() {
  if (_byNorm) return _byNorm;
  _byNorm = new Map();
  try {
    const pages = (JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}).pages || {};
    /* 이름은 정규화해서 담는다. DART 기업개황은 '삼성전자(주)' 로 주고 우리 목록은
       '삼성전자' 라, 그대로 맞추면 리포트에서만 조용히 빗나간다(24-7 과 같은 함정). */
    for (const [name, url] of Object.entries(pages)) {
      if (typeof url === 'string' && /^https:\/\//.test(url)) _byNorm.set(normalize(name), url);
    }
  } catch {
    /* 표가 없어도 서버는 뜬다. 링크 한 줄이 빠질 뿐이다. */
  }
  return _byNorm;
}

/* 회사 이름 → 자사 채용페이지 URL. 없으면 null. */
function urlOf(name) {
  if (!name) return null;
  return load().get(normalize(name)) || null;
}

const count = () => load().size;

module.exports = { urlOf, count, _file: FILE, _reset: () => { _byNorm = null; } };
