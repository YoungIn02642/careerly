-- careerly MySQL 스키마
--
-- ── 설계 원칙 ──
-- 통계를 내는 데 쓰는 것은 테이블로 쪼갠다(JOIN·GROUP BY 로 집계해야 하므로),
-- 화면에서 통째로 읽고 쓰기만 하는 것은 JSON 컬럼에 둔다.
-- 전부 정규화하면 테이블이 15개를 넘고 저장 한 번에 트랜잭션이 길어진다.
-- 반대로 전부 JSON 이면 '자격증별 보유율' 같은 집계를 SQL 로 못 짠다.
--
-- ── 문자셋 ──
-- utf8mb4 가 아니면 이모지(🗂️·✂️)가 저장되지 않는다. careerly 는 분류 라벨에
-- 이모지를 쓰므로 utf8mb3 로 만들면 저장 시점에 깨진다.

SET NAMES utf8mb4;

-- ════════════════════════════════════════════════════════════
--  회원
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id             VARCHAR(32)  PRIMARY KEY,
  username       VARCHAR(64)  NOT NULL UNIQUE,
  -- 소셜 가입은 비밀번호가 없다. NULL 을 허용해야 하고, 로그인 쪽에서 걸러낸다.
  password_hash  VARCHAR(255) NULL,
  name           VARCHAR(64)  NOT NULL,
  -- 이메일은 카카오에서 선택 동의라 안 올 수 있다. UNIQUE 는 유지하되 NULL 허용
  -- (MySQL 은 NULL 을 중복으로 보지 않아 여러 건이 공존한다).
  email          VARCHAR(190) NULL UNIQUE,
  -- 소셜 가입 직후에는 역할이 없다. 추가입력 화면에서 채운다.
  role           ENUM('mentor','mentee') NULL,
  nickname       VARCHAR(32)  NULL,
  provider       VARCHAR(16)  NULL,          -- 'naver' | 'kakao' | NULL(일반 가입)
  provider_id    VARCHAR(64)  NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 소셜 로그인은 (제공자, 제공자 계정) 으로 회원을 찾는다. 매 로그인마다 조회된다.
  UNIQUE KEY uk_provider (provider, provider_id),
  KEY idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  user_id        VARCHAR(32)  PRIMARY KEY,
  nickname       VARCHAR(32)  NULL,
  university     VARCHAR(128) NULL,
  current_job    VARCHAR(128) NULL,
  tips           TEXT         NULL,
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token       VARCHAR(64) PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL,
  created_at  BIGINT      NOT NULL,
  expires_at  BIGINT      NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- 만료 세션 정리와 '이 회원의 기존 세션 제거'가 매 로그인마다 돈다
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ════════════════════════════════════════════════════════════
--  스펙 — 통계의 원천
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_specs (
  user_id     VARCHAR(32)  PRIMARY KEY,
  -- dept 는 집계를 묶는 키다. 화면에 보이는 학과명(major)은 자유 입력이라 따로 둔다.
  dept        VARCHAR(32)  NULL,
  major       VARCHAR(128) NULL,
  field       VARCHAR(32)  NULL,
  job         VARCHAR(32)  NULL,
  company     VARCHAR(190) NULL,
  corp_type   VARCHAR(16)  NULL,
  gpa         DECIMAL(4,2) NULL,
  gpa_max     DECIMAL(4,2) NULL,
  -- 어학 점수는 시험 종류가 늘어날 때마다 컬럼을 추가하게 된다(TEPS·G-TELP·제2외국어를
  -- 실제로 그렇게 늘렸다). 통계는 '평균'만 내면 되므로 JSON 으로 두고 앱에서 계산한다.
  scores      JSON         NULL,
  -- 옛 스펙 호환 필드. 새로 쓰이지 않지만 기존 데이터를 버리지 않는다.
  qual        JSON         NULL,
  detail      JSON         NULL,
  -- 직접 입력한 자격증의 발급기관·취득일 { 이름: {issuer, date} }
  cert_meta   JSON         NULL,
  interest_companies JSON  NULL,   -- 멘티: 관심 기업 이름 배열
  careers     JSON         NULL,   -- 멘토: 경력 [{company,start,end,...}]
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_specs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- 커리어 로드맵이 dept/field/job 조합으로 집계한다
  KEY idx_specs_dept (dept, field, job),
  KEY idx_specs_corp (corp_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 자격증·활동은 **보유율 집계**에 쓰인다. JSON 에 두면 '이 학과에서 정보처리기사를
-- 가진 비율' 을 SQL 로 못 짠다. 그래서 이 둘만 테이블로 쪼갠다.
CREATE TABLE IF NOT EXISTS spec_certs (
  user_id   VARCHAR(32)  NOT NULL,
  cert_name VARCHAR(190) NOT NULL,
  PRIMARY KEY (user_id, cert_name),
  CONSTRAINT fk_spec_certs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_spec_certs_name (cert_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS spec_activities (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      VARCHAR(32)  NOT NULL,
  type         VARCHAR(32)  NOT NULL,     -- CAS.ACTIVITY_TYPES 의 id
  name         VARCHAR(190) NULL,
  org          VARCHAR(190) NULL,         -- 주최기관 (인턴십이면 회사)
  duration     VARCHAR(32)  NULL,
  role         VARCHAR(64)  NULL,
  stage        VARCHAR(32)  NULL,         -- 연구 단계 (research 전용)
  outcome      VARCHAR(64)  NULL,
  company_tier VARCHAR(16)  NULL,         -- 인턴십 기업규모 배수용
  company_name VARCHAR(190) NULL,
  CONSTRAINT fk_spec_acts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_spec_acts_user (user_id),
  KEY idx_spec_acts_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ════════════════════════════════════════════════════════════
--  멘토링 · 결제
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS mentoring_requests (
  id           VARCHAR(32)  PRIMARY KEY,
  mentee_id    VARCHAR(32)  NOT NULL,
  mentor_id    VARCHAR(64)  NOT NULL,     -- 아직 시드 멘토라 users 를 참조하지 않는다
  mentor_name  VARCHAR(64)  NULL,
  format       VARCHAR(32)  NOT NULL,
  format_name  VARCHAR(64)  NULL,
  -- 금액은 서버가 정한 값이다. 결제 승인 때 이 값과 대조하므로 절대 화면 값을 넣지 않는다.
  amount       INT          NOT NULL,
  message      TEXT         NULL,
  status       ENUM('pending','paid','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
  order_id     VARCHAR(128) NULL UNIQUE,  -- 결제 시도마다 새로 발급. 승인 때 이걸로 되찾는다
  payment      JSON         NULL,         -- 승인 응답(paymentKey·method·영수증 등)
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_mreq_mentee FOREIGN KEY (mentee_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_mreq_mentee (mentee_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ════════════════════════════════════════════════════════════
--  카탈로그 — 검색 대상
--  파일(JSON)에서 DB 로 옮긴다. LIKE 검색과 페이징을 SQL 로 처리하기 위해서다.
--  수집 스크립트(fetch-*.js)가 채운다.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS certs (
  name       VARCHAR(190) PRIMARY KEY,
  code       VARCHAR(32)  NULL,
  kind       VARCHAR(32)  NULL,           -- national-tech | national-pro | private
  kind_label VARCHAR(32)  NULL,
  grade      VARCHAR(16)  NULL,
  field      VARCHAR(64)  NULL,           -- 대직무분야
  mid_field  VARCHAR(64)  NULL,
  -- LIKE '검색어%' 는 이 인덱스를 탄다. '%검색어%' 는 못 타지만 643건이라 무방하다.
  KEY idx_certs_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS majors (
  name VARCHAR(128) PRIMARY KEY,
  -- careerly 집계 분류. NULL 이면 아직 통계를 내지 않는 계열이다.
  dept VARCHAR(32) NULL,
  KEY idx_majors_dept (dept)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS companies (
  -- 정규화명(공백·법인격 제거, 대문자)을 키로 쓴다. 같은 회사의 표기 흔들림을 합친다.
  norm_name  VARCHAR(190) PRIMARY KEY,
  name       VARCHAR(190) NOT NULL,       -- 화면에 보여줄 이름
  corp_type  VARCHAR(16)  NULL,           -- large | mid | small | public
  source     VARCHAR(190) NULL,
  KEY idx_companies_name (name),
  KEY idx_companies_norm (norm_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 직업 분류(KECO)는 3단계 트리다. 화면이 트리를 통째로 받아 쓰므로 계층을 유지한다.
CREATE TABLE IF NOT EXISTS job_majors (
  code  VARCHAR(8)   PRIMARY KEY,
  no    TINYINT      NOT NULL,            -- 화면 번호(1~10). 공식 코드와 다르다
  name  VARCHAR(128) NOT NULL,
  emoji VARCHAR(16)  NULL,
  descr VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_middles (
  code       VARCHAR(8)   PRIMARY KEY,
  major_code VARCHAR(8)   NOT NULL,
  name       VARCHAR(128) NOT NULL,
  majors     JSON         NULL,           -- 관련 전공 (화면 표시용)
  legacy     JSON         NULL,           -- 옛 스펙 매칭 조건 {dept, field}
  CONSTRAINT fk_jmid_major FOREIGN KEY (major_code) REFERENCES job_majors(code) ON DELETE CASCADE,
  KEY idx_jmid_major (major_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS jobs (
  code        VARCHAR(16)  PRIMARY KEY,
  middle_code VARCHAR(8)   NOT NULL,
  name        VARCHAR(190) NOT NULL,
  avg_wage    INT          NULL,          -- 만원. 0/없음은 NULL(자료 없음과 0원을 구분)
  outlook     VARCHAR(32)  NULL,          -- 화면에는 안 쓰지만 원본을 버리지 않는다
  summary     TEXT         NULL,
  CONSTRAINT fk_jobs_middle FOREIGN KEY (middle_code) REFERENCES job_middles(code) ON DELETE CASCADE,
  KEY idx_jobs_middle (middle_code),
  KEY idx_jobs_wage (avg_wage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
