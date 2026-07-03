const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token && req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Confirms the authenticated user is a member of :projectId (used by nearly
// every project-scoped route). Attaches req.membership so handlers can check
// role without a second query.
function requireProjectMember(pool) {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.body.project_id;
      if (!projectId) return res.status(400).json({ error: 'project_id is required' });
      const { rows } = await pool.query(
        'SELECT role, view_preference FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, req.user.id]
      );
      if (rows.length === 0) return res.status(403).json({ error: 'Not a member of this project' });
      req.membership = rows[0];
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireAuth, requireProjectMember };
