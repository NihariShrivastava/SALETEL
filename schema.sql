-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: admin_users
CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Table: brands
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now()
);

-- Table: regions
CREATE TABLE regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand_id uuid REFERENCES brands(id),
  created_at timestamptz DEFAULT now()
);

-- Table: domains
CREATE TABLE domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,           -- e.g. "Three Wheeler", "Loan Collection"
  description text,
  brand_id uuid REFERENCES brands(id),
  icon text,                    -- lucide icon name string
  color text,                   -- hex color for role badge
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now()
);

-- Table: form_templates
CREATE TABLE form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid REFERENCES domains(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]',   -- array of field config objects
  is_active boolean DEFAULT true,
  version integer DEFAULT 1,
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: user_roles
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text
);

-- Table: counters
CREATE TABLE counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  location text,
  created_at timestamptz DEFAULT now()
);

-- Table: surveyors
CREATE TABLE surveyors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  domain_id uuid REFERENCES domains(id),
  user_role_id uuid REFERENCES user_roles(id),
  counter_ids uuid[] DEFAULT '{}',
  assigned_template_ids uuid[] DEFAULT '{}',
  team_lead_ids uuid[] DEFAULT '{}',
  brand_id uuid REFERENCES brands(id),
  region_id uuid REFERENCES regions(id),
  location text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES admin_users(id),
  created_at timestamptz DEFAULT now(),
  assigned_domains uuid[] DEFAULT '{}'
);

-- Table: submissions
CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id uuid REFERENCES form_templates(id),
  domain_id uuid REFERENCES domains(id),
  surveyor_id uuid REFERENCES surveyors(id),
  brand_id uuid REFERENCES brands(id),
  region_id uuid REFERENCES regions(id),
  data jsonb NOT NULL DEFAULT '{}',    -- key: field_id, value: submitted value
  status text DEFAULT 'submitted',     -- submitted | reviewed | approved | rejected
  admin_notes text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES admin_users(id),
  location_lat float,
  location_lng float,
  device_info text
);

-- Table: pending_approvals
CREATE TABLE pending_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES submissions(id),
  created_at timestamptz DEFAULT now(),
  resolved boolean DEFAULT false
);

-- Enable realtime on submissions table:
ALTER TABLE submissions REPLICA IDENTITY FULL;

-- Seed admin user (password: admin123)
-- Using SHA-256 hash of 'admin123' which is '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
INSERT INTO admin_users (username, password_hash) VALUES 
('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9');
