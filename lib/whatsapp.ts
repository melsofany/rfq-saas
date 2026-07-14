import { WhatsAppAPI } from 'whatsapp-api-js';
import {
  Text,
  Template,
  Language,
  BodyComponent,
  BodyParameter,
  URLComponent,
} from 'whatsapp-api-js/messages';
import { pool } from '@/lib/db';

// Approved WhatsApp Business message template used to initiate RFQ conversations.
// WhatsApp requires a pre-approved "template" message (not free text) for any
// business-initiated message — i.e. any message sent to a supplier who hasn't
// messaged us in the last 24h. Free text is silently accepted by the Graph API
// (you get a wamid back) but NEVER delivered in that case, which is why RFQs
// sent as plain Text never arrived. This template + its button URL prefix are
// already approved on the account (verified via the Graph API on 2026-07-14).
const RFQ_TEMPLATE_NAME = process.env.WHATSAPP_RFQ_TEMPLATE || 'rfq_send_ar';
const RFQ_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'ar';

function sanitizeWaParam(text: string): string {
  return text.replace(/[\r\n\t]/g, ' ').replace(/ {5,}/g, '    ').trim();
}

/** Normalize a supplier phone number to the digits-only, country-code-prefixed
 *  format the WhatsApp Cloud API expects (no leading +, no local 0). */
export function normalizeWaPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = '2' + cleaned; // EG mobile
  if (cleaned.length === 10 && cleaned.startsWith('1')) cleaned = '20' + cleaned;
  return cleaned;
}

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

export interface RfqWhatsAppOpts {
  supplierName: string;
  rfqNo: string;
  itemsSummary: string;
  closeDate: string;
  contactText: string;
  /** The `sent_log.token` — becomes the suffix of the template's approved button URL. */
  token: string;
}

/**
 * Send the RFQ-to-supplier notification as an approved WhatsApp message TEMPLATE
 * (not free text). This is required because the supplier hasn't messaged us
 * first, so this is a business-initiated conversation — WhatsApp only delivers
 * those via a pre-approved template. See RFQ_TEMPLATE_NAME above.
 */
export async function sendRfqWhatsAppTemplate(orgId: string, to: string, opts: RfqWhatsAppOpts) {
  const settings = await getOrgWhatsAppSettings(orgId);
  if (!settings || !settings.whatsapp_phone_number_id) {
    throw new Error('WhatsApp is not configured for this organization yet (Settings → Sensitive Data).');
  }
  const client = buildWhatsAppClient(settings);
  const waTo = normalizeWaPhone(to);

  const template = new Template(
    RFQ_TEMPLATE_NAME,
    new Language(RFQ_TEMPLATE_LANG),
    new BodyComponent(
      new BodyParameter(sanitizeWaParam(opts.supplierName)),
      new BodyParameter(sanitizeWaParam(opts.rfqNo)),
      new BodyParameter(sanitizeWaParam(opts.itemsSummary)),
      new BodyParameter(sanitizeWaParam(opts.closeDate)),
      new BodyParameter(sanitizeWaParam(opts.contactText)),
    ),
    new URLComponent(opts.token),
  );

  const response: any = await client.sendMessage(settings.whatsapp_phone_number_id, waTo, template);
  if (response && response.error) {
    throw new Error(`WhatsApp template error: ${JSON.stringify(response.error)}`);
  }
  const waMessageId = response?.messages?.[0]?.id || null;
  if (!waMessageId) {
    throw new Error('WhatsApp API did not confirm delivery (no message id returned)');
  }

  const logBody = `[${RFQ_TEMPLATE_NAME}] RFQ ${opts.rfqNo} → ${opts.supplierName}`;
  await pool.query(
    `INSERT INTO whatsapp_messages (org_id, phone, direction, message_type, content, status, wa_message_id)
     VALUES ($1, $2, 'out', 'template', $3, 'sent', $4)`,
    [orgId, waTo, logBody, waMessageId]
  );

  return response;
}
