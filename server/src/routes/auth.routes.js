const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');

module.exports = function authRoutes(pool) {
  const router = express.Router();

  router.post('/register', asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) throw new HttpError(400, 'name, email, password are required');

    const normalizedEmail = email.toLowerCase().trim();
    const { rows: existing } = await pool.query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.length > 0) throw new HttpError(409, 'Email address is already registered');

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
         RETURNING id, name, email, theme, email_opt_out, created_at`,
        [name, normalizedEmail, passwordHash]
      );
      const user = rows[0];

      // Auto-assign new user to default projects so they don't get a blank screen on login
      const defaultProjectIds = [
        'e1d2c1b0-1111-4444-8888-000000000001',
        'e1d2c1b0-2222-4444-8888-000000000002',
        'e1d2c1b0-3333-4444-8888-000000000003'
      ];
      for (const pid of defaultProjectIds) {
        const { rows: projCheck } = await client.query('SELECT 1 FROM projects WHERE id = $1', [pid]);
        if (projCheck.length > 0) {
          await client.query(
            `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [pid, user.id]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ user, token: issueToken(user) });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new HttpError(400, 'email and password are required');

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (rows.length === 0) throw new HttpError(401, 'Invalid credentials');

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new HttpError(401, 'Invalid credentials');

    delete user.password_hash;
    res.json({ user, token: issueToken(user) });
  }));

  function issueToken(user) {
    return jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  return router;
};
