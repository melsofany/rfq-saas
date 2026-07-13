import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { verifyToken } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json().catch(() => ({}));
    if (!access_token) return NextResponse.json({ user: null, member: null });

    const decoded = verifyToken(access_token);
    if (!decoded || decoded.type !== 'org') {
      return NextResponse.json({ user: null, member: null });
    }

    // ── Single-session check: token must match DB ──
    const { rows: sessionRows } = await pool.query(
      `SELECT active_session_token FROM org_users WHERE id = $1 AND is_active = true`,
      [decoded.sub]
    );
    const dbUser = sessionRows[0];

    if (!dbUser) return NextResponse.json({ user: null, member: null });

    // If DB has a session_token but JWT doesn't match → another login replaced it
    if (dbUser.active_session_token && decoded.sessionToken !== dbUser.active_session_token) {
      return NextResponse.json({ user: null, member: null, reason: 'session_replaced' });
    }

    const { rows: userRows } = await pool.query(
      `SELECT id, email, full_name, is_active FROM org_users WHERE id = $1 AND is_active = true`,
      [decoded.sub]
    );
    const user = userRows[0];
    if (!user) return NextResponse.json({ user: null, member: null });

    const { rows: memberRows } = await pool.query(
      `SELECT id, org_id, role, is_active FROM organization_members WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [user.id]
    );

    return NextResponse.json({
      user: { id: user.id, email: user.email, full_name: user.full_name },
      member: memberRows[0] || null,
    });
  } catch (err: any) {
    console.error('org-auth/session error:', err);
    return NextResponse.json({ user: null, member: null });
  }
}
