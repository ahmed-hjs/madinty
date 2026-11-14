const router = require('express').Router();
const path = require('path');
const db = require('../config/db');
const { optionalAuth } = require('../middleware/auth');
const { HttpError, wrap } = require('../lib/http');
const { UPLOAD_DIR } = require('../lib/upload');

router.get('/:id', optionalAuth, wrap(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) throw new HttpError(404, 'Image introuvable.');
  const { rows } = await db.query(
    `SELECT i.storage_path, i.mime_type, i.context, i.uploaded_by,
            COALESCE(c1.organization_id, c2.organization_id, c3.organization_id) AS organization_id
       FROM "REPORT_IMAGES" i
       LEFT JOIN "REPORTS" r1 ON r1.id = i.report_id
       LEFT JOIN "CATEGORIES" c1 ON c1.id = r1.category_id
       LEFT JOIN "INTERVENTIONS" iv ON iv.id = i.intervention_id
       LEFT JOIN "REPORTS" r2 ON r2.id = iv.report_id
       LEFT JOIN "CATEGORIES" c2 ON c2.id = r2.category_id
       LEFT JOIN "CONTESTATIONS" k ON k.id = i.contestation_id
       LEFT JOIN "REPORTS" r3 ON r3.id = k.report_id
       LEFT JOIN "CATEGORIES" c3 ON c3.id = r3.category_id
      WHERE i.id = $1`,
    [req.params.id]
  );
  const img = rows[0];
  if (!img) throw new HttpError(404, 'Image introuvable.');
  if (img.context === 'Contestation') {
    const u = req.user;
    const allowed = u && (u.role === 'Administrateur' || u.id === img.uploaded_by ||
      (u.role === 'Organisme' && u.organization_id === img.organization_id));
    if (!allowed) throw new HttpError(404, 'Image introuvable.');
  }
  res.type(img.mime_type || 'image/jpeg');
  res.sendFile(path.resolve(UPLOAD_DIR, path.basename(img.storage_path)));
}));

module.exports = router;
