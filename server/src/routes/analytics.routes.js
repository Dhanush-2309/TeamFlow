const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireProjectMember } = require('../middleware/auth');

module.exports = function analyticsRoutes(pool) {
  const router = express.Router({ mergeParams: true });
  router.use(requireAuth, requireProjectMember(pool));

  router.get('/dashboard', asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;

    const [completion, workload, velocity, rcaVolume] = await Promise.all([
      pool.query(
        `SELECT status, count(*)::int AS count FROM tasks WHERE project_id = $1 GROUP BY status`,
        [projectId]
      ),
      pool.query(
        `SELECT u.id AS user_id, u.name, count(t.id)::int AS active_tasks
           FROM users u JOIN tasks t ON t.assignee_id = u.id
          WHERE t.project_id = $1 AND t.status IN ('backlog','in_progress','review')
          GROUP BY u.id, u.name ORDER BY active_tasks DESC`,
        [projectId]
      ),
      pool.query(
        `SELECT date_trunc('week', updated_at) AS week, count(*)::int AS completed
           FROM tasks WHERE project_id = $1 AND status = 'done'
          GROUP BY week ORDER BY week DESC LIMIT 12`,
        [projectId]
      ),
      pool.query(
        `SELECT status, count(*)::int AS count FROM rcas WHERE project_id = $1 GROUP BY status`,
        [projectId]
      ),
    ]);

    const totalTasks = completion.rows.reduce((sum, r) => sum + r.count, 0);
    const doneTasks = completion.rows.find((r) => r.status === 'done')?.count || 0;

    res.json({
      completion_rate: totalTasks > 0 ? Number((doneTasks / totalTasks).toFixed(3)) : 0,
      tasks_by_status: completion.rows,
      workload_per_assignee: workload.rows,
      velocity_trend: velocity.rows,
      rca_by_status: rcaVolume.rows,
      project_health: totalTasks === 0 ? 'no_data' : (doneTasks / totalTasks) > 0.6 ? 'healthy' : 'at_risk',
    });
  }));

  return router;
};
