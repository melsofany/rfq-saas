import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'rfq-saas-secret-key-2026';
const SESSION_DURATION = '7d';

export async function POST(req: NextRequest) {
  try {
    const {
      email, password, full_name,
      org_name, org_name_ar, slug,
      phone, address, country, plan_id,
    } = await req.json();

    if (!email || !password || !org_name || !slug) {
      return NextResponse.json({ error: 'Email, password, organization name, and slug are required' }, { status: 400 });
    }

    const existing = await query('SELECT id FROM org_users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const existingSlug = await query('SELECT id FROM organizations WHERE slug = $1', [slug]);
    if (existingSlug.rows.length > 0) {
      return NextResponse.json({ error: 'This organization slug is already taken' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await query(
      `INSERT INTO org_users (email, password_hash, full_name, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, email, full_name`,
      [email.toLowerCase(), passwordHash, full_name || null]
    );
    const newUser = userResult.rows[0];

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const orgResult = await query(
      `INSERT INTO organizations (name, name_ar, slug, email, phone, address, country, plan_id, status, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'trialing', $9)
       RETURNING id`,
      [org_name, org_name_ar || null, slug, email.toLowerCase(), phone || null, address || null, country || null, plan_id || null, trialEndsAt]
    );
    const orgId = orgResult.rows[0].id;

    await query(
      `INSERT INTO organization_members (org_id, user_id, role, is_active)
       VALUES ($1, $2, 'admin', true)
       RETURNING id`,
      [orgId, newUser.id]
    );

    await query(
      `INSERT INTO company_settings (org_id, name_en, name_ar, address, phone, email, currency)
       VALUES ($1, $2, $3, $4, $5, $6, 'USD')`,
      [orgId, org_name, org_name_ar || null, address || null, phone || null, email.toLowerCase()]
    );

    if (plan_id) {
      await query(
        `INSERT INTO subscriptions (org_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
         VALUES ($1, $2, 'active', 'monthly', NOW(), $3)`,
        [orgId, plan_id, trialEndsAt]
      );
    }

    const memberResult = await query(
      `SELECT id, org_id, role, is_active FROM organization_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, newUser.id]
    );
    const member = memberResult.rows[0];

    const token = jwt.sign(
      { sub: newUser.id, orgId: orgId, email: newUser.email, role: 'admin', type: 'org' },
      JWT_SECRET,
      { expiresIn: SESSION_DURATION }
    );

    return NextResponse.json({
      session: { access_token: token },
      user: { id: newUser.id, email: newUser.email, full_name: newUser.full_name },
      member: { id: member.id, org_id: member.org_id, role: member.role, is_active: member.is_active },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status: 500 });
  }
}
