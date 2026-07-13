import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { setup_key } = await req.json();
    if (setup_key !== 'init-db-2026') {
      return NextResponse.json({ error: 'Invalid setup key' }, { status: 403 });
    }

    const errors: string[] = [];

    const statements = [
      `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

      `CREATE TABLE IF NOT EXISTS subscription_plans (
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
      )`,

      `CREATE TABLE IF NOT EXISTS organizations (
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
      )`,

      `CREATE TABLE IF NOT EXISTS subscriptions (
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
      )`,

      `CREATE TABLE IF NOT EXISTS org_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        full_name text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,

      `CREATE TABLE IF NOT EXISTS organization_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES org_users(id) ON DELETE CASCADE,
        email text NOT NULL,
        role text NOT NULL DEFAULT 'purchasing',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(org_id, user_id)
      )`,

      `CREATE TABLE IF NOT EXISTS saas_admins (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'admin',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,

      `CREATE TABLE IF NOT EXISTS company_settings (
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
      )`,

      `CREATE TABLE IF NOT EXISTS suppliers (
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
      )`,

      `CREATE TABLE IF NOT EXISTS supplier_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(org_id, name)
      )`,

      `CREATE TABLE IF NOT EXISTS items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        item_id text,
        part_no text,
        description text NOT NULL,
        uom text,
        reference_price numeric(15,4),
        category text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,

      `CREATE TABLE IF NOT EXISTS rfqs (
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
      )`,

      `CREATE TABLE IF NOT EXISTS rfq_items (
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
      )`,

      `CREATE TABLE IF NOT EXISTS sent_log (
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
      )`,

      `CREATE TABLE IF NOT EXISTS offers (
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
      )`,

      `CREATE TABLE IF NOT EXISTS offer_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
        rfq_item_id uuid NOT NULL REFERENCES rfq_items(id),
        price numeric(15,4) NOT NULL,
        tax_included boolean NOT NULL DEFAULT false,
        delivery_days int,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,

      `CREATE TABLE IF NOT EXISTS purchase_orders (
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
      )`,

      `CREATE TABLE IF NOT EXISTS purchase_order_items (
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
      )`,

      `CREATE TABLE IF NOT EXISTS audit_log (
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
      )`,
    ];

    for (const stmt of statements) {
      try {
        await query(stmt);
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          errors.push(err.message);
        }
      }
    }

    try {
      await query(`
        INSERT INTO subscription_plans (name, name_ar, description, price_monthly, price_yearly, max_employees, max_suppliers, max_rfqs_per_month, max_purchase_orders, features, sort_order)
        VALUES
          ('Free', 'مجاني', 'Get started with basic RFQ management', 0, 0, 3, 20, 20, 10,
           '["Dashboard","RFQ Management (up to 20/month)","Suppliers (up to 20)","Purchase Orders (up to 10)","Basic Analytics"]'::jsonb, 0),
          ('Pro', 'احترافي', 'For growing procurement teams', 49, 490, 15, 200, 500, 200,
           '["Everything in Free","RFQ Management (up to 500/month)","Suppliers (up to 200)","Purchase Orders (up to 200)","Advanced Analytics","WhatsApp Integration","Google Sheets Sync","PDF Export"]'::jsonb, 1),
          ('Enterprise', 'مؤسسات', 'For large organizations with custom needs', 199, 1990, 100, 999999, 999999, 999999,
           '["Everything in Pro","Unlimited Employees","Unlimited Suppliers","Unlimited RFQs","Unlimited POs","Custom Branding","Priority Support","API Access","Audit Logs"]'::jsonb, 2)
        ON CONFLICT (name) DO NOTHING
      `);
    } catch (err: any) {
      errors.push(`Plans: ${err.message}`);
    }

    try {
      const passwordHash = await bcrypt.hash('Admin2026!', 10);
      await query(`
        INSERT INTO saas_admins (email, password_hash, role)
        VALUES ('admin@rfqmanager.com', $1, 'super_admin')
        ON CONFLICT (email) DO UPDATE SET password_hash = $1, is_active = true
      `, [passwordHash]);
    } catch (err: any) {
      errors.push(`Admin: ${err.message}`);
    }

    return NextResponse.json({
      success: true,
      errors: errors.length > 0 ? errors : undefined,
      message: 'Database initialized successfully',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
