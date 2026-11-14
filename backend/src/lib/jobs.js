const db = require('../config/db');
const { notify } = require('./notify');

async function runContestJobs() {
  const toRemind = await db.query(
    `SELECT r.id, r.reference, r.user_id FROM "REPORTS" r
      WHERE r.status = 'Résolu' AND r.contest_deadline > now()
        AND now() >= r.resolved_at + (r.contest_deadline - r.resolved_at) * 2.0 / 3.0
        AND NOT EXISTS (SELECT 1 FROM "CONTESTATIONS" k WHERE k.report_id = r.id AND k.resolution_round = r.resolution_round)
        AND NOT EXISTS (SELECT 1 FROM "NOTIFICATIONS" n WHERE n.report_id = r.id AND n.type = 'rappel' AND n.created_at >= r.resolved_at)`
  );
  for (const r of toRemind.rows) {
    await notify(db, r.user_id, r.id, 'rappel', `Le problème est-il bien réglé ? Confirmez ou contestez ${r.reference} avant la fin du délai.`);
  }

  const toClose = await db.query(
    `SELECT * FROM "REPORTS" r
      WHERE r.status = 'Résolu' AND r.contest_deadline <= now()
        AND NOT EXISTS (SELECT 1 FROM "CONTESTATIONS" k WHERE k.report_id = r.id AND k.decision IS NULL)`
  );
  for (const r of toClose.rows) {
    await db.tx(async (client) => {
      const cur = (await client.query('SELECT * FROM "REPORTS" WHERE id = $1 FOR UPDATE', [r.id])).rows[0];
      if (cur.status !== 'Résolu') return;
      await client.query(`UPDATE "REPORTS" SET status = 'Clos', closed_at = now() WHERE id = $1`, [cur.id]);
      await client.query(
        `INSERT INTO "REPORT_STATUS_HISTORY" (report_id, author_id, old_status, new_status, comment)
         VALUES ($1, NULL, 'Résolu', 'Clos', 'Confirmation automatique : délai de contestation écoulé')`, [cur.id]);
      await notify(client, cur.user_id, cur.id, 'cloture', `${cur.reference} est clos (confirmation automatique).`);
    });
  }
}

function startJobs() {
  const tick = () => runContestJobs().catch((e) => console.error('Tâche périodique :', e.message));
  setInterval(tick, 60 * 1000).unref();
  setTimeout(tick, 5000).unref();
}
module.exports = { startJobs, runContestJobs };
