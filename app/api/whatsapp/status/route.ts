import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/server-auth';
import { getOrgWhatsAppConfig } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await getOrgWhatsAppConfig(auth.orgId);
    const configured = Boolean(config?.whatsapp_token && config?.whatsapp_phone_number_id);
    return NextResponse.json({
      configured,
      phone_number: config?.whatsapp_phone_number ?? null,
      phone_number_id: config?.whatsapp_phone_number_id ?? null,
      business_account_id: config?.whatsapp_business_account_id ?? null,
      has_token: Boolean(config?.whatsapp_token),
      has_app_secret: Boolean(config?.whatsapp_app_secret),
      has_verify_token: Boolean(config?.whatsapp_verify_token),
    });
  } catch (err: any) {
    console.error('whatsapp/status error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load status' }, { status: 500 });
  }
}
