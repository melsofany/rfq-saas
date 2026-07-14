import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/server-auth';

// PATCH /api/employees/:id — admin-only: update name/phone/email/role of a membership
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org' || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { full_name, email, phone, role } = body;

  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(
      `SELECT id, user_id FROM organization_members WHERE id = $1 AND org_id = $2`,
      [params.id, auth.orgId]
    );
    if (!existing[0]) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    }

    await client.query('BEGIN');

    const { rows: updated } = await client.query(
      `UPDATE organization_members
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           role = COALESCE($4, role),
           updated_at = now()
       WHERE id = $5 AND org_id = $6
       RETURNING id, org_id, user_id, role, is_active, full_name, email, phone, created_at`,
      [full_name || null, email ? String(email).toLowerCase() : null, phone || null, role || null, params.id, auth.orgId]
    );

    // Keep org_users in sync so login/display stays consistent
    if (full_name || email) {
      const sets: string[] = [];
      const vals: any[] = [];
      let i = 1;
      if (full_name) { sets.push(`full_name = $${i++}`); vals.push(full_name); }
      if (email) { sets.push(`email = $${i++}`); vals.push(String(email).toLowerCase()); }
      vals.push(existing[0].user_id);
      await client.query(`UPDATE org_users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i}`, vals);
    }

    await client.query(
      `INSERT INTO audit_log (org_id, action, entity_type, entity_id, description)
       VALUES ($1, 'update', 'member', $2, 'Updated employee details')`,
      [auth.orgId, params.id]
    );

    await client.query('COMMIT');
    return NextResponse.json(updated[0]);
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('employees PATCH error:', err);
    return NextResponse.json({ error: err.message || 'فشل تحديث بيانات الموظف' }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/employees/:id — admin-only: remove an employee from the organization
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org' || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(
      `SELECT id, user_id, role, full_name, email FROM organization_members WHERE id = $1 AND org_id = $2`,
      [params.id, auth.orgId]
    );
    if (!existing[0]) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    }

    if (existing[0].user_id === auth.sub) {
      return NextResponse.json({ error: 'لا يمكنك حذف حسابك الخاص' }, { status: 400 });
    }

    if (existing[0].role === 'admin') {
      const { rows: adminCount } = await client.query(
        `SELECT COUNT(*)::int AS count FROM organization_members WHERE org_id = $1 AND role = 'admin' AND is_active = true`,
        [auth.orgId]
      );
      if (adminCount[0].count <= 1) {
        return NextResponse.json({ error: 'لا يمكن حذف آخر مسؤول (admin) في الشركة' }, { status: 400 });
      }
    }

    await client.query('BEGIN');
    await client.query(`DELETE FROM organization_members WHERE id = $1 AND org_id = $2`, [params.id, auth.orgId]);
    await client.query(
      `INSERT INTO audit_log (org_id, action, entity_type, entity_id, description)
       VALUES ($1, 'delete', 'member', $2, $3)`,
      [auth.orgId, params.id, `Removed employee ${existing[0].full_name || existing[0].email || ''}`]
    );
    await client.query('COMMIT');

    return NextResponse.json({ success: true });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('employees DELETE error:', err);
    return NextResponse.json({ error: err.message || 'فشل حذف الموظف' }, { status: 500 });
  } finally {
    client.release();
  }
}
