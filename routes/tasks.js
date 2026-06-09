// routes/tasks.js — Task assignment, completion, time tracking

const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');
const auth    = require('../middleware/auth');
const pool    = new Pool({ connectionString: process.env.DATABASE_URL });

// GET /api/tasks/mine — all pending tasks assigned to current user
router.get('/mine', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, m.title AS matter_title, m.type AS matter_type, m.matter_id
      FROM tasks t
      JOIN matters m ON t.matter_id = m.id
      WHERE t.assigned_to = $1 AND t.done = false
      ORDER BY t.due_date ASC NULLS LAST
    `, [req.user.name]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tasks/mine/completed — completed tasks for current user
router.get('/mine/completed', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, m.title AS matter_title, m.type AS matter_type
      FROM tasks t
      JOIN matters m ON t.matter_id = m.id
      WHERE t.assigned_to = $1 AND t.done = true
      ORDER BY t.done_date DESC LIMIT 50
    `, [req.user.name]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tasks — assign new task to a matter
router.post('/', auth, async (req, res) => {
  const { matterId, name, assignedTo, dueDate, note } = req.body;
  const id = 't' + Date.now();
  try {
    const result = await pool.query(`
      INSERT INTO tasks (id, matter_id, name, assigned_to, assigned_by, assigned_date, due_date, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [id, matterId, name, assignedTo, req.user.name,
        new Date().toISOString().split('T')[0], dueDate||null, note||null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/tasks/:id/complete — mark task as done
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    // Get task to calculate days_to_complete
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!task.rows.length) return res.status(404).json({ error: 'Task not found' });
    const t = task.rows[0];
    const days = t.assigned_date
      ? Math.max(0, Math.round((new Date(today) - new Date(t.assigned_date)) / 86400000))
      : null;
    const result = await pool.query(`
      UPDATE tasks SET done=true, done_date=$1, days_to_complete=$2 WHERE id=$3 RETURNING *
    `, [today, days, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/tasks/:id/reassign — reassign task to different person
router.patch('/:id/reassign', auth, async (req, res) => {
  const { assignedTo, dueDate } = req.body;
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      UPDATE tasks SET assigned_to=$1, assigned_by=$2, assigned_date=$3, due_date=$4,
                       done=false, done_date=null, days_to_complete=null
      WHERE id=$5 RETURNING *
    `, [assignedTo, req.user.name, today, dueDate||null, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
