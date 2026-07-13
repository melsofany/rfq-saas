'use client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

import { getAccessToken, adminRefreshToken } from './admin-auth';

async function getHeaders(): Promise<HeadersInit> {
  let token = getAccessToken();
  if (!token) {
    token = await adminRefreshToken();
  }
  return {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token}`,
  };
}

export async function adminQuery<T = any>(
  table: string,
  options: {
    select?: string;
    eq?: Record<string, any>;
    order?: { column: string; ascending: boolean };
    limit?: number;
  } = {}
): Promise<T[]> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${options.select || '*'}`;
  if (options.eq) {
    for (const [key, value] of Object.entries(options.eq)) {
      url += `&${key}=eq.${encodeURIComponent(String(value))}`;
    }
  }
  if (options.order) {
    url += `&order=${options.order.column}.${options.order.ascending ? 'asc' : 'desc'}`;
  }
  if (options.limit) url += `&limit=${options.limit}`;

  const headers = await getHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Query ${table} failed: ${res.status}`);
  return await res.json() as T[];
}

export async function adminInsert<T = any>(table: string, data: Record<string, any>): Promise<T> {
  const headers = await getHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Insert ${table} failed: ${res.status}`);
  const result = await res.json();
  return result[0] as T;
}

export async function adminUpdate<T = any>(
  table: string,
  data: Record<string, any>,
  eq: Record<string, any>
): Promise<T[]> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  for (const [key, value] of Object.entries(eq)) {
    url += `${key}=eq.${encodeURIComponent(String(value))}&`;
  }
  const headers = await getHeaders();
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Update ${table} failed: ${res.status}`);
  return await res.json() as T[];
}

export async function adminDelete(table: string, eq: Record<string, any>): Promise<void> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  for (const [key, value] of Object.entries(eq)) {
    url += `${key}=eq.${encodeURIComponent(String(value))}&`;
  }
  const headers = await getHeaders();
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok) throw new Error(`Delete ${table} failed: ${res.status}`);
}

export async function adminCount(table: string, eq?: Record<string, any>): Promise<number> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=id`;
  if (eq) {
    for (const [key, value] of Object.entries(eq)) {
      url += `&${key}=eq.${encodeURIComponent(String(value))}`;
    }
  }
  const headers = await getHeaders();
  const res = await fetch(url, {
    method: 'HEAD',
    headers: { ...headers, 'Prefer': 'count=exact' },
  });
  if (!res.ok) return 0;
  const count = res.headers.get('content-range');
  if (count) {
    const parts = count.split('/');
    if (parts.length > 1) return parseInt(parts[1], 10);
  }
  return 0;
}
