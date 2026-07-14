import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { buildWhatsAppClient, getOrgByPhoneNumberId } from '@/lib/whatsapp';

// ── GET: Meta's webhook verification handshake ──
// Meta calls this with hub.mode / hub.verify_token / hub.challenge and does NOT
// tell us which org it belongs to, so we check the token against every org
// that has WhatsApp configured (Settings → Sensitive Data → WHATSAPP_VERIFY_TOKEN).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get('hub.mode');
  const token = sp.get('hub.verify_token');
  const challenge = sp.get('hub.challenge');

  if (mode !== 'subscribe' || !token) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { rows } = await pool.query(
    `SELECT org_id FROM org_integrations WHERE whatsapp_verify_token = $1 LIMIT 1`,
    [token]
  );

  if (rows.length === 0) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return new NextResponse(challenge ?? '', { status: 200 });
}

// ── POST: incoming messages & status updates from Meta ──
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const phoneNumberId =
    payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  if (!phoneNumberId) {
    // Not a message/status payload we care about — ack anyway so Meta stops retrying.
    return NextResponse.json({ received: true });
  }

  const settings = await getOrgByPhoneNumberId(phoneNumberId);
  if (!settings) {
    return NextResponse.json({ error: 'Unknown phone_number_id' }, { status: 404 });
  }

  const client = buildWhatsAppClient(settings);
  const signature = req.headers.get('x-hub-signature-256') || '';

  // Store incoming messages using the library's typed event callback.
  client.on.message = async ({ from, name, message }) => {
    const body =
      message.type === 'text'
        ? message.text?.body
        : `[${message.type}]`;

    await pool.query(
      `INSERT INTO whatsapp_messages (org_id, contact_wa_id, contact_name, direction, message_type, body, status, wa_message_id)
       VALUES ($1, $2, $3, 'in', $4, $5, 'received', $6)`,
      [settings.org_id, from, name || null, message.type, body || null, (message as any).id || null]
    );
  };

  // Update delivery/read status for messages we sent.
  client.on.status = async ({ id, status }) => {
    if (!id) return;
    await pool.query(
      `UPDATE whatsapp_messages SET status = $1 WHERE wa_message_id = $2`,
      [status, id]
    );
  };

  try {
    await client.post(payload, raw, signature);
  } catch (err) {
    console.error('whatsapp webhook post error:', err);
  }

  return NextResponse.json({ received: true });
}
