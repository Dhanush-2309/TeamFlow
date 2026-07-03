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

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
       RETURNING id, name, email, theme, email_opt_out, created_at`,
      [name, email.toLowerCase(), passwordHash]
    );
    const user = rows[0];
    res.status(201).json({ user, token: issueToken(user) });
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new HttpError(400, 'email and password are required');

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
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
