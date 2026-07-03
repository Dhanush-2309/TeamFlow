const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireProjectMember } = require('../middleware/auth');
const { buildTaskFilters } = require('../utils/taskFilters');

function toCsv(rows, columns) {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

module.exports = function exportRoutes(pool) {
  const router = express.Router({ mergeParams: true });
  router.use(requireAuth, requireProjectMember(pool));

  router.get('/tasks.csv', asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const { clauses, params } = buildTaskFilters(req.query, 2);
    const where = ['project_id = $1', ...clauses].join(' AND ');
    const { rows } = await pool.query(
      `SELECT id, title, status, priority, assignee_id, due_date, created_at FROM tasks WHERE ${where} ORDER BY due_date NULLS LAST`,
      [projectId, ...params]
    );
    const csv = toCsv(rows, ['id', 'title', 'status', 'priority', 'assignee_id', 'due_date', 'created_at']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tasks-export.csv"`);
    res.send(csv);
  }));

  return router;
};
