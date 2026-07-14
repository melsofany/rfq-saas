import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/server-auth';
import { sendWhatsAppText } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { to, body } = await req.json();
    if (!to || !body) {
      return NextResponse.json({ error: 'to and body are required' }, { status: 400 });
    }
    const result = await sendWhatsAppText(auth.orgId, String(to), String(body));
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('whatsapp send error:', err);
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 });
  }
}
