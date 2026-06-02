SELECT 'CREATE DATABASE fems_auth'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fems_auth') \gexec

SELECT 'CREATE DATABASE fems_inventory'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fems_inventory') \gexec

SELECT 'CREATE DATABASE fems_notification'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fems_notification') \gexec

\connect fems_auth

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'STAFF', 'POLICE', 'CUSTOMER')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

\connect fems_inventory

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portal_user_id UUID,
  full_name VARCHAR(140) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  address TEXT NOT NULL,
  national_id VARCHAR(80),
  company_name VARCHAR(140),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);
CREATE INDEX IF NOT EXISTS customers_portal_user_id_idx ON customers(portal_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS customers_portal_user_id_unique_idx ON customers(portal_user_id) WHERE portal_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS extinguishers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  serial_number VARCHAR(100) NOT NULL UNIQUE,
  extinguisher_type VARCHAR(80) NOT NULL,
  capacity_kg NUMERIC(8, 2) NOT NULL CHECK (capacity_kg > 0),
  manufacturer VARCHAR(120),
  purchase_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'SERVICED', 'REPLACED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expiry_date >= purchase_date)
);

CREATE INDEX IF NOT EXISTS extinguishers_expiry_date_idx ON extinguishers(expiry_date);
CREATE INDEX IF NOT EXISTS extinguishers_customer_id_idx ON extinguishers(customer_id);

CREATE TABLE IF NOT EXISTS extinguisher_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extinguisher_id UUID NOT NULL REFERENCES extinguishers(id) ON DELETE CASCADE,
  actor_user_id UUID,
  actor_role VARCHAR(20),
  action VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS extinguisher_history_extinguisher_idx ON extinguisher_history(extinguisher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  extinguisher_id UUID REFERENCES extinguishers(id) ON DELETE CASCADE,
  target_user_id UUID,
  target_role VARCHAR(20) CHECK (target_role IN ('ADMIN', 'STAFF', 'POLICE', 'CUSTOMER')),
  type VARCHAR(40) NOT NULL CHECK (type IN ('EXPIRY_WARNING', 'EXPIRY_OVERDUE', 'POLICE_ESCALATION', 'SYSTEM')),
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminded_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS notifications_customer_idx ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS notifications_target_idx ON notifications(target_user_id, target_role);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extinguisher_id UUID NOT NULL REFERENCES extinguishers(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  inspection_type VARCHAR(30) NOT NULL DEFAULT 'ROUTINE' CHECK (inspection_type IN ('ROUTINE', 'ANNUAL', 'POST_SERVICE')),
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED')),
  inspector_user_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inspections_extinguisher_idx ON inspections(extinguisher_id);
CREATE INDEX IF NOT EXISTS inspections_schedule_idx ON inspections(scheduled_date, status);

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  extinguisher_id UUID NOT NULL REFERENCES extinguishers(id) ON DELETE RESTRICT,
  request_type VARCHAR(30) NOT NULL CHECK (request_type IN ('SERVICE', 'RENEWAL', 'REPLACEMENT')),
  status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
  customer_notes TEXT,
  staff_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_requests_customer_idx ON service_requests(customer_id);
CREATE INDEX IF NOT EXISTS service_requests_status_idx ON service_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  expiry_warning_days INTEGER NOT NULL DEFAULT 30 CHECK (expiry_warning_days BETWEEN 1 AND 365),
  escalation_grace_days INTEGER NOT NULL DEFAULT 7 CHECK (escalation_grace_days BETWEEN 1 AND 90),
  reminder_interval_days INTEGER NOT NULL DEFAULT 3 CHECK (reminder_interval_days BETWEEN 1 AND 30),
  max_reminders INTEGER NOT NULL DEFAULT 3 CHECK (max_reminders BETWEEN 1 AND 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO notification_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS police_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  extinguisher_id UUID NOT NULL REFERENCES extinguishers(id),
  notification_id UUID REFERENCES notifications(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVIEWING', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS police_reports_status_idx ON police_reports(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID,
  actor_role VARCHAR(20),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(100),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);

\connect fems_notification

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL,
  recipient VARCHAR(180) NOT NULL,
  subject VARCHAR(220) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('SENT', 'FAILED', 'PREVIEW')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_logs_created_at_idx ON email_logs(created_at DESC);
