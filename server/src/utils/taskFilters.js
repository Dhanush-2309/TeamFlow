// Shared by GET /tasks (list/Kanban/calendar) and GET /export/tasks.csv
function buildTaskFilters(query, startParamIndex = 1) {
  const clauses = [];
  const params = [];
  let i = startParamIndex;

  if (query.status) { clauses.push(`status = $${i++}`); params.push(query.status); }
  if (query.priority) { clauses.push(`priority = $${i++}`); params.push(query.priority); }
  if (query.assignee_id) { clauses.push(`assignee_id = $${i++}`); params.push(query.assignee_id); }
  if (query.due_before) { clauses.push(`due_date <= $${i++}`); params.push(query.due_before); }
  if (query.due_after) { clauses.push(`due_date >= $${i++}`); params.push(query.due_after); }
  if (query.q) { clauses.push(`title ILIKE $${i++}`); params.push(`%${query.q}%`); }

  return { clauses, params, nextIndex: i };
}

module.exports = { buildTaskFilters };
