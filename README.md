# Careerly

대학생 커리어 빌딩 플랫폼 Careerly입니다.
NCS 24개 직업 분류 기반 커리어 로드맵과, 선배 데이터로 집계한 정량·정성 스펙을 제공합니다.

## 프로젝트 구조

```text
careerly
├─ frontend                 # careerly.html 단일 문서 SPA (해시 라우팅)
│  ├─ careerly.html
│  ├─ css
│  │  ├─ main.css
│  │  ├─ home.css
│  │  └─ mentoring.css
│  └─ js
│     ├─ app.js             # 라우터 + 인증
│     ├─ db.js              # localStorage 저장소
│     ├─ ncs.js             # NCS 24개 직업 분류 카탈로그
│     ├─ career.js          # 커리어 로드맵
│     ├─ aggregation.js     # 스펙 집계 엔진
│     ├─ spec-form.js       # 스펙 입력 폼
│     ├─ mentoring.js       # CAS · 멘토 찾기 · 내 멘토링
│     ├─ backoffice.js
│     └─ home.js
├─ backend
│  ├─ src
│  │  ├─ server.js
│  │  ├─ store.js
│  │  └─ routes
│  ├─ data
│  │  └─ career-data.json
│  └─ package.json
├─ .gitignore
└─ README.md
```

## 주요 기능

- 커리어 로드맵 — NCS 24개 직업 대분류 → 중분류 → 소분류(세부 직무)
- 중분류별 정량 스펙 (학점, 자격증 보유율, 어학 성적) 집계
- 중분류별 정성 스펙 (대외활동, 인턴십, 프로젝트 등 8개 항목) 보유율
- CAS 점수, 멘토 찾기, 내 멘토링
- 회원가입 / 로그인 / 마이페이지 스펙 입력
- 백오피스 (집계 현황, 데모 시드 데이터 생성)

## 실행 방법

프론트엔드는 별도 빌드가 없습니다. `frontend/careerly.html` 을 브라우저에서 바로 열어도 동작합니다.

백엔드를 통해 서빙하려면:

```text
cd backend
npm install
npm start
```

브라우저에서 접속합니다.

```text
http://localhost:3000
```

## 데이터 저장 방식

현재 프론트엔드는 **브라우저 `localStorage`** 에 모든 데이터를 저장합니다 (`frontend/js/db.js`).
회원 정보, 스펙 입력값, 로그인 세션이 모두 여기에 들어갑니다.

이 때문에 다음 특성이 있습니다.

- 서버 없이 `careerly.html` 만 열어도 전체 기능이 동작합니다.
- 브라우저를 바꾸거나 사이트 데이터를 지우면 가입 정보와 스펙이 사라집니다.
- 기기 간에 데이터가 공유되지 않습니다.

백오피스 화면에서 데모 시드 데이터를 넣으면 집계 화면을 바로 확인할 수 있습니다.

## 백엔드 API

백엔드에는 인증·프로필·커리어 데이터 API가 구현되어 있습니다.

```text
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

GET  /api/profile
PUT  /api/profile

GET  /api/career-data
GET  /api/recommendations
```

> **주의** — 현재 프론트엔드(SPA)는 이 API를 호출하지 않습니다.
> 과거 `Main_web.html`, `login.html`, `signup.html`, `mypage.html`, `career.html` 이
> 유일한 소비자였고, SPA 로 통합하면서 제거되었습니다.
> 지금 백엔드는 `frontend/` 를 정적 서빙하는 역할만 합니다.
> localStorage 대신 서버 DB를 쓰려면 `frontend/js/db.js` 를 위 API 호출로 교체해야 합니다.

## 개발 상태

완료:

- 프론트엔드/백엔드 폴더 분리
- 단일 문서 SPA 로 화면 통합 (홈·로그인·회원가입·마이페이지·커리어 로드맵·멘토링·백오피스)
- 커리어 로드맵을 NCS 24개 직업 분류 기반으로 개편
- 좁은 화면(≤900px)용 네비게이션 드로어

남은 작업:

- 마이페이지 스펙 입력 폼(`spec-form.js`)이 아직 학과 기반입니다. NCS 분류로 옮기려면
  기존 스펙 레코드 마이그레이션이 필요합니다. 현재는 `js/ncs.js` 의 `legacy` 매핑으로
  옛 스키마(`dept`/`field`/`job`)를 NCS 중분류에 대응시켜 집계하고 있습니다.
- SPA 를 백엔드 API 에 연결할지 결정 필요 (위 '백엔드 API' 주의 참고)
