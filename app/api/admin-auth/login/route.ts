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
      `SELECT id, email, password_hash, role, is_active FROM saas_admins WHERE email = $1 AND is_active = true`,
      [String(email).toLowerCase()]
    );
    const admin = rows[0];
    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, admin.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ type: 'admin', sub: admin.id, email: admin.email, role: admin.role });

    return NextResponse.json({
      session: { access_token: token },
      user: { id: admin.id, email: admin.email },
      admin: { id: admin.id, role: admin.role },
    });
  } catch (err: any) {
    console.error('admin-auth/login error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
