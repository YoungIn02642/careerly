# C:road (커리어 로드)

대학생 커리어 빌딩 플랫폼 **C:road** 입니다.
직업 분류(KECO) 기반 커리어 로드맵과, 선배 데이터로 집계한 정량·정성 스펙을 제공합니다.

> **이름이 careerly 에서 C:road 로 바뀌었습니다.** 저장소 URL·배포 주소·파일명
> (`frontend/careerly.html`)·Docker 컨테이너 이름·localStorage 키에는 옛 이름이
> 남아 있는데, **일부러 그대로 둔 것**입니다 — 바꾸면 저장된 로그인 세션과 로드맵
> 상태가 끊기고 배포 주소가 깨집니다. 문서와 화면에 보이는 **제품 이름만** 바꿨습니다.

운영: <https://careerly-production-5d6b.up.railway.app>

## 실행 방법

전제: **Node 20 이상, Docker, Git.**

```bash
npm install               # 루트에서 한 번. workspaces 라 backend/ 의존성까지 깔린다
```

MySQL 을 띄웁니다. **DB 가 없으면 서버는 일부러 죽습니다** — 살아있는 척하면 원인을
찾기 어려워서입니다.

```bash
docker run -d --name careerly-mysql \
  -e MYSQL_ROOT_PASSWORD=careerly_dev -e MYSQL_DATABASE=careerly \
  -p 3306:3306 mysql:8.0 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
# 두 번째부터는 docker start careerly-mysql

cp backend/.env.example backend/.env      # DB_* 만 채우면 뜬다 (아래 '환경변수')
node backend/scripts/load-schema.js       # 테이블 생성 (mysql CLI 없이 동작)
node backend/scripts/migrate-to-mysql.js --catalog   # 자격증·학과·기업·직업 카탈로그
```

```bash
npm run dev               # nodemon. npm start 는 재시작이 없다
```

브라우저에서 `http://localhost:3000` 으로 접속합니다.
clone 부터 첫 PR 까지의 전체 절차는 [docs/팀-개발환경.md](docs/팀-개발환경.md) 에 있습니다.

> **`frontend/careerly.html` 을 파일로 직접 열면 동작하지 않습니다.**
> 회원 정보·스펙·집계가 전부 서버 API 에 있으므로 반드시 백엔드를 띄우고 접속해야 합니다.

### 화면만 볼 때 — MySQL 없이

화면(프론트엔드)만 고치는 중이라면 Docker·MySQL 없이 띄울 수 있습니다.

```bash
npm run preview           # http://localhost:3100
```

DB 가 필요 없는 코드는 **실제 서버 코드가 그대로** 답하고(자소서 코치·기업분석·
직무 적합도·스펙UP·자격증·학과·회사·직업 카탈로그), DB 가 필요한 부분만 메모리로
대신합니다(회원·스펙·백오피스·인사이트·멘토링). 데모 데이터가 채워진 채로 열립니다.

> ⚠️ **개발 기계 전용입니다.** 비밀번호를 검사하지 않아 아무 아이디로나 로그인되고,
> 적은 내용은 서버를 끄면 사라집니다. 결제·본인확인은 '설정 안 됨' 으로 동작합니다.
> API 동작까지 봐야 하면 MySQL 을 띄우고 `npm run dev` 를 쓰세요.

관리자로 백오피스에 들어가려면 `.env` 의 `ADMIN_USERNAMES` 에 아이디를 넣고 서버를 다시
띄웁니다. **첫 관리자를 만드는 유일한 방법입니다** — 권한을 주는 화면이 백오피스 안에
있어서, 비어 있으면 아무도 못 들어갑니다. 백오피스에서 데모 시드 데이터를 넣으면 집계
화면을 바로 확인할 수 있습니다.

## 프로젝트 구조

```text
C:road
├─ frontend                 # careerly.html 단일 문서 SPA (해시 라우팅), 빌드 없음
│  ├─ careerly.html         # 페이지 16개가 이 한 파일에 들어 있다
│  ├─ css                   # main.css · home.css · mentoring.css · jd-coach.css
│  └─ js
│     ├─ app.js             # 라우터 + 인증
│     ├─ db.js              # 데이터 레이어 (서버 API 호출)
│     ├─ ncs.js             # NCS 직업 분류 카탈로그
│     ├─ keco.js            # 학과(KECO) 분류
│     ├─ career.js          # 커리어 로드맵
│     ├─ aggregation.js     # 스펙 집계 엔진
│     ├─ cas.js             # CAS 점수 엔진 (배점 상수의 단일 출처 — 백엔드도 읽는다)
│     ├─ cas-hero.js        # CAS 히어로 (점수·구성·백분위·등급)
│     ├─ cas-compare.js     # 스펙 비교 막대
│     ├─ cas-radar.js       # CAS 레이더 차트
│     ├─ spec-form.js       # 스펙 입력 폼 (+ AI 한 번에 입력)
│     ├─ account.js         # 마이페이지 계정 관리·탈퇴
│     ├─ mentor-profile.js  # 마이페이지 멘토 페이지 (멘토만)
│     ├─ mentoring.js       # 멘토 찾기 · 멘토 상세 · 내 멘토링
│     ├─ jd-coach.js        # 자소서 코치
│     ├─ company-cover.js   # 회사 찾기 (자소서 코치의 앞 단계)
│     ├─ specup.js          # 스펙 채우기 — 부족 항목 + 시험일정·공모전 모집
│     ├─ insight.js         # 커리어 인사이트 (커뮤니티 게시판)
│     ├─ backoffice.js      # 백오피스 (관리자만)
│     └─ home.js
├─ backend
│  ├─ src
│  │  ├─ server.js          # Express 진입점 + 인증/스펙/카탈로그/관리 API
│  │  ├─ mysql.js           # 커넥션 풀 · 트랜잭션
│  │  ├─ repo.js            # 데이터 접근 계층 (라우트가 SQL 을 직접 쓰지 않는다)
│  │  ├─ catalog-db.js      # 자격증·학과·기업·직업 카탈로그 조회 (SQL LIKE)
│  │  ├─ oauth.js           # 네이버·카카오 소셜 로그인
│  │  ├─ nice-auth.js       # 본인확인(CI) — 한 사람 = 한 계정
│  │  ├─ spec-parse.js      # 반정형 스펙 텍스트 → 활동/정량 (규칙 기반)
│  │  ├─ company-classify.js# 회사명 → 기업규모 4분류
│  │  ├─ jd-competency.js   # 역량 원형 14종 + 가이드 조립
│  │  ├─ job-trends.js      # 채용공고 → 직무별 역량 요구 빈도
│  │  ├─ job-filter.js      # 대학생 취업 선택지가 아닌 직업 걸러내기
│  │  ├─ wage-jobs.js       # 직업별 임금·전망
│  │  ├─ news.js            # 회사 뉴스 → 지원동기 소재
│  │  ├─ specup.js          # 자격증 시험일정 · 공모전/대외활동 모집
│  │  ├─ demo-seed.js       # 백오피스 데모 시드
│  │  ├─ ai-provider.js     # LLM 호출 한 겹 (Groq 전용)
│  │  └─ routes             # recommendations · casAnalyze · jdCoach · specup · mentoring · payments · insight
│  ├─ database/schema.sql   # MySQL 스키마
│  ├─ data                  # 수집 캐시 (NCS·공공기관·대기업·중견기업·자격증·임금)
│  └─ scripts               # 수집(fetch-*) · 집계(build-*) · 점검(check-*) · 이관(migrate-*)
├─ docs                     # 설계·운영 문서
└─ test                     # 테스트 640개 (17개 파일)
```

저장소는 **MySQL 8** 입니다. `routes/careerData.js` 에 남은 SQLite 경로는 죽은 코드입니다.
인증은 bcryptjs + cookie-parser 기반 세션 쿠키입니다.

## 주요 기능

- 커리어 로드맵 — KECO 1차 → 2차 분류 → 직업(461개), 직업별 임금·전망
- 중분류별 정량 스펙 (학점, 자격증 보유율, 어학 성적) 집계
- 중분류별 정성 스펙 (대외활동, 인턴십, 프로젝트 등) 보유율
- CAS 점수 (1000점) · 백분위 · 등급 · 레이더 · 스펙 비교
- 스펙 채우기 — 부족한 항목에 국가자격 시험일정·공모전 모집공고를 붙여 보여줌
- 스펙 입력 AI 분석 — 반정형 텍스트에서 활동·정량값을 자동으로 채움
- 자격증·학과·대학·기업 자동완성 (카탈로그 DB)
- 자소서 코치 — 채용공고에서 요구 역량을 뽑아 작성 가이드 제공 + 회사 뉴스로 지원동기 소재
- 기업규모 자동분류 (대기업 / 중견기업 / 중소기업 / 공기업)
- 회원가입 / 로그인 / **소셜 로그인(네이버·카카오)** / **본인확인(CI) — 한 사람 한 계정**
- 마이페이지 3탭 — 계정 관리 · 스펙 관리 · 멘토 페이지(멘토만), 회원 탈퇴
- 멘토 찾기 · 날짜·시간을 골라 신청 · 내 멘토링 · **토스페이먼츠 결제**
- 백오피스 (집계 현황, 회원 관리, 권한 지정, 데모 시드) — 관리자만

## 환경변수

`backend/.env.example` 을 복사해 `backend/.env` 로 만들어 씁니다.

**필수는 DB 접속뿐입니다.** 나머지는 **전부 비워둬도 서버는 뜨고, 해당 기능만 빠집니다.**

| 키 | 없으면 | 발급처 |
|---|---|---|
| `DB_HOST`·`DB_PORT`·`DB_USER`·`DB_PASSWORD`·`DB_NAME` | **서버가 뜨지 않는다** | 로컬 Docker MySQL |
| `MYSQL_URL` | 배포용. 있으면 위 `DB_*` 는 무시된다 | Railway MySQL 서비스가 주입 |
| `ADMIN_USERNAMES` | 백오피스에 아무도 못 들어간다 | 쉼표로 여러 개 |
| `GROQ_API_KEY` | AI 분석·자소서 코치 AI 보강만 503 | [console.groq.com/keys](https://console.groq.com/keys) (무료) |
| `DATA_GO_KR_SERVICE_KEY` | 데이터 *갱신*만 불가 (캐시는 저장소에 포함). 스펙 채우기의 **자격증 시험일정**도 빠진다 — 이 키는 API 마다 따로 활용신청해야 한다 | 공공데이터포털 |
| `YOUTH_API_KEY` | 스펙 채우기의 **공모전·대외활동 모집**만 빠진다 | [온통청년 마이페이지](https://www.youthcenter.go.kr/myPage/openapi) (data.go.kr 키와 다름) |
| `WORK24_API_KEY` | 중견기업 자동판정·직무 트렌드 갱신만 불가 | 고용24 |
| `CAREERNET_API_KEY` | 대학 자동완성만 빠진다 (직접 입력은 된다) | 커리어넷 (수동 승인) |
| `NICE_SITE_CODE` / `_PASSWORD` / `_RETURN_URL` | 개발 모드로 동작(모의 CI). **`NODE_ENV=production` 에서는 503** | NICE평가정보 (계약 필요) |
| `NAVER_LOGIN_CLIENT_ID` / `_SECRET` | 네이버 로그인 버튼이 안 뜬다 | [developers.naver.com](https://developers.naver.com/apps) |
| `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | 카카오 로그인 버튼이 안 뜬다 | [developers.kakao.com](https://developers.kakao.com/console/app) |
| `TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | 결제 없이 신청만 남는다 | [developers.tosspayments.com](https://developers.tosspayments.com) (테스트키 즉시) |
| `NAVER_CLIENT_ID` / `_SECRET` | 뉴스가 웹 검색 폴백으로 동작 (정확도 낮음) | NCP 또는 네이버 개발자센터 |

> ⚠️ `NAVER_CLIENT_ID`(뉴스 검색)와 `NAVER_LOGIN_CLIENT_ID`(로그인)는 **다른 애플리케이션**
> 입니다. 같은 값을 넣으면 인증이 실패합니다. 각 키의 주의사항은 `.env.example` 주석에
> 자세히 적혀 있습니다.

설정이 실제로 동작하는지 확인:

```bash
cd backend
node scripts/check-ai.js            # AI 프로바이더
node scripts/check-news-api.js      # 뉴스 검색
node scripts/check-auth-pay.js      # 소셜 로그인 · 본인확인 · 결제
node scripts/check-careernet-api.js # 커리어넷
node scripts/check-specup-api.js    # 자격증 시험일정 · 공모전
```

## AI 프로바이더

**Groq**(`llama-3.3-70b-versatile`) 하나만 씁니다. 응답이 1초 안팎이고 무료 티어가 있습니다.
`backend/.env` 의 `GROQ_API_KEY` 만 채우면 되고, 확인은 `node scripts/check-ai.js` 입니다.

키가 없으면 AI 기능(스펙 "AI로 한 번에 입력" · 자소서 코치 역량 보강 · AI 초안)만 503 을
돌려주고 나머지 화면은 그대로 동작합니다.

Groq 모델이 폐기되면 `.env` 의 `GROQ_MODEL` 만
[현행 모델](https://console.groq.com/docs/models)로 바꾸면 됩니다.

> 예전에는 로컬 Ollama 를 기본으로 두고 Groq 를 선택지로 뒀는데, 환경변수가 안 읽히면
> 조용히 Ollama 로 떨어져 **쓰지도 않는 도구의 연결 오류**가 사용자 화면에 떴습니다.
> 프로바이더를 하나로 줄여 그 실패 모드를 없앴습니다(2026-08).

**AI 는 분류·추출에만 씁니다.** 점수 계산과 자소서 문장은 코드가 담당합니다 — 모델이 낸
점수는 서버가 `cas.js` 로 다시 계산하고(`rescore`), 기간·성과는 원문 근거가 있을 때만
인정합니다. 이유는 `docs/` 와 `CROAD-작업정리.md` 6장에 실측과 함께 정리돼 있습니다.

## 테스트

저장소 루트에서, **셸에서** 실행합니다. 현재 640개입니다.

```bash
for f in test/*.test.js; do node "$f" | tail -1; done
```

`npm test` 도 같은 명령이지만, Windows 에서는 npm 이 `cmd` 로 실행해 깨집니다.
Git Bash 에서는 위 명령을 직접 씁니다.

## 브랜치와 배포

```text
feature/*  →  PR  →  dev (기본 브랜치 · 스테이징 자동배포)  →  PR  →  main (운영 자동배포)
```

**`main` 에 직접 푸시하지 않습니다.** 배포는 Railway 이고, 절차와 환경변수 주입 방법은
[docs/배포.md](docs/배포.md) 8~9장에 있습니다.

## 백엔드 API

```text
인증·계정
  POST /api/auth/signup · /login · /logout · /onboarding · /withdraw
  GET  /api/auth/me · /api/auth/providers · /api/auth/check-username
  GET  /api/auth/:provider · /api/auth/:provider/callback     # naver | kakao
  GET  /api/verify/status   POST /api/verify/request · /api/verify/result   # 본인확인(CI)
  GET  /api/profile         PUT  /api/profile · /api/users/me

스펙·집계
  GET  /api/specs                      # 익명화된 전체 스펙 (집계·백분위용)
  GET  /api/specs/me                   PUT /api/specs/me
  GET  /api/recommendations · /api/stats
  GET  /api/departments · /api/career-specs · /api/jobs/:jobId/specs

카탈로그 (자동완성)
  GET  /api/certs · /api/certs/suggest
  GET  /api/majors · /api/majors/suggest · /api/majors/classify
  GET  /api/jobs · /api/universities/suggest
  GET  /api/company/classify · /api/company/suggest · /api/company/stats

AI · 뉴스
  POST /api/cas/analyze                # 스펙 텍스트 → 활동/정량
  POST /api/jd/coach                   # 채용공고 → 요구역량 + 작성 가이드
  GET  /api/news/company

스펙 채우기
  GET  /api/specup/exams               # 자격증 이름 → 국가자격 시험일정(접수중/다음 회차)
  GET  /api/specup/activities          # 공모전·대외활동 모집

멘토링 · 결제
  GET  /api/mentoring/formats · /api/mentoring/requests
  POST /api/mentoring/requests · /api/mentoring/requests/:id/cancel
  GET  /api/payments/config   POST /api/payments/prepare · /api/payments/confirm

운영
  GET  /api/health
  GET  /api/admin/users · DELETE /api/admin/users/:username        # 관리자
  POST /api/admin/seed · /api/admin/seed-random · /api/admin/clear # 관리자
```

## 문서

| 문서 | 내용 |
|---|---|
| [CROAD-작업정리.md](CROAD-작업정리.md) | **전체 맥락·설계 판단·실측 기록 (여기부터 읽으면 됩니다)** |
| [docs/화면-구조-지도.md](docs/화면-구조-지도.md) | **화면을 고치기 전에 볼 것** — 페이지 16개가 한 파일에 있고 절반은 JS 가 만든다 |
| [docs/팀-개발환경.md](docs/팀-개발환경.md) | clone 부터 첫 PR 까지 |
| [docs/배포.md](docs/배포.md) | Railway 배포·환경변수·스테이징/운영 분리 |
| [docs/CAS-정리.md](docs/CAS-정리.md) | CAS 점수 체계 전반 — 배점표·상대채점·정량:정성 비중 |
| [docs/CAS-정량-가중치.md](docs/CAS-정량-가중치.md) | 학점·어학·자격증 가중치 |
| [docs/CAS-신규배점-설계안.md](docs/CAS-신규배점-설계안.md) | 배점 개편 설계 이력 |
| [docs/스펙입력-AI-분석-개선.md](docs/스펙입력-AI-분석-개선.md) | AI 한 번에 입력 · 배점 서열 개편 |
| [docs/외부API-연동구조.md](docs/외부API-연동구조.md) | 외부 데이터 수집 구조 |
| [docs/2차-배포-수정목록.md](docs/2차-배포-수정목록.md) | 2차 배포 실행 목록 |
