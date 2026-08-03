#!/usr/bin/env node
/* 이미 만들어진 테이블에 **컬럼을 더한다**.
 *
 *   node scripts/migrate-schema.js                         # .env 접속 정보(로컬)
 *   MYSQL_URL="mysql://..." node scripts/migrate-schema.js # 배포 DB
 *
 * ── 왜 load-schema.js 로는 안 되나 ──
 * schema.sql 은 전부 CREATE TABLE **IF NOT EXISTS** 다. 테이블이 이미 있으면
 * 통째로 건너뛰므로, 새로 추가한 컬럼이 기존 DB 에는 영영 안 생긴다.
 * 그런데 에러는 나지 않는다 — load-schema 는 '완료' 를 찍고, 서버도 뜨고,
 * 저장할 때가 되어서야 Unknown column 으로 죽는다. 새 테이블(universities)은
 * IF NOT EXISTS 로 잘 생기기 때문에 '반은 되고 반은 안 되는' 상태가 되어 더 헷갈린다.
 *
 * ── 안전하게 두 번 돌릴 수 있다 ──
 * 컬럼·인덱스가 이미 있으면 건너뛴다(information_schema 로 먼저 확인).
 * ADD COLUMN 만 하고 DROP 은 하지 않는다 — 이 스크립트로 데이터가 사라질 일은 없다.
 */
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { config } = require('../src/mysql');

/* 추가할 것들. schema.sql 에 적은 정의와 **같아야 한다** —
   새 DB(schema.sql)와 기존 DB(여기)가 갈리면 환경마다 다른 스키마가 된다. */
const COLUMNS = [
  ['user_specs', 'job_major',   `VARCHAR(8) NULL COMMENT 'KECO 1차 코드'`],
  ['user_specs', 'job_middles', `JSON NULL COMMENT 'KECO 2차 코드 배열'`],
  ['users',      'ci',          `VARCHAR(88) NULL COMMENT '본인확인 CI'`],
  ['users',      'phone',       `VARCHAR(20) NULL`],
  ['users',      'verified_at', `DATETIME NULL`],
  ['users',      'is_admin',    `BOOLEAN NOT NULL DEFAULT FALSE COMMENT '백오피스 접근 권한'`],
  ['profiles',   'avatar',      `MEDIUMTEXT NULL COMMENT '프로필 사진 (base64)'`],
  ['profiles',   'gender',      `VARCHAR(16) NULL`],
  ['profiles',   'birthdate',   `DATE NULL`],
  ['profiles',   'phone',       `VARCHAR(20) NULL COMMENT '연락처 (users.phone 인증번호와 별개)'`],
  ['profiles',   'address',     `VARCHAR(255) NULL`],
  ['profiles',   'availability',`JSON NULL COMMENT '멘토 예약 가능 일정'`],
  ['mentoring_requests', 'slot_date', `DATE NULL COMMENT '멘티가 고른 날짜'`],
  ['mentoring_requests', 'slot_time', `VARCHAR(5) NULL COMMENT '멘티가 고른 시각 HH:MM'`],
  ['profiles',   'intro',       `TEXT NULL COMMENT '멘토 소개글'`],
  ['profiles',   'specialties', `JSON NULL COMMENT '전문 분야'`],
  ['profiles',   'timeline',    `JSON NULL COMMENT '경력 타임라인'`],
  ['profiles',   'modes',       `JSON NULL COMMENT '멘토링 가능 형식'`],
];

const INDEXES = [
  ['user_specs', 'idx_specs_job_major', '(job_major)'],
];

/* UNIQUE 는 따로 둔다. 이미 중복 값이 들어 있으면 ALTER 가 실패하는데,
   그 경우 '왜 실패했는지'를 알려줘야 한다(그냥 죽으면 원인을 못 찾는다). */
const UNIQUES = [
  ['users', 'uk_ci', '(ci)'],
];

async function main() {
  const { _from, ...c } = config();
  console.log(`대상 : ${c.user}@${c.host}:${c.port}/${c.database}`);
  console.log(`출처 : ${_from}\n`);

  const conn = await mysql.createConnection({ ...c, charset: 'utf8mb4' });
  try {
    let added = 0, skipped = 0;

    for (const [table, column, def] of COLUMNS) {
      const [[hit]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
        [c.database, table, column]);
      if (hit.n) { console.log(`  = ${table}.${column} — 이미 있음`); skipped++; continue; }
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
      console.log(`  + ${table}.${column} 추가`);
      added++;
    }

    for (const [table, index, cols] of INDEXES) {
      const [[hit]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?`,
        [c.database, table, index]);
      if (hit.n) { console.log(`  = ${table}.${index} — 이미 있음`); skipped++; continue; }
      await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${index}\` ${cols}`);
      console.log(`  + ${table}.${index} 추가`);
      added++;
    }

    for (const [table, index, cols] of UNIQUES) {
      const [[hit]] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?`,
        [c.database, table, index]);
      if (hit.n) { console.log(`  = ${table}.${index} — 이미 있음`); skipped++; continue; }
      try {
        await conn.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${index}\` ${cols}`);
        console.log(`  + ${table}.${index} (UNIQUE) 추가`);
        added++;
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          console.error(`  ! ${table}.${index} 실패 — ${cols} 에 이미 중복 값이 있습니다.`);
          console.error(`    중복을 정리한 뒤 다시 돌리세요:`);
          console.error(`      SELECT ${cols.replace(/[()]/g, '')}, COUNT(*) c FROM ${table}`);
          console.error(`       GROUP BY 1 HAVING c > 1;`);
          throw e;
        }
        throw e;
      }
    }

    console.log(`\n완료 — 추가 ${added}건 · 건너뜀 ${skipped}건`);
    if (added) {
      console.log('\n※ 새 테이블(universities 등)은 이 스크립트가 만들지 않습니다.');
      console.log('   node scripts/load-schema.js 를 함께 돌리세요 (IF NOT EXISTS 라 안전합니다).');
    }
  } finally {
    await conn.end();
  }
}

main().catch(e => {
  console.error('마이그레이션 실패:', e.message);
  process.exit(1);
});
