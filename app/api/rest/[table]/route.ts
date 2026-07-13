import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/server-auth';

// Tables that belong to a single organization and must always be
// filtered/forced to the caller's own org_id.
const TENANT_TABLES = new Set([
  'company_settings', 'suppliers', 'supplier_categories', 'items',
  'rfqs', 'rfq_items', 'sent_log', 'offers', 'offer_items',
  'purchase_orders', 'purchase_order_items', 'audit_log', 'organization_members',
  'org_integrations', 'whatsapp_templates',
]);

// Tables only a SaaS admin may manage. Org users get a restricted view
// (organizations: only their own row).
const ADMIN_TABLES = new Set(['organizations', 'subscriptions']);

// Anyone (even logged out) may read these — needed for pricing/register pages.
const PUBLIC_READ_TABLES = new Set(['subscription_plans']);

const ALL_TABLES = new Set(Array.prototype.concat(
  Array.from(TENANT_TABLES), Array.from(ADMIN_TABLES), Array.from(PUBLIC_READ_TABLES)
));

function safeIdent(s: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) {
    throw new Error(`Invalid identifier: ${s}`);
  }
  return s;
}

function buildEqFilters(searchParams: URLSearchParams) {
  const clauses: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Array.from(searchParams.entries())) {
    if (['select', 'order', 'limit'].includes(key)) continue;
    if (val.startsWith('eq.')) {
      clauses.push(safeIdent(key));
      values.push(val.slice(3));
    }
  }
  return { clauses, values };
}

type Access = { ok: true; isAdmin: boolean; isOrg: boolean; orgId?: string } | { ok: false; status: number; error: string };

function checkAccess(req: NextRequest, table: string): Access {
  if (!ALL_TABLES.has(table)) return { ok: false, status: 404, error: 'Unknown table' };

  const auth = getAuthFromRequest(req);
  const isAdmin = auth?.type === 'admin';
  const isOrg = auth?.type === 'org';

  if (PUBLIC_READ_TABLES.has(table) && req.method === 'GET') {
    return { ok: true, isAdmin, isOrg, orgId: isOrg ? (auth as any).orgId : undefined };
  }

  if (!isAdmin && !isOrg) return { ok: false, status: 401, error: 'Unauthorized' };

  if (ADMIN_TABLES.has(table) && !isAdmin) {
    // org users can read their own organization row or their own subscriptions
    if (req.method === 'GET' && (table === 'organizations' || table === 'subscriptions')) {
      return { ok: true, isAdmin, isOrg, orgId: (auth as any).orgId };
    }
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, isAdmin, isOrg, orgId: isOrg ? (auth as any).orgId : undefined };
}

export async function GET(req: NextRequest, { params }: { params: { table: string } }) {
  const table = params.table;
  const access = checkAccess(req, table);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const sp = req.nextUrl.searchParams;
    const select = sp.get('select') || '*';
    const selectCols = select === '*' ? '*' : select.split(',').map((c) => safeIdent(c.trim())).join(', ');

    const { clauses, values } = buildEqFilters(sp);
    let idx = values.length + 1;

    if (TENANT_TABLES.has(table) && access.isOrg && !access.isAdmin) {
      clauses.push('org_id');
      values.push(access.orgId);
    }
    if (table === 'organizations' && access.isOrg && !access.isAdmin) {
      clauses.push('id');
      values.push(access.orgId);
    }
    if (table === 'subscriptions' && access.isOrg && !access.isAdmin) {
      clauses.push('org_id');
      values.push(access.orgId);
    }

    const whereSql = clauses.length
      ? 'WHERE ' + clauses.map((col, i) => `${safeIdent(col)} = $${i + 1}`).join(' AND ')
      : '';

    let sql = `SELECT ${selectCols} FROM ${safeIdent(table)} ${whereSql}`;

    const order = sp.get('order');
    if (order) {
      const [col, dir] = order.split('.');
      sql += ` ORDER BY ${safeIdent(col)} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
    }
    const limit = sp.get('limit');
    if (limit && /^\d+$/.test(limit)) sql += ` LIMIT ${limit}`;

    const result = await pool.query(sql, values);
    const res = NextResponse.json(result.rows);

    if (req.headers.get('prefer')?.includes('count=exact')) {
      const countSql = `SELECT COUNT(*) FROM ${safeIdent(table)} ${whereSql}`;
      const c = await pool.query(countSql, values);
      res.headers.set('content-range', `0-0/${c.rows[0].count}`);
    }
    return res;
  } catch (err: any) {
    console.error(`rest/${table} GET error:`, err);
    return NextResponse.json({ error: err.message || 'Query failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { table: string } }) {
  const table = params.table;
  const access = checkAccess(req, table);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await req.json().catch(() => ({}));
    const data: Record<string, any> = { ...body };

    if (TENANT_TABLES.has(table) && access.isOrg && !access.isAdmin) {
      data.org_id = access.orgId; // force — ignore any client-supplied org_id
    }

    const cols = Object.keys(data);
    if (cols.length === 0) return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    cols.forEach(safeIdent);

    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO ${safeIdent(table)} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(sql, Object.values(data));
    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error(`rest/${table} POST error:`, err);
    return NextResponse.json({ error: err.message || 'Insert failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { table: string } }) {
  const table = params.table;
  const access = checkAccess(req, table);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await req.json().catch(() => ({}));
    const data: Record<string, any> = { ...body };
    delete data.org_id; // org_id must never change via client update

    const sp = req.nextUrl.searchParams;
    const { clauses, values: whereValues } = buildEqFilters(sp);

    if (TENANT_TABLES.has(table) && access.isOrg && !access.isAdmin) {
      clauses.push('org_id');
      whereValues.push(access.orgId);
    }
    if (clauses.length === 0) {
      return NextResponse.json({ error: 'Refusing update with no filter' }, { status: 400 });
    }

    const cols = Object.keys(data);
    cols.forEach(safeIdent);
    const setSql = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const whereSql = clauses.map((col, i) => `${safeIdent(col)} = $${cols.length + i + 1}`).join(' AND ');

    const sql = `UPDATE ${safeIdent(table)} SET ${setSql} WHERE ${whereSql} RETURNING *`;
    const result = await pool.query(sql, [...Object.values(data), ...whereValues]);
    return NextResponse.json(result.rows);
  } catch (err: any) {
    console.error(`rest/${table} PATCH error:`, err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { table: string } }) {
  const table = params.table;
  const access = checkAccess(req, table);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const sp = req.nextUrl.searchParams;
    const { clauses, values } = buildEqFilters(sp);

    if (TENANT_TABLES.has(table) && access.isOrg && !access.isAdmin) {
      clauses.push('org_id');
      values.push(access.orgId);
    }
    if (clauses.length === 0) {
      return NextResponse.json({ error: 'Refusing delete with no filter' }, { status: 400 });
    }

    const whereSql = clauses.map((col, i) => `${safeIdent(col)} = $${i + 1}`).join(' AND ');
    await pool.query(`DELETE FROM ${safeIdent(table)} WHERE ${whereSql}`, values);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`rest/${table} DELETE error:`, err);
    return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 });
  }
}
