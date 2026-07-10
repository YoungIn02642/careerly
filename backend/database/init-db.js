const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "careerly.db");
const careerDataPath = path.join(__dirname, "../data/career-data.json");

if (!fs.existsSync(careerDataPath)) {
  console.error("career-data.json 파일을 찾을 수 없습니다.");
  console.error("찾는 위치:", careerDataPath);
  process.exit(1);
}

const careerData = JSON.parse(fs.readFileSync(careerDataPath, "utf-8"));

if (!Array.isArray(careerData.alumni)) {
  console.error("career-data.json에서 alumni 배열을 찾을 수 없습니다.");
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("SQLite DB 연결 실패:", err.message);
    process.exit(1);
  }

  console.log("SQLite DB 연결 성공:", dbPath);
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS alumni (
      id INTEGER PRIMARY KEY,
      sourceNo INTEGER,
      name TEXT,
      major TEXT,
      company TEXT,
      category TEXT,
      job TEXT,
      mentoringTopic TEXT,
      gpa REAL,
      nonCurricularCount INTEGER,
      certificationCount INTEGER,
      certificationsText TEXT,
      languagesText TEXT,
      comment TEXT
    )
  `);

  db.run("DELETE FROM alumni");

  const insertSql = `
    INSERT INTO alumni (
      id,
      sourceNo,
      name,
      major,
      company,
      category,
      job,
      mentoringTopic,
      gpa,
      nonCurricularCount,
      certificationCount,
      certificationsText,
      languagesText,
      comment
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const stmt = db.prepare(insertSql);

  careerData.alumni.forEach((alumni, index) => {
    stmt.run([
      Number(alumni.id) || index + 1,
      alumni.sourceNo ?? null,
      alumni.name ?? "",
      alumni.major ?? "",
      alumni.company ?? "",
      alumni.category ?? "",
      alumni.job ?? "",
      alumni.mentoringTopic ?? "",
      alumni.gpa === "" || alumni.gpa == null ? null : Number(alumni.gpa),
      alumni.nonCurricularCount == null ? 0 : Number(alumni.nonCurricularCount),
      alumni.certificationCount == null ? 0 : Number(alumni.certificationCount),
      alumni.certificationsText ?? "",
      alumni.languagesText ?? "",
      alumni.comment ?? "",
    ]);
  });

  stmt.finalize();

  db.get("SELECT COUNT(*) AS count FROM alumni", [], (err, row) => {
    if (err) {
      console.error("alumni 개수 확인 실패:", err.message);
      return;
    }

    console.log(`alumni 데이터 ${row.count}개 저장 완료`);
  });
});

db.close((err) => {
  if (err) {
    console.error("SQLite DB 종료 실패:", err.message);
    process.exit(1);
  }

  console.log("SQLite DB 초기화 완료");
});