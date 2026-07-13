import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'rfq-saas-secret-key-2026';

const ALLOWED_TABLES = [
  'subscription_plans', 'subscriptions', 'organizations', 'organization_members',
  'suppliers', 'supplier_categories', 'items',
  'rfqs', 'rfq_items', 'sent_log', 'offers', 'offer_items',
  'purchase_orders', 'purchase_order_items',
  'audit_log', 'company_settings',
];

function verifyToken(req: NextRequest): any | null {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const decoded = verifyToken(req);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const table = searchParams.get('table');
  if (!table || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
  }

  const params: any[] = [];
  let whereClause = '';
  let paramIdx = 1;

  const hasOrgId = ['suppliers', 'supplier_categories', 'items', 'rfqs', 'rfq_items', 'sent_log', 'offers', 'offer_items', 'purchase_orders', 'purchase_order_items', 'audit_log', 'company_settings', 'subscriptions', 'organization_members'].includes(table);

  if (decoded.type !== 'admin' && hasOrgId) {
    whereClause = ` WHERE org_id = $${paramIdx++}`;
    params.push(decoded.orgId);
  }

  const eqParam = searchParams.get('eq');
  if (eqParam) {
    const eqs = eqParam.split(',');
    const conditions: string[] = [];
    for (const e of eqs) {
      const [col, val] = e.split('=');
      if (col && val) {
        conditions.push(`${col} = $${paramIdx++}`);
        params.push(val);
      }
    }
    if (conditions.length > 0) {
      whereClause = whereClause ? whereClause + ` AND ${conditions.join(' AND ')}` : ` WHERE ${conditions.join(' AND ')}`;
    }
  }

  try {
    const result = await query(`SELECT COUNT(*) as count FROM ${table}${whereClause}`, params);
    return NextResponse.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
