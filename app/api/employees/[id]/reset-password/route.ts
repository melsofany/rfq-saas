import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthFromRequest, hashPassword } from '@/lib/server-auth';

// POST /api/employees/:id/reset-password
// Admin sets a temporary password for the employee. On next login, the
// employee is forced to /app/reset-password to choose their own password.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org' || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { temp_password } = await req.json().catch(() => ({}));
  if (!temp_password || String(temp_password).length < 6) {
    return NextResponse.json({ error: 'كلمة المرور المؤقتة يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
  }

  try {
    const { rows: member } = await pool.query(
      `SELECT user_id FROM organization_members WHERE id = $1 AND org_id = $2`,
      [params.id, auth.orgId]
    );
    if (!member[0]) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    }

    const passwordHash = await hashPassword(temp_password);
    await pool.query(
      `UPDATE org_users
       SET password_hash = $1, must_reset_password = true, active_session_token = NULL, updated_at = now()
       WHERE id = $2`,
      [passwordHash, member[0].user_id]
    );

    await pool.query(
      `INSERT INTO audit_log (org_id, action, entity_type, entity_id, description)
       VALUES ($1, 'update', 'member', $2, 'Reset employee password (forced reset on next login)')`,
      [auth.orgId, params.id]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('reset-password error:', err);
    return NextResponse.json({ error: err.message || 'فشل إعادة تعيين كلمة المرور' }, { status: 500 });
  }
}
