# SR4IPR CRM — Complete Developer Handoff Guide

## What you are deploying
A full browser-based Case Management System built specifically for SR4IPR.

Pre-loaded with:
- 2,081 matters (Patent, Trademark, Copyright, Design, Legal Notices)
- 842 clients
- 748 invoices (FY 2025-26)
- 294 renewals (Patent annuities, TM renewals, Design renewals)
- 12 user accounts with role-based access

---

## Folder Structure

```
sr4ipr-deploy/
├── README.md              ← This file — read fully before starting
├── package.json           ← Node.js dependencies
├── .env.example           ← Environment config template
├── .gitignore
├── server.js              ← Main Express server (entry point)
├── public/
│   └── index.html         ← Complete frontend (HTML/CSS/JS, single file)
├── db/
│   ├── schema.sql         ← PostgreSQL table definitions — run once
│   └── seed.js            ← Loads all 2,081 matters + clients + invoices
├── middleware/
│   └── auth.js            ← JWT token verification middleware
└── routes/
    ├── auth.js            ← POST /api/auth/login, GET /api/auth/me
    ├── matters.js         ← GET/POST/PATCH /api/matters
    ├── tasks.js           ← GET/POST/PATCH /api/tasks
    ├── clients.js         ← GET/POST /api/clients
    ├── invoices.js        ← GET/POST/PATCH /api/invoices
    ├── renewals.js        ← GET/PATCH /api/renewals
    └── users.js           ← GET/POST/PATCH /api/users
```

---

## Step-by-Step Local Setup

### Prerequisites
- Node.js v20 LTS — https://nodejs.org
- PostgreSQL 16 — https://postgresql.org/download

### Step 1 — Install dependencies
```bash
cd sr4ipr-deploy
npm install
```

### Step 2 — Create the database
Open pgAdmin or psql terminal:
```sql
CREATE DATABASE sr4ipr_crm;
```

### Step 3 — Run the schema
```bash
psql -U postgres -d sr4ipr_crm -f db/schema.sql
```
This creates all tables: users, clients, matters, tasks, communications,
documents, invoices, renewals.

### Step 4 — Configure environment
```bash
cp .env.example .env
```
Edit .env and fill in:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/sr4ipr_crm
JWT_SECRET=any-random-string-minimum-32-characters-long
PORT=3000
```

### Step 5 — Seed all data
```bash
node db/seed.js
```
This loads 842 clients, 2,081 matters, 748 invoices, 12 users, 294 renewals.
Takes approximately 2-3 minutes. You will see progress in the terminal.

### Step 6 — Start the server
```bash
node server.js
```
Open http://localhost:3000 — you should see the SR4IPR CRM login page.

Test login: himanshu@sr4ipr.in / Sr4ipr@2025

---

## Deploying to Railway (go live at crm.sr4ipr.in)

### Step 1 — Push code to GitHub
```bash
git init
git add .
git commit -m "SR4IPR CRM initial deployment"
git remote add origin https://github.com/YOUR_USERNAME/sr4ipr-crm.git
git push -u origin main
```

### Step 2 — Create Railway project
1. Go to https://railway.app → New Project
2. Deploy from GitHub repo → select sr4ipr-crm
3. Railway auto-detects Node.js and deploys

### Step 3 — Add PostgreSQL on Railway
1. In Railway project → + New Service → Database → PostgreSQL
2. Click the PostgreSQL service → Variables tab
3. Copy the DATABASE_URL value

### Step 4 — Set environment variables on Railway
In your app service → Variables tab, add:
```
DATABASE_URL=  (paste from PostgreSQL service)
JWT_SECRET=    (same long random string from your .env)
NODE_ENV=production
```

### Step 5 — Run schema and seed on Railway
In Railway → your app service → click Deploy Logs
After first deploy, open the Railway shell:
```bash
node db/schema.sql   # or run via psql with Railway DATABASE_URL
node db/seed.js
```

### Step 6 — Connect custom domain
1. In Railway → your app service → Settings → Custom Domain
2. Add: crm.sr4ipr.in
3. Railway gives you a CNAME target
4. In your domain DNS (where sr4ipr.in is registered):
   - Add CNAME record: Name = crm, Value = [Railway CNAME target]
   - TTL = 300
5. HTTPS is automatic — Railway provisions SSL certificate

Total time: 30-45 minutes
Monthly cost: approximately Rs 800-1,500 on Railway Hobby plan

---

## Phase 2 — Connecting Frontend to Backend API

The current index.html uses localStorage for data storage (Phase 1).
To connect it to the PostgreSQL backend, make these changes in index.html:

### Replace the DB object (top of the script section):

CURRENT (localStorage):
```javascript
const DB = {
  get(k) { try { return JSON.parse(localStorage.getItem('sr4_'+k)) } catch { return null } },
  set(k,v) { localStorage.setItem('sr4_'+k, JSON.stringify(v)) },
  del(k) { localStorage.removeItem('sr4_'+k) }
};
```

REPLACE WITH (API calls):
```javascript
const TOKEN_KEY = 'sr4ipr_token';
const API = async (path, method='GET', body=null) => {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (localStorage.getItem(TOKEN_KEY)||'')
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api/' + path, opts);
  if (res.status === 401) { doLogout(); return null; }
  return res.ok ? res.json() : null;
};
```

### Update doLogin to use the API:
```javascript
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const data  = await API('auth/login', 'POST', { email, password: pass });
  if (!data) { document.getElementById('auth-error').textContent = 'Invalid email or password.'; return; }
  localStorage.setItem(TOKEN_KEY, data.token);
  CU = data.user;
  startApp();
}
```

### Make all data functions async and replace DB calls:
All functions calling DB.get('matters') become:
```javascript
const matters = await API('matters');
```
All DB.set('matters', matters) become API PATCH/POST calls to the relevant route.

Estimated developer effort for full Phase 2 migration: 3-5 days.

---

## All API Endpoints

### Auth
- POST   /api/auth/login          { email, password } → { token, user }
- GET    /api/auth/me             → current user

### Matters
- GET    /api/matters             ?type=patent&status=active&search=xyz&page=1
- GET    /api/matters/:id         → matter with tasks, comms, documents
- POST   /api/matters             create new matter
- PATCH  /api/matters/:id         update stage, status, payment_status

### Tasks
- GET    /api/tasks/mine          → all pending tasks for current user
- GET    /api/tasks/mine/completed → completed tasks
- POST   /api/tasks               assign new task { matterId, name, assignedTo, dueDate }
- PATCH  /api/tasks/:id/complete  mark done, auto-calculates days_to_complete
- PATCH  /api/tasks/:id/reassign  { assignedTo, dueDate }

### Clients
- GET    /api/clients             ?search=xyz&type=company&source=Referral
- GET    /api/clients/:id         → client with matters list
- POST   /api/clients             create new client

### Invoices
- GET    /api/invoices            ?search=xyz&status=unpaid&fy=2025-26
- POST   /api/invoices            create invoice
- PATCH  /api/invoices/:id/pay    { method, amountReceived } mark as paid

### Renewals
- GET    /api/renewals            ?type=Patent+Annuity&urgency=30
- PATCH  /api/renewals/:id        update status, alertSent

### Users (COO / Founder only)
- GET    /api/users               list all users
- POST   /api/users               add new user
- PATCH  /api/users/:id/password  admin reset
- PATCH  /api/users/me/password   user changes own password

---

## Default Login Credentials (change immediately after going live)

| Name            | Email                      | Role          | Password      |
|-----------------|----------------------------|---------------|---------------|
| R P Yadav       | rpyadav@sr4ipr.in          | Founder       | Sr4ipr@2025   |
| Himanshu Yadav  | himanshu@sr4ipr.in         | COO           | Sr4ipr@2025   |
| Divyanshu Yadav | divyanshu@sr4ipr.in        | Business Head | Sr4ipr@2025   |
| Dinesh Kumar    | dinesh@sr4ipr.in           | Patent Head   | Sr4ipr@2025   |
| Shreya Gaur     | shreya@sr4ipr.in           | TM Head       | Sr4ipr@2025   |
| Abhishek Tyagi  | abhishek@sr4ipr.in         | Accounts      | Sr4ipr@2025   |
| Shivangi        | shivangi@sr4ipr.in         | Patent Paralegal | Sr4ipr@2025 |
| Jitender Anand  | jitender@sr4ipr.in         | Communications | Sr4ipr@2025  |
| Nishtha         | nishtha@sr4ipr.in          | TM Associate  | Sr4ipr@2025   |
| Lipi            | lipi@sr4ipr.in             | TM Associate  | Sr4ipr@2025   |
| Ayush           | ayush@sr4ipr.in            | TM Paralegal  | Sr4ipr@2025   |
| Lokesh          | lokesh@sr4ipr.in           | TM Paralegal  | Sr4ipr@2025   |

---

## Role Access Summary

| Role             | Sees                                          | Can do                          |
|------------------|-----------------------------------------------|---------------------------------|
| Founder          | Everything (read-focused)                     | View all, no user management    |
| COO              | Everything                                    | Full control + user management  |
| Business Head    | Everything + billing                          | Create matters, assign tasks    |
| Patent Head      | Patent matters only + clients                 | Assign tasks to patent team     |
| TM Head          | TM/Copyright/Design matters + clients         | Assign tasks to TM team         |
| Accounts         | Billing + renewals + pending invoices         | Create invoices, mark paid      |
| Patent Paralegal | My Tasks only                                 | Complete own tasks              |
| TM Associate     | My Tasks only                                 | Complete own tasks              |
| TM Paralegal     | My Tasks only                                 | Complete own tasks              |
| Communications   | My Tasks + Notice/Copyright/Design matters    | Complete own tasks, log comms   |

---

## Security Checklist Before Going Live

- [ ] Change ALL default passwords immediately after first login
- [ ] Set a strong JWT_SECRET (32+ random characters, never share it)
- [ ] Enable HTTPS (automatic on Railway with custom domain)
- [ ] Set up daily database backups in Railway settings
- [ ] In production index.html: remove importProductionData() function after
      Phase 2 migration is complete (data will be in PostgreSQL, not localStorage)
- [ ] Restrict PostgreSQL port to Railway internal network only

---

## Phase 2 Developer Notes

1. Tasks currently store assignedTo as a name string (e.g. "Nishtha").
   In Phase 2, migrate to store assignedToUserId (foreign key to users.id).
   This makes bulk reassignment a single SQL UPDATE and solves the
   name-change problem permanently.

2. Document storage: currently documents table stores file_path.
   Add file upload support using AWS S3 or Railway volumes.

3. WhatsApp notification integration: when a task is assigned or a
   deadline is approaching, trigger WhatsApp Business API messages.
   All communication triggers are already defined in the SOP documentation.

4. Client portal: a read-only matter status view for clients.
   Toggle on by adding a 'client' role to ROLES and a /portal route.
