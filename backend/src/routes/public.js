const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { HttpError, wrap } = require('../lib/http');

const STATS = `COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE r.status IN ('Résolu', 'Clos'))::int AS resolus,
  COUNT(*) FILTER (WHERE r.status NOT IN ('Résolu', 'Clos', 'Rejeté'))::int AS en_attente,
  AVG(EXTRACT(EPOCH FROM (r.resolved_at - r.created_at)) / 86400) FILTER (WHERE r.resolved_at IS NOT NULL) AS delai_moyen,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.resolved_at - r.created_at)) / 86400)
    FILTER (WHERE r.resolved_at IS NOT NULL) AS delai_median`;
const r1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
const shape = (s) => ({
  signalements: s.total, resolus: s.resolus, en_attente: s.en_attente,
  taux_resolution: s.total ? Math.round((s.resolus / s.total) * 100) : 0,
  delai_moyen_jours: r1(s.delai_moyen), delai_median_jours: r1(s.delai_median),
});

router.get('/stats', wrap(async (_req, res) => {
  const { rows } = await db.query(`SELECT ${STATS} FROM "REPORTS" r WHERE r.status <> 'Rejeté'`);
  res.json({ ...shape(rows[0]), perimetre: 'Tous organismes, territoire pilote', note: 'Données agrégées, sans donnée personnelle.' });
}));

router.get('/organizations', wrap(async (_req, res) => {
  const { rows } = await db.query(
    `SELECT o.id, o.name, o.slug, o.type, o.description,
            COALESCE(json_agg(c.label ORDER BY c.label) FILTER (WHERE c.id IS NOT NULL), '[]'::json) AS domaines
       FROM "ORGANIZATIONS" o LEFT JOIN "CATEGORIES" c ON c.organization_id = o.id AND c.is_active
      GROUP BY o.id ORDER BY o.name`);
  res.json(rows);
}));

router.get('/organizations/:slug', wrap(async (req, res) => {
  const org = (await db.query('SELECT * FROM "ORGANIZATIONS" WHERE slug = $1', [req.params.slug])).rows[0];
  if (!org) throw new HttpError(404, 'Organisme introuvable.');
  const [domaines, stats, parCategorie, derniers] = await Promise.all([
    db.query('SELECT id, label FROM "CATEGORIES" WHERE organization_id = $1 AND is_active ORDER BY label', [org.id]),
    db.query(`SELECT ${STATS} FROM "REPORTS" r JOIN "CATEGORIES" c ON c.id = r.category_id WHERE c.organization_id = $1 AND r.status <> 'Rejeté'`, [org.id]),
    db.query(
      `SELECT c.label, COUNT(*)::int AS total FROM "REPORTS" r JOIN "CATEGORIES" c ON c.id = r.category_id
        WHERE c.organization_id = $1 AND r.status <> 'Rejeté' AND r.created_at >= now() - interval '6 months' GROUP BY c.label ORDER BY total DESC`, [org.id]),
    db.query(
      `SELECT r.reference, r.title, r.status, r.resolved_at FROM "REPORTS" r JOIN "CATEGORIES" c ON c.id = r.category_id
        WHERE c.organization_id = $1 AND r.status IN ('Résolu', 'Clos') ORDER BY r.resolved_at DESC NULLS LAST LIMIT 5`, [org.id]),
  ]);
  res.json({
    organisme: { id: org.id, name: org.name, slug: org.slug, type: org.type, description: org.description },
    contact: { email: org.public_email, telephone: org.public_phone, horaires: org.opening_hours },
    domaines: domaines.rows,
    statistiques: shape(stats.rows[0]),
    par_categorie: parCategorie.rows,
    derniers_resolus: derniers.rows,
    perimetre_et_limites: 'Statistiques agrégées sans donnée personnelle. MADINTY ne garantit pas qu’un organisme traite un signalement.',
  });
}));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages envoyés, réessayez plus tard.' },
});

router.post(
  '/contact',
  contactLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('email').trim().isEmail().normalizeEmail(),
    body('subject').trim().isLength({ min: 2, max: 120 }),
    body('message').trim().isLength({ min: 10, max: 2000 }),
  ],
  validate,
  wrap(async (req, res) => {
    const { name, email, subject, message } = req.body;
    if (process.env.SMTP_HOST) {
      const nodemailer = require('nodemailer');
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM || 'MADINTY <no-reply@madinty.tn>',
        to: process.env.CONTACT_TO || process.env.SMTP_USER,
        replyTo: email,
        subject: `[MADINTY Contact] ${subject}`,
        text: `De : ${name} <${email}>\n\n${message}`,
      });
    } else {
      console.log(`[DEV] Message de contact de ${name} <${email}> — ${subject}\n${message}`);
    }
    res.status(201).json({ message: 'Message envoyé.' });
  })
);

module.exports = router;
