# Careerly

대학생 커리어 빌딩 플랫폼 Careerly입니다.
NCS 24개 직업 분류 기반 커리어 로드맵과, 선배 데이터로 집계한 정량·정성 스펙을 제공합니다.

## 실행 방법

```bash
cd backend
npm install
cp .env.example .env      # 키는 비워둬도 서버는 뜬다 (아래 '환경변수' 참고)
npm start                 # 개발 중에는 npm run dev (nodemon)
```

브라우저에서 `http://localhost:3000` 으로 접속합니다.

> **`frontend/careerly.html` 을 파일로 직접 열면 동작하지 않습니다.**
> 회원 정보·스펙·집계가 전부 서버 API 에 있으므로 반드시 백엔드를 띄우고 접속해야 합니다.

처음 실행하면 `backend/data/db.json` 이 자동으로 생성됩니다(회원 데이터라 저장소에는 올라가지
않습니다). 백오피스 화면에서 데모 시드 데이터를 넣으면 집계 화면을 바로 확인할 수 있습니다.

## 프로젝트 구조

```text
careerly
├─ frontend                 # careerly.html 단일 문서 SPA (해시 라우팅), 빌드 없음
│  ├─ careerly.html
│  ├─ css                   # main.css · home.css · mentoring.css · jd-coach.css
│  └─ js
│     ├─ app.js             # 라우터 + 인증
│     ├─ db.js              # 데이터 레이어 (서버 API 호출)
│     ├─ ncs.js             # NCS 24개 직업 분류 카탈로그
│     ├─ career.js          # 커리어 로드맵
│     ├─ aggregation.js     # 스펙 집계 엔진
│     ├─ cas.js             # CAS 점수 엔진 (배점 상수의 단일 출처)
│     ├─ cas-hero.js        # CAS 히어로 (점수·구성·백분위·등급)
│     ├─ cas-compare.js     # 스펙 비교 막대
│     ├─ cas-radar.js       # CAS 레이더 차트
│     ├─ spec-form.js       # 스펙 입력 폼 (+ AI 한 번에 입력)
│     ├─ jd-coach.js        # 자소서 코치
│     ├─ mentoring.js       # CAS · 멘토 찾기 · 내 멘토링
│     ├─ backoffice.js
│     └─ home.js
├─ backend
│  ├─ src
│  │  ├─ server.js          # Express 진입점 + 인증/스펙/관리 API
│  │  ├─ store.js           # db.json 접근 레이어
│  │  ├─ spec-parse.js      # 반정형 스펙 텍스트 → 활동/정량 (규칙 기반)
│  │  ├─ company-classify.js# 회사명 → 기업규모 4분류
│  │  ├─ jd-competency.js   # 역량 원형 14종 + 가이드 조립
│  │  ├─ job-trends.js      # 채용공고 → 직무별 역량 요구 빈도
│  │  ├─ news.js            # 회사 뉴스 → 지원동기 소재
│  │  ├─ ai-provider.js     # LLM 호출 한 겹 (Groq / Ollama)
│  │  └─ routes
│  ├─ data                  # 정적 데이터 캐시 (NCS·공공기관·대기업·중견기업 명단)
│  └─ scripts               # 수집(fetch-*.js) · 집계(build-*.js) · 점검(check-*.js)
├─ docs                     # 설계 문서
└─ test                     # 테스트 136개
```

## 주요 기능

- 커리어 로드맵 — NCS 24개 직업 대분류 → 중분류 → 소분류(세부 직무)
- 중분류별 정량 스펙 (학점, 자격증 보유율, 어학 성적) 집계
- 중분류별 정성 스펙 (대외활동, 인턴십, 프로젝트 등) 보유율
- CAS 점수 (1000점) · 멘토 찾기 · 내 멘토링
- 스펙 입력 AI 분석 — 반정형 텍스트에서 활동·정량값을 자동으로 채움
- 자소서 코치 — 채용공고에서 요구 역량을 뽑아 작성 가이드 제공
- 기업규모 자동분류 (대기업 / 중견기업 / 중소기업 / 공기업)
- 회원가입 / 로그인 / 마이페이지 스펙 입력
- 백오피스 (집계 현황, 데모 시드 데이터 생성)

## 환경변수

`backend/.env.example` 을 복사해 `backend/.env` 로 만들어 씁니다. **전부 비워둬도 서버는 뜨고,
해당 기능만 빠집니다.**

| 키 | 없으면 | 발급처 |
|---|---|---|
| `GROQ_API_KEY` | AI 분석·자소서 코치 AI 보강만 503 | [console.groq.com/keys](https://console.groq.com/keys) (무료) |
| `DATA_GO_KR_SERVICE_KEY` | 데이터 *갱신*만 불가 (명단 캐시는 저장소에 포함) | 공공데이터포털 |
| `WORK24_API_KEY` | 중견기업 자동판정·직무 트렌드 갱신만 불가 | 고용24 |
| `NAVER_CLIENT_ID` / `SECRET` | 뉴스가 웹 검색 폴백으로 동작 (정확도 낮음) | NCP 또는 네이버 개발자센터 |

설정이 실제로 동작하는지 확인:

```bash
cd backend
node scripts/check-ai.js         # AI 프로바이더
node scripts/check-news-api.js   # 뉴스 검색
```

## AI 프로바이더

기본은 **Groq**(`llama-3.3-70b-versatile`) 입니다. 응답이 1초 안팎이고 무료 티어가 있습니다.

키 없이 오프라인으로 쓰려면 로컬 [Ollama](https://ollama.com) 로 바꿀 수 있습니다.

```bash
ollama pull qwen3:8b
# backend/.env 에 CAS_AI_PROVIDER=ollama
```

다만 8B 는 CPU 추론에서 요청당 1분 안팎이 걸립니다. Groq 모델이 폐기되면 `.env` 의
`GROQ_MODEL` 만 [현행 모델](https://console.groq.com/docs/models)로 바꾸면 됩니다.

**AI 는 분류·추출에만 씁니다.** 점수 계산과 자소서 문장은 코드가 담당합니다 — 모델이 낸
점수는 서버가 `cas.js` 로 다시 계산하고(`rescore`), 기간·성과는 원문 근거가 있을 때만
인정합니다. 이유는 `docs/` 와 `CAREERLY-작업정리.md` 6장에 실측과 함께 정리돼 있습니다.

## 테스트

저장소 루트에서 실행합니다.

```bash
for f in test/*.test.js; do node "$f" | tail -1; done
```

## 백엔드 API

```text
POST /api/auth/signup · /api/auth/login · /api/auth/logout
GET  /api/auth/me
GET  /api/profile                    PUT /api/profile
GET  /api/specs                      # 익명화된 전체 스펙 (집계·백분위용)
GET  /api/specs/me                   PUT /api/specs/me
PUT  /api/users/me
GET  /api/career-data · /api/recommendations
GET  /api/departments · /api/career-specs · /api/jobs/:jobId/specs
POST /api/cas/analyze                # 스펙 텍스트 → 활동/정량
POST /api/jd/coach                   # 채용공고 → 요구역량 + 작성 가이드
GET  /api/news/company
GET  /api/company/classify · /api/company/stats
GET  /api/health · /api/stats
GET  /api/admin/users · DELETE /api/admin/users/:username     # devOnly
POST /api/admin/seed · /api/admin/seed-random · /api/admin/clear   # devOnly
```

## 문서

| 문서 | 내용 |
|---|---|
| [CAREERLY-작업정리.md](CAREERLY-작업정리.md) | **전체 맥락·설계 판단·실측 기록 (여기부터 읽으면 됩니다)** |
| [docs/CAS-정리.md](docs/CAS-정리.md) | CAS 점수 체계 전반 — 배점표·상대채점·정량:정성 비중 |
| [docs/CAS-정량-가중치.md](docs/CAS-정량-가중치.md) | 학점·어학·자격증 가중치 |
| [docs/CAS-신규배점-설계안.md](docs/CAS-신규배점-설계안.md) | 배점 개편 설계 이력 |
| [docs/스펙입력-AI-분석-개선.md](docs/스펙입력-AI-분석-개선.md) | AI 한 번에 입력 · 배점 서열 개편 |
| [docs/외부API-연동구조.md](docs/외부API-연동구조.md) | 외부 데이터 수집 구조 |
