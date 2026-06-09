// SR4IPR CRM — Main Server
// Run: node server.js

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ── MIDDLEWARE ─────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── ROUTES ─────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/matters',  require('./routes/matters'));
app.use('/api/clients',  require('./routes/clients'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/renewals', require('./routes/renewals'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/tasks',    require('./routes/tasks'));

// ── HEALTH CHECK ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'SR4IPR CRM', version: '1.0.0' });
});

// ── SERVE FRONTEND ─────────────────────────────────────────
// All non-API routes serve the frontend HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── ERROR HANDLER ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── START ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SR4IPR CRM running on port ${PORT}`);
  console.log(`Open: http://localhost:${PORT}`);
});
