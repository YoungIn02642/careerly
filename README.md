# Careerly

대학생 커리어 빌딩 플랫폼 Careerly입니다.  
사용자의 프로필 정보를 저장하고, 학과/직무별 커리어 데이터와 취업 스펙 정보를 제공합니다.

## 프로젝트 구조

```text
careerly
├─ frontend
│  ├─ Main_web.html
│  ├─ career.html
│  ├─ login.html
│  ├─ signup.html
│  └─ mypage.html
├─ backend
│  ├─ src
│  │  ├─ server.js
│  │  └─ store.js
│  ├─ data
│  │  └─ career-data.json
│  ├─ package.json
│  └─ package-lock.json
├─ .gitignore
└─ README.md
```

## 주요 기능

회원가입
로그인 / 로그아웃
로그인 사용자 확인
마이페이지 프로필 저장 및 조회
학과/직무별 커리어 데이터 제공
정량 스펙, 정성 스펙, 합격 기업 데이터 제공

## 실행 방법

백엔드 폴더로 이동합니다.

```text
cd backend
npm install
npm start
```

서버 실행 후 브라우저에서 접속합니다.

```text
http://localhost:3000/Main_web.html
```

## API 목록

### 인증 API

```text
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### 프로필 API

```text
GET /api/profile
PUT /api/profile
```

### 커리어 데이터 API

```text
GET /api/career-data
```

## 데이터 저장 방식

현재는 초기 개발 및 시연을 위해 JSON 파일 기반으로 데이터를 저장합니다.

backend/data/career-data.json: 학과/직무/스펙 데이터

backend/data/users.json: 회원 정보

backend/data/profiles.json: 사용자 프로필 정보

추후 MySQL, MongoDB, PostgreSQL 같은 실제 DB로 교체할 수 있습니다.

## 개발 상태

현재 완료된 작업:

프론트엔드/백엔드 폴더 분리

회원가입, 로그인 기능 구현

마이페이지 프로필 저장 기능 구현

커리어 데이터 JSON 분리

서버 API와 프론트 화면 연결
