#!/usr/bin/env node
/* users 테이블에 멘토⇄멘티 전환 신청 컬럼 3개를 추가한다.
 *
 *   node scripts/migrate-add-role-change.js                  # .env 의 접속 정보(로컬)
 *   MYSQL_URL="mysql://..." node scripts/migrate-add-role-change.js   # 배포 DB
 *
 * ── 왜 schema.sql 만으로는 안 되나 ──
 * schema.sql 은 CREATE TABLE IF NOT EXISTS 라 이미 있는 테이블은 건드리지 않는다.
 * 이번 변경은 기존 users 테이블에 컬럼을 더하는 ALTER 라서 따로 돌려야 한다
 * (docs/배포.md 8장 — "컬럼 추가·변경은 schema.sql 만으로는 반영되지 않는다").
 *
 * ── 안전장치 ──
 * 컬럼이 이미 있으면 건너뛴다 — 재실행해도 안전하다(load-schema.js 와 같은 원칙).
 */
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { config } = require('../src/mysql');

const COLUMNS = [
  { name: 'pending_role',             ddl: "ALTER TABLE users ADD COLUMN pending_role ENUM('mentor','mentee') NULL AFTER created_at" },
  { name: 'role_change_requested_at', ddl: 'ALTER TABLE users ADD COLUMN role_change_requested_at DATETIME NULL AFTER pending_role' },
  { name: 'role_change_effective_at', ddl: 'ALTER TABLE users ADD COLUMN role_change_effective_at DATETIME NULL AFTER role_change_requested_at' },
];

async function main() {
  const { _from, ...c } = config();
  console.log(`대상 : ${c.user}@${c.host}:${c.port}/${c.database}`);
  console.log(`출처 : ${_from}\n`);

  const conn = await mysql.createConnection({ ...c, charset: 'utf8mb4' });
  try {
    const [existing] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`, [c.database]);
    const have = new Set(existing.map(r => r.COLUMN_NAME));

    for (const col of COLUMNS) {
      if (have.has(col.name)) { console.log(`- ${col.name} 이미 있음, 건너뜀`); continue; }
      await conn.query(col.ddl);
      console.log(`+ ${col.name} 추가함`);
    }
    console.log('\n완료');
  } finally {
    await conn.end();
  }
}

main().catch(e => {
  console.error('마이그레이션 실패:', e.message);
  process.exit(1);
});
