const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body, query, param } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { requireAuth, optionalAuth, requireRole, ROLES } = require('../middleware/auth');
const { refreshScore } = require('../lib/priority');
const { notifyOrganization } = require('../lib/notify');

const publicColumns = (userParam) => `
  r.id, r.reference, r.title, r.address, r.latitude, r.longitude, r.status, r.priority, r.priority_score, r.created_at,
  c.id AS category_id, c.label AS category_label, c.icon_key,
  (SELECT COUNT(*)::int FROM "SUPPORTS" s WHERE s.report_id = r.id) AS supports_count,
  COALESCE(r.user_id = ${userParam}::bigint, false) AS is_mine,
  EXISTS (SELECT 1 FROM "SUPPORTS" s WHERE s.report_id = r.id AND s.user_id = ${userParam}::bigint) AS supported_by_me`;

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.REPORT_RATE_MAX) || 30,
  keyGenerator: (req) => `user:${req.user.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de signalements en peu de temps. Réessayez plus tard.' },
});

router.get(
  '/',
  optionalAuth,
  [
    query('category_id').optional().isInt({ min: 1 }).toInt(),
    query('status').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { category_id, status, from, to } = req.query;
      const limit = req.query.limit || 200;
      const offset = req.query.offset || 0;
      const where = [`r.status <> 'Rejeté'`, 'r.duplicate_of_id IS NULL'];
      const params = [req.user ? req.user.id : null];
      const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };

      if (category_id) add('r.category_id = ?', category_id);
      if (status) add('r.status = ?::report_status_enum', status);
      if (from) add('r.created_at >= ?', from);
      if (to) add('r.created_at <= ?', to);
      params.push(limit, offset);

      const { rows } = await db.query(
        `SELECT ${publicColumns('$1')}
           FROM "REPORTS" r
           JOIN "CATEGORIES" c ON c.id = r.category_id
          WHERE ${where.join(' AND ')}
          ORDER BY r.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      res.json(rows);
    } catch (err) {
      if (err.code === '22P02') return res.status(400).json({ error: 'Statut inconnu.' });
      next(err);
    }
  }
);

router.get(
  '/:id',
  [param('id').matches(/^(\d+|MD-\d+)$/i).withMessage('Identifiant invalide.')],
  validate,
  optionalAuth,
  async (req, res, next) => {
    try {
      const isRef = /^MD-/i.test(req.params.id);
      const { rows } = await db.query(
        `SELECT ${publicColumns('$2')}, r.description, r.user_id, r.contest_deadline, r.resolution_round,
                r.rejection_reason, r.rejection_comment,
                o.id AS organization_id, o.name AS organization_name
           FROM "REPORTS" r
           JOIN "CATEGORIES" c ON c.id = r.category_id
           JOIN "ORGANIZATIONS" o ON o.id = c.organization_id
          WHERE ${isRef ? 'r.reference = upper($1)' : 'r.id = $1::bigint'}`,
        [req.params.id, req.user ? req.user.id : null]
      );
      const report = rows[0];
      if (!report) return res.status(404).json({ error: 'Signalement introuvable.' });

      const isAuthor = !!req.user && req.user.id === Number(report.user_id);
      if (report.status === 'Rejeté' && !isAuthor) {
        return res.status(404).json({ error: 'Signalement introuvable.' });
      }
      delete report.user_id;
      report.is_author = isAuthor;

      if (!isAuthor) { delete report.rejection_reason; delete report.rejection_comment; }

      const imgs = await db.query(
        `SELECT i.id, i.context, i.kind FROM "REPORT_IMAGES" i
          WHERE i.report_id = $1 OR i.intervention_id IN (SELECT id FROM "INTERVENTIONS" WHERE report_id = $1)
          ORDER BY i.id`,
        [report.id]
      );
      report.images = imgs.rows.map((i) => ({ ...i, url: `/api/images/${i.id}` }));

      if (['Résolu', 'Clos'].includes(report.status)) {
        const iv = await db.query(
          `SELECT reference, work_report FROM "INTERVENTIONS" WHERE report_id = $1 ORDER BY id DESC LIMIT 1`, [report.id]);
        report.work_report = iv.rows[0] ? iv.rows[0].work_report : null;
      }

      if (isAuthor) {
        const h = await db.query(
          `SELECT h.old_status, h.new_status, h.comment, h.created_at, COALESCE(o.name, 'Vous') AS actor
             FROM "REPORT_STATUS_HISTORY" h
             LEFT JOIN "USERS" u ON u.id = h.author_id AND u.id <> $2
             LEFT JOIN "ORGANIZATIONS" o ON o.id = u.organization_id
            WHERE h.report_id = $1 ORDER BY h.created_at, h.id`,
          [report.id, req.user.id]
        );
        report.history = h.rows;
        const k = await db.query(
          `SELECT id, message, decision, decision_reason, created_at FROM "CONTESTATIONS"
            WHERE report_id = $1 AND resolution_round = $2`, [report.id, report.resolution_round]);
        report.contestation = k.rows[0] || null;
      }
      res.json(report);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.CITOYEN),
  createLimiter,
  [
    body('title').trim().isLength({ min: 3, max: 255 }).withMessage('Titre requis (3 à 255 caractères).'),
    body('description').trim().isLength({ min: 10, max: 5000 }).withMessage('Description requise (10 à 5000 caractères).'),
    body('category_id').isInt({ min: 1 }).withMessage('Catégorie requise.').toInt(),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide.').toFloat(),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide.').toFloat(),
    body('address').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { title, description, category_id, latitude, longitude, address } = req.body;

      await client.query('BEGIN');

      const cat = await client.query(
        `SELECT c.id, c.organization_id, o.name AS organization_name
           FROM "CATEGORIES" c JOIN "ORGANIZATIONS" o ON o.id = c.organization_id
          WHERE c.id = $1 AND c.is_active`, [category_id]);
      if (!cat.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Catégorie inconnue ou inactive.' });
      }

      const { rows: [{ id }] } = await client.query(
        `SELECT nextval(pg_get_serial_sequence('"REPORTS"', 'id')) AS id`
      );
      const reference = `MD-${String(id).padStart(4, '0')}`;

      const { rows } = await client.query(
        `INSERT INTO "REPORTS" (id, reference, user_id, category_id, title, description, address, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, reference, title, status, category_id, latitude, longitude, created_at`,
        [id, reference, req.user.id, category_id, title, description, address || null, latitude, longitude]
      );

      await client.query(
        `INSERT INTO "REPORT_STATUS_HISTORY" (report_id, author_id, old_status, new_status, comment)
         VALUES ($1, $2, NULL, 'Soumis', 'Signalement créé')`,
        [id, req.user.id]
      );

      await refreshScore(client, id);

      await notifyOrganization(client, cat.rows[0].organization_id, id, 'nouveau_signalement',
        `Nouveau signalement ${reference} : ${title}`);

      await client.query('COMMIT');
      res.status(201).json({ ...rows[0], organization_name: cat.rows[0].organization_name });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23514' || err.code === '23502' || err.code === '23503') {
        return res.status(400).json({ error: 'Données refusées par la base (RG-02).' });
      }
      next(err);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
