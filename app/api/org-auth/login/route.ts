import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'rfq-saas-secret-key-2026';
const SESSION_DURATION = '7d';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const result = await query(
      `SELECT om.id, om.org_id, om.role, om.is_active, om.user_id,
              ou.email, ou.password_hash, ou.full_name
       FROM org_users ou
       JOIN organization_members om ON om.user_id = ou.id
       WHERE ou.email = $1 AND ou.is_active = true AND om.is_active = true
       LIMIT 1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = jwt.sign(
      { sub: user.user_id, orgId: user.org_id, email: user.email, role: user.role, type: 'org' },
      JWT_SECRET,
      { expiresIn: SESSION_DURATION }
    );

    return NextResponse.json({
      session: { access_token: token },
      user: { id: user.user_id, email: user.email, full_name: user.full_name },
      member: { id: user.id, org_id: user.org_id, role: user.role, is_active: user.is_active },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}
