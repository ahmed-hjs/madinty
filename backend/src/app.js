const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./config/db');

const app = express();
// Les photos sont lues par le frontend (autre origine) : autoriser le chargement cross-origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    console.error('Health check : base inaccessible :', err.message);
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
// citizen doit rester monté avant reports (/mine et /nearby passent avant /:id).
app.use('/api/reports', require('./routes/citizen'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/images', require('./routes/images'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/organisme', require('./routes/organisme'));
app.use('/api/equipe', require('./routes/equipe'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/public', require('./routes/public'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable.' }));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide.' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Fichier trop volumineux (5 Mo max).' });
  if (err.code && String(err.code).startsWith('LIMIT_')) return res.status(400).json({ error: 'Trop de fichiers ou champ inattendu.' });
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

module.exports = app;
