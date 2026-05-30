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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_customer_idx ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS notifications_target_idx ON notifications(target_user_id, target_role);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

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
