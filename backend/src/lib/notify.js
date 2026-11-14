async function notify(client, userId, reportId, type, content) {
  if (!userId) return;
  await client.query(
    'INSERT INTO "NOTIFICATIONS" (user_id, report_id, type, content) VALUES ($1, $2, $3, $4)',
    [userId, reportId || null, type, content]
  );
}
async function notifyOrganization(client, organizationId, reportId, type, content) {
  await client.query(
    `INSERT INTO "NOTIFICATIONS" (user_id, report_id, type, content)
     SELECT id, $2, $3, $4 FROM "USERS" WHERE organization_id = $1 AND role = 'Organisme' AND state = 'Actif'`,
    [organizationId, reportId, type, content]
  );
}
module.exports = { notify, notifyOrganization };
