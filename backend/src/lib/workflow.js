const { HttpError } = require('./http');

async function changeReportStatus(client, report, newStatus, authorId, comment, extra = {}) {
  const sets = ['status = $2::report_status_enum'];
  const params = [report.id, newStatus];
  for (const [col, value] of Object.entries(extra)) {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  }
  await client.query(`UPDATE "REPORTS" SET ${sets.join(', ')} WHERE id = $1`, params);
  await client.query(
    `INSERT INTO "REPORT_STATUS_HISTORY" (report_id, author_id, old_status, new_status, comment)
     VALUES ($1, $2, $3, $4, $5)`,
    [report.id, authorId, report.status, newStatus, comment || null]
  );
}

async function changeInterventionStatus(client, intervention, newStatus, authorId, comment, extra = {}) {
  const sets = ['status = $2::intervention_status_enum'];
  const params = [intervention.id, newStatus];
  for (const [col, value] of Object.entries(extra)) {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  }
  await client.query(`UPDATE "INTERVENTIONS" SET ${sets.join(', ')} WHERE id = $1`, params);
  await client.query(
    `INSERT INTO "INTERVENTION_HISTORY" (intervention_id, author_id, old_status, new_status, comment)
     VALUES ($1, $2, $3, $4, $5)`,
    [intervention.id, authorId, intervention.status, newStatus, comment || null]
  );
}

async function getOrgReport(client, reportId, organizationId, lock = false) {
  const { rows } = await client.query(
    `SELECT r.*, c.organization_id, c.label AS category_label
       FROM "REPORTS" r JOIN "CATEGORIES" c ON c.id = r.category_id
      WHERE r.id = $1 AND c.organization_id = $2 ${lock ? 'FOR UPDATE OF r' : ''}`,
    [reportId, organizationId]
  );
  if (!rows[0]) throw new HttpError(404, 'Signalement introuvable.');
  return rows[0];
}

async function getOrgIntervention(client, id, organizationId, lock = false) {
  const { rows } = await client.query(
    `SELECT * FROM "INTERVENTIONS" WHERE id = $1 AND organization_id = $2 ${lock ? 'FOR UPDATE' : ''}`,
    [id, organizationId]
  );
  if (!rows[0]) throw new HttpError(404, 'Intervention introuvable.');
  return rows[0];
}

async function getTeamIntervention(client, id, userId, lock = false) {
  const { rows } = await client.query(
    `SELECT i.* FROM "INTERVENTIONS" i
      WHERE i.id = $1
        AND (i.lead_id = $2 OR i.team_id IN (SELECT id FROM "TEAMS" WHERE lead_id = $2))
      ${lock ? 'FOR UPDATE OF i' : ''}`,
    [id, userId]
  );
  if (!rows[0]) throw new HttpError(404, 'Intervention introuvable.');
  return rows[0];
}

async function contestDelayMinutes(client) {
  const { rows } = await client.query(`SELECT value FROM "SETTINGS" WHERE key = 'contest_delay_minutes'`);
  const n = rows[0] ? parseInt(rows[0].value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 10080;
}

async function markResolved(client, report, authorId, comment) {
  const delay = await contestDelayMinutes(client);
  const now = new Date();
  await changeReportStatus(client, report, 'Résolu', authorId, comment, {
    resolved_at: now,
    contest_deadline: new Date(now.getTime() + delay * 60000),
    resolution_round: (report.resolution_round || 0) + 1,
  });
}

module.exports = {
  changeReportStatus, changeInterventionStatus, getOrgReport, getOrgIntervention,
  getTeamIntervention, contestDelayMinutes, markResolved,
};
