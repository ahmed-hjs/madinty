const router = require('express').Router();
const { body, query, param } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { requireAuth, requireRole, ROLES } = require('../middleware/auth');
const { HttpError, wrap } = require('../lib/http');
const { notify } = require('../lib/notify');
const audit = require('../lib/audit');
const {
  changeReportStatus, changeInterventionStatus, getOrgReport, getOrgIntervention, markResolved,
} = require('../lib/workflow');

router.use(requireAuth, requireRole(ROLES.ORGANISME));
router.use((req, res, next) =>
  req.user.organization_id ? next() : res.status(403).json({ error: 'Compte organisme sans organisme rattaché.' }));

const idParam = param('id').isInt({ min: 1 }).toInt();
const PRIORITIES = ['Basse', 'Moyenne', 'Haute', 'Critique'];
const REJECTION_REASONS = ['Hors compétence', 'Autre organisme concerné', 'Informations insuffisantes', 'Autre'];

router.get(
  '/reports',
  [
    query('status').optional().isString(),
    query('category_id').optional().isInt({ min: 1 }).toInt(),
    query('q').optional().isString().isLength({ max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  validate,
  wrap(async (req, res) => {
    const params = [req.user.organization_id];
    const where = ['c.organization_id = $1'];
    if (req.query.status) { params.push(req.query.status); where.push(`r.status = $${params.length}::report_status_enum`); }
    if (req.query.category_id) { params.push(req.query.category_id); where.push(`r.category_id = $${params.length}`); }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      const n = params.length;
      where.push(`(r.title ILIKE $${n} OR r.reference ILIKE $${n} OR COALESCE(r.address, '') ILIKE $${n})`);
    }
    params.push(req.query.limit || 50, req.query.offset || 0);
    const sql = where.join(' AND ');
    const list = await db.query(
      `SELECT r.id, r.reference, r.title, r.status, r.priority, r.priority_score, r.created_at,
              c.id AS category_id, c.label AS category_label,
              (SELECT COUNT(*)::int FROM "SUPPORTS" s WHERE s.report_id = r.id) AS supports_count
         FROM "REPORTS" r JOIN "CATEGORIES" c ON c.id = r.category_id
        WHERE ${sql}
        ORDER BY COALESCE(r.priority_score, 0) DESC, r.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const counts = await db.query(
      `SELECT r.status, COUNT(*)::int AS n FROM "REPORTS" r JOIN "CATEGORIES" c ON c.id = r.category_id
        WHERE c.organization_id = $1 GROUP BY r.status`,
      [req.user.organization_id]
    );
    res.json({ items: list.rows, counts_by_status: Object.fromEntries(counts.rows.map((c) => [c.status, c.n])) });
  })
);

router.get('/reports/:id', [idParam], validate, wrap(async (req, res) => {
  const report = await getOrgReport(db, req.params.id, req.user.organization_id);
  const [images, history, supports, similar, interventions] = await Promise.all([
    db.query(`SELECT id, context, kind FROM "REPORT_IMAGES" WHERE report_id = $1 ORDER BY id`, [report.id]),
    db.query(
      `SELECT h.old_status, h.new_status, h.comment, h.created_at, COALESCE(o.name, 'Citoyen') AS actor
         FROM "REPORT_STATUS_HISTORY" h LEFT JOIN "USERS" u ON u.id = h.author_id LEFT JOIN "ORGANIZATIONS" o ON o.id = u.organization_id
        WHERE h.report_id = $1 ORDER BY h.created_at, h.id`, [report.id]),
    db.query('SELECT COUNT(*)::int AS n FROM "SUPPORTS" WHERE report_id = $1', [report.id]),
    db.query(
      `SELECT r2.id, r2.reference, r2.title, r2.status,
              ROUND(ST_Distance(ST_SetSRID(ST_MakePoint(r2.longitude::float8, r2.latitude::float8), 4326)::geography,
                                ST_SetSRID(ST_MakePoint($2::float8, $3::float8), 4326)::geography))::int AS distance_m
         FROM "REPORTS" r2
        WHERE r2.id <> $1 AND r2.category_id = $4 AND r2.status NOT IN ('Clos', 'Rejeté')
          AND ST_DWithin(ST_SetSRID(ST_MakePoint(r2.longitude::float8, r2.latitude::float8), 4326)::geography,
                         ST_SetSRID(ST_MakePoint($2::float8, $3::float8), 4326)::geography, 100)
        ORDER BY distance_m LIMIT 3`,
      [report.id, report.longitude, report.latitude, report.category_id]),
    db.query(`SELECT id, reference, status FROM "INTERVENTIONS" WHERE report_id = $1 ORDER BY id DESC`, [report.id]),
  ]);
  delete report.user_id;
  res.json({
    ...report,
    supports_count: supports.rows[0].n,
    images: images.rows.map((i) => ({ ...i, url: `/api/images/${i.id}` })),
    history: history.rows,
    possible_duplicates: similar.rows,
    interventions: interventions.rows,
  });
}));

router.post(
  '/reports/:id/decision',
  [
    idParam,
    body('action').isIn(['verify', 'accept', 'reject']),
    body('reason').optional({ values: 'falsy' }).isIn(REJECTION_REASONS).withMessage('Motif de rejet inconnu.'),
    body('comment').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
  ],
  validate,
  wrap(async (req, res) => {
    const { action, reason, comment } = req.body;
    const result = await db.tx(async (client) => {
      const report = await getOrgReport(client, req.params.id, req.user.organization_id, true);
      if (action === 'verify') {
        if (report.status !== 'Soumis') throw new HttpError(409, 'Seul un signalement « Soumis » peut passer en vérification.');
        await changeReportStatus(client, report, 'En vérification', req.user.id, comment);
        await notify(client, report.user_id, report.id, 'statut', `${report.reference} est en cours de vérification.`);
        return 'En vérification';
      }
      if (!['Soumis', 'En vérification'].includes(report.status)) {
        throw new HttpError(409, `Décision impossible : le signalement est « ${report.status} ».`);
      }
      if (action === 'accept') {
        await changeReportStatus(client, report, 'Accepté', req.user.id, comment);
        await notify(client, report.user_id, report.id, 'statut', `${report.reference} a été accepté.`);
        await audit(client, req.user.id, 'report.accept', 'REPORTS', report.id);
        return 'Accepté';
      }
      if (!reason) throw new HttpError(400, 'Un motif de rejet est obligatoire.');
      if (reason === 'Autre' && !comment) throw new HttpError(400, 'Précisez le motif dans le commentaire.');
      await changeReportStatus(client, report, 'Rejeté', req.user.id, comment || reason, {
        rejection_reason: reason, rejection_comment: comment || null,
      });
      await notify(client, report.user_id, report.id, 'rejet', `${report.reference} a été rejeté : ${reason}.`);
      await audit(client, req.user.id, 'report.reject', 'REPORTS', report.id, { reason });
      return 'Rejeté';
    });
    res.json({ status: result });
  })
);

router.post(
  '/reports/:id/priority',
  [idParam, body('priority').isIn(PRIORITIES), body('justification').trim().notEmpty().withMessage('Justification requise.')],
  validate,
  wrap(async (req, res) => {
    await db.tx(async (client) => {
      const report = await getOrgReport(client, req.params.id, req.user.organization_id, true);
      if (['Clos', 'Rejeté'].includes(report.status)) throw new HttpError(409, 'Priorité non modifiable.');
      await client.query(
        `UPDATE "REPORTS" SET priority = $2, priority_justification = $3, priority_set_by = $4 WHERE id = $1`,
        [report.id, req.body.priority, req.body.justification, req.user.id]
      );
      await audit(client, req.user.id, 'report.priority', 'REPORTS', report.id, { priority: req.body.priority });
    });
    res.json({ priority: req.body.priority });
  })
);

router.get('/teams', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT t.id, t.name, t.domain, t.members_count, t.lead_id, u.full_name AS lead_name,
            COUNT(i.id) FILTER (WHERE i.status = 'En cours')::int AS en_cours,
            COUNT(i.id) FILTER (WHERE i.status IN ('À affecter', 'Affectée'))::int AS a_faire
       FROM "TEAMS" t
       LEFT JOIN "USERS" u ON u.id = t.lead_id
       LEFT JOIN "INTERVENTIONS" i ON i.team_id = t.id
      WHERE t.organization_id = $1
      GROUP BY t.id, u.full_name ORDER BY t.name`,
    [req.user.organization_id]
  );
  res.json(rows);
}));

router.get('/interventions', [query('status').optional().isString(), query('team_id').optional().isInt({ min: 1 }).toInt()], validate, wrap(async (req, res) => {
  const params = [req.user.organization_id];
  const where = ['i.organization_id = $1'];
  if (req.query.status) { params.push(req.query.status); where.push(`i.status = $${params.length}::intervention_status_enum`); }
  if (req.query.team_id) { params.push(req.query.team_id); where.push(`i.team_id = $${params.length}`); }
  const { rows } = await db.query(
    `SELECT i.id, i.reference, i.status, i.priority, i.planned_date, i.report_id,
            r.reference AS report_reference, r.title, t.name AS team_name
       FROM "INTERVENTIONS" i JOIN "REPORTS" r ON r.id = i.report_id LEFT JOIN "TEAMS" t ON t.id = i.team_id
      WHERE ${where.join(' AND ')} ORDER BY i.id DESC`,
    params
  );
  res.json(rows);
}));

router.get('/interventions/:id', [idParam], validate, wrap(async (req, res) => {
  const iv = await getOrgIntervention(db, req.params.id, req.user.organization_id);
  const [images, history] = await Promise.all([
    db.query(`SELECT id, context, kind FROM "REPORT_IMAGES" WHERE intervention_id = $1 ORDER BY id`, [iv.id]),
    db.query(`SELECT old_status, new_status, comment, created_at FROM "INTERVENTION_HISTORY" WHERE intervention_id = $1 ORDER BY created_at, id`, [iv.id]),
  ]);
  res.json({ ...iv, images: images.rows.map((i) => ({ ...i, url: `/api/images/${i.id}` })), history: history.rows });
}));

router.post(
  '/interventions',
  [
    body('report_id').isInt({ min: 1 }).toInt(),
    body('team_id').isInt({ min: 1 }).toInt(),
    body('lead_id').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
    body('priority').optional({ values: 'falsy' }).isIn(PRIORITIES),
    body('planned_date').optional({ values: 'falsy' }).isISO8601(),
    body('instructions').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
  ],
  validate,
  wrap(async (req, res) => {
    const created = await db.tx(async (client) => {
      const report = await getOrgReport(client, req.body.report_id, req.user.organization_id, true);
      if (report.status !== 'Accepté') throw new HttpError(409, 'Seul un signalement accepté peut recevoir une intervention.');

      const team = (await client.query('SELECT * FROM "TEAMS" WHERE id = $1 AND organization_id = $2', [req.body.team_id, req.user.organization_id])).rows[0];
      if (!team) throw new HttpError(400, 'Équipe inconnue pour votre organisme.');
      const leadId = req.body.lead_id || team.lead_id;
      if (!leadId) throw new HttpError(400, 'Cette équipe n’a pas de responsable : précisez lead_id.');
      const lead = (await client.query(
        `SELECT id FROM "USERS" WHERE id = $1 AND role = 'Responsable d''équipe' AND organization_id = $2 AND state = 'Actif'`,
        [leadId, req.user.organization_id])).rows[0];
      if (!lead) throw new HttpError(400, 'Responsable d’équipe invalide.');

      const { rows: [{ id }] } = await client.query(`SELECT nextval(pg_get_serial_sequence('"INTERVENTIONS"', 'id')) AS id`);
      const reference = `INT-${String(id).padStart(4, '0')}`;
      const priority = req.body.priority || report.priority || null;
      const ins = await client.query(
        `INSERT INTO "INTERVENTIONS" (id, reference, report_id, organization_id, team_id, lead_id, created_by, priority, planned_date, instructions, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Affectée')
         RETURNING id, reference, status, report_id, team_id, lead_id, priority, planned_date`,
        [id, reference, report.id, req.user.organization_id, team.id, leadId, req.user.id, priority, req.body.planned_date || null, req.body.instructions || null]
      );
      await client.query(
        `INSERT INTO "INTERVENTION_HISTORY" (intervention_id, author_id, old_status, new_status, comment) VALUES ($1, $2, NULL, 'Affectée', 'Intervention créée et affectée')`,
        [id, req.user.id]);
      await changeReportStatus(client, report, 'Affecté', req.user.id, `Affecté à ${team.name}`);
      await notify(client, leadId, report.id, 'affectation', `Nouvelle mission ${reference} affectée à ${team.name}.`);
      await notify(client, report.user_id, report.id, 'statut', `${report.reference} a été affecté à une équipe d’intervention.`);
      await audit(client, req.user.id, 'intervention.create', 'INTERVENTIONS', id);
      return ins.rows[0];
    });
    res.status(201).json(created);
  })
);

router.post(
  '/interventions/:id/validate',
  [idParam, body('approve').isBoolean().toBoolean(), body('comment').optional({ values: 'falsy' }).trim().isLength({ max: 1000 })],
  validate,
  wrap(async (req, res) => {
    const { approve, comment } = req.body;
    const out = await db.tx(async (client) => {
      const iv = await getOrgIntervention(client, req.params.id, req.user.organization_id, true);
      if (iv.status !== 'À valider') throw new HttpError(409, 'Cette intervention n’est pas en attente de validation.');
      const report = await getOrgReport(client, iv.report_id, req.user.organization_id, true);

      if (!approve) {
        if (!comment) throw new HttpError(400, 'Indiquez ce qui doit être corrigé.');
        await changeInterventionStatus(client, iv, 'En cours', req.user.id, `Renvoyée à l’équipe : ${comment}`);
        await notify(client, iv.lead_id, report.id, 'renvoi', `Mission ${iv.reference} renvoyée : ${comment}`);
        return { intervention: 'En cours', report: report.status };
      }
      if (!iv.work_report || !iv.work_report.trim()) throw new HttpError(409, 'Compte rendu manquant (RG-10).');
      const photos = await client.query('SELECT COUNT(*)::int AS n FROM "REPORT_IMAGES" WHERE intervention_id = $1', [iv.id]);
      if (photos.rows[0].n === 0 && req.body.allow_without_photo !== true) {
        throw new HttpError(409, 'Aucune preuve photo jointe. Renvoyez à l’équipe ou confirmez avec allow_without_photo.');
      }
      await changeInterventionStatus(client, iv, 'Terminée', req.user.id, comment || 'Compte rendu validé', {
        validated_by: req.user.id, validated_at: new Date(),
      });
      await markResolved(client, report, req.user.id, 'Intervention validée par l’organisme');
      await notify(client, report.user_id, report.id, 'resolution',
        `${report.reference} est résolu. Le problème est-il bien réglé ? Confirmez ou contestez.`);
      await audit(client, req.user.id, 'intervention.validate', 'INTERVENTIONS', iv.id);
      return { intervention: 'Terminée', report: 'Résolu' };
    });
    res.json(out);
  })
);

router.get('/contestations', [query('state').optional().isIn(['a_examiner', 'traitees'])], validate, wrap(async (req, res) => {
  const cond = req.query.state === 'traitees' ? 'k.decision IS NOT NULL' : req.query.state === 'a_examiner' ? 'k.decision IS NULL' : 'TRUE';
  const { rows } = await db.query(
    `SELECT k.id, k.report_id, r.reference AS report_reference, r.title, k.message, k.decision, k.decision_reason,
            k.escalated_to_admin, k.created_at,
            (SELECT iv.work_report FROM "INTERVENTIONS" iv WHERE iv.report_id = r.id ORDER BY iv.id DESC LIMIT 1) AS work_report,
            (SELECT COALESCE(json_agg(json_build_object('id', im.id, 'url', '/api/images/' || im.id)), '[]'::json)
               FROM "REPORT_IMAGES" im WHERE im.contestation_id = k.id) AS images
       FROM "CONTESTATIONS" k JOIN "REPORTS" r ON r.id = k.report_id JOIN "CATEGORIES" c ON c.id = r.category_id
      WHERE c.organization_id = $1 AND ${cond}
      ORDER BY k.created_at DESC`,
    [req.user.organization_id]
  );
  res.json(rows);
}));

router.post(
  '/contestations/:id/decision',
  [
    idParam,
    body('decision').optional().isIn(['Acceptée', 'Rejetée']),
    body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
    body('escalate').optional().isBoolean().toBoolean(),
  ],
  validate,
  wrap(async (req, res) => {
    const { decision, reason, escalate } = req.body;
    await db.tx(async (client) => {
      const { rows } = await client.query(
        `SELECT k.*, c.organization_id FROM "CONTESTATIONS" k JOIN "REPORTS" r ON r.id = k.report_id JOIN "CATEGORIES" c ON c.id = r.category_id
          WHERE k.id = $1 AND c.organization_id = $2 FOR UPDATE OF k`,
        [req.params.id, req.user.organization_id]);
      const k = rows[0];
      if (!k) throw new HttpError(404, 'Contestation introuvable.');
      await decideContestation(client, k, req.user, { decision, reason, escalate });
    });
    res.json({ ok: true });
  })
);

async function decideContestation(client, k, user, { decision, reason, escalate }) {
  if (k.decision) throw new HttpError(409, 'Contestation déjà traitée.');
  if (escalate) {
    if (user.role !== ROLES.ORGANISME) throw new HttpError(400, 'Seul l’organisme peut saisir l’administrateur.');
    await client.query('UPDATE "CONTESTATIONS" SET escalated_to_admin = TRUE WHERE id = $1', [k.id]);
    await audit(client, user.id, 'contestation.escalate', 'CONTESTATIONS', k.id);
    return;
  }
  if (!decision) throw new HttpError(400, 'Décision requise.');
  if (!reason) throw new HttpError(400, decision === 'Acceptée' ? 'Commentaire officiel requis.' : 'Motif de rejet requis (visible par le citoyen).');
  const report = (await client.query('SELECT * FROM "REPORTS" WHERE id = $1 FOR UPDATE', [k.report_id])).rows[0];
  await client.query(
    'UPDATE "CONTESTATIONS" SET decision = $2, decision_reason = $3, decided_by = $4 WHERE id = $1',
    [k.id, decision, reason, user.id]);
  if (decision === 'Acceptée') {
    await changeReportStatus(client, report, 'En cours', user.id, `Contestation acceptée : ${reason}`, { contest_deadline: null });
    const iv = (await client.query('SELECT * FROM "INTERVENTIONS" WHERE report_id = $1 ORDER BY id DESC LIMIT 1', [report.id])).rows[0];
    if (iv && iv.status === 'Terminée') {
      await changeInterventionStatus(client, iv, 'En cours', user.id, 'Réouverture après contestation');
      await notify(client, iv.lead_id, report.id, 'reouverture', `Mission ${iv.reference} rouverte après contestation.`);
    }
    await notify(client, report.user_id, report.id, 'contestation', `Votre contestation est acceptée : ${report.reference} repasse en cours.`);
  } else {
    await notify(client, report.user_id, report.id, 'contestation', `Votre contestation est rejetée : ${reason}`);
  }
  await audit(client, user.id, `contestation.${decision}`, 'CONTESTATIONS', k.id);
}

router.get('/indicators', [query('months').optional().isInt({ min: 1, max: 24 }).toInt()], validate, wrap(async (req, res) => {
  const months = req.query.months || 6;
  const org = req.user.organization_id;
  const base = `FROM "REPORTS" r JOIN "CATEGORIES" c ON c.id = r.category_id
                WHERE c.organization_id = $1 AND r.created_at >= now() - make_interval(months => $2::int)`;
  const [kpi, byCat, byMonth, contests, orgRow] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE r.status IN ('Soumis', 'En vérification'))::int AS a_examiner,
              COUNT(*) FILTER (WHERE r.status IN ('Accepté', 'Affecté', 'En cours'))::int AS en_cours,
              COUNT(*) FILTER (WHERE r.status IN ('Résolu', 'Clos'))::int AS resolus,
              COUNT(*) FILTER (WHERE r.status NOT IN ('Résolu', 'Clos', 'Rejeté'))::int AS en_attente,
              AVG(EXTRACT(EPOCH FROM (r.resolved_at - r.created_at)) / 86400) FILTER (WHERE r.resolved_at IS NOT NULL) AS delai_moyen_jours,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.resolved_at - r.created_at)) / 86400)
                FILTER (WHERE r.resolved_at IS NOT NULL) AS delai_median_jours
         ${base}`, [org, months]),
    db.query(
      `SELECT c.label, COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE r.status IN ('Résolu', 'Clos'))::int AS resolus,
              AVG(EXTRACT(EPOCH FROM (r.resolved_at - r.created_at)) / 86400) FILTER (WHERE r.resolved_at IS NOT NULL) AS delai_moyen_jours
         ${base} GROUP BY c.label ORDER BY total DESC`, [org, months]),
    db.query(
      `SELECT to_char(date_trunc('month', r.created_at), 'YYYY-MM') AS mois, COUNT(*)::int AS recus,
              COUNT(*) FILTER (WHERE r.status IN ('Résolu', 'Clos'))::int AS resolus
         ${base} GROUP BY 1 ORDER BY 1`, [org, months]),
    db.query(
      `SELECT COUNT(*)::int AS n FROM "CONTESTATIONS" k JOIN "REPORTS" r ON r.id = k.report_id JOIN "CATEGORIES" c ON c.id = r.category_id
        WHERE c.organization_id = $1 AND k.created_at >= now() - make_interval(months => $2::int)`, [org, months]),
    db.query('SELECT name FROM "ORGANIZATIONS" WHERE id = $1', [org]),
  ]);
  const k = kpi.rows[0];
  const round1 = (v) => (v === null ? null : Math.round(v * 10) / 10);
  res.json({
    perimetre: orgRow.rows[0].name,
    periode: `${months} derniers mois`,
    total: k.total, a_examiner: k.a_examiner, en_cours: k.en_cours, en_attente: k.en_attente,
    taux_resolution: k.total ? Math.round((k.resolus / k.total) * 100) : 0,
    delai_moyen_jours: round1(k.delai_moyen_jours),
    delai_median_jours: round1(k.delai_median_jours),
    taux_contestation: k.resolus ? Math.round((contests.rows[0].n / k.resolus) * 100) : 0,
    par_categorie: byCat.rows.map((c) => ({ ...c, delai_moyen_jours: round1(c.delai_moyen_jours) })),
    par_mois: byMonth.rows,
    note: 'Pas de classement entre organismes ; les délais dépendent de la nature des interventions.',
  });
}));

module.exports = router;
module.exports.decideContestation = decideContestation;
