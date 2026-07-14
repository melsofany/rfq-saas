import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Public, token-based endpoints — no org/admin auth. A supplier reaches these
// via the unique link we sent them (email/WhatsApp), so the token IS the auth.

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token;
  try {
    const { rows: logRows } = await pool.query(
      `SELECT sl.id, sl.rfq_id, sl.supplier_id, sl.close_date, sl.offer_submitted, sl.open_count,
              s.name AS supplier_name, s.email AS supplier_email,
              r.internal_rfq_no, r.customer_rfq_no, r.notes, r.required_response_date, r.status AS rfq_status
       FROM sent_log sl
       JOIN suppliers s ON s.id = sl.supplier_id
       JOIN rfqs r ON r.id = sl.rfq_id
       WHERE sl.token = $1`,
      [token]
    );
    if (logRows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }
    const log = logRows[0];

    const { rows: items } = await pool.query(
      `SELECT id, description, part_no, qty, uom FROM rfq_items WHERE rfq_id = $1 ORDER BY created_at ASC`,
      [log.rfq_id]
    );

    await pool.query(
      `UPDATE sent_log SET link_opened = true, open_count = open_count + 1,
              first_opened_at = COALESCE(first_opened_at, now()), last_opened_at = now()
       WHERE id = $1`,
      [log.id]
    );

    return NextResponse.json({
      rfq: {
        internal_rfq_no: log.internal_rfq_no,
        customer_rfq_no: log.customer_rfq_no,
        notes: log.notes,
        required_response_date: log.required_response_date,
        status: log.rfq_status,
      },
      supplier: { name: log.supplier_name, email: log.supplier_email },
      items,
      close_date: log.close_date,
      offer_submitted: log.offer_submitted,
    });
  } catch (err: any) {
    console.error('offer GET error:', err);
    return NextResponse.json({ error: 'Failed to load RFQ' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token;
  try {
    const { rows: logRows } = await pool.query(
      `SELECT id, org_id, rfq_id, supplier_id, offer_submitted FROM sent_log WHERE token = $1`,
      [token]
    );
    if (logRows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }
    const log = logRows[0];
    if (log.offer_submitted) {
      return NextResponse.json({ error: 'An offer has already been submitted for this RFQ' }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const generalNotes: string | null = body.general_notes || null;
    const items: Array<{ rfq_item_id: string; price: number; tax_included?: boolean; delivery_days?: number; notes?: string }> =
      Array.isArray(body.items) ? body.items : [];

    const validItems = items.filter((it) => it.rfq_item_id && it.price != null && it.price !== ('' as any) && !Number.isNaN(Number(it.price)));
    if (validItems.length === 0) {
      return NextResponse.json({ error: 'Enter a price for at least one item' }, { status: 400 });
    }

    const totalPrice = validItems.reduce((sum, it) => sum + Number(it.price), 0);

    const { rows: offerRows } = await pool.query(
      `INSERT INTO offers (org_id, rfq_id, supplier_id, sent_log_id, total_price, general_notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'submitted') RETURNING id`,
      [log.org_id, log.rfq_id, log.supplier_id, log.id, totalPrice, generalNotes]
    );
    const offerId = offerRows[0].id;

    for (const it of validItems) {
      await pool.query(
        `INSERT INTO offer_items (org_id, offer_id, rfq_item_id, price, tax_included, delivery_days, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [log.org_id, offerId, it.rfq_item_id, Number(it.price), !!it.tax_included, it.delivery_days || null, it.notes || null]
      );
    }

    await pool.query(`UPDATE sent_log SET offer_submitted = true WHERE id = $1`, [log.id]);

    await pool.query(
      `UPDATE rfqs SET status = CASE WHEN status = 'sent' THEN 'partial' ELSE status END, updated_at = now() WHERE id = $1`,
      [log.rfq_id]
    );

    return NextResponse.json({ success: true, offer_id: offerId });
  } catch (err: any) {
    console.error('offer POST error:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit offer' }, { status: 500 });
  }
}
