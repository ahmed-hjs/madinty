const router = require('express').Router();
const bcrypt = require('bcrypt');
const { body, query, param } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { requireAuth, requireRole, ROLES } = require('../middleware/auth');
const { HttpError, wrap } = require('../lib/http');
const audit = require('../lib/audit');
const { decideContestation } = require('./organisme');

router.use(requireAuth, requireRole(ROLES.ADMIN));
const idParam = param('id').isInt({ min: 1 }).toInt();
const ROLE_VALUES = Object.values(ROLES);

router.get('/users', [query('role').optional().isIn(ROLE_VALUES)], validate, wrap(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.role) { params.push(req.query.role); where = 'WHERE u.role = $1::role_enum'; }
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.email, u.role, u.state, u.organization_id, o.name AS organization_name, u.created_at
       FROM "USERS" u LEFT JOIN "ORGANIZATIONS" o ON o.id = u.organization_id ${where} ORDER BY u.id`, params);
  res.json(rows);
}));

router.post(
  '/users',
  [
    body('full_name').trim().isLength({ min: 2, max: 255 }),
    body('email').trim().isEmail().normalizeEmail(),
    body('password').isLength({ min: 8, max: 72 }).matches(/[A-Z]/).matches(/[0-9]/),
    body('role').isIn(ROLE_VALUES),
    body('organization_id').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  ],
  validate,
  wrap(async (req, res) => {
    const { full_name, email, password, role, organization_id } = req.body;
    if ([ROLES.ORGANISME, ROLES.EQUIPE].includes(role) && !organization_id) throw new HttpError(400, 'organization_id requis pour ce rôle.');
    try {
      const hash = await bcrypt.hash(password, 10);
      const out = await db.tx(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO "USERS" (organization_id, full_name, email, password_hash, role, state, privacy_accepted_at)
           VALUES ($1, $2, $3, $4, $5::role_enum, 'Actif', CURRENT_TIMESTAMP) RETURNING id, full_name, email, role, state, organization_id`,
          [organization_id || null, full_name, email, hash, role]);
        await audit(client, req.user.id, 'user.create', 'USERS', rows[0].id, { role });
        return rows[0];
      });
      res.status(201).json(out);
    } catch (err) {
      if (err.code === '23505') throw new HttpError(409, 'Cet e-mail est déjà utilisé.');
      if (err.code === '23503') throw new HttpError(400, 'Organisme inconnu.');
      throw err;
    }
  })
);

router.patch(
  '/users/:id',
  [idParam, body('role').optional().isIn(ROLE_VALUES), body('state').optional().isIn(['Actif', 'Inactif', 'Suspendu'])],
  validate,
  wrap(async (req, res) => {
    const { role, state } = req.body;
    if (req.params.id === req.user.id && (state && state !== 'Actif' || role && role !== ROLES.ADMIN)) {
      throw new HttpError(400, 'Vous ne pouvez pas vous retirer vos propres droits.');
    }
    const row = await db.tx(async (client) => {
      const { rows } = await client.query(
        `UPDATE "USERS" SET role = COALESCE($2::role_enum, role), state = COALESCE($3::state_enum, state) WHERE id = $1
         RETURNING id, full_name, email, role, state, organization_id`, [req.params.id, role || null, state || null]);
      if (!rows[0]) throw new HttpError(404, 'Utilisateur introuvable.');
      await audit(client, req.user.id, 'user.update', 'USERS', rows[0].id, { role, state });
      return rows[0];
    });
    res.json(row);
  })
);

router.get('/organizations', wrap(async (_req, res) => {
  const { rows } = await db.query(
    `SELECT o.id, o.name, o.slug, o.type,
            (SELECT COUNT(*)::int FROM "TEAMS" t WHERE t.organization_id = o.id) AS teams,
            (SELECT COUNT(*)::int FROM "CATEGORIES" c WHERE c.organization_id = o.id) AS categories
       FROM "ORGANIZATIONS" o ORDER BY o.name`);
  res.json(rows);
}));

router.get('/categories', wrap(async (_req, res) => {
  const { rows } = await db.query(
    `SELECT c.*, o.name AS organization_name FROM "CATEGORIES" c JOIN "ORGANIZATIONS" o ON o.id = c.organization_id ORDER BY o.name, c.label`);
  res.json(rows);
}));

router.post(
  '/categories',
  [
    body('label').trim().isLength({ min: 2, max: 255 }),
    body('organization_id').isInt({ min: 1 }).toInt(),
    body('description').optional({ values: 'falsy' }).trim(),
    body('severity_weight').optional().isFloat({ min: 0, max: 5 }).toFloat(),
    body('risk_weight').optional().isFloat({ min: 0, max: 5 }).toFloat(),
  ],
  validate,
  wrap(async (req, res) => {
    const b = req.body;
    try {
      const { rows } = await db.query(
        `INSERT INTO "CATEGORIES" (organization_id, label, description, severity_weight, risk_weight)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [b.organization_id, b.label, b.description || null, b.severity_weight ?? 2, b.risk_weight ?? 2]);
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23505') throw new HttpError(409, 'Cette catégorie existe déjà.');
      if (err.code === '23503') throw new HttpError(400, 'Organisme inconnu.');
      throw err;
    }
  })
);

router.patch(
  '/categories/:id',
  [
    idParam,
    body('organization_id').optional().isInt({ min: 1 }).toInt(),
    body('is_active').optional().isBoolean().toBoolean(),
    body('label').optional().trim().isLength({ min: 2, max: 255 }),
    body('severity_weight').optional().isFloat({ min: 0, max: 5 }).toFloat(),
    body('risk_weight').optional().isFloat({ min: 0, max: 5 }).toFloat(),
  ],
  validate,
  wrap(async (req, res) => {
    const b = req.body;
    const { rows } = await db.query(
      `UPDATE "CATEGORIES" SET organization_id = COALESCE($2, organization_id), is_active = COALESCE($3, is_active),
              label = COALESCE($4, label), severity_weight = COALESCE($5, severity_weight), risk_weight = COALESCE($6, risk_weight)
        WHERE id = $1 RETURNING *`,
      [req.params.id, b.organization_id ?? null, b.is_active ?? null, b.label ?? null, b.severity_weight ?? null, b.risk_weight ?? null]);
    if (!rows[0]) throw new HttpError(404, 'Catégorie introuvable.');
    res.json(rows[0]);
  })
);

router.get('/settings', wrap(async (_req, res) => {
  const { rows } = await db.query('SELECT key, value, updated_at FROM "SETTINGS" ORDER BY key');
  res.json(rows);
}));

router.put(
  '/settings/:key',
  [param('key').isIn(['contest_delay_minutes']), body('value').isInt({ min: 1, max: 525600 }).withMessage('Nombre de minutes entre 1 et 525600.')],
  validate,
  wrap(async (req, res) => {
    const row = await db.tx(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO "SETTINGS" (key, value, updated_by) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
         RETURNING key, value, updated_at`,
        [req.params.key, String(req.body.value), req.user.id]);
      await audit(client, req.user.id, 'setting.update', 'SETTINGS', null, { key: req.params.key, value: req.body.value });
      return rows[0];
    });
    res.json(row);
  })
);

router.get('/audit-logs', [query('limit').optional().isInt({ min: 1, max: 200 }).toInt()], validate, wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.id, a.action, a.resource, a.resource_id, a.metadata, a.created_at, u.full_name AS actor
       FROM "AUDIT_LOGS" a LEFT JOIN "USERS" u ON u.id = a.actor_id ORDER BY a.created_at DESC, a.id DESC LIMIT $1`,
    [req.query.limit || 50]);
  res.json(rows);
}));

router.get('/dashboard', wrap(async (_req, res) => {
  const [s, u, c] = await Promise.all([
    db.query(`SELECT status, COUNT(*)::int AS n FROM "REPORTS" GROUP BY status`),
    db.query(`SELECT role, COUNT(*)::int AS n FROM "USERS" GROUP BY role`),
    db.query(`SELECT COUNT(*)::int AS n FROM "CONTESTATIONS" WHERE decision IS NULL`),
  ]);
  res.json({
    signalements_par_statut: Object.fromEntries(s.rows.map((r) => [r.status, r.n])),
    utilisateurs_par_role: Object.fromEntries(u.rows.map((r) => [r.role, r.n])),
    contestations_a_examiner: c.rows[0].n,
  });
}));

router.get('/contestations', wrap(async (_req, res) => {
  const { rows } = await db.query(
    `SELECT k.id, r.reference AS report_reference, r.title, k.message, k.decision, k.decision_reason, k.escalated_to_admin, k.created_at
       FROM "CONTESTATIONS" k JOIN "REPORTS" r ON r.id = k.report_id
      WHERE k.escalated_to_admin AND k.decision IS NULL ORDER BY k.created_at`);
  res.json(rows);
}));

router.post(
  '/contestations/:id/decision',
  [idParam, body('decision').isIn(['Acceptée', 'Rejetée']), body('reason').trim().notEmpty()],
  validate,
  wrap(async (req, res) => {
    await db.tx(async (client) => {
      const k = (await client.query('SELECT * FROM "CONTESTATIONS" WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!k) throw new HttpError(404, 'Contestation introuvable.');
      if (!k.escalated_to_admin) throw new HttpError(409, 'Cette contestation n’a pas été portée devant l’administrateur.');
      await decideContestation(client, k, req.user, { decision: req.body.decision, reason: req.body.reason });
    });
    res.json({ ok: true });
  })
);

module.exports = router;
