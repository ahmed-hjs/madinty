const jwt = require('jsonwebtoken');
const db = require('../config/db');

const ROLES = {
  CITOYEN: 'Citoyen',
  ADMIN: 'Administrateur',
  ORGANISME: 'Organisme',
  EQUIPE: "Responsable d'équipe",
};

function readToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

async function loadUser(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const { rows } = await db.query(
    'SELECT id, full_name, email, role, state, organization_id FROM "USERS" WHERE id = $1',
    [payload.sub]
  );
  const user = rows[0];
  return user && user.state === 'Actif' ? user : null;
}

async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    const user = await loadUser(token);
    if (!user) return res.status(401).json({ error: 'Session invalide.' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session invalide ou expirée.' });
    }
    next(err);
  }
}

async function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    req.user = (await loadUser(token)) || undefined;
  } catch (err) {
    if (err.name !== 'JsonWebTokenError' && err.name !== 'TokenExpiredError') return next(err);
  }
  next();
}

const requireRole = (...allowed) => (req, res, next) =>
  req.user && allowed.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'Accès refusé pour votre rôle.' });

module.exports = { ROLES, requireAuth, optionalAuth, requireRole };
