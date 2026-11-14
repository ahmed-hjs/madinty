const router = require('express').Router();
const db = require('../config/db');

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.label, c.description, c.icon_key, o.id AS organization_id, o.name AS organization_name
         FROM "CATEGORIES" c
         JOIN "ORGANIZATIONS" o ON o.id = c.organization_id
        WHERE c.is_active
        ORDER BY o.name, c.label`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
