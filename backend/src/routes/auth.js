const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { requireAuth, ROLES } = require('../middleware/auth');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez plus tard.' },
});

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, org: user.organization_id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

const publicUser = (u) => ({
  id: u.id,
  full_name: u.full_name,
  email: u.email,
  role: u.role,
  organization_id: u.organization_id,
});

// Hash factice : le temps de réponse ne doit pas révéler si l'e-mail existe.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

router.post(
  '/register',
  limiter,
  [
    body('full_name').trim().isLength({ min: 2, max: 255 }).withMessage('Nom complet requis.'),
    body('email').trim().isEmail().withMessage('E-mail invalide.').normalizeEmail(),
    body('password')
      .isLength({ min: 8, max: 72 }).withMessage('8 caractères minimum.')
      .matches(/[A-Z]/).withMessage('Une majuscule requise.')
      .matches(/[0-9]/).withMessage('Un chiffre requis.'),
    body('privacy_accepted').equals('true').withMessage('Le consentement à la politique de confidentialité est requis.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { full_name, email, password } = req.body;
      const hash = await bcrypt.hash(password, 10);
      const { rows } = await db.query(
        `INSERT INTO "USERS" (full_name, email, password_hash, role, state, privacy_accepted_at)
         VALUES ($1, $2, $3, $4, 'Actif', CURRENT_TIMESTAMP)
         RETURNING id, full_name, email, role, organization_id`,
        [full_name, email, hash, ROLES.CITOYEN]
      );
      res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Impossible de créer ce compte.' });
      next(err);
    }
  }
);

router.post(
  '/login',
  limiter,
  [body('email').trim().isEmail().normalizeEmail(), body('password').isString().notEmpty()],
  (req, res, next) => {
    if (!validationResult(req).isEmpty()) return res.status(401).json({ error: 'Identifiants invalides.' });
    next();
  },
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const { rows } = await db.query(
        'SELECT id, full_name, email, password_hash, role, state, organization_id FROM "USERS" WHERE email = $1',
        [email]
      );
      const user = rows[0];
      const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
      if (!user || !ok || user.state !== 'Actif') {
        return res.status(401).json({ error: 'Identifiants invalides.' });
      }
      res.json({ token: signToken(user), user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

const strongPassword = (field) =>
  body(field)
    .isLength({ min: 8, max: 72 }).withMessage('8 caractères minimum.')
    .matches(/[A-Z]/).withMessage('Une majuscule requise.')
    .matches(/[0-9]/).withMessage('Un chiffre requis.');
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

async function sendResetMail(email, link) {
  if (!process.env.SMTP_HOST) {
    console.log(`[DEV] Lien de réinitialisation pour ${email} : ${link}`);
    return;
  }
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'MADINTY <no-reply@madinty.tn>', to: email,
    subject: 'Réinitialisation de votre mot de passe MADINTY',
    text: `Pour choisir un nouveau mot de passe (lien valable 30 minutes) : ${link}`,
  });
}

router.post('/forgot-password', limiter, [body('email').trim().isEmail().normalizeEmail()], validate, async (req, res, next) => {
  const generic = { message: 'Si un compte existe pour cette adresse, un e-mail vient d’être envoyé. Le lien est valable 30 minutes.' };
  try {
    const { rows } = await db.query(`SELECT id, email FROM "USERS" WHERE email = $1 AND state = 'Actif'`, [req.body.email]);
    if (rows[0]) {
      const token = crypto.randomBytes(32).toString('hex');
      await db.query(
        `INSERT INTO "PASSWORD_RESET_TOKENS" (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 minutes')`,
        [rows[0].id, sha256(token)]);
      const base = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';
      sendResetMail(rows[0].email, `${base}/reinitialisation?jeton=${token}`).catch((e) => console.error('Envoi e-mail :', e.message));
    }
    res.json(generic);
  } catch (err) { next(err); }
});

router.post('/reset-password', limiter, [body('token').isString().isLength({ min: 32, max: 200 }), strongPassword('password')], validate, async (req, res, next) => {
  try {
    const user = await db.tx(async (client) => {
      const t = (await client.query(
        `SELECT id, user_id FROM "PASSWORD_RESET_TOKENS" WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
        [sha256(req.body.token)])).rows[0];
      if (!t) return null;
      const u = (await client.query('SELECT id, password_hash FROM "USERS" WHERE id = $1', [t.user_id])).rows[0];
      if (await bcrypt.compare(req.body.password, u.password_hash)) return 'same';
      await client.query('UPDATE "USERS" SET password_hash = $2 WHERE id = $1', [u.id, await bcrypt.hash(req.body.password, 10)]);
      await client.query('UPDATE "PASSWORD_RESET_TOKENS" SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [u.id]);
      return (await client.query('SELECT id, full_name, email, role, organization_id FROM "USERS" WHERE id = $1', [u.id])).rows[0];
    });
    if (!user) return res.status(400).json({ error: 'Lien expiré ou déjà utilisé.' });
    if (user === 'same') return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l’ancien.' });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.put(
  '/me',
  requireAuth,
  [
    body('full_name').optional().trim().isLength({ min: 2, max: 255 }),
    body('new_password').optional().custom((v) => /^(?=.*[A-Z])(?=.*[0-9]).{8,72}$/.test(v)).withMessage('8 caractères, une majuscule et un chiffre.'),
    body('current_password').if(body('new_password').exists()).isString().notEmpty().withMessage('Mot de passe actuel requis.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { full_name, new_password, current_password } = req.body;
      if (new_password) {
        const { rows } = await db.query('SELECT password_hash FROM "USERS" WHERE id = $1', [req.user.id]);
        if (!(await bcrypt.compare(current_password, rows[0].password_hash))) {
          return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
        }
        await db.query('UPDATE "USERS" SET password_hash = $2 WHERE id = $1', [req.user.id, await bcrypt.hash(new_password, 10)]);
      }
      if (full_name) await db.query('UPDATE "USERS" SET full_name = $2 WHERE id = $1', [req.user.id, full_name]);
      const { rows } = await db.query('SELECT id, full_name, email, role, organization_id FROM "USERS" WHERE id = $1', [req.user.id]);
      res.json({ user: publicUser(rows[0]) });
    } catch (err) { next(err); }
  }
);

module.exports = router;
