// routes/renewals.js
const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');
const auth    = require('../middleware/auth');
const pool    = new Pool({ connectionString: process.env.DATABASE_URL });

router.get('/', auth, async (req, res) => {
  const { type, urgency } = req.query;
  let where=[], params=[], idx=1;
  if (type) { where.push(`type=$${idx++}`); params.push(type); }
  if (urgency) {
    where.push(`due_date <= CURRENT_DATE + INTERVAL '${parseInt(urgency)} days'`);
  }
  const sql = `SELECT * FROM renewals ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY due_date ASC`;
  const result = await pool.query(sql, params);
  res.json(result.rows);
});

router.patch('/:id', auth, async (req, res) => {
  const { status, alertSent } = req.body;
  const result = await pool.query(
    'UPDATE renewals SET status=$1, alert_sent=$2 WHERE id=$3 RETURNING *',
    [status||'pending', alertSent||false, req.params.id]
  );
  res.json(result.rows[0]);
});


// PUT /api/renewals/bulk — bulk update array (Phase 2 migration helper)
router.put('/bulk', auth, async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      
      await client.query(`
        UPDATE renewals SET status=$2, alert_sent=$3 WHERE id=$1
      `, [item.id, item.status||'pending', item.alertSent||false]);
    }
    await client.query('COMMIT');
    res.json({ updated: items.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
