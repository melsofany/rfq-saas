-- ═══════════════════════════════════════════════════════════════════
-- Migration 002 — Integrations & WhatsApp Templates
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  -- SMTP
  smtp_host text,
  smtp_port int,
  smtp_user text,
  smtp_pass text,
  -- WhatsApp
  whatsapp_token text,
  whatsapp_verify_token text,
  whatsapp_phone_number text,
  whatsapp_phone_number_id text,
  whatsapp_business_account_id text,
  whatsapp_app_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_integrations_org ON org_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_org ON whatsapp_templates(org_id);
