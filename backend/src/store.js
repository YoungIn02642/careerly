/* db.json 접근 레이어.

   ── 왜 자동 생성이 필요한가 ──
   db.json 은 회원 데이터라 .gitignore 대상이다. 그래서 clone 직후엔 파일이 없고,
   예전 readDb() 는 readFileSync 를 그대로 불러 ENOENT 를 던졌다 — 서버는 떠 있는데
   API 마다 500 이 나서, 받은 사람은 원인을 알 수 없었다(실제로 겪은 문제).

   ── 파일 없음과 파일 손상은 반드시 구분한다 ──
   "없으면 만든다"를 "읽기 실패하면 만든다"로 뭉뚱그리면, JSON 이 한 글자 깨졌을 때
   회원 데이터를 통째로 빈 DB 로 덮어쓴다. 손상은 고쳐야 할 사고지 초기화할 일이 아니므로
   여기서는 멈추고 사람이 판단하게 한다. */
const fs = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '..', 'data');
const SEED_PATH = path.join(DATA_DIR, 'db-seed.json');

/* ── db.json 위치는 배포에서 달라진다 ──────────────────────────
   배포 플랫폼(Railway·Render)의 파일시스템은 휘발성이다. 재배포하거나 인스턴스가
   재시작하면 그 안에 쓴 파일이 사라진다 — 가입 회원과 결제 내역이 통째로 날아간다.
   그래서 운영에서는 영속 볼륨을 붙이고 그 경로를 CAREERLY_DB_PATH 로 알려 준다.

   ── 볼륨을 backend/data 에 마운트하면 안 된다 (중요) ──
   이 폴더에는 커밋된 캐시가 8개 들어 있다(wage-jobs·qnet-certs·ftc-large-groups·
   public-orgs·ncs-taxonomy·work24-companies·career-data·db-seed). 볼륨을 여기에
   걸면 그 파일들이 전부 가려져서 커리어 로드맵·자격증 검색·기업 분류가 죽는다.
   빈 폴더(예: /data)에 마운트하고 이 변수로 db.json 만 그쪽을 보게 한다. */
const DB_PATH = (process.env.CAREERLY_DB_PATH || '').trim()
  || path.join(DATA_DIR, 'db.json');
const DB_DIR = path.dirname(DB_PATH);

/* 저장소가 가져야 할 최소 형태. 옛 db.json 에 없던 키가 나중에 늘어나도
   호출하는 쪽이 undefined 를 만나지 않게 한다. */
const EMPTY_DB = () => ({
  users: [], profiles: [], sessions: [],
  departments: [], careerSpecs: [], userSpecs: [],
});

/* 학과·직무 정적 참조 데이터(회원 데이터 아님)는 db-seed.json 으로 커밋해 둔다.
   clone 한 사람이 빈 껍데기가 아니라 동작하는 기준선에서 시작하도록. */
function seedDb() {
  const db = EMPTY_DB();
  try {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
    for (const k of Object.keys(db)) {
      if (Array.isArray(seed[k])) db[k] = seed[k];
    }
  } catch { /* 시드가 없어도 빈 DB 로 시작하면 된다 — 가입부터 하면 되는 상태다. */ }
  return db;
}

function readDb() {
  let raw;
  try {
    raw = fs.readFileSync(DB_PATH, 'utf-8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;                 // 권한 문제 등은 삼키지 않는다
    const db = seedDb();
    /* 볼륨을 갓 붙이면 그 폴더는 비어 있다. db.json 이 놓일 폴더를 만든다
       (DATA_DIR 이 아니라 DB_DIR — 둘은 배포에서 서로 다른 경로다). */
    fs.mkdirSync(DB_DIR, { recursive: true });
    writeDb(db);
    console.log(`[store] db.json 이 없어 새로 만들었습니다 → ${DB_PATH}`);
    return db;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    /* 여기서 초기화하면 회원 데이터가 사라진다. 고칠 수 있게 알리고 멈춘다. */
    throw new Error(
      `db.json 을 읽을 수 없습니다(JSON 형식 오류: ${e.message}). `
      + `파일이 손상됐을 수 있습니다 — ${DB_PATH} 를 고치거나, 데이터를 버려도 된다면 `
      + `파일을 지우고 서버를 다시 시작하면 새로 만들어집니다.`);
  }

  return { ...EMPTY_DB(), ...parsed };                // 빠진 키만 채운다(기존 값은 그대로)
}

/* 쓰다가 프로세스가 죽으면 db.json 이 반쯤 쓰인 채 남아 위의 "손상" 상태가 된다.
   임시 파일에 다 쓴 뒤 이름을 바꾸면 그 창이 사라진다(rename 은 원자적). */
function writeDb(db) {
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmp, DB_PATH);
}

module.exports = { readDb, writeDb, DB_PATH };
