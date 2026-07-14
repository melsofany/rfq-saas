import { NextRequest, NextResponse } from 'next/server';
import { Text, Template } from 'whatsapp-api-js/messages';
import { getAuthFromRequest } from '@/lib/server-auth';
import { getWhatsAppClient } from '@/lib/whatsapp';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SendBody = {
  to?: string;
  type?: 'text' | 'template';
  text?: string;
  preview_url?: boolean;
  template_name?: string;
  language_code?: string;
};

function normalizePhone(raw: string): string {
  // WhatsApp expects the number in international format without '+' or spaces.
  return raw.replace(/[^\d]/g, '');
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as SendBody;
  const to = body.to ? normalizePhone(body.to) : '';
  if (!to) {
    return NextResponse.json({ error: 'Recipient phone number is required' }, { status: 400 });
  }

  const ready = await getWhatsAppClient(auth.orgId);
  if (!ready) {
    return NextResponse.json(
      { error: 'WhatsApp is not configured. Add your token and phone number id in Settings → Sensitive Data.' },
      { status: 409 }
    );
  }

  const type = body.type ?? 'text';
  let message;
  if (type === 'template') {
    if (!body.template_name) {
      return NextResponse.json({ error: 'template_name is required for template messages' }, { status: 400 });
    }
    message = new Template(body.template_name, body.language_code || 'en_US');
  } else {
    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }
    message = new Text(body.text.trim(), body.preview_url ?? false);
  }

  try {
    const response = await ready.client.sendMessage(ready.phoneNumberID, to, message);

    if ((response as any)?.error) {
      const apiErr = (response as any).error;
      return NextResponse.json(
        { error: apiErr.message || 'WhatsApp API returned an error', details: apiErr },
        { status: 502 }
      );
    }

    // Best-effort audit log; never block the send on logging failures.
    try {
      await pool.query(
        `INSERT INTO audit_log (org_id, action, entity_type, description)
         VALUES ($1, 'send', 'whatsapp', $2)`,
        [auth.orgId, `Sent WhatsApp ${type} message to ${to}`]
      );
    } catch {
      /* ignore */
    }

    return NextResponse.json({ success: true, response });
  } catch (err: any) {
    console.error('whatsapp/send error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send message' }, { status: 500 });
  }
}
