import { NextRequest, NextResponse } from 'next/server';
import { randomUUID, randomBytes } from 'crypto';
import { pool } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/server-auth';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { sendOrgEmail } from '@/lib/email';

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : 'https://rfq-saas.onrender.com';
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rfqId = params.id;
  const orgId = auth.orgId;

  try {
    const body = await req.json().catch(() => ({}));
    const supplierIds: string[] = Array.isArray(body.supplierIds) ? body.supplierIds : [];
    const viaWhatsapp: boolean = !!body.whatsapp;
    const viaEmail: boolean = !!body.email;
    const customMessage: string = typeof body.message === 'string' ? body.message.trim() : '';

    if (supplierIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one supplier' }, { status: 400 });
    }
    if (!viaWhatsapp && !viaEmail) {
      return NextResponse.json({ error: 'Select at least one channel (WhatsApp or Email)' }, { status: 400 });
    }

    const { rows: rfqRows } = await pool.query(
      `SELECT id, org_id, internal_rfq_no, customer_rfq_no, required_response_date FROM rfqs WHERE id = $1 AND org_id = $2`,
      [rfqId, orgId]
    );
    if (rfqRows.length === 0) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });
    }
    const rfq = rfqRows[0];

    // sent_by references organization_members(id), not org_users(id) (the JWT `sub`)
    const { rows: memberRows } = await pool.query(
      `SELECT id FROM organization_members WHERE user_id = $1 AND org_id = $2 LIMIT 1`,
      [(auth as any).sub, orgId]
    );
    const memberId: string | null = memberRows[0]?.id || null;

    const { rows: suppliers } = await pool.query(
      `SELECT id, name, email, phone FROM suppliers WHERE org_id = $1 AND id = ANY($2::uuid[])`,
      [orgId, supplierIds]
    );

    const baseUrl = getBaseUrl(req);
    const results: any[] = [];

    for (const supplier of suppliers) {
      const token = randomBytes(24).toString('hex');
      const link = `${baseUrl}/offer/${token}`;

      const { rows: sentRows } = await pool.query(
        `INSERT INTO sent_log (org_id, rfq_id, supplier_id, sent_by, token, close_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [orgId, rfqId, supplier.id, memberId, token, rfq.required_response_date || null]
      );
      const sentLogId = sentRows[0].id;

      const defaultMessage = `You have received a new Request for Quotation (${rfq.internal_rfq_no}). Please submit your offer using the link below:\n${link}`;
      const messageText = customMessage ? `${customMessage}\n\n${link}` : defaultMessage;

      const entry: any = { supplier_id: supplier.id, supplier_name: supplier.name, sent_log_id: sentLogId, whatsapp: null, email: null };

      if (viaWhatsapp) {
        if (!supplier.phone) {
          entry.whatsapp = { ok: false, error: 'No phone number on file' };
        } else {
          try {
            await sendWhatsAppText(orgId, supplier.phone, messageText);
            entry.whatsapp = { ok: true };
          } catch (err: any) {
            entry.whatsapp = { ok: false, error: err.message || 'Failed to send' };
          }
        }
      }

      if (viaEmail) {
        if (!supplier.email) {
          entry.email = { ok: false, error: 'No email on file' };
        } else {
          try {
            const html = `<p>${(customMessage || `You have received a new Request for Quotation <b>${rfq.internal_rfq_no}</b>.`).replace(/\n/g, '<br/>')}</p><p><a href="${link}">${link}</a></p>`;
            await sendOrgEmail(orgId, supplier.email, `RFQ ${rfq.internal_rfq_no} — Request for Quotation`, html);
            entry.email = { ok: true };
          } catch (err: any) {
            entry.email = { ok: false, error: err.message || 'Failed to send' };
          }
        }
      }

      results.push(entry);
    }

    // Mark the RFQ as sent (only moves it forward from draft)
    await pool.query(`UPDATE rfqs SET status = 'sent', updated_at = now() WHERE id = $1 AND org_id = $2 AND status = 'draft'`, [rfqId, orgId]);

    await pool.query(
      `INSERT INTO audit_log (org_id, action, entity_type, entity_id, description)
       VALUES ($1, 'send', 'rfq', $2, $3)`,
      [orgId, rfqId, `Sent RFQ ${rfq.internal_rfq_no} to ${suppliers.length} supplier(s)`]
    );

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error('rfq send error:', err);
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 });
  }
}
