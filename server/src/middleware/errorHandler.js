// Central error handler.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);

  if (err.code === '23505') { // unique_violation
    return res.status(409).json({ error: 'Conflicting or duplicate record', detail: err.detail });
  }
  if (err.code === '23503') { // foreign_key_violation
    return res.status(400).json({ error: 'Referenced record does not exist', detail: err.detail });
  }
  if (err.code === '23514') { // check_violation
    return res.status(400).json({ error: 'Value violates a data constraint', detail: err.detail });
  }
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
