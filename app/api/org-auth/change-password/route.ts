import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAuthFromRequest, hashPassword } from '@/lib/server-auth';

// POST /api/org-auth/change-password — sets a new password for the logged-in user
// and clears must_reset_password. Used by the forced-reset screen.
export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.type !== 'org') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { new_password } = await req.json().catch(() => ({}));
  if (!new_password || String(new_password).length < 6) {
    return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(new_password);
    await pool.query(
      `UPDATE org_users SET password_hash = $1, must_reset_password = false, updated_at = now() WHERE id = $2`,
      [passwordHash, auth.sub]
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('change-password error:', err);
    return NextResponse.json({ error: 'فشل تحديث كلمة المرور' }, { status: 500 });
  }
}
