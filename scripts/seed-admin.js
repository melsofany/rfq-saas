/**
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/seed-admin.js admin@example.com "StrongPassword123!"
 *
 * Creates (or updates the password of) a SaaS admin account so you can
 * log in to /admin for the first time.
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error('Usage: node scripts/seed-admin.js <email> <password>');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL env var first.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  });

  const hash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO saas_admins (email, password_hash, role, is_active)
     VALUES ($1, $2, 'admin', true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, email`,
    [email.toLowerCase(), hash]
  );

  console.log('Admin ready:', rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
