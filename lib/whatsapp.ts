import { WhatsAppAPI } from 'whatsapp-api-js';
import { Text } from 'whatsapp-api-js/messages';
import { pool } from '@/lib/db';

export type OrgWhatsAppSettings = {
  org_id: string;
  whatsapp_token: string | null;
  whatsapp_verify_token: string | null;
  whatsapp_phone_number: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  whatsapp_app_secret: string | null;
};

/** Load the WhatsApp Business credentials an org saved in Settings → Sensitive Data. */
export async function getOrgWhatsAppSettings(orgId: string): Promise<OrgWhatsAppSettings | null> {
  const { rows } = await pool.query(
    `SELECT org_id, whatsapp_token, whatsapp_verify_token, whatsapp_phone_number,
            whatsapp_phone_number_id, whatsapp_business_account_id, whatsapp_app_secret
     FROM org_integrations WHERE org_id = $1`,
    [orgId]
  );
  return rows[0] || null;
}

/** Find which org owns a given WhatsApp phone_number_id (used by the webhook, which is shared across all tenants). */
export async function getOrgByPhoneNumberId(phoneNumberId: string): Promise<OrgWhatsAppSettings | null> {
  const { rows } = await pool.query(
    `SELECT org_id, whatsapp_token, whatsapp_verify_token, whatsapp_phone_number,
            whatsapp_phone_number_id, whatsapp_business_account_id, whatsapp_app_secret
     FROM org_integrations WHERE whatsapp_phone_number_id = $1`,
    [phoneNumberId]
  );
  return rows[0] || null;
}

/** Build a whatsapp-api-js client for a given org's saved credentials. */
export function buildWhatsAppClient(settings: OrgWhatsAppSettings) {
  if (!settings.whatsapp_token || !settings.whatsapp_app_secret) {
    throw new Error('WhatsApp is not configured for this organization yet (Settings → Sensitive Data).');
  }
  return new WhatsAppAPI({
    token: settings.whatsapp_token,
    appSecret: settings.whatsapp_app_secret,
    webhookVerifyToken: settings.whatsapp_verify_token || undefined,
    // secure defaults to true, which requires + verifies appSecret above (recommended)
  });
}

export async function sendWhatsAppText(orgId: string, to: string, body: string) {
  const settings = await getOrgWhatsAppSettings(orgId);
  if (!settings || !settings.whatsapp_phone_number_id) {
    throw new Error('WhatsApp is not configured for this organization yet (Settings → Sensitive Data).');
  }
  const client = buildWhatsAppClient(settings);
  const response = await client.sendMessage(settings.whatsapp_phone_number_id, to, new Text(body));

  const waMessageId = (response as any)?.messages?.[0]?.id || null;

  await pool.query(
    `INSERT INTO whatsapp_messages (org_id, phone, direction, message_type, content, status, wa_message_id)
     VALUES ($1, $2, 'out', 'text', $3, 'sent', $4)`,
    [orgId, to, body, waMessageId]
  );

  return response;
}
