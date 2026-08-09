#!/usr/bin/env node
/* 커리어 인사이트 운영방침 공지를 넣는다.
 *
 *   node scripts/seed-notice.js
 *   MYSQL_URL="mysql://..." node scripts/seed-notice.js    # 배포 DB
 *
 * ── 왜 스크립트인가 ──
 * 공지는 관리자만 쓸 수 있는데(routes/insight.js), 새 환경에는 관리자가 아직 없을
 * 수 있다. ADMIN_USERNAMES 로 관리자를 만들고 → 로그인하고 → 글을 쓰는 절차를
 * 거치지 않아도 게시판이 규칙을 갖춘 상태로 시작하게 한다.
 *
 * ── 여러 번 돌려도 안전하다 ──
 * 같은 제목의 공지가 이미 있으면 **덮어쓰지 않고** 건너뛴다. 운영 중에 관리자가
 * 문구를 다듬었을 수 있는데, 스크립트를 다시 돌렸다고 그 수정이 날아가면 안 된다.
 * 문구를 새로 반영하려면 --force 로 명시한다.
 *
 * 글쓴이는 관리자 계정을 쓰고, 없으면 가장 먼저 가입한 회원으로 단다
 * (insight_posts.user_id 가 users 를 참조하므로 주인 없는 글은 만들 수 없다).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { nanoid } = require('nanoid');
const { query, queryOne, pool } = require('../src/mysql');

const TITLE = '[필독] 커리어 인사이트 운영방침 · 게시글 작성 규칙';

const BODY = `커리어 인사이트는 취업을 준비하는 사람들이 **서로에게 도움이 되는 정보**를 나누는 공간입니다.
모두가 편하게 쓰고 읽을 수 있도록 아래 내용을 지켜주세요.

■ 이런 글을 환영합니다
· 서류·면접·인턴 합격 후기와 탈락 후기 (탈락 후기도 정보입니다)
· 자격증·어학 공부 방법, 실제로 걸린 기간과 비용
· 직무가 실제로 하는 일, 현직자에게 들은 이야기
· 답이 정해지지 않은 고민 — "이 스펙으로 어디를 넣을까요" 같은 질문도 좋습니다

■ 이런 글은 삭제됩니다
1. 욕설·비방·인신공격
   특정인이나 특정 집단을 깎아내리는 글, 조롱하는 댓글은 예고 없이 지웁니다.
   회사·학교·직무를 비판하는 것은 괜찮지만, 사람을 향한 공격은 안 됩니다.

2. 차별과 혐오
   성별·지역·학력·나이·장애·출신에 따른 차별 표현은 어떤 맥락에서도 허용하지 않습니다.

3. 개인정보 노출
   본인이든 타인이든 실명·연락처·주소·학번·사번·재직증명 사진을 올리지 마세요.
   합격 인증을 올릴 때는 이름과 수험번호를 반드시 가려주세요.

4. 광고·홍보·도배
   유료 강의, 컨설팅, 스터디 모집을 가장한 홍보, 외부 링크 유도, 같은 글 반복 게시.

5. 확인되지 않은 정보를 사실처럼 쓰는 글
   "○○기업 올해 채용 없다더라" 같은 소문은 근거(공고·기사)를 함께 적어주세요.
   근거 없는 채용 정보는 다른 사람의 준비 계획을 망칩니다.

6. 자소서 대필·대리 작성 거래
   금전을 주고받는 대필 요청·제안은 금지합니다. 첨삭과 피드백은 괜찮습니다.

7. 저작권 침해
   유료 강의 자료, 기업 내부 문서, 시험 문제의 무단 게시.

■ 위반했을 때
1회 — 해당 글·댓글 삭제 및 안내
2회 — 7일 작성 제한
3회 — 게시판 이용 제한

정도가 심한 경우(개인정보 대량 노출, 지속적인 혐오 표현)에는 1회라도 바로 이용을 제한합니다.

■ 댓글을 쓸 때
답이 아니어도 괜찮습니다. 다만 질문한 사람이 더 막막해지는 말("그 스펙으로는 어렵죠")보다는,
무엇을 더 하면 되는지 한 줄이라도 같이 적어주세요.

■ 문의
운영방침에 대한 의견이나 삭제 조치에 대한 이의는 마이페이지 문의로 보내주세요.
규칙은 이용자 의견을 반영해 계속 다듬습니다.`;

async function main() {
  const force = process.argv.includes('--force');

  const existing = await queryOne(
    'SELECT id, is_notice FROM insight_posts WHERE title=? LIMIT 1', [TITLE]);

  if (existing && !force) {
    console.log(`이미 있습니다 (id ${existing.id}) — 건너뜁니다.`);
    console.log('문구를 새로 반영하려면: node scripts/seed-notice.js --force');
    return;
  }

  /* 관리자 우선, 없으면 가장 먼저 가입한 회원. 회원이 하나도 없으면 만들 수 없다
     (외래키). 그때는 왜 못 만드는지 알려주고 끝낸다 — 조용히 넘어가면 공지가
     안 생긴 이유를 못 찾는다. */
  const author = await queryOne(
    `SELECT id, username, is_admin FROM users
      ORDER BY is_admin DESC, created_at ASC LIMIT 1`);
  if (!author) {
    console.log('회원이 한 명도 없어 공지를 만들 수 없습니다 (글쓴이가 필요합니다).');
    console.log('회원가입을 한 번 한 뒤 다시 실행하세요.');
    return;
  }
  if (!author.is_admin) {
    console.log(`※ 관리자 계정이 없어 '${author.username}' 으로 답니다.`);
    console.log('  .env 의 ADMIN_USERNAMES 를 채우고 서버를 다시 띄우면 관리자가 생깁니다.');
  }

  if (existing) {
    await query('UPDATE insight_posts SET body=?, is_notice=TRUE WHERE id=?', [BODY, existing.id]);
    console.log(`갱신했습니다 (id ${existing.id}).`);
    return;
  }

  const id = nanoid();
  await query(
    `INSERT INTO insight_posts (id, user_id, category, title, body, is_notice)
     VALUES (?,?,?,?,?,TRUE)`,
    [id, author.id, 'free', TITLE, BODY]);
  console.log(`공지를 만들었습니다 (id ${id}, 글쓴이 ${author.username}).`);
}

main()
  .catch(e => { console.error('실패:', e.message); process.exitCode = 1; })
  .finally(() => pool().end());   // pool 은 게으른 팩토리다(src/mysql.js)
