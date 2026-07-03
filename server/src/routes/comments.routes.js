const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { notify } = require('../services/notificationService');
const { HttpError } = require('../utils/httpError');

module.exports = function commentsRoutes(pool, { parentField }) {
  const router = express.Router({ mergeParams: true });
  router.use(requireAuth);

  const parentParam = parentField === 'task_id' ? 'taskId' : 'rcaId';

  router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id = c.author_id
        WHERE c.${parentField} = $1 ORDER BY c.created_at ASC`,
      [req.params[parentParam]]
    );
    res.json(rows);
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const { body, mentioned_user_ids } = req.body;
    if (!body || !body.trim()) throw new HttpError(400, 'Comment body is required');
    const mentions = Array.isArray(mentioned_user_ids) ? mentioned_user_ids : [];

    const { rows } = await pool.query(
      `INSERT INTO comments (${parentField}, author_id, body, mentioned_user_ids)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params[parentParam], req.user.id, body.trim(), mentions]
    );
    const comment = rows[0];

    for (const userId of mentions) {
      if (userId === req.user.id) continue;
      const { rows: mentioned } = await pool.query('SELECT email_opt_out FROM users WHERE id = $1', [userId]);
      await notify(pool, {
        userId, eventType: 'mention', entityType: parentField === 'task_id' ? 'task' : 'rca',
        entityId: req.params[parentParam],
        message: `${req.user.name} mentioned you in a comment`,
        emailOptedOut: mentioned[0]?.email_opt_out,
      });
    }

    res.status(201).json(comment);
  }));

  return router;
};
