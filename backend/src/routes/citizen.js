const router = require('express').Router();
const { body, query, param } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { requireAuth, requireRole, ROLES } = require('../middleware/auth');
const { HttpError, wrap } = require('../lib/http');
const { upload, saveImages, discard } = require('../lib/upload');
const { changeReportStatus } = require('../lib/workflow');
const { notify, notifyOrganization } = require('../lib/notify');
const { refreshScore } = require('../lib/priority');

const citizen = [requireAuth, requireRole(ROLES.CITOYEN)];
const idParam = param('id').isInt({ min: 1 }).toInt();

router.get('/mine', ...citizen, [query('status').optional().isString()], validate, wrap(async (req, res) => {
  const params = [req.user.id];
  let filter = '';
  if (req.query.status) { params.push(req.query.status); filter = 'AND r.status = $2::report_status_enum'; }
  const { rows } = await db.query(
    `SELECT r.id, r.reference, r.title, r.status, r.created_at, r.contest_deadline, r.resolution_round,
            c.label AS category_label, o.name AS organization_name,
            (SELECT COUNT(*)::int FROM "SUPPORTS" s WHERE s.report_id = r.id) AS supports_count,
            EXISTS (SELECT 1 FROM "CONTESTATIONS" k WHERE k.report_id = r.id AND k.resolution_round = r.resolution_round) AS contested
       FROM "REPORTS" r
       JOIN "CATEGORIES" c ON c.id = r.category_id
       JOIN "ORGANIZATIONS" o ON o.id = c.organization_id
      WHERE r.user_id = $1 ${filter}
      ORDER BY r.created_at DESC`,
    params
  );
  res.json(rows);
}));

router.get('/supported', ...citizen, wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.id, r.reference, r.title, r.status, r.created_at, c.label AS category_label
       FROM "SUPPORTS" s JOIN "REPORTS" r ON r.id = s.report_id JOIN "CATEGORIES" c ON c.id = r.category_id
      WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
}));

router.get(
  '/nearby',
  ...citizen,
  [
    query('latitude').isFloat({ min: -90, max: 90 }).toFloat(),
    query('longitude').isFloat({ min: -180, max: 180 }).toFloat(),
    query('category_id').isInt({ min: 1 }).toInt(),
    query('radius').optional().isFloat({ min: 10, max: 2000 }).toFloat(),
  ],
  validate,
  wrap(async (req, res) => {
    const { latitude, longitude, category_id } = req.query;
    const radius = req.query.radius || 200;
    const { rows } = await db.query(
      `SELECT r.id, r.reference, r.title, r.status, r.created_at, r.latitude, r.longitude,
              ROUND(ST_Distance(pt.geog, ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography))::int AS distance_m,
              (SELECT COUNT(*)::int FROM "SUPPORTS" s WHERE s.report_id = r.id) AS supports_count,
              EXISTS (SELECT 1 FROM "SUPPORTS" s WHERE s.report_id = r.id AND s.user_id = $5) AS supported_by_me,
              (r.user_id = $5) AS is_mine
         FROM "REPORTS" r
        CROSS JOIN LATERAL (SELECT ST_SetSRID(ST_MakePoint(r.longitude::float8, r.latitude::float8), 4326)::geography AS geog) pt
        WHERE r.category_id = $3::bigint
          AND r.status NOT IN ('Clos', 'Rejeté')
          AND r.created_at >= now() - interval '30 days'
          AND ST_DWithin(pt.geog, ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography, $4::float8)
        ORDER BY distance_m
        LIMIT 10`,
      [longitude, latitude, category_id, radius, req.user.id]
    );
    res.json(rows);
  })
);

router.post('/:id/support', ...citizen, [idParam], validate, wrap(async (req, res) => {
  const count = await db.tx(async (client) => {
    const { rows } = await client.query('SELECT id, reference, user_id, status FROM "REPORTS" WHERE id = $1', [req.params.id]);
    const report = rows[0];
    if (!report || ['Rejeté', 'Clos'].includes(report.status)) throw new HttpError(404, 'Signalement introuvable.');
    if (report.user_id === req.user.id) throw new HttpError(403, 'Vous ne pouvez pas soutenir votre propre signalement.');
    const ins = await client.query(
      'INSERT INTO "SUPPORTS" (report_id, user_id) VALUES ($1, $2) ON CONFLICT (report_id, user_id) DO NOTHING RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!ins.rows[0]) throw new HttpError(409, 'Vous soutenez déjà ce signalement.');
    await refreshScore(client, req.params.id);
    await notify(client, report.user_id, report.id, 'soutien', `Un habitant soutient votre signalement ${report.reference}.`);
    const c = await client.query('SELECT COUNT(*)::int AS n FROM "SUPPORTS" WHERE report_id = $1', [req.params.id]);
    return c.rows[0].n;
  });
  res.status(201).json({ supports_count: count, supported_by_me: true });
}));

router.post('/:id/images', ...citizen, upload.array('photos', 5), wrap(async (req, res) => {
  const files = req.files || [];
  try {
    const id = parseInt(req.params.id, 10);
    if (!files.length) throw new HttpError(400, 'Aucune photo envoyée.');
    const saved = await db.tx(async (client) => {
      const { rows } = await client.query('SELECT id, user_id, status FROM "REPORTS" WHERE id = $1', [id]);
      if (!rows[0] || rows[0].user_id !== req.user.id) throw new HttpError(404, 'Signalement introuvable.');
      if (['Clos', 'Rejeté'].includes(rows[0].status)) throw new HttpError(409, 'Ce signalement n’accepte plus de photos.');
      const n = await client.query(`SELECT COUNT(*)::int AS n FROM "REPORT_IMAGES" WHERE report_id = $1 AND context = 'Signalement'`, [id]);
      if (n.rows[0].n + files.length > 5) throw new HttpError(400, '5 photos maximum par signalement.');
      return saveImages(client, files, { context: 'Signalement', reportId: id, userId: req.user.id });
    });
    res.status(201).json(saved);
  } catch (err) {
    discard(files);
    throw err;
  }
}));

router.post('/:id/confirm', ...citizen, [idParam], validate, wrap(async (req, res) => {
  await db.tx(async (client) => {
    const { rows } = await client.query('SELECT * FROM "REPORTS" WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.id, req.user.id]);
    const report = rows[0];
    if (!report) throw new HttpError(404, 'Signalement introuvable.');
    if (report.status !== 'Résolu') throw new HttpError(409, 'Ce signalement n’est pas en attente de confirmation.');
    await changeReportStatus(client, report, 'Clos', req.user.id, 'Résolution confirmée par le citoyen', { closed_at: new Date() });
  });
  res.json({ status: 'Clos' });
}));

router.post(
  '/:id/contest',
  ...citizen,
  upload.array('photos', 1),
  [idParam, body('message').trim().isLength({ min: 3, max: 300 }).withMessage('Message requis (300 caractères max).')],
  (req, res, next) => {
    const { validationResult } = require('express-validator');
    if (validationResult(req).isEmpty()) return next();
    discard(req.files);
    validate(req, res, next);
  },
  wrap(async (req, res) => {
    const files = req.files || [];
    try {
      const saved = await db.tx(async (client) => {
        const { rows } = await client.query(
          `SELECT r.*, c.organization_id FROM "REPORTS" r JOIN "CATEGORIES" c ON c.id = r.category_id
            WHERE r.id = $1 AND r.user_id = $2 FOR UPDATE OF r`,
          [req.params.id, req.user.id]
        );
        const report = rows[0];
        if (!report) throw new HttpError(404, 'Signalement introuvable.');
        if (report.status !== 'Résolu') throw new HttpError(409, 'Ce signalement n’est pas contestable.');
        if (!report.contest_deadline || new Date(report.contest_deadline) < new Date()) {
          throw new HttpError(409, 'Le délai de contestation est dépassé.');
        }
        let contestation;
        try {
          const ins = await client.query(
            `INSERT INTO "CONTESTATIONS" (report_id, author_id, resolution_round, message)
             VALUES ($1, $2, $3, $4) RETURNING id, report_id, resolution_round, message, created_at`,
            [report.id, req.user.id, report.resolution_round, req.body.message]
          );
          contestation = ins.rows[0];
        } catch (err) {
          if (err.code === '23505') throw new HttpError(409, 'Une seule contestation est possible par résolution.');
          throw err;
        }
        contestation.images = await saveImages(client, files, { context: 'Contestation', contestationId: contestation.id, userId: req.user.id });
        await notifyOrganization(client, report.organization_id, report.id, 'contestation',
          `Contestation reçue pour ${report.reference}`);
        return contestation;
      });
      res.status(201).json(saved);
    } catch (err) {
      discard(files);
      throw err;
    }
  })
);

module.exports = router;
