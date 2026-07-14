import { NextRequest, NextResponse } from 'next/server';
import { randomUUID, randomBytes } from 'crypto';
import { pool } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/server-auth';
import { sendRfqWhatsAppTemplate } from '@/lib/whatsapp';
import { sendOrgEmail } from '@/lib/email';
import { getCompanySettings } from '@/lib/company';
import { generateRfqPdf } from '@/lib/pdf';

function buildItemsSummary(items: Array<{ description: string; qty: number | string | null }>): string {
  const suffix = items.length > 5 ? `، وغيرها (${items.length} صنف)` : '';
  const summary = items
    .slice(0, 5)
    .map((item, i) => `${i + 1}. ${item.description}${item.qty ? ` x${item.qty}` : ''}`)
    .join('، ') + suffix;
  return summary.length <= 800 ? summary : summary.slice(0, 800 - suffix.length).trimEnd() + '…' + suffix;
}

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
      `SELECT id, full_name, phone FROM organization_members WHERE user_id = $1 AND org_id = $2 LIMIT 1`,
      [(auth as any).sub, orgId]
    );
    const memberId: string | null = memberRows[0]?.id || null;
    const senderName: string = memberRows[0]?.full_name || '';
    const senderPhone: string | null = memberRows[0]?.phone || null;

    const { rows: suppliers } = await pool.query(
      `SELECT id, name, email, phone FROM suppliers WHERE org_id = $1 AND id = ANY($2::uuid[])`,
      [orgId, supplierIds]
    );

    const { rows: rfqItems } = await pool.query(
      `SELECT description, part_no, qty, uom FROM rfq_items WHERE rfq_id = $1 ORDER BY created_at ASC`,
      [rfqId]
    );

    const company = (viaEmail || viaWhatsapp) ? await getCompanySettings(orgId) : null;

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

      const entry: any = { supplier_id: supplier.id, supplier_name: supplier.name, sent_log_id: sentLogId, whatsapp: null, email: null };

      if (viaWhatsapp) {
        if (!supplier.phone) {
          entry.whatsapp = { ok: false, error: 'No phone number on file' };
        } else {
          try {
            const closeDateText = rfq.required_response_date
              ? new Date(rfq.required_response_date).toLocaleDateString()
              : 'غير محدد';
            const contactText = senderName
              ? `${senderName}${senderPhone ? ' — ' + senderPhone : ''}`
              : (company?.phone || company?.name_en || company?.name_ar || '');
            await sendRfqWhatsAppTemplate(orgId, supplier.phone, {
              supplierName: supplier.name,
              rfqNo: rfq.internal_rfq_no,
              itemsSummary: buildItemsSummary(rfqItems),
              closeDate: closeDateText,
              contactText,
              token,
            });
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
            let pdfBuffer: Buffer | null = null;
            try {
              pdfBuffer = await generateRfqPdf({
                company,
                rfq: { internal_rfq_no: rfq.internal_rfq_no, customer_rfq_no: rfq.customer_rfq_no, required_response_date: rfq.required_response_date },
                items: rfqItems,
                supplierName: supplier.name,
                offerLink: link,
              });
            } catch (pdfErr) {
              console.error('rfq pdf generation error:', pdfErr);
            }
            await sendOrgEmail(
              orgId,
              supplier.email,
              `RFQ ${rfq.internal_rfq_no} — Request for Quotation`,
              html,
              pdfBuffer ? [{ filename: `RFQ-${rfq.internal_rfq_no}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : undefined
            );
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
