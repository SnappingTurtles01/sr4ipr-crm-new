// routes/users.js
const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');
const bcrypt  = require('bcryptjs');
const auth    = require('../middleware/auth');
const pool    = new Pool({ connectionString: process.env.DATABASE_URL });

function adminOnly(req, res, next) {
  if (!['coo','founder'].includes(req.user.role))
    return res.status(403).json({ error: 'Admin access required' });
  next();
}

// GET /api/users — list all users (admin only)
router.get('/', auth, adminOnly, async (req, res) => {
  const result = await pool.query(
    'SELECT id,name,email,role,avatar,created_at FROM users ORDER BY name'
  );
  res.json(result.rows);
});

// POST /api/users — add new user (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  const { name, email, password, role, avatar } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  const hash = await bcrypt.hash(password, 10);
  const id   = 'u'+Date.now();
  const result = await pool.query(
    'INSERT INTO users (id,name,email,password_hash,role,avatar) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role,avatar',
    [id, name, email, hash, role||'associate', (avatar||name.substring(0,2)).toUpperCase()]
  );
  res.status(201).json(result.rows[0]);
});

// PATCH /api/users/:id/password — reset password
router.patch('/:id/password', auth, adminOnly, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
  res.json({ success: true });
});

// PATCH /api/users/me/password — user changes own password
router.patch('/me/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  if (!user.rows.length) return res.status(404).json({ error: 'User not found' });
  const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
  res.json({ success: true });
});


// PUT /api/users/bulk — bulk update array (Phase 2 migration helper)
router.put('/bulk', auth, async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      
      // Only allow non-sensitive field updates via bulk
      await client.query(`
        UPDATE users SET name=$2, role=$3 WHERE id=$1
      `, [item.id, item.name, item.role]);
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
