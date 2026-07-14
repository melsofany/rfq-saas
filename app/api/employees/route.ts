import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthFromRequest, hashPassword } from '@/lib/server-auth';

// POST /api/employees — admin-only: create a new org user + membership
// body: { full_name, email, phone, password, role }
export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org' || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { full_name, email, phone, password, role } = body;

  if (!full_name || !email || !phone || !password) {
    return NextResponse.json(
      { error: 'الاسم ورقم الهاتف والبريد الإلكتروني وكلمة المرور كلها مطلوبة' },
      { status: 400 }
    );
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
  }

  const lowerEmail = String(email).toLowerCase().trim();
  const orgId = auth.orgId;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(`SELECT id FROM org_users WHERE email = $1`, [lowerEmail]);

    let userId: string;
    if (existing[0]) {
      userId = existing[0].id;
      const { rows: alreadyMember } = await client.query(
        `SELECT id FROM organization_members WHERE org_id = $1 AND user_id = $2`,
        [orgId, userId]
      );
      if (alreadyMember[0]) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'هذا البريد الإلكتروني مسجل بالفعل في الشركة' }, { status: 409 });
      }
    } else {
      const passwordHash = await hashPassword(password);
      const { rows: userRows } = await client.query(
        `INSERT INTO org_users (email, password_hash, full_name, is_active)
         VALUES ($1, $2, $3, true) RETURNING id`,
        [lowerEmail, passwordHash, full_name]
      );
      userId = userRows[0].id;
    }

    const { rows: memberRows } = await client.query(
      `INSERT INTO organization_members (org_id, user_id, role, is_active, full_name, email, phone)
       VALUES ($1, $2, $3, true, $4, $5, $6)
       RETURNING id, org_id, user_id, role, is_active, full_name, email, phone, created_at`,
      [orgId, userId, role || 'member', full_name, lowerEmail, phone]
    );

    await client.query(
      `INSERT INTO audit_log (org_id, action, entity_type, entity_id, description)
       VALUES ($1, 'create', 'member', $2, $3)`,
      [orgId, memberRows[0].id, `Added employee ${full_name} (${lowerEmail})`]
    );

    await client.query('COMMIT');
    return NextResponse.json(memberRows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('employees POST error:', err);
    return NextResponse.json({ error: err.message || 'فشل إضافة الموظف' }, { status: 500 });
  } finally {
    client.release();
  }
}
