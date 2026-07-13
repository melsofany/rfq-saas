import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Add it in Render → your web service → Environment.'
    );
  }
  return new Pool({
    connectionString,
    ssl: connectionString.includes('render.com')
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10,
  });
}

// Reuse the pool across hot-reloads / lambda invocations
export const pool = global.__pgPool || createPool();
if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool;
}
