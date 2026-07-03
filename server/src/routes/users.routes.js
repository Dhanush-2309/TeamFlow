const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

module.exports = function usersRoutes(pool) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/me', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, name, email, theme, email_opt_out, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0]);
  }));

  router.patch('/me', asyncHandler(async (req, res) => {
    const { theme, email_opt_out } = req.body;
    const { rows } = await pool.query(
      `UPDATE users SET
         theme = COALESCE($1, theme),
         email_opt_out = COALESCE($2, email_opt_out)
       WHERE id = $3
       RETURNING id, name, email, theme, email_opt_out`,
      [theme ?? null, email_opt_out ?? null, req.user.id]
    );
    res.json(rows[0]);
  }));

  router.get('/search', asyncHandler(async (req, res) => {
    const { q, project_id } = req.query;
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email
         FROM users u
         JOIN project_members pm ON pm.user_id = u.id
        WHERE pm.project_id = $1 AND (u.name ILIKE $2 OR u.email ILIKE $2)
        LIMIT 10`,
      [project_id, `%${q || ''}%`]
    );
    res.json(rows);
  }));

  // Extra helper to search all users regardless of project (helpful for first-time assignment or reviewer adding)
  router.get('/', asyncHandler(async (req, res) => {
    const { q } = req.query;
    const { rows } = await pool.query(
      `SELECT id, name, email FROM users WHERE name ILIKE $1 OR email ILIKE $1 LIMIT 10`,
      [`%${q || ''}%`]
    );
    res.json(rows);
  }));

  return router;
};
