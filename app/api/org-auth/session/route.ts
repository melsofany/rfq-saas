import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'rfq-saas-secret-key-2026';

export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json();

    if (!access_token) {
      return NextResponse.json({ user: null, member: null });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(access_token, JWT_SECRET);
    } catch {
      return NextResponse.json({ user: null, member: null });
    }

    if (!decoded || decoded.type !== 'org') {
      return NextResponse.json({ user: null, member: null });
    }

    const result = await query(
      `SELECT ou.id, ou.email, ou.full_name, om.id as member_id, om.org_id, om.role, om.is_active
       FROM org_users ou
       JOIN organization_members om ON om.user_id = ou.id
       WHERE ou.id = $1 AND ou.is_active = true AND om.is_active = true
       LIMIT 1`,
      [decoded.sub]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ user: null, member: null });
    }

    const row = result.rows[0];
    return NextResponse.json({
      user: { id: row.id, email: row.email, full_name: row.full_name },
      member: { id: row.member_id, org_id: row.org_id, role: row.role, is_active: row.is_active },
    });
  } catch {
    return NextResponse.json({ user: null, member: null });
  }
}
