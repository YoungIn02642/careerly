/* 커리어 인사이트 — 정보를 주고받는 커뮤니티 게시판.
   글쓴이는 로그인한 회원 누구나(멘토·멘티 구분 없음). 읽기는 비로그인도 된다 —
   가격표(mentoring.js FORMATS)처럼 카테고리도 여기가 단일 출처다. 프론트는
   같은 목록을 보여주기 위한 사본을 갖지만, 저장을 막는 건 여기 검사뿐이다. */
const express = require('express');
const { nanoid } = require('nanoid');
const { query, queryOne } = require('../mysql');

const router = express.Router();

const CATEGORIES = [
  { id: 'free',    label: '자유' },
  { id: 'jobinfo', label: '취업정보' },
  { id: 'review',  label: '후기' },
  { id: 'qna',     label: '질문' },
];
const categoryIds = new Set(CATEGORIES.map(c => c.id));

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  next();
}

/* express 4 는 async 핸들러의 예외를 자동으로 못 잡는다(server.js ah() 주석과
   같은 이유) — 여기서도 같은 문제가 생기지 않도록 똑같이 감싼다. */
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const displayName = r => r.author_nickname || r.author_name || '탈퇴한 회원';

function toPostSummary(r) {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    preview: (r.body || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    authorId: r.user_id,
    authorName: displayName(r),
    viewCount: r.view_count,
    commentCount: Number(r.comment_count || 0),
    createdAt: r.created_at,
  };
}

function toPostDetail(r) {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    body: r.body,
    authorId: r.user_id,
    authorName: displayName(r),
    viewCount: r.view_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toComment(r) {
  return {
    id: r.id,
    postId: r.post_id,
    authorId: r.user_id,
    authorName: displayName(r),
    body: r.body,
    createdAt: r.created_at,
  };
}

// 카테고리 목록 — 화면이 이 순서·라벨 그대로 탭을 그린다
router.get('/categories', (req, res) => res.json({ categories: CATEGORIES }));

/* 목록. 카테고리로 거르고(선택), 최신순 페이지네이션. 본문은 미리보기만
   잘라 보낸다 — 목록에서 전체 본문까지 실어 보낼 이유가 없다. */
router.get('/', ah(async (req, res) => {
  const category = String(req.query.category || '').trim();
  if (category && !categoryIds.has(category)) {
    return res.status(400).json({ error: '올바르지 않은 카테고리입니다.' });
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const offset = (page - 1) * limit;

  const where = category ? 'WHERE p.category=?' : '';
  const params = category ? [category] : [];

  const [{ n: total }] = await query(
    `SELECT COUNT(*) AS n FROM insight_posts p ${where}`, params);

  const rows = await query(
    `SELECT p.*, u.nickname AS author_nickname, u.name AS author_name,
            (SELECT COUNT(*) FROM insight_comments c WHERE c.post_id = p.id) AS comment_count
       FROM insight_posts p
       JOIN users u ON u.id = p.user_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
    params);

  res.json({ posts: rows.map(toPostSummary), total: Number(total), page, limit });
}));

/* 상세. 볼 때마다 조회수를 올린다 — 좋아요 같은 별도 집계가 없어서
   '읽혔다'를 나타내는 값이 이거 하나다. 댓글은 오래된 순으로 같이 준다. */
router.get('/:id', ah(async (req, res) => {
  const row = await queryOne(
    `SELECT p.*, u.nickname AS author_nickname, u.name AS author_name
       FROM insight_posts p JOIN users u ON u.id = p.user_id
      WHERE p.id=?`, [req.params.id]);
  if (!row) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });

  await query('UPDATE insight_posts SET view_count = view_count + 1 WHERE id=?', [req.params.id]);
  row.view_count += 1;

  const comments = await query(
    `SELECT c.*, u.nickname AS author_nickname, u.name AS author_name
       FROM insight_comments c JOIN users u ON u.id = c.user_id
      WHERE c.post_id=? ORDER BY c.created_at ASC`, [req.params.id]);

  res.json({ post: toPostDetail(row), comments: comments.map(toComment) });
}));

router.post('/', requireAuth, ah(async (req, res) => {
  const { category, title, body } = req.body || {};
  if (!categoryIds.has(category)) {
    return res.status(400).json({ error: '카테고리를 선택해주세요.' });
  }
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  if (!t || t.length > 200) {
    return res.status(400).json({ error: '제목은 1~200자여야 합니다.' });
  }
  if (!b) {
    return res.status(400).json({ error: '내용을 입력해주세요.' });
  }

  const id = nanoid();
  await query(
    'INSERT INTO insight_posts (id, user_id, category, title, body) VALUES (?,?,?,?,?)',
    [id, req.user.id, category, t, b]);

  const row = await queryOne(
    `SELECT p.*, u.nickname AS author_nickname, u.name AS author_name
       FROM insight_posts p JOIN users u ON u.id = p.user_id WHERE p.id=?`, [id]);
  res.status(201).json({ post: toPostDetail(row) });
}));

/* 글쓴이 본인만 고친다 — 남의 글 수정은 존재 자체를 감춘다(404). */
router.put('/:id', requireAuth, ah(async (req, res) => {
  const row = await queryOne('SELECT * FROM insight_posts WHERE id=?', [req.params.id]);
  if (!row || row.user_id !== req.user.id) {
    return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
  }
  const { title, body } = req.body || {};
  const t = String(title ?? row.title).trim();
  const b = String(body ?? row.body).trim();
  if (!t || t.length > 200) return res.status(400).json({ error: '제목은 1~200자여야 합니다.' });
  if (!b) return res.status(400).json({ error: '내용을 입력해주세요.' });

  await query('UPDATE insight_posts SET title=?, body=? WHERE id=?', [t, b, req.params.id]);
  const updated = await queryOne(
    `SELECT p.*, u.nickname AS author_nickname, u.name AS author_name
       FROM insight_posts p JOIN users u ON u.id = p.user_id WHERE p.id=?`, [req.params.id]);
  res.json({ post: toPostDetail(updated) });
}));

router.delete('/:id', requireAuth, ah(async (req, res) => {
  const row = await queryOne('SELECT user_id FROM insight_posts WHERE id=?', [req.params.id]);
  if (!row || (row.user_id !== req.user.id && !req.user.isAdmin)) {
    return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
  }
  await query('DELETE FROM insight_posts WHERE id=?', [req.params.id]);   // 댓글은 CASCADE
  res.json({ message: '삭제되었습니다.' });
}));

router.post('/:id/comments', requireAuth, ah(async (req, res) => {
  const post = await queryOne('SELECT id FROM insight_posts WHERE id=?', [req.params.id]);
  if (!post) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });

  const b = String((req.body || {}).body || '').trim();
  if (!b) return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
  if (b.length > 1000) return res.status(400).json({ error: '댓글은 1000자를 넘을 수 없어요.' });

  const id = nanoid();
  await query('INSERT INTO insight_comments (id, post_id, user_id, body) VALUES (?,?,?,?)',
    [id, req.params.id, req.user.id, b]);
  const row = await queryOne(
    `SELECT c.*, u.nickname AS author_nickname, u.name AS author_name
       FROM insight_comments c JOIN users u ON u.id = c.user_id WHERE c.id=?`, [id]);
  res.status(201).json({ comment: toComment(row) });
}));

router.delete('/:id/comments/:commentId', requireAuth, ah(async (req, res) => {
  const row = await queryOne('SELECT user_id FROM insight_comments WHERE id=? AND post_id=?',
    [req.params.commentId, req.params.id]);
  if (!row || (row.user_id !== req.user.id && !req.user.isAdmin)) {
    return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
  }
  await query('DELETE FROM insight_comments WHERE id=?', [req.params.commentId]);
  res.json({ message: '삭제되었습니다.' });
}));

module.exports = { router, CATEGORIES };
