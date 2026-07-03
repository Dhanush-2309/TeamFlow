const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireProjectMember } = require('../middleware/auth');
const { logActivity } = require('../services/activityLogService');
const { HttpError } = require('../utils/httpError');

module.exports = function projectsRoutes(pool) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.description, p.created_at, pm.role, pm.view_preference
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = $1
        ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    if (!name) throw new HttpError(400, 'name is required');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING *`,
        [name, description || null, req.user.id]
      );
      const project = rows[0];
      await client.query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [project.id, req.user.id]
      );
      await logActivity(client, {
        entityType: 'project', entityId: project.id, actorId: req.user.id, action: 'created',
      });
      await client.query('COMMIT');
      res.status(201).json(project);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }));

  router.get('/:projectId', requireProjectMember(pool), asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.projectId]);
    if (rows.length === 0) throw new HttpError(404, 'Project not found');
    res.json({ ...rows[0], membership: req.membership });
  }));

  router.get('/:projectId/members', requireProjectMember(pool), asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, pm.role
         FROM project_members pm JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = $1
        ORDER BY u.name`,
      [req.params.projectId]
    );
    res.json(rows);
  }));

  router.post('/:projectId/members', requireProjectMember(pool), asyncHandler(async (req, res) => {
    if (req.membership.role !== 'owner') throw new HttpError(403, 'Only an owner can add members');
    const { user_id, role } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, COALESCE($3, 'member')::project_role)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [req.params.projectId, user_id, role || null]
    );
    res.status(201).json(rows[0]);
  }));

  router.patch('/:projectId/view-preference', requireProjectMember(pool), asyncHandler(async (req, res) => {
    const { view_preference } = req.body;
    if (!['kanban', 'calendar', 'list'].includes(view_preference)) {
      throw new HttpError(400, 'view_preference must be one of kanban, calendar, list');
    }
    const { rows } = await pool.query(
      `UPDATE project_members SET view_preference = $1 WHERE project_id = $2 AND user_id = $3 RETURNING *`,
      [view_preference, req.params.projectId, req.user.id]
    );
    res.json(rows[0]);
  }));

  return router;
};
