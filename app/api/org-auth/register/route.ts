import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, full_name, org_name, org_name_ar, slug, phone, address, country, plan_id } = body;

    if (!email || !password || !org_name || !slug) {
      return NextResponse.json({ error: 'Email, password, org name, and slug required' }, { status: 400 });
    }

    const lowerEmail = String(email).toLowerCase();

    const { rows: existingUser } = await client.query(`SELECT id FROM org_users WHERE email = $1`, [lowerEmail]);
    if (existingUser[0]) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }

    const { rows: existingSlug } = await client.query(`SELECT id FROM organizations WHERE slug = $1`, [slug]);
    if (existingSlug[0]) {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    await client.query('BEGIN');

    const { rows: userRows } = await client.query(
      `INSERT INTO org_users (email, password_hash, full_name, is_active)
       VALUES ($1, $2, $3, true) RETURNING id, email, full_name`,
      [lowerEmail, passwordHash, full_name || null]
    );
    const newUser = userRows[0];

    const { rows: orgRows } = await client.query(
      `INSERT INTO organizations (name, name_ar, slug, email, phone, address, country, plan_id, status, trial_ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'trialing',$9) RETURNING id`,
      [org_name, org_name_ar || null, slug, lowerEmail, phone || null, address || null, country || null, plan_id || null, trialEndsAt]
    );
    const org = orgRows[0];

    const { rows: memberRows } = await client.query(
      `INSERT INTO organization_members (org_id, user_id, email, role, is_active)
       VALUES ($1,$2,$3,'admin',true) RETURNING id, org_id, role, is_active`,
      [org.id, newUser.id, lowerEmail]
    );
    const member = memberRows[0];

    await client.query(
      `INSERT INTO company_settings (org_id, name_en, name_ar, currency) VALUES ($1,$2,$3,'USD')`,
      [org.id, org_name, org_name_ar || null]
    );

    if (plan_id) {
      await client.query(
        `INSERT INTO subscriptions (org_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
         VALUES ($1,$2,'active','monthly', now(), $3)`,
        [org.id, plan_id, trialEndsAt]
      );
    }

    await client.query('COMMIT');

    const token = signToken({
      type: 'org',
      sub: newUser.id,
      email: newUser.email,
      orgId: org.id,
      role: 'admin',
    });

    return NextResponse.json({
      session: { access_token: token },
      user: { id: newUser.id, email: newUser.email, full_name: newUser.full_name },
      member,
    });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('org-auth/register error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  } finally {
    client.release();
  }
}
