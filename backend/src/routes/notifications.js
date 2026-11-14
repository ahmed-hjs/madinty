const router = require('express').Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { wrap } = require('../lib/http');

router.use(requireAuth);

router.get('/', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT n.id, n.report_id, r.reference AS report_reference, n.type, n.content, n.is_read, n.created_at
       FROM "NOTIFICATIONS" n LEFT JOIN "REPORTS" r ON r.id = n.report_id
      WHERE n.user_id = $1 ORDER BY n.created_at DESC, n.id DESC LIMIT 50`,
    [req.user.id]
  );
  const unread = await db.query('SELECT COUNT(*)::int AS n FROM "NOTIFICATIONS" WHERE user_id = $1 AND NOT is_read', [req.user.id]);
  res.json({ unread: unread.rows[0].n, items: rows });
}));

router.post('/read-all', wrap(async (req, res) => {
  await db.query('UPDATE "NOTIFICATIONS" SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
  res.json({ unread: 0 });
}));

router.post('/:id/read', wrap(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Notification introuvable.' });
  await db.query('UPDATE "NOTIFICATIONS" SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

module.exports = router;
