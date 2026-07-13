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

const ALLOWED_COLUMNS: Record<string, string[]> = {
  subscription_plans: ['id', 'name', 'name_ar', 'description', 'price_monthly', 'price_yearly', 'max_employees', 'max_suppliers', 'max_rfqs_per_month', 'max_purchase_orders', 'features', 'is_active', 'sort_order', 'created_at', 'updated_at'],
  subscriptions: ['id', 'org_id', 'plan_id', 'status', 'billing_cycle', 'current_period_start', 'current_period_end', 'cancel_at_period_end', 'created_at', 'updated_at'],
  organizations: ['id', 'name', 'name_ar', 'slug', 'email', 'phone', 'address', 'country', 'plan_id', 'status', 'trial_ends_at', 'created_at', 'updated_at'],
  organization_members: ['id', 'org_id', 'user_id', 'email', 'role', 'is_active', 'created_at', 'updated_at'],
  suppliers: ['id', 'org_id', 'supplier_id', 'name', 'contact_person', 'email', 'phone', 'address', 'category', 'is_active', 'created_at', 'updated_at'],
  supplier_categories: ['id', 'org_id', 'name', 'created_at'],
  items: ['id', 'org_id', 'item_id', 'part_no', 'description', 'uom', 'reference_price', 'category', 'created_at'],
  rfqs: ['id', 'org_id', 'internal_rfq_no', 'customer_rfq_no', 'customer_rfq_date', 'required_response_date', 'status', 'created_by', 'notes', 'expires_at', 'created_at', 'updated_at'],
  rfq_items: ['id', 'org_id', 'rfq_id', 'item_id', 'line_item', 'part_no', 'description', 'uom', 'qty', 'reference_price', 'created_at'],
  sent_log: ['id', 'org_id', 'rfq_id', 'supplier_id', 'sent_by', 'token', 'close_date', 'link_opened', 'open_count', 'first_opened_at', 'last_opened_at', 'offer_submitted', 'created_at'],
  offers: ['id', 'org_id', 'rfq_id', 'supplier_id', 'sent_log_id', 'submitted_by', 'total_price', 'general_notes', 'status', 'created_at', 'updated_at'],
  offer_items: ['id', 'org_id', 'offer_id', 'rfq_item_id', 'price', 'tax_included', 'delivery_days', 'notes', 'created_at'],
  purchase_orders: ['id', 'org_id', 'internal_po_no', 'external_po_no', 'receiver_name', 'receiver_phone', 'status', 'created_by', 'notes', 'created_at', 'updated_at'],
  purchase_order_items: ['id', 'org_id', 'po_id', 'item_id', 'line_item', 'part_no', 'description', 'uom', 'qty', 'reference_price', 'tax_included', 'supplier_id', 'created_at'],
  audit_log: ['id', 'org_id', 'action', 'entity_type', 'entity_id', 'member_id', 'description', 'ip_address', 'user_agent', 'created_at'],
  company_settings: ['id', 'org_id', 'name_en', 'name_ar', 'logo_url', 'address', 'phone', 'email', 'tax_number', 'currency', 'created_at', 'updated_at'],
};

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

function validateColumns(table: string, cols: string[]): boolean {
  const allowed = ALLOWED_COLUMNS[table];
  if (!allowed) return false;
  return cols.every(c => c === '*' || allowed.includes(c));
}

function buildOrgFilter(decoded: any): string {
  if (decoded.type === 'admin') return '';
  if (decoded.orgId) return ` AND org_id = '${decoded.orgId}'`;
  return ' AND 1=0';
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

  const select = searchParams.get('select') || '*';
  const selectCols = select === '*' ? ['*'] : select.split(',').map(c => c.trim());
  if (!validateColumns(table, selectCols)) {
    return NextResponse.json({ error: 'Invalid columns' }, { status: 400 });
  }

  const orderCol = searchParams.get('order');
  const orderDir = searchParams.get('dir') || 'asc';
  const limit = searchParams.get('limit');

  if (orderCol && (!ALLOWED_COLUMNS[table] || !ALLOWED_COLUMNS[table].includes(orderCol))) {
    return NextResponse.json({ error: 'Invalid order column' }, { status: 400 });
  }
  if (orderDir !== 'asc' && orderDir !== 'desc') {
    return NextResponse.json({ error: 'Invalid order direction' }, { status: 400 });
  }

  const hasOrgId = ALLOWED_COLUMNS[table]?.includes('org_id');
  const orgFilter = (decoded.type !== 'admin' && hasOrgId) ? ` WHERE org_id = $1` : '';

  let sql = `SELECT ${select} FROM ${table}${orgFilter}`;
  const params: any[] = [];
  let paramIdx = decoded.type !== 'admin' && hasOrgId ? 2 : 1;

  const eqParam = searchParams.get('eq');
  if (eqParam) {
    const eqs = eqParam.split(',');
    const conditions: string[] = [];
    for (const e of eqs) {
      const [col, val] = e.split('=');
      if (col && val) {
        if (!ALLOWED_COLUMNS[table]?.includes(col)) {
          return NextResponse.json({ error: `Invalid filter column: ${col}` }, { status: 400 });
        }
        conditions.push(`${col} = $${paramIdx++}`);
        params.push(val);
      }
    }
    if (conditions.length > 0) {
      if (orgFilter) {
        sql += ` AND ${conditions.join(' AND ')}`;
      } else {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
  }

  if (decoded.type !== 'admin' && hasOrgId) {
    params.unshift(decoded.orgId);
  }

  if (orderCol) {
    sql += ` ORDER BY ${orderCol} ${orderDir === 'desc' ? 'DESC' : 'ASC'}`;
  }

  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
    }
    sql += ` LIMIT ${limitNum}`;
  }

  try {
    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const decoded = verifyToken(req);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { table, data } = await req.json();
  if (!table || !data || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table or data' }, { status: 400 });
  }

  const cols = Object.keys(data);
  if (!validateColumns(table, cols)) {
    return NextResponse.json({ error: 'Invalid columns in data' }, { status: 400 });
  }

  const hasOrgId = ALLOWED_COLUMNS[table]?.includes('org_id');
  if (hasOrgId && decoded.type !== 'admin') {
    data.org_id = decoded.orgId;
  }

  const allCols = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = allCols.map((_, i) => `$${i + 1}`).join(', ');
  const colList = allCols.join(', ');

  try {
    const result = await query(
      `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) RETURNING *`,
      vals
    );
    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const decoded = verifyToken(req);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { table, data, eq } = await req.json();
  if (!table || !data || !eq || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const setCols = Object.keys(data);
  if (!validateColumns(table, setCols)) {
    return NextResponse.json({ error: 'Invalid columns in data' }, { status: 400 });
  }

  const eqCols = Object.keys(eq);
  if (!validateColumns(table, eqCols)) {
    return NextResponse.json({ error: 'Invalid filter columns' }, { status: 400 });
  }

  const setVals = Object.values(data);
  const setClause = setCols.map((c, i) => `${c} = $${i + 1}`).join(', ');

  const eqVals = Object.values(eq);
  let whereClause = eqCols.map((c, i) => `${c} = $${setVals.length + i + 1}`).join(' AND ');

  const hasOrgId = ALLOWED_COLUMNS[table]?.includes('org_id');
  if (hasOrgId && decoded.type !== 'admin') {
    whereClause += ` AND org_id = $${setVals.length + eqVals.length + 1}`;
    eqVals.push(decoded.orgId);
  }

  try {
    const result = await query(
      `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`,
      [...setVals, ...eqVals]
    );
    return NextResponse.json(result.rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const decoded = verifyToken(req);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const table = searchParams.get('table');
  const eqParam = searchParams.get('eq');

  if (!table || !eqParam || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table or eq' }, { status: 400 });
  }

  const eqs = eqParam.split(',');
  const whereParts: string[] = [];
  const params: any[] = [];
  let idx = 1;

  for (const e of eqs) {
    const [col, val] = e.split('=');
    if (col && val) {
      if (!ALLOWED_COLUMNS[table]?.includes(col)) {
        return NextResponse.json({ error: `Invalid filter column: ${col}` }, { status: 400 });
      }
      whereParts.push(`${col} = $${idx++}`);
      params.push(val);
    }
  }

  const hasOrgId = ALLOWED_COLUMNS[table]?.includes('org_id');
  if (hasOrgId && decoded.type !== 'admin') {
    whereParts.push(`org_id = $${idx++}`);
    params.push(decoded.orgId);
  }

  try {
    await query(`DELETE FROM ${table} WHERE ${whereParts.join(' AND ')}`, params);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
