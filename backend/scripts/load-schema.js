#!/usr/bin/env node
/* database/schema.sql 을 접속한 DB 에 넣는다.
 *
 *   node scripts/load-schema.js                    # .env 의 접속 정보(로컬)
 *   MYSQL_URL="mysql://..." node scripts/load-schema.js   # 배포 DB
 *
 * ── 왜 이 스크립트가 있나 ──
 * 원래는 `mysql < schema.sql` 한 줄이면 된다. 그런데 Railway 컨테이너에는 셸이
 * 없어서 배포 DB 는 내 PC 에서 넣어야 하고, 내 PC 에는 mysql CLI 가 없다
 * (MySQL 을 Docker 로만 돌려서 클라이언트가 PATH 에 없다). 팀원 PC 도 마찬가지일
 * 것이므로 CLI 설치를 전제하지 않는다. mysql2 는 이미 의존성에 있다.
 *
 * ── 안전장치 ──
 * schema.sql 은 CREATE TABLE IF NOT EXISTS 라 여러 번 돌려도 데이터를 지우지
 * 않는다. 그래도 어느 DB 에 넣는지 먼저 찍고 시작한다 — 로컬에 넣으려다 배포
 * DB 에 넣는(또는 그 반대) 사고를 막는다.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { config } = require('../src/mysql');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const { _from, ...c } = config();
  console.log(`대상 : ${c.user}@${c.host}:${c.port}/${c.database}`);
  console.log(`출처 : ${_from}`);
  console.log(`파일 : ${path.relative(process.cwd(), sqlPath)} (${sql.length.toLocaleString()}자)\n`);

  /* multipleStatements 는 SQL 인젝션 위험 때문에 평소엔 끄는 옵션이다.
     여기서는 저장소에 있는 고정 파일만 실행하므로 켠다. 서버 쪽 풀은 그대로 꺼져 있다. */
  const conn = await mysql.createConnection({ ...c, multipleStatements: true, charset: 'utf8mb4' });
  try {
    await conn.query(sql);
    const [rows] = await conn.query('SHOW TABLES');
    const names = rows.map(r => Object.values(r)[0]);
    console.log(`완료 — 테이블 ${names.length}개`);
    console.log('  ' + names.join(', '));
  } finally {
    await conn.end();
  }
}

main().catch(e => {
  console.error('스키마 투입 실패:', e.message);
  process.exit(1);
});
