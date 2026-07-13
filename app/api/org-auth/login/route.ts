import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { signToken, verifyPassword } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json().catch(() => ({}));
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `SELECT id, email, password_hash, full_name, is_active FROM org_users WHERE email = $1 AND is_active = true`,
      [String(email).toLowerCase()]
    );
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const { rows: memberRows } = await pool.query(
      `SELECT id, org_id, role, is_active FROM organization_members WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [user.id]
    );
    const member = memberRows[0];
    if (!member) {
      return NextResponse.json({ error: 'No active organization membership' }, { status: 403 });
    }

    const token = signToken({
      type: 'org',
      sub: user.id,
      email: user.email,
      orgId: member.org_id,
      role: member.role,
    });

    return NextResponse.json({
      session: { access_token: token },
      user: { id: user.id, email: user.email, full_name: user.full_name },
      member: { id: member.id, org_id: member.org_id, role: member.role, is_active: member.is_active },
    });
  } catch (err: any) {
    console.error('org-auth/login error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
