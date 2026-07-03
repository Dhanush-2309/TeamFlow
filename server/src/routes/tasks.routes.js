const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireProjectMember } = require('../middleware/auth');
const { logActivity } = require('../services/activityLogService');
const { notify } = require('../services/notificationService');
const { assertValidTransition, computeWarnings } = require('../services/taskRules');
const { buildTaskFilters } = require('../utils/taskFilters');
const { HttpError } = require('../utils/httpError');

module.exports = function tasksRoutes(pool) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', asyncHandler(async (req, res) => {
    const { project_id } = req.query;
    if (!project_id) throw new HttpError(400, 'project_id query param is required');
    const { rows: membership } = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2', [project_id, req.user.id]
    );
    if (membership.length === 0) throw new HttpError(403, 'Not a member of this project');

    const { clauses, params } = buildTaskFilters(req.query, 2);
    const where = ['project_id = $1', ...clauses].join(' AND ');
    const { rows } = await pool.query(
      `SELECT * FROM tasks WHERE ${where} ORDER BY due_date NULLS LAST, priority DESC`,
      [project_id, ...params]
    );
    res.json(rows);
  }));

  router.post('/', requireProjectMember(pool), asyncHandler(async (req, res) => {
    const { title, description, priority, assignee_id, due_date, parent_task_id } = req.body;
    if (!title) throw new HttpError(400, 'title is required');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO tasks (project_id, parent_task_id, title, description, priority, assignee_id, due_date, created_by)
         VALUES ($1,$2,$3,$4,COALESCE($5,'medium')::task_priority,$6,$7,$8) RETURNING *`,
        [req.params.projectId || req.body.project_id, parent_task_id || null, title, description || null,
          priority || null, assignee_id || null, due_date || null, req.user.id]
      );
      const task = rows[0];
      await logActivity(client, {
        entityType: 'task', entityId: task.id, actorId: req.user.id, action: 'created',
        context: { title },
      });
      await client.query('COMMIT');

      const warnings = await computeWarnings(pool, {
        taskId: task.id, projectId: task.project_id, assigneeId: task.assignee_id,
        status: task.status, dueDate: task.due_date,
      });

      if (assignee_id && assignee_id !== req.user.id) {
        const { rows: assignee } = await pool.query('SELECT email_opt_out FROM users WHERE id = $1', [assignee_id]);
        await notify(pool, {
          userId: assignee_id, eventType: 'task_assigned', entityType: 'task', entityId: task.id,
          message: `You were assigned to "${task.title}"`,
          emailOptedOut: assignee[0]?.email_opt_out,
        });
      }

      res.status(201).json({ task, warnings });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }));

  router.get('/:taskId', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.taskId]);
    if (rows.length === 0) throw new HttpError(404, 'Task not found');
    const { rows: relations } = await pool.query(
      `SELECT tr.id AS relation_id, tr.relation_type, t.id, t.title, t.status, t.project_id
         FROM task_relations tr JOIN tasks t ON t.id = tr.related_task_id
        WHERE tr.task_id = $1`,
      [req.params.taskId]
    );
    res.json({ ...rows[0], relations });
  }));

  router.patch('/:taskId', asyncHandler(async (req, res) => {
    const { title, description, priority, assignee_id, due_date } = req.body;
    const { rows: existingRows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.taskId]);
    if (existingRows.length === 0) throw new HttpError(404, 'Task not found');
    const existing = existingRows[0];
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}::task_priority`);
      params.push(priority);
    }
    if (assignee_id !== undefined) {
      updates.push(`assignee_id = $${paramIndex++}`);
      params.push(assignee_id);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      params.push(due_date);
    }

    if (updates.length === 0) {
      const warnings = await computeWarnings(pool, {
        taskId: existing.id, projectId: existing.project_id, assigneeId: existing.assignee_id,
        status: existing.status, dueDate: existing.due_date,
      });
      return res.json({ task: existing, warnings });
    }

    params.push(req.params.taskId);
    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const { rows } = await pool.query(query, params);
    const task = rows[0];

    if (assignee_id && assignee_id !== existing.assignee_id) {
      const { rows: assignee } = await pool.query('SELECT email_opt_out FROM users WHERE id = $1', [assignee_id]);
      await notify(pool, {
        userId: assignee_id, eventType: 'task_assigned', entityType: 'task', entityId: task.id,
        message: `You were assigned to "${task.title}"`,
        emailOptedOut: assignee[0]?.email_opt_out,
      });
    }

    const warnings = await computeWarnings(pool, {
      taskId: task.id, projectId: task.project_id, assigneeId: task.assignee_id,
      status: task.status, dueDate: task.due_date,
    });
    res.json({ task, warnings });
  }));

  router.patch('/:taskId/status', asyncHandler(async (req, res) => {
    const { status } = req.body;
    const { rows: existingRows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.taskId]);
    if (existingRows.length === 0) throw new HttpError(404, 'Task not found');
    const existing = existingRows[0];

    assertValidTransition(existing.status, status);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.taskId]);
      const task = rows[0];
      await logActivity(client, {
        entityType: 'task', entityId: task.id, actorId: req.user.id, action: 'status_changed',
        context: { from: existing.status, to: status },
      });
      await client.query('COMMIT');

      const warnings = await computeWarnings(pool, {
        taskId: task.id, projectId: task.project_id, assigneeId: task.assignee_id,
        status: task.status, dueDate: task.due_date,
      });

      if (task.assignee_id && task.assignee_id !== req.user.id) {
        const { rows: assignee } = await pool.query('SELECT email_opt_out FROM users WHERE id = $1', [task.assignee_id]);
        await notify(pool, {
          userId: task.assignee_id, eventType: 'task_status_changed', entityType: 'task', entityId: task.id,
          message: `"${task.title}" moved from ${existing.status} to ${status}`,
          emailOptedOut: assignee[0]?.email_opt_out,
        });
      }

      res.json({ task, warnings });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }));

  router.delete('/:taskId', asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.taskId]);
    res.status(204).send();
  }));

  router.post('/:taskId/relations', asyncHandler(async (req, res) => {
    const { related_task_id, relation_type } = req.body;
    if (!['blocks', 'blocked_by'].includes(relation_type)) throw new HttpError(400, 'relation_type must be blocks or blocked_by');

    const { rows } = await pool.query(
      `INSERT INTO task_relations (task_id, related_task_id, relation_type) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.taskId, related_task_id, relation_type]
    );
    const inverse = relation_type === 'blocks' ? 'blocked_by' : 'blocks';
    await pool.query(
      `INSERT INTO task_relations (task_id, related_task_id, relation_type) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [related_task_id, req.params.taskId, inverse]
    );
    res.status(201).json(rows[0]);
  }));

  router.delete('/:taskId/relations/:relationId', asyncHandler(async (req, res) => {
    // Delete relation and its inverse
    const { rows } = await pool.query('SELECT * FROM task_relations WHERE id = $1', [req.params.relationId]);
    if (rows.length > 0) {
      const rel = rows[0];
      const inverseType = rel.relation_type === 'blocks' ? 'blocked_by' : 'blocks';
      await pool.query('DELETE FROM task_relations WHERE id = $1', [req.params.relationId]);
      await pool.query(
        'DELETE FROM task_relations WHERE task_id = $1 AND related_task_id = $2 AND relation_type = $3',
        [rel.related_task_id, rel.task_id, inverseType]
      );
    }
    res.status(204).send();
  }));

  return router;
};
