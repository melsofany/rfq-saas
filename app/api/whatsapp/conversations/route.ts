import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/server-auth';

// GET /api/whatsapp/conversations              → list of contacts + last message (WhatsApp-Web-style sidebar)
// GET /api/whatsapp/conversations?contact=WA_ID → full message thread with that contact
export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contact = req.nextUrl.searchParams.get('contact');

  try {
    if (contact) {
      const { rows } = await pool.query(
        `SELECT id, phone AS contact_wa_id, contact_name, direction, message_type, content AS body, status, wa_message_id, created_at
         FROM whatsapp_messages
         WHERE org_id = $1 AND phone = $2
         ORDER BY created_at ASC`,
        [auth.orgId, contact]
      );
      return NextResponse.json(rows);
    }

    const { rows } = await pool.query(
      `SELECT DISTINCT ON (phone)
         phone AS contact_wa_id, contact_name, content AS last_message, direction, status, created_at AS last_message_at
       FROM whatsapp_messages
       WHERE org_id = $1
       ORDER BY phone, created_at DESC`,
      [auth.orgId]
    );
    rows.sort((a: any, b: any) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error('whatsapp conversations error:', err);
    return NextResponse.json({ error: err.message || 'Query failed' }, { status: 500 });
  }
}
