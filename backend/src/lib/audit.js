module.exports = (client, actorId, action, resource, resourceId, metadata) =>
  client.query(
    'INSERT INTO "AUDIT_LOGS" (actor_id, action, resource, resource_id, metadata) VALUES ($1, $2, $3, $4, $5)',
    [actorId, action, resource, resourceId || null, metadata ? JSON.stringify(metadata) : null]
  );
