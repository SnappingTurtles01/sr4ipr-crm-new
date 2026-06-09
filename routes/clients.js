// routes/clients.js
const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');
const auth    = require('../middleware/auth');
const pool    = new Pool({ connectionString: process.env.DATABASE_URL });

router.get('/', auth, async (req, res) => {
  const { search, type, source, page=1, limit=100 } = req.query;
  let where = [], params = [], idx = 1;
  if (search) {
    where.push(`(LOWER(name) LIKE $${idx} OR LOWER(email) LIKE $${idx} OR LOWER(city) LIKE $${idx})`);
    params.push('%'+search.toLowerCase()+'%'); idx++;
  }
  if (type)   { where.push(`type=$${idx++}`);   params.push(type); }
  if (source) { where.push(`source=$${idx++}`); params.push(source); }
  const sql = `SELECT * FROM clients ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY name LIMIT $${idx} OFFSET $${idx+1}`;
  const result = await pool.query(sql, [...params, limit, (page-1)*limit]);
  res.json(result.rows);
});

router.get('/:id', auth, async (req, res) => {
  const c = await pool.query('SELECT * FROM clients WHERE id=$1', [req.params.id]);
  if (!c.rows.length) return res.status(404).json({error:'Not found'});
  const matters = await pool.query('SELECT id,matter_id,title,type,stage,status FROM matters WHERE client_id=$1', [req.params.id]);
  res.json({...c.rows[0], matters: matters.rows});
});

router.post('/', auth, async (req, res) => {
  const c = req.body;
  const id = 'c'+Date.now();
  const result = await pool.query(
    'INSERT INTO clients (id,name,email,phone,type,city,source,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [id,c.name,c.email||'',c.phone||'',c.type||'individual',c.city||'',c.source||'Referral',new Date().toISOString().split('T')[0]]
  );
  res.status(201).json(result.rows[0]);
});


// PUT /api/clients/bulk — bulk update array (Phase 2 migration helper)
router.put('/bulk', auth, async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      
      await client.query(`
        UPDATE clients SET name=$2, email=$3, phone=$4, city=$5, type=$6, source=$7
        WHERE id=$1
      `, [item.id, item.name, item.email||null, item.phone||null,
          item.city||null, item.type||'individual', item.source||null]);
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
