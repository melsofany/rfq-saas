-- ═══════════════════════════════════════════════════════════════════
-- Migration 004 — WhatsApp Messages (chat-style log for the WhatsApp Web page)
-- Powered by the open-source "whatsapp-api-js" client for WhatsApp Cloud API
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- the other party's WhatsApp number (E.164, no +), used to group a "conversation"
  contact_wa_id text NOT NULL,
  contact_name text,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  message_type text NOT NULL DEFAULT 'text',
  body text,
  status text NOT NULL DEFAULT 'sent', -- sent | delivered | read | failed | received
  wa_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_org_contact
  ON whatsapp_messages(org_id, contact_wa_id, created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_message_id
  ON whatsapp_messages(wa_message_id);
