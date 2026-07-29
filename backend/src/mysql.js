/* MySQL 연결 — 커넥션 풀 하나를 앱 전체가 공유한다.

   ── 왜 풀인가 ──
   요청마다 연결을 새로 만들면 TCP·인증 왕복이 매번 붙어 느리고, 동시 요청이 몰리면
   MySQL 의 max_connections 에 걸린다. 풀은 연결을 재사용하고 상한을 지킨다.

   ── 접속 정보는 두 가지 형태로 온다 ──
   Railway 는 MYSQL_URL(mysql://user:pass@host:port/db) 하나로 준다. 로컬 개발은
   DB_HOST/DB_USER/... 로 나눠 쓰는 게 편하다. 둘 다 받는다.

   ── 왜 여기서 죽지 않는가 ──
   연결 실패를 모듈 로드 시점에 던지면 서버가 아예 뜨지 않아 원인 로그도 안 남는다.
   풀 생성은 실제 연결을 열지 않으므로(lazy), 첫 질의에서 실패하고 그때 로그가 남는다.
*/
const mysql = require('mysql2/promise');

function config() {
  const url = (process.env.MYSQL_URL || process.env.DATABASE_URL || '').trim();
  if (url) {
    const u = new URL(url);
    return {
      _from: process.env.MYSQL_URL ? 'MYSQL_URL' : 'DATABASE_URL',
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  }
  return {
    _from: 'DB_HOST 등 개별 변수(기본값)',
    host: (process.env.DB_HOST || '127.0.0.1').trim(),
    port: Number(process.env.DB_PORT || 3306),
    user: (process.env.DB_USER || 'root').trim(),
    password: process.env.DB_PASSWORD ?? '',
    database: (process.env.DB_NAME || 'careerly').trim(),
  };
}

let _pool = null;

function pool() {
  if (_pool) return _pool;
  const { _from, ...c } = config();   // _from 은 진단용이라 드라이버에 넘기지 않는다
  _pool = mysql.createPool({
    ...c,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    /* 이모지가 들어간 분류 라벨(🗂️·✂️)을 저장하려면 utf8mb4 여야 한다.
       기본값이 utf8mb3 인 서버가 아직 있어서 명시한다. */
    charset: 'utf8mb4',
    /* DATETIME 을 JS Date 로 바꾸면 시간대 때문에 값이 밀린다. 문자열로 받아
       그대로 쓴다(화면도 문자열을 기대한다). */
    dateStrings: true,
    /* JSON 컬럼은 드라이버가 알아서 파싱한다(mysql2 기본). */
  });
  return _pool;
}

/* 질의 한 줄 헬퍼. 호출부가 pool() 을 매번 꺼내지 않게 한다. */
async function query(sql, params = []) {
  const [rows] = await pool().execute(sql, params);
  return rows;
}

/* 한 건만 필요한 곳이 많다(회원 조회·세션 조회). */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/* 여러 문장을 한 트랜잭션으로 묶는다. 스펙 저장은 user_specs·spec_certs·
   spec_activities 세 테이블을 함께 고치므로, 중간에 실패하면 전부 되돌려야 한다.
   (파일 DB 때는 writeDb 한 번이라 이 문제가 없었다.) */
async function transaction(fn) {
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();   // 반납을 빼먹으면 풀이 말라 서버가 통째로 멈춘다
  }
}

/* 서버 부팅 때 한 번 불러 연결을 확인한다. 여기서 실패하면 원인을 로그로 남기고
   죽는 편이 낫다 — DB 없이 뜬 서버는 모든 API 가 500 을 내면서 살아 있는 척한다. */
async function assertConnection() {
  const c = config();
  try {
    await query('SELECT 1');
    console.log(`[mysql] 연결됨 — ${c.user}@${c.host}:${c.port}/${c.database}`);
  } catch (e) {
    console.error(`[mysql] 연결 실패 — ${c.user}@${c.host}:${c.port}/${c.database}`);
    console.error(`        ${e.message}`);
    console.error(`        접속 정보 출처: ${c._from}`);
    /* 배포 환경에서 실제로 겪은 함정이다. Railway 에서 MYSQL_URL 을
       ${{MySQL.MYSQL_URL}} 로 걸었는데 서비스 이름이 달라 치환이 안 됐고,
       값이 빈 문자열이 되면서 로컬 기본값(127.0.0.1)으로 조용히 떨어졌다.
       주소만 보면 '왜 localhost 로 붙지?' 하고 한참 헤맨다. */
    if (c._from !== 'MYSQL_URL' && c._from !== 'DATABASE_URL') {
      console.error('        MYSQL_URL 이 비어 있습니다. 배포 환경이라면 이게 원인입니다 —');
      console.error('        참조(${{서비스이름.MYSQL_URL}})의 서비스 이름이 실제와 같은지 확인하세요.');
    }
    throw e;
  }
}

module.exports = { pool, query, queryOne, transaction, assertConnection, config };
