async function refreshScore(client, reportId) {
  await client.query(
    `UPDATE "REPORTS" r
        SET priority_score = LEAST(100, ROUND(
              COALESCE(c.severity_weight, 0) * 10
            + COALESCE(c.risk_weight, 0) * 6
            + LEAST((SELECT COUNT(*) FROM "SUPPORTS" s WHERE s.report_id = r.id), 10) * 2
            + LEAST(EXTRACT(DAY FROM now() - r.created_at), 10)
            ))::smallint
       FROM "CATEGORIES" c
      WHERE c.id = r.category_id AND r.id = $1`,
    [reportId]
  );
}
module.exports = { refreshScore };
