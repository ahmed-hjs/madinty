const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { HttpError } = require('./http');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) =>
      cb(null, crypto.randomBytes(16).toString('hex') + (file.mimetype === 'image/png' ? '.png' : '.jpg')),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) =>
    ['image/jpeg', 'image/png'].includes(file.mimetype) ? cb(null, true) : cb(new HttpError(400, 'Format accepté : JPG ou PNG.')),
});

function hasImageSignature(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  const png = buf.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const jpg = buf.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  return png || jpg;
}

const discard = (files = []) => files.forEach((f) => fs.unlink(f.path, () => {}));

async function saveImages(client, files = [], { context, kind = null, reportId = null, interventionId = null, contestationId = null, userId }) {
  for (const f of files) {
    if (!hasImageSignature(f.path)) {
      discard(files);
      throw new HttpError(400, 'Le fichier envoyé n’est pas une image valide.');
    }
  }
  const saved = [];
  for (const f of files) {
    const { rows } = await client.query(
      `INSERT INTO "REPORT_IMAGES" (context, kind, report_id, intervention_id, contestation_id, uploaded_by, storage_path, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, context, kind`,
      [context, kind, reportId, interventionId, contestationId, userId, f.filename, f.mimetype, f.size]
    );
    saved.push({ ...rows[0], url: `/api/images/${rows[0].id}` });
  }
  return saved;
}

module.exports = { upload, saveImages, discard, UPLOAD_DIR };
