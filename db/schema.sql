-- SR4IPR CRM — Database Schema
-- Run this once to create all tables:
-- psql -U postgres -d sr4ipr_crm -f db/schema.sql

-- ── USERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(20) PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(30) NOT NULL,
  avatar        VARCHAR(5),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ── CLIENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id          VARCHAR(20) PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  email       VARCHAR(150),
  phone       VARCHAR(20),
  type        VARCHAR(30) DEFAULT 'individual',
  city        VARCHAR(100),
  source      VARCHAR(50) DEFAULT 'Referral',
  gstin       VARCHAR(20),
  created_at  DATE DEFAULT CURRENT_DATE,
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- ── MATTERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matters (
  id              VARCHAR(20) PRIMARY KEY,
  matter_id       VARCHAR(30) UNIQUE NOT NULL,
  type            VARCHAR(20) NOT NULL, -- patent, trademark, copyright, design, notice
  client_id       VARCHAR(20) REFERENCES clients(id),
  client_name     VARCHAR(200),
  title           VARCHAR(500) NOT NULL,
  status          VARCHAR(20) DEFAULT 'active', -- active, completed, on hold, abandoned
  stage           VARCHAR(30),
  intake_stage    VARCHAR(30),
  assigned_lead   VARCHAR(100),
  date_opened     DATE DEFAULT CURRENT_DATE,
  payment_status  VARCHAR(20) DEFAULT 'pending', -- pending, partial, cleared
  total_fee       INTEGER DEFAULT 0,
  govt_fee        INTEGER DEFAULT 0,
  notes           TEXT,
  -- Patent specific
  application_no        VARCHAR(50),
  priority_date         DATE,
  filing_date           DATE,
  jurisdiction          VARCHAR(50),
  application_type      VARCHAR(30),
  route                 VARCHAR(20),
  applicant_category    VARCHAR(30),
  fer_received_date     DATE,
  fer_response_deadline DATE,
  rfe_deadline          DATE,
  grant_date            DATE,
  patent_number         VARCHAR(50),
  annuity_year3_due     DATE,
  -- Trademark specific
  nice_class            VARCHAR(10),
  mark_type             VARCHAR(30),
  fee_option            VARCHAR(20),
  exam_report_date      DATE,
  objection_reply_deadline DATE,
  objection_reply_filed DATE,
  hearing_date          DATE,
  publication_date      DATE,
  opposition_received   VARCHAR(5),
  opposition_date       DATE,
  counter_statement_deadline DATE,
  counter_statement_filed    DATE,
  registration_date     DATE,
  registration_number   VARCHAR(50),
  renewal_due_date      DATE,
  -- Copyright specific
  work_type             VARCHAR(50),
  author_name           VARCHAR(200),
  diary_no              VARCHAR(30),
  waiting_period_end    DATE,
  -- Design specific
  design_class          VARCHAR(20),
  -- Legal notice specific
  notice_type           VARCHAR(50),
  opposite_party        VARCHAR(200),
  opposite_party_address TEXT,
  opposite_party_email  VARCHAR(150),
  dispatch_date         DATE,
  speed_post_id         VARCHAR(50),
  delivery_date         DATE,
  response_due_date     DATE,
  statutory_limitation  DATE,
  outcome               VARCHAR(30),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matters_type        ON matters(type);
CREATE INDEX IF NOT EXISTS idx_matters_client_id   ON matters(client_id);
CREATE INDEX IF NOT EXISTS idx_matters_status      ON matters(status);
CREATE INDEX IF NOT EXISTS idx_matters_stage       ON matters(stage);
CREATE INDEX IF NOT EXISTS idx_matters_payment     ON matters(payment_status);
CREATE INDEX IF NOT EXISTS idx_matters_lead        ON matters(assigned_lead);

-- ── TASKS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                VARCHAR(30) PRIMARY KEY,
  matter_id         VARCHAR(20) REFERENCES matters(id) ON DELETE CASCADE,
  name              VARCHAR(300) NOT NULL,
  assigned_to       VARCHAR(100),
  assigned_by       VARCHAR(100),
  assigned_date     DATE DEFAULT CURRENT_DATE,
  due_date          DATE,
  done              BOOLEAN DEFAULT FALSE,
  done_date         DATE,
  days_to_complete  INTEGER,
  note              TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_matter_id   ON tasks(matter_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_done        ON tasks(done);

-- ── COMMUNICATIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communications (
  id          VARCHAR(30) PRIMARY KEY,
  matter_id   VARCHAR(20) REFERENCES matters(id) ON DELETE CASCADE,
  type        VARCHAR(20), -- call, whatsapp, email
  comm_date   DATE DEFAULT CURRENT_DATE,
  text        TEXT,
  logged_by   VARCHAR(100),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comms_matter_id ON communications(matter_id);

-- ── DOCUMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id           VARCHAR(30) PRIMARY KEY,
  matter_id    VARCHAR(20) REFERENCES matters(id) ON DELETE CASCADE,
  name         VARCHAR(300),
  uploaded_by  VARCHAR(100),
  upload_date  DATE DEFAULT CURRENT_DATE,
  file_path    VARCHAR(500), -- for Phase 2 file storage
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_matter_id ON documents(matter_id);

-- ── INVOICES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id               VARCHAR(20) PRIMARY KEY,
  invoice_no       VARCHAR(50) UNIQUE NOT NULL,
  bill_no          VARCHAR(30),
  financial_year   VARCHAR(10),
  matter_id        VARCHAR(20) REFERENCES matters(id),
  client_id        VARCHAR(20) REFERENCES clients(id),
  client_name      VARCHAR(200),
  practice_area    VARCHAR(30),
  description      TEXT,
  amount           INTEGER DEFAULT 0,  -- professional fee
  govt_fee         INTEGER DEFAULT 0,
  total            INTEGER DEFAULT 0,
  amount_received  INTEGER DEFAULT 0,
  balance_due      INTEGER DEFAULT 0,
  status           VARCHAR(20) DEFAULT 'unpaid', -- unpaid, partial, paid, advance, written_off
  invoice_date     DATE DEFAULT CURRENT_DATE,
  paid_date        DATE,
  method           VARCHAR(30),
  remark           TEXT,
  added_by         VARCHAR(100),
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_matter_id ON invoices(matter_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status    ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_fy        ON invoices(financial_year);

-- ── RENEWALS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS renewals (
  id           VARCHAR(20) PRIMARY KEY,
  type         VARCHAR(30), -- Patent Annuity, Trademark Renewal, Design Renewal
  client_name  VARCHAR(200),
  matter_id    VARCHAR(20) REFERENCES matters(id),
  matter_title VARCHAR(500),
  patent_no    VARCHAR(50),
  app_no       VARCHAR(50),
  due_date     DATE,
  year         VARCHAR(30),
  amount       INTEGER DEFAULT 0,
  status       VARCHAR(20) DEFAULT 'pending', -- pending, urgent, completed
  alert_sent   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewals_due_date  ON renewals(due_date);
CREATE INDEX IF NOT EXISTS idx_renewals_status    ON renewals(status);
CREATE INDEX IF NOT EXISTS idx_renewals_matter_id ON renewals(matter_id);

-- ── UPDATED_AT TRIGGER ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['users','clients','matters','tasks','invoices','renewals']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END $$;

-- Done
SELECT 'SR4IPR CRM schema created successfully' AS status;
