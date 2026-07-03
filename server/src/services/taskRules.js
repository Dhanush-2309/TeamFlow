// Task progression rules + non-blocking warnings.
// Adapted for frontend task status values: backlog, in_progress, review, done.
const ALLOWED_TRANSITIONS = {
  backlog: ['in_progress'],
  todo: ['in_progress'],
  in_progress: ['backlog', 'review', 'todo'],
  review: ['in_progress', 'done'],
  in_review: ['in_progress', 'done'],
  done: ['in_progress'], // reopening is allowed
};

function assertValidTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    const err = new Error(`Cannot move task from '${fromStatus}' to '${toStatus}'`);
    err.statusCode = 422;
    throw err;
  }
}

// Dependency conflicts and assignee overload are surfaced as warnings
// WITHOUT blocking the save.
async function computeWarnings(pool, { taskId, projectId, assigneeId, status, dueDate }) {
  const warnings = [];

  if (status === 'done' && taskId) {
    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.status
         FROM task_relations tr
         JOIN tasks t ON t.id = tr.related_task_id
        WHERE tr.task_id = $1 AND tr.relation_type = 'blocked_by' AND t.status <> 'done'`,
      [taskId]
    );
    if (rows.length > 0) {
      warnings.push({
        type: 'dependency_conflict',
        message: `Task is blocked by ${rows.length} incomplete task(s): ${rows.map((r) => r.title).join(', ')}`,
        blocking_task_ids: rows.map((r) => r.id),
      });
    }
  }

  if (assigneeId) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS active_count
         FROM tasks
        WHERE assignee_id = $1 AND status IN ('backlog', 'in_progress', 'review') AND id <> COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
      [assigneeId, taskId || null]
    );
    const ACTIVE_TASK_SOFT_LIMIT = 8;
    if (rows[0].active_count >= ACTIVE_TASK_SOFT_LIMIT) {
      warnings.push({
        type: 'assignee_overload',
        message: `Assignee already has ${rows[0].active_count} active tasks`,
      });
    }
  }

  return warnings;
}

module.exports = { assertValidTransition, computeWarnings, ALLOWED_TRANSITIONS };
