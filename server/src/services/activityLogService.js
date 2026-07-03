async function logActivity(client, { entityType, entityId, actorId, action, context = {} }) {
  await client.query(
    `INSERT INTO activity_log (entity_type, entity_id, actor_id, action, context)
     VALUES ($1, $2, $3, $4, $5)`,
    [entityType, entityId, actorId, action, context]
  );
}

module.exports = { logActivity };
