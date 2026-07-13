-- ═══════════════════════════════════════════════════════════════════
-- RFQ SaaS — Native PostgreSQL schema (no Supabase dependency)
-- Run this once against your Render PostgreSQL database.
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── SaaS management layer ──

CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  name_ar text,
  description text,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  max_employees int NOT NULL DEFAULT 5,
  max_suppliers int NOT NULL DEFAULT 50,
  max_rfqs_per_month int NOT NULL DEFAULT 100,
  max_purchase_orders int NOT NULL DEFAULT 50,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO subscription_plans (name, name_ar, description, price_monthly, price_yearly, max_employees, max_suppliers, max_rfqs_per_month, max_purchase_orders, features, sort_order) VALUES
  ('Free', 'مجاني', 'Get started with basic RFQ management', 0, 0, 3, 20, 20, 10,
   '["Dashboard","RFQ Management (up to 20/month)","Suppliers (up to 20)","Purchase Orders (up to 10)","Basic Analytics"]'::jsonb, 0),
  ('Pro', 'احترافي', 'For growing procurement teams', 49, 490, 15, 200, 500, 200,
   '["Everything in Free","RFQ Management (up to 500/month)","Suppliers (up to 200)","Purchase Orders (up to 200)","Advanced Analytics","WhatsApp Integration","Google Sheets Sync","PDF Export"]'::jsonb, 1),
  ('Enterprise', 'مؤسسات', 'For large organizations with custom needs', 199, 1990, 100, 999999, 999999, 999999,
   '["Everything in Pro","Unlimited Employees","Unlimited Suppliers","Unlimited RFQs","Unlimited POs","Custom Branding","Priority Support","API Access","Audit Logs"]'::jsonb, 2)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text,
  slug text NOT NULL UNIQUE,
  email text NOT NULL,
  phone text,
  address text,
  country text,
  plan_id uuid REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'active',
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'active',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Application-level users (replaces Supabase auth.users)
CREATE TABLE IF NOT EXISTS org_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES org_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'purchasing',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- SaaS platform admins (separate login, separate table, has its own credentials)
CREATE TABLE IF NOT EXISTS saas_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Tenant data tables (all scoped by org_id) ──

CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  name_en text,
  name_ar text,
  logo_url text,
  address text,
  phone text,
  email text,
  tax_number text,
  currency text DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id text,
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  category text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id text,
  part_no text,
  description text NOT NULL,
  uom text,
  reference_price numeric(15,4),
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rfq_number text,
  title text,
  status text NOT NULL DEFAULT 'draft',
  due_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rfq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id),
  description text,
  quantity numeric(15,4),
  uom text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rfq_id uuid REFERENCES rfqs(id),
  supplier_id uuid REFERENCES suppliers(id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  channel text
);

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rfq_id uuid REFERENCES rfqs(id),
  supplier_id uuid REFERENCES suppliers(id),
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric(15,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  rfq_item_id uuid REFERENCES rfq_items(id),
  unit_price numeric(15,4),
  quantity numeric(15,4),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  po_number text,
  supplier_id uuid REFERENCES suppliers(id),
  status text NOT NULL DEFAULT 'draft',
  total_amount numeric(15,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description text,
  unit_price numeric(15,4),
  quantity numeric(15,4),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes for tenant lookups ──
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(org_id);
CREATE INDEX IF NOT EXISTS idx_items_org ON items(org_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_org ON rfqs(org_id);
CREATE INDEX IF NOT EXISTS idx_rfq_items_org ON rfq_items(org_id);
CREATE INDEX IF NOT EXISTS idx_offers_org ON offers(org_id);
CREATE INDEX IF NOT EXISTS idx_po_org ON purchase_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(org_id);
