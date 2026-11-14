const router = require('express').Router();
const { body, query, param } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { requireAuth, requireRole, ROLES } = require('../middleware/auth');
const { HttpError, wrap } = require('../lib/http');
const { upload, saveImages, discard } = require('../lib/upload');
const { notify, notifyOrganization } = require('../lib/notify');
const { changeInterventionStatus, getTeamIntervention } = require('../lib/workflow');

router.use(requireAuth, requireRole(ROLES.EQUIPE));
const idParam = param('id').isInt({ min: 1 }).toInt();

const MINE = `(i.lead_id = $1 OR i.team_id IN (SELECT id FROM "TEAMS" WHERE lead_id = $1))`;

router.get('/interventions', [query('state').optional().isIn(['a_faire', 'en_cours', 'terminees'])], validate, wrap(async (req, res) => {
  const filters = {
    a_faire: `AND i.status IN ('À affecter', 'Affectée')`,
    en_cours: `AND i.status IN ('En cours', 'À valider')`,
    terminees: `AND i.status = 'Terminée'`,
  };
  const { rows } = await db.query(
    `SELECT i.id, i.reference, i.status, i.priority, i.planned_date, r.reference AS report_reference,
            r.title, r.address, c.label AS category_label
       FROM "INTERVENTIONS" i JOIN "REPORTS" r ON r.id = i.report_id JOIN "CATEGORIES" c ON c.id = r.category_id
      WHERE ${MINE} ${filters[req.query.state] || ''}
      ORDER BY CASE i.priority WHEN 'Critique' THEN 0 WHEN 'Haute' THEN 1 WHEN 'Moyenne' THEN 2 ELSE 3 END, i.planned_date NULLS LAST, i.id DESC`,
    [req.user.id]
  );
  res.json(rows);
}));

router.get('/interventions/:id', [idParam], validate, wrap(async (req, res) => {
  const iv = await getTeamIntervention(db, req.params.id, req.user.id);
  const [report, images] = await Promise.all([
    db.query(
      `SELECT r.id, r.reference, r.title, r.description, r.address, r.latitude, r.longitude, c.label AS category_label
         FROM "REPORTS" r JOIN "CATEGORIES" c ON c.id = r.category_id WHERE r.id = $1`, [iv.report_id]),
    db.query(`SELECT id, kind FROM "REPORT_IMAGES" WHERE intervention_id = $1 ORDER BY id`, [iv.id]),
  ]);
  res.json({ ...iv, report: report.rows[0], images: images.rows.map((i) => ({ ...i, url: `/api/images/${i.id}` })) });
}));

router.post(
  '/interventions/:id/progress',
  [idParam, body('status').optional().isIn(['En cours']), body('work_report').optional().isString().isLength({ max: 5000 })],
  validate,
  wrap(async (req, res) => {
    const out = await db.tx(async (client) => {
      const iv = await getTeamIntervention(client, req.params.id, req.user.id, true);
      if (!['Affectée', 'En cours'].includes(iv.status)) throw new HttpError(409, 'Cette mission ne peut plus être modifiée.');
      const extra = req.body.work_report !== undefined ? { work_report: req.body.work_report } : {};
      if (req.body.status === 'En cours' && iv.status === 'Affectée') {
        await changeInterventionStatus(client, iv, 'En cours', req.user.id, 'Intervention démarrée', extra);
        const r = (await client.query('SELECT * FROM "REPORTS" WHERE id = $1 FOR UPDATE', [iv.report_id])).rows[0];
        if (r.status === 'Affecté') {
          const { changeReportStatus } = require('../lib/workflow');
          await changeReportStatus(client, r, 'En cours', req.user.id, 'Intervention démarrée sur le terrain');
          await notify(client, r.user_id, r.id, 'statut', `${r.reference} : l’équipe est en cours d’intervention.`);
        }
        return 'En cours';
      }
      if (Object.keys(extra).length) {
        await client.query('UPDATE "INTERVENTIONS" SET work_report = $2 WHERE id = $1', [iv.id, req.body.work_report]);
      }
      return iv.status;
    });
    res.json({ status: out });
  })
);

router.post('/interventions/:id/images', upload.array('photos', 5), wrap(async (req, res) => {
  const files = req.files || [];
  try {
    if (!['Avant', 'Après'].includes(req.body.kind)) throw new HttpError(400, 'kind doit valoir « Avant » ou « Après ».');
    if (!files.length) throw new HttpError(400, 'Aucune photo envoyée.');
    const saved = await db.tx(async (client) => {
      const iv = await getTeamIntervention(client, parseInt(req.params.id, 10) || 0, req.user.id);
      if (iv.status === 'Terminée') throw new HttpError(409, 'Mission terminée.');
      return saveImages(client, files, { context: 'Intervention', kind: req.body.kind, interventionId: iv.id, userId: req.user.id });
    });
    res.status(201).json(saved);
  } catch (err) {
    discard(files);
    throw err;
  }
}));

router.post(
  '/interventions/:id/submit',
  [idParam, body('work_report').optional().isString().isLength({ max: 5000 })],
  validate,
  wrap(async (req, res) => {
    await db.tx(async (client) => {
      const iv = await getTeamIntervention(client, req.params.id, req.user.id, true);
      if (!['Affectée', 'En cours'].includes(iv.status)) throw new HttpError(409, 'Cette mission ne peut pas être soumise.');
      const report = (req.body.work_report || iv.work_report || '').trim();
      if (!report) throw new HttpError(400, 'Le compte rendu est obligatoire avant la clôture.');
      await changeInterventionStatus(client, iv, 'À valider', req.user.id, 'Soumise à validation', {
        work_report: report, submitted_at: new Date(),
      });
      const r = (await client.query('SELECT reference, category_id FROM "REPORTS" WHERE id = $1', [iv.report_id])).rows[0];
      await notifyOrganization(client, iv.organization_id, iv.report_id, 'validation', `Mission ${iv.reference} à valider (${r.reference}).`);
    });
    res.json({ status: 'À valider' });
  })
);

module.exports = router;
