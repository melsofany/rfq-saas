import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/server-auth';

// Allowed forward transitions for each status
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:   ['SENT'],
  SENT:    ['QUOTED', 'FAILED', 'SUCCESS'],
  QUOTED:  ['SUCCESS', 'FAILED'],
  FAILED:  [],
  SUCCESS: [],
};

const VALID_STATUSES = new Set(Object.keys(VALID_TRANSITIONS));

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { orgId } = auth;
  const rfqId = params.id;

  try {
    const body = await req.json().catch(() => ({}));
    const newStatus: string = body.status;

    if (!VALID_STATUSES.has(newStatus)) {
      return NextResponse.json({ error: `Invalid status: ${newStatus}` }, { status: 400 });
    }

    const { rows } = await pool.query(
      `SELECT status FROM rfqs WHERE id = $1 AND org_id = $2`,
      [rfqId, orgId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });
    }

    const currentStatus: string = rows[0].status;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${currentStatus} to ${newStatus}` },
        { status: 422 }
      );
    }

    await pool.query(
      `UPDATE rfqs SET status = $1, updated_at = now() WHERE id = $2 AND org_id = $3`,
      [newStatus, rfqId, orgId]
    );

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err: any) {
    console.error('rfq status update error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update status' }, { status: 500 });
  }
}
