# Careerly Backend

Careerly UI와 바로 연결되는 최소 백엔드 서버입니다.

## 역할

- 회원가입: `POST /api/auth/signup`
- 로그인: `POST /api/auth/login`
- 로그아웃: `POST /api/auth/logout`
- 로그인 사용자 확인: `GET /api/auth/me`
- 마이페이지 프로필 조회: `GET /api/profile`
- 마이페이지 프로필 저장: `PUT /api/profile`
- 학과 데이터 조회: `GET /api/departments`
- 커리어 스펙 데이터 조회: `GET /api/career-specs`
- 특정 직무 스펙 조회: `GET /api/jobs/:jobId/specs`

## 실행 방법

```bash
npm install
npm start
```

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:3000/Main_web.html
```

## 테스트 계정 만들기

회원가입 페이지에서 직접 계정을 만들면 `data/db.json`에 저장됩니다.

## 현재 저장 방식

초기 개발용으로 SQLite/MySQL 대신 `data/db.json` 파일에 저장합니다.
발표/시연 전까지는 충분하고, 나중에 MySQL이나 MongoDB로 교체할 수 있습니다.

## 프론트와 연결된 API

기존 HTML에 이미 다음 요청이 들어가 있습니다.

- `signup.html` → `/api/auth/signup`
- `login.html` → `/api/auth/login`
- `mypage.html` → `/api/profile`

따라서 서버를 실행한 뒤 HTML을 `localhost:3000`에서 열면 바로 동작합니다.
