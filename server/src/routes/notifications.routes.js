const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

module.exports = function notificationsRoutes(pool) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', asyncHandler(async (req, res) => {
    const { unread_only } = req.query;
    const params = [req.user.id];
    let where = 'user_id = $1';
    if (unread_only === 'true') where += ' AND read = false';
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT 100`,
      params
    );
    res.json(rows);
  }));

  router.patch('/:notificationId/read', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.notificationId, req.user.id]
    );
    res.json(rows[0]);
  }));

  router.post('/mark-all-read', asyncHandler(async (req, res) => {
    await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [req.user.id]);
    res.status(204).send();
  }));

  return router;
};
