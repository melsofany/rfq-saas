import { WhatsAppAPI } from 'whatsapp-api-js';
import { pool } from './db';

/**
 * Server-side WhatsApp Business Cloud API helper.
 *
 * Credentials are never hard-coded: they are pulled per-organization from the
 * `org_integrations` row that users fill in under Settings → Sensitive Data.
 * The actual WhatsApp Cloud API calls are delegated to the open-source
 * `whatsapp-api-js` library — this file only wires the stored config into it.
 */

export interface OrgWhatsAppConfig {
  whatsapp_token: string | null;
  whatsapp_verify_token: string | null;
  whatsapp_phone_number: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  whatsapp_app_secret: string | null;
}

export async function getOrgWhatsAppConfig(
  orgId: string
): Promise<OrgWhatsAppConfig | null> {
  const { rows } = await pool.query<OrgWhatsAppConfig>(
    `SELECT whatsapp_token, whatsapp_verify_token, whatsapp_phone_number,
            whatsapp_phone_number_id, whatsapp_business_account_id, whatsapp_app_secret
       FROM org_integrations
      WHERE org_id = $1
      LIMIT 1`,
    [orgId]
  );
  return rows[0] ?? null;
}

export type WhatsAppReady = {
  client: WhatsAppAPI;
  phoneNumberID: string;
  config: OrgWhatsAppConfig;
};

/**
 * Builds a `WhatsAppAPI` client from the organization's stored credentials.
 * Returns `null` when the mandatory fields (token + phone number id) are missing
 * so callers can surface a "configure WhatsApp in Settings" message.
 */
export async function getWhatsAppClient(
  orgId: string
): Promise<WhatsAppReady | null> {
  const config = await getOrgWhatsAppConfig(orgId);
  if (!config?.whatsapp_token || !config?.whatsapp_phone_number_id) {
    return null;
  }

  // `appSecret` is only needed to verify inbound webhook signatures. When it is
  // provided we run in secure mode; otherwise we disable it so outbound sends
  // still work without a secret (the library requires this explicit switch).
  const client = config.whatsapp_app_secret
    ? new WhatsAppAPI({
        token: config.whatsapp_token,
        appSecret: config.whatsapp_app_secret,
        webhookVerifyToken: config.whatsapp_verify_token ?? undefined,
      })
    : new WhatsAppAPI({
        token: config.whatsapp_token,
        secure: false,
        webhookVerifyToken: config.whatsapp_verify_token ?? undefined,
      });

  return { client, phoneNumberID: config.whatsapp_phone_number_id, config };
}
