import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { verifyToken } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json().catch(() => ({}));
    if (!access_token) return NextResponse.json({ user: null, admin: null });

    const decoded = verifyToken(access_token);
    if (!decoded || decoded.type !== 'admin') {
      return NextResponse.json({ user: null, admin: null });
    }

    const { rows } = await pool.query(
      `SELECT id, email, role, is_active FROM saas_admins WHERE id = $1 AND is_active = true`,
      [decoded.sub]
    );
    const admin = rows[0];
    if (!admin) return NextResponse.json({ user: null, admin: null });

    return NextResponse.json({
      user: { id: admin.id, email: admin.email },
      admin: { id: admin.id, role: admin.role },
    });
  } catch (err: any) {
    console.error('admin-auth/session error:', err);
    return NextResponse.json({ user: null, admin: null });
  }
}
