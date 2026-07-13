/*
# Multi-Tenant SaaS Schema for RFQ Manager

## Overview
Converts the single-tenant RFQ Manager into a multi-tenant SaaS platform.
Each organization (tenant) has isolated data for RFQs, suppliers, purchase orders, etc.
A separate SaaS admin layer manages organizations, subscriptions, and plans.

## New Tables

### SaaS Management Layer
1. `subscription_plans` — SaaS pricing tiers (Free, Pro, Enterprise) with limits
2. `subscriptions` — Links organizations to plans with billing status
3. `saas_admins` — Platform-level administrators (separate from tenant users)

### Tenant Management
4. `organizations` — Tenant companies registered on the platform
5. `organization_members` — Users belonging to organizations with roles (admin/manager/purchasing)

### Tenant Data (all scoped by org_id)
6. `suppliers` — Supplier records per organization
7. `supplier_categories` — Supplier categories per organization
8. `items` — Item catalog per organization
9. `rfqs` — RFQ records per organization
10. `rfq_items` — Line items per RFQ
11. `sent_log` — RFQ sent tracking per organization
12. `offers` — Supplier offers per organization
13. `offer_items` — Line items per offer
14. `purchase_orders` — PO records per organization
15. `purchase_order_items` — Line items per PO
16. `audit_log` — Audit trail per organization
17. `company_settings` — Company branding/settings per organization

## Security
- RLS enabled on ALL tables
- Tenant users can only access data within their organization
- SaaS admins can access management tables
- Organization members table is the bridge between auth.users and organizations
*/

-- ═══════════════════════════════════════════════════════════════════
-- SAAS MANAGEMENT LAYER
-- ═══════════════════════════════════════════════════════════════════

-- Subscription Plans (SaaS pricing tiers)
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

-- Seed default plans
INSERT INTO subscription_plans (name, name_ar, description, price_monthly, price_yearly, max_employees, max_suppliers, max_rfqs_per_month, max_purchase_orders, features, sort_order) VALUES
  ('Free', 'مجاني', 'Get started with basic RFQ management', 0, 0, 3, 20, 20, 10,
   '["Dashboard","RFQ Management (up to 20/month)","Suppliers (up to 20)","Purchase Orders (up to 10)","Basic Analytics"]'::jsonb, 0),
  ('Pro', 'احترافي', 'For growing procurement teams', 49, 490, 15, 200, 500, 200,
   '["Everything in Free","RFQ Management (up to 500/month)","Suppliers (up to 200)","Purchase Orders (up to 200)","Advanced Analytics","WhatsApp Integration","Google Sheets Sync","PDF Export"]'::jsonb, 1),
  ('Enterprise', 'مؤسسات', 'For large organizations with custom needs', 199, 1990, 100, 999999, 999999, 999999,
   '["Everything in Pro","Unlimited Employees","Unlimited Suppliers","Unlimited RFQs","Unlimited POs","Custom Branding","Priority Support","API Access","Audit Logs"]'::jsonb, 2)
ON CONFLICT (name) DO NOTHING;

-- Organizations (tenants)
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

-- Subscriptions (links org to plan with billing info)
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

-- Organization Members (links auth.users to organizations)
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'purchasing',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- SaaS Admins (platform-level administrators)
CREATE TABLE IF NOT EXISTS saas_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- TENANT DATA TABLES (all scoped by org_id)
-- ═══════════════════════════════════════════════════════════════════

-- Company Settings (per org branding)
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

-- Suppliers
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

-- Supplier Categories
CREATE TABLE IF NOT EXISTS supplier_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Items (catalog)
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

-- RFQs
CREATE TABLE IF NOT EXISTS rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  internal_rfq_no text NOT NULL,
  customer_rfq_no text NOT NULL,
  customer_rfq_date text,
  required_response_date text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES organization_members(id),
  notes text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, internal_rfq_no)
);

-- RFQ Items
CREATE TABLE IF NOT EXISTS rfq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  item_id text,
  line_item text,
  part_no text,
  description text NOT NULL,
  uom text,
  qty numeric(15,4),
  reference_price numeric(15,4),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sent Log (tracking RFQ sends to suppliers)
CREATE TABLE IF NOT EXISTS sent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  sent_by uuid REFERENCES organization_members(id),
  token text NOT NULL UNIQUE,
  close_date text,
  link_opened boolean NOT NULL DEFAULT false,
  open_count int NOT NULL DEFAULT 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  offer_submitted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Offers
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  sent_log_id uuid REFERENCES sent_log(id),
  submitted_by uuid REFERENCES organization_members(id),
  total_price numeric(15,4),
  general_notes text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Offer Items
CREATE TABLE IF NOT EXISTS offer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  rfq_item_id uuid NOT NULL REFERENCES rfq_items(id),
  price numeric(15,4) NOT NULL,
  tax_included boolean NOT NULL DEFAULT false,
  delivery_days int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  internal_po_no text NOT NULL,
  external_po_no text NOT NULL,
  receiver_name text,
  receiver_phone text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES organization_members(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, internal_po_no)
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id text,
  line_item text,
  part_no text,
  description text NOT NULL,
  uom text,
  qty numeric(15,4),
  reference_price numeric(15,4),
  tax_included boolean NOT NULL DEFAULT false,
  supplier_id uuid REFERENCES suppliers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  member_id uuid REFERENCES organization_members(id),
  description text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(org_id);
CREATE INDEX IF NOT EXISTS idx_items_org ON items(org_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_org ON rfqs(org_id);
CREATE INDEX IF NOT EXISTS idx_rfq_items_org ON rfq_items(org_id);
CREATE INDEX IF NOT EXISTS idx_rfq_items_rfq ON rfq_items(rfq_id);
CREATE INDEX IF NOT EXISTS idx_sent_log_org ON sent_log(org_id);
CREATE INDEX IF NOT EXISTS idx_offers_org ON offers(org_id);
CREATE INDEX IF NOT EXISTS idx_offer_items_org ON offer_items(org_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org ON purchase_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_po_items_org ON purchase_order_items(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

-- Helper function: get current user's org_id
CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id FROM organization_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- Helper function: check if current user is a SaaS admin
CREATE OR REPLACE FUNCTION is_saas_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM saas_admins WHERE user_id = auth.uid()
  );
$$;

-- ── subscription_plans: public read ──
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select_all" ON subscription_plans;
CREATE POLICY "plans_select_all" ON subscription_plans FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "plans_admin_modify" ON subscription_plans;
CREATE POLICY "plans_admin_modify" ON subscription_plans FOR ALL
  TO authenticated USING (is_saas_admin()) WITH CHECK (is_saas_admin());

-- ── organizations: members can read their own org, saas admins can read all ──
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_own" ON organizations;
CREATE POLICY "org_select_own" ON organizations FOR SELECT
  TO authenticated USING (
    id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "org_insert_any" ON organizations;
CREATE POLICY "org_insert_any" ON organizations FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "org_update_own" ON organizations;
CREATE POLICY "org_update_own" ON organizations FOR UPDATE
  TO authenticated USING (
    id = get_current_org_id() OR is_saas_admin()
  ) WITH CHECK (
    id = get_current_org_id() OR is_saas_admin()
  );

-- ── subscriptions: org members can read own, saas admins can read all ──
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_select_own" ON subscriptions;
CREATE POLICY "sub_select_own" ON subscriptions FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "sub_insert_own" ON subscriptions;
CREATE POLICY "sub_insert_own" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "sub_update_own" ON subscriptions;
CREATE POLICY "sub_update_own" ON subscriptions FOR UPDATE
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  ) WITH CHECK (
    org_id = get_current_org_id() OR is_saas_admin()
  );

-- ── organization_members: members can read their org's members ──
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members_select_own" ON organization_members;
CREATE POLICY "members_select_own" ON organization_members FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "members_insert_own" ON organization_members;
CREATE POLICY "members_insert_own" ON organization_members FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid() OR org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "members_update_own" ON organization_members;
CREATE POLICY "members_update_own" ON organization_members FOR UPDATE
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  ) WITH CHECK (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "members_delete_own" ON organization_members;
CREATE POLICY "members_delete_own" ON organization_members FOR DELETE
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );

-- ── saas_admins: only saas admins can manage ──
ALTER TABLE saas_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saas_admin_select" ON saas_admins;
CREATE POLICY "saas_admin_select" ON saas_admins FOR SELECT
  TO authenticated USING (is_saas_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "saas_admin_insert" ON saas_admins;
CREATE POLICY "saas_admin_insert" ON saas_admins FOR INSERT
  TO authenticated WITH CHECK (is_saas_admin());

-- ── company_settings: org members can CRUD their own ──
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_select_own" ON company_settings;
CREATE POLICY "settings_select_own" ON company_settings FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "settings_insert_own" ON company_settings;
CREATE POLICY "settings_insert_own" ON company_settings FOR INSERT
  TO authenticated WITH CHECK (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "settings_update_own" ON company_settings;
CREATE POLICY "settings_update_own" ON company_settings FOR UPDATE
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  ) WITH CHECK (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "settings_delete_own" ON company_settings;
CREATE POLICY "settings_delete_own" ON company_settings FOR DELETE
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );

-- ── suppliers: org-scoped CRUD ──
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_select_own" ON suppliers;
CREATE POLICY "suppliers_select_own" ON suppliers FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "suppliers_insert_own" ON suppliers;
CREATE POLICY "suppliers_insert_own" ON suppliers FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "suppliers_update_own" ON suppliers;
CREATE POLICY "suppliers_update_own" ON suppliers FOR UPDATE
  TO authenticated USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "suppliers_delete_own" ON suppliers;
CREATE POLICY "suppliers_delete_own" ON suppliers FOR DELETE
  TO authenticated USING (org_id = get_current_org_id());

-- ── supplier_categories: org-scoped CRUD ──
ALTER TABLE supplier_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cat_select_own" ON supplier_categories;
CREATE POLICY "cat_select_own" ON supplier_categories FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "cat_insert_own" ON supplier_categories;
CREATE POLICY "cat_insert_own" ON supplier_categories FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "cat_update_own" ON supplier_categories;
CREATE POLICY "cat_update_own" ON supplier_categories FOR UPDATE
  TO authenticated USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "cat_delete_own" ON supplier_categories;
CREATE POLICY "cat_delete_own" ON supplier_categories FOR DELETE
  TO authenticated USING (org_id = get_current_org_id());

-- ── items: org-scoped CRUD ──
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items_select_own" ON items;
CREATE POLICY "items_select_own" ON items FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "items_insert_own" ON items;
CREATE POLICY "items_insert_own" ON items FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "items_update_own" ON items;
CREATE POLICY "items_update_own" ON items FOR UPDATE
  TO authenticated USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "items_delete_own" ON items;
CREATE POLICY "items_delete_own" ON items FOR DELETE
  TO authenticated USING (org_id = get_current_org_id());

-- ── rfqs: org-scoped CRUD ──
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rfqs_select_own" ON rfqs;
CREATE POLICY "rfqs_select_own" ON rfqs FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "rfqs_insert_own" ON rfqs;
CREATE POLICY "rfqs_insert_own" ON rfqs FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "rfqs_update_own" ON rfqs;
CREATE POLICY "rfqs_update_own" ON rfqs FOR UPDATE
  TO authenticated USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "rfqs_delete_own" ON rfqs;
CREATE POLICY "rfqs_delete_own" ON rfqs FOR DELETE
  TO authenticated USING (org_id = get_current_org_id());

-- ── rfq_items: org-scoped CRUD ──
ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rfq_items_select_own" ON rfq_items;
CREATE POLICY "rfq_items_select_own" ON rfq_items FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "rfq_items_insert_own" ON rfq_items;
CREATE POLICY "rfq_items_insert_own" ON rfq_items FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "rfq_items_update_own" ON rfq_items;
CREATE POLICY "rfq_items_update_own" ON rfq_items FOR UPDATE
  TO authenticated USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "rfq_items_delete_own" ON rfq_items;
CREATE POLICY "rfq_items_delete_own" ON rfq_items FOR DELETE
  TO authenticated USING (org_id = get_current_org_id());

-- ── sent_log: org-scoped CRUD ──
ALTER TABLE sent_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sent_log_select_own" ON sent_log;
CREATE POLICY "sent_log_select_own" ON sent_log FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "sent_log_insert_own" ON sent_log;
CREATE POLICY "sent_log_insert_own" ON sent_log FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "sent_log_update_own" ON sent_log;
CREATE POLICY "sent_log_update_own" ON sent_log FOR UPDATE
  TO authenticated USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());

-- ── offers: org-scoped CRUD ──
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offers_select_own" ON offers;
CREATE POLICY "offers_select_own" ON offers FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "offers_insert_own" ON offers;
CREATE POLICY "offers_insert_own" ON offers FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "offers_update_own" ON offers;
CREATE POLICY "offers_update_own" ON offers FOR UPDATE
  TO authenticated USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());

-- ── offer_items: org-scoped CRUD ──
ALTER TABLE offer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offer_items_select_own" ON offer_items;
CREATE POLICY "offer_items_select_own" ON offer_items FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "offer_items_insert_own" ON offer_items;
CREATE POLICY "offer_items_insert_own" ON offer_items FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());

-- ── purchase_orders: org-scoped CRUD ──
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "po_select_own" ON purchase_orders;
CREATE POLICY "po_select_own" ON purchase_orders FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "po_insert_own" ON purchase_orders;
CREATE POLICY "po_insert_own" ON purchase_orders FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "po_update_own" ON purchase_orders;
CREATE POLICY "po_update_own" ON purchase_orders FOR UPDATE
  TO authenticated USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "po_delete_own" ON purchase_orders;
CREATE POLICY "po_delete_own" ON purchase_orders FOR DELETE
  TO authenticated USING (org_id = get_current_org_id());

-- ── purchase_order_items: org-scoped CRUD ──
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "po_items_select_own" ON purchase_order_items;
CREATE POLICY "po_items_select_own" ON purchase_order_items FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "po_items_insert_own" ON purchase_order_items;
CREATE POLICY "po_items_insert_own" ON purchase_order_items FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "po_items_update_own" ON purchase_order_items;
CREATE POLICY "po_items_update_own" ON purchase_order_items FOR UPDATE
  TO authenticated USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());
DROP POLICY IF EXISTS "po_items_delete_own" ON purchase_order_items;
CREATE POLICY "po_items_delete_own" ON purchase_order_items FOR DELETE
  TO authenticated USING (org_id = get_current_org_id());

-- ── audit_log: org-scoped read, org-scoped insert ──
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_select_own" ON audit_log;
CREATE POLICY "audit_select_own" ON audit_log FOR SELECT
  TO authenticated USING (
    org_id = get_current_org_id() OR is_saas_admin()
  );
DROP POLICY IF EXISTS "audit_insert_own" ON audit_log;
CREATE POLICY "audit_insert_own" ON audit_log FOR INSERT
  TO authenticated WITH CHECK (org_id = get_current_org_id());
