const crypto = require('crypto');

const DEDUPE_WINDOW_MS = 60_000;

function buildDedupeKey({ userId, eventType, entityId, channel }) {
  const bucket = Math.floor(Date.now() / DEDUPE_WINDOW_MS);
  return crypto
    .createHash('sha256')
    .update(`${userId}:${eventType}:${entityId}:${channel}:${bucket}`)
    .digest('hex');
}

async function notify(pool, { userId, eventType, entityType, entityId, message, emailOptedOut }) {
  const channels = ['in_app'];
  if (!emailOptedOut) channels.push('email');

  const dispatched = [];
  for (const channel of channels) {
    const dedupeKey = buildDedupeKey({ userId, eventType, entityId, channel });
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, event_type, entity_type, entity_id, channel, message, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [userId, eventType, entityType, entityId, channel, message, dedupeKey]
    );
    if (rows.length === 0) continue; // duplicate suppressed

    const notificationId = rows[0].id;
    if (channel === 'email') {
      await dispatchEmail(pool, notificationId, userId, message);
    } else {
      await pool.query('UPDATE notifications SET delivered_at = now() WHERE id = $1', [notificationId]);
    }
    dispatched.push({ channel, notificationId });
  }
  return dispatched;
}

async function dispatchEmail(pool, notificationId, userId, message) {
  const configured = Boolean(process.env.SMTP_HOST);
  if (!configured) {
    await pool.query(
      `UPDATE notifications SET delivered_at = NULL WHERE id = $1`,
      [notificationId]
    );
    return;
  }
  try {
    // Placeholder for email delivery
    await pool.query('UPDATE notifications SET delivered_at = now() WHERE id = $1', [notificationId]);
  } catch (err) {
    console.error(`Email dispatch failed for notification ${notificationId}:`, err.message);
    throw err;
  }
}

module.exports = { notify };
