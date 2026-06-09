// routes/invoices.js
const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');
const auth    = require('../middleware/auth');
const pool    = new Pool({ connectionString: process.env.DATABASE_URL });

// Only accounts, coo, biz_head, founder can access billing
function billingAuth(req, res, next) {
  if (!['accounts','coo','biz_head','founder'].includes(req.user.role))
    return res.status(403).json({ error: 'Billing access denied' });
  next();
}

router.get('/', auth, billingAuth, async (req, res) => {
  const { search, status, fy, page=1, limit=200 } = req.query;
  let where=[], params=[], idx=1;
  if (search) {
    where.push(`(LOWER(client_name) LIKE $${idx} OR LOWER(invoice_no) LIKE $${idx} OR LOWER(description) LIKE $${idx})`);
    params.push('%'+search.toLowerCase()+'%'); idx++;
  }
  if (status) { where.push(`status=$${idx++}`); params.push(status); }
  if (fy)     { where.push(`financial_year=$${idx++}`); params.push(fy); }
  const sql = `SELECT * FROM invoices ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY invoice_date DESC LIMIT $${idx} OFFSET $${idx+1}`;
  const result = await pool.query(sql, [...params, limit, (page-1)*limit]);
  const count  = await pool.query(`SELECT COUNT(*),SUM(total) total,SUM(amount_received) received FROM invoices ${where.length?'WHERE '+where.join(' AND '):''}`, params);
  res.json(req.query.page ? { invoices: result.rows, ...count.rows[0] } : result.rows);
});

router.post('/', auth, billingAuth, async (req, res) => {
  const inv = req.body;
  const result = await pool.query(`
    INSERT INTO invoices (id,invoice_no,bill_no,financial_year,matter_id,client_id,client_name,practice_area,description,amount,govt_fee,total,status,invoice_date,added_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
  `, ['inv'+Date.now(),inv.invoiceNo,inv.billNo||'',inv.financialYear||'2025-26',
      inv.matterId||null,inv.clientId||null,inv.clientName||'',inv.practiceArea||'',inv.description||'',
      inv.amount||0,inv.govtFee||0,(inv.amount||0)+(inv.govtFee||0),
      'unpaid',new Date().toISOString().split('T')[0],req.user.name]);
  res.status(201).json(result.rows[0]);
});

router.patch('/:id/pay', auth, billingAuth, async (req, res) => {
  const { method, amountReceived } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const inv = await pool.query('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
  if (!inv.rows.length) return res.status(404).json({error:'Not found'});
  const total = inv.rows[0].total;
  const received = amountReceived || total;
  const balance = total - received;
  const status = balance <= 0 ? 'paid' : 'partial';
  const result = await pool.query(`
    UPDATE invoices SET status=$1, amount_received=$2, balance_due=$3, paid_date=$4, method=$5
    WHERE id=$6 RETURNING *
  `, [status, received, balance, today, method||'UPI', req.params.id]);
  // Update matter payment status
  if (balance <= 0 && inv.rows[0].matter_id) {
    await pool.query("UPDATE matters SET payment_status='cleared' WHERE id=$1", [inv.rows[0].matter_id]);
  }
  res.json(result.rows[0]);
});


// PUT /api/invoices/bulk — bulk update array (Phase 2 migration helper)
router.put('/bulk', auth, async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      
      await client.query(`
        UPDATE invoices SET status=$2, paid_date=$3, payment_method=$4,
          amount_received=$5
        WHERE id=$1
      `, [item.id, item.status, item.paidDate||null, item.method||null,
          item.amountReceived||null]);
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
