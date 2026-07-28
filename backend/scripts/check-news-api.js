/* 뉴스 검색 API 키 점검 — .env 에 넣은 키가 실제로 동작하는지 확인한다.

     node scripts/check-news-api.js

   ── 뉴스 검색은 발급처가 둘이고, 어느 쪽이든 된다 ──
   · NCP NAVER API Hub  : 헤더 X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY
                          GET https://naverapihub.apigw.ntruss.com/search/v1/news
   · developers.naver.com : 헤더 X-Naver-Client-Id / X-Naver-Client-Secret
                          GET https://openapi.naver.com/v1/search/news.json
   응답 형식이 같아서 서버(src/news.js)는 둘을 자동으로 가려 쓴다. 이 스크립트는
   양쪽에 실제로 한 번씩 던져 어느 콘솔의 키인지 알려준다.
   주의: 두 콘솔의 값을 하나씩 섞어 넣으면 양쪽 다 실패한다. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const ID     = (process.env.NAVER_CLIENT_ID || '').trim();
const SECRET = (process.env.NAVER_CLIENT_SECRET || '').trim();

(async () => {
  if (!ID || !SECRET) {
    console.log('✗ NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 가 .env 에 없습니다.');
    console.log('  없어도 뉴스 카드는 웹 검색 폴백으로 동작합니다(정확도는 낮습니다).');
    console.log('  발급: https://developers.naver.com → 애플리케이션 등록 → 사용 API 에 "검색" 선택\n');
    return;
  }
  console.log(`Client ID: ${ID.slice(0, 4)}… (${ID.length}자) / Secret: ${SECRET.length}자`);

  /* 길이만 봐도 발급처를 대략 가를 수 있다. 실측한 형식:
       developers.naver.com → ID 10자 안팎 / Secret 10자 안팎
       NCP APIGW            → 키가 40자
     둘 다 정상이다. 다만 ID 와 Secret 의 형식이 서로 다르면 섞어 복사한 것이다. */
  console.log(SECRET.length >= 30
    ? '  (Secret 40자 → NCP NAVER API Hub 형식)'
    : '  (Secret 10자 안팎 → 개발자센터 형식)');
  console.log();

  /* 네이버 뉴스 검색은 발급처가 둘이고 응답 형식은 같다. 어느 쪽 키인지 몰라도 되도록
     둘 다 던져보고 통한 쪽을 알려준다(서버 news.js 와 같은 전략).
       · NCP NAVER API Hub : X-NCP-APIGW-API-KEY-ID  / naverapihub.apigw.ntruss.com
       · 개발자센터         : X-Naver-Client-Id      / openapi.naver.com  */
  const targets = [
    {
      label: 'NCP NAVER API Hub',
      url: 'https://naverapihub.apigw.ntruss.com/search/v1/news?'
         + new URLSearchParams({ query: '아주산업', display: '3', sort: 'date', format: 'json' }),
      headers: { 'X-NCP-APIGW-API-KEY-ID': ID, 'X-NCP-APIGW-API-KEY': SECRET },
      env: 'NEWS_PROVIDER=ncp',
    },
    {
      label: '네이버 개발자센터 검색 API',
      url: 'https://openapi.naver.com/v1/search/news.json?'
         + new URLSearchParams({ query: '아주산업', display: '3', sort: 'date' }),
      headers: { 'X-Naver-Client-Id': ID, 'X-Naver-Client-Secret': SECRET },
      env: 'NEWS_PROVIDER=naver',
    },
  ];

  let okAny = false;
  for (const t of targets) {
    let res, body;
    try {
      res = await fetch(t.url, { headers: t.headers, signal: AbortSignal.timeout(10000) });
      body = await res.text();
    } catch (e) {
      console.log(`✗ ${t.label} — 호출 실패: ${e.message}`);
      continue;
    }

    if (res.ok) {
      okAny = true;
      const data = JSON.parse(body);
      console.log(`✓ ${t.label} — 기사 ${(data.items || []).length}건 조회됨`);
      (data.items || []).slice(0, 3).forEach(it =>
        console.log('   ·', it.title.replace(/<[^>]+>/g, '').slice(0, 50)));
      console.log(`   (서버는 이 경로를 자동으로 찾아 씁니다. 고정하려면 .env 에 ${t.env})`);
      continue;
    }

    let code = '';
    try { code = JSON.parse(body).errorCode || ''; } catch { /* JSON 이 아닐 수 있다 */ }
    console.log(`✗ ${t.label} — HTTP ${res.status}${code ? ` (code ${code})` : ''}: ${body.replace(/\s+/g, ' ').slice(0, 120)}`);
  }

  console.log();
  if (okAny) {
    console.log('이제 자소서 코치의 "이 회사, 지금" 이 네이버 뉴스로 동작합니다.');
    return;
  }

  console.log('→ 양쪽 모두 인증에 실패했습니다. 확인할 것:');
  console.log('  1) Client ID 와 Secret 을 **같은 콘솔의 같은 화면**에서 함께 복사했는가');
  console.log('     (NCP 콘솔 값과 개발자센터 값을 하나씩 섞으면 반드시 실패한다)');
  console.log('  2) NCP 라면 콘솔에서 NAVER API Hub 의 **검색** 상품이 신청·이용중 상태인가');
  console.log('  3) 개발자센터라면 애플리케이션의 "사용 API" 에 **검색** 이 추가돼 있는가');
})();
