'use client';

import { getAccessToken } from './org-auth';

async function getHeaders(): Promise<HeadersInit> {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export async function dataQuery<T = any>(
  table: string,
  options: {
    select?: string;
    eq?: Record<string, any>;
    order?: { column: string; ascending: boolean };
    limit?: number;
  } = {}
): Promise<T[]> {
  const params = new URLSearchParams({ table, select: options.select || '*' });
  if (options.eq) {
    const eqs = Object.entries(options.eq).map(([k, v]) => `${k}=${v}`).join(',');
    params.set('eq', eqs);
  }
  if (options.order) {
    params.set('order', options.order.column);
    params.set('dir', options.order.ascending ? 'asc' : 'desc');
  }
  if (options.limit) params.set('limit', String(options.limit));

  const headers = await getHeaders();
  const res = await fetch(`/api/data?${params.toString()}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Query ${table} failed: ${res.status} ${text}`);
  }
  return await res.json() as T[];
}

export async function dataInsert<T = any>(table: string, data: Record<string, any>): Promise<T> {
  const headers = await getHeaders();
  const res = await fetch('/api/data', {
    method: 'POST',
    headers,
    body: JSON.stringify({ table, data }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert ${table} failed: ${res.status} ${text}`);
  }
  return await res.json() as T;
}

export async function dataUpdate<T = any>(
  table: string,
  data: Record<string, any>,
  eq: Record<string, any>
): Promise<T[]> {
  const headers = await getHeaders();
  const res = await fetch('/api/data', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ table, data, eq }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update ${table} failed: ${res.status} ${text}`);
  }
  return await res.json() as T[];
}

export async function dataDelete(table: string, eq: Record<string, any>): Promise<void> {
  const params = new URLSearchParams({ table });
  const eqs = Object.entries(eq).map(([k, v]) => `${k}=${v}`).join(',');
  params.set('eq', eqs);

  const headers = await getHeaders();
  const res = await fetch(`/api/data?${params.toString()}`, { method: 'DELETE', headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete ${table} failed: ${res.status} ${text}`);
  }
}

export async function dataCount(table: string, eq?: Record<string, any>): Promise<number> {
  const params = new URLSearchParams({ table });
  if (eq) {
    const eqs = Object.entries(eq).map(([k, v]) => `${k}=${v}`).join(',');
    params.set('eq', eqs);
  }

  const headers = await getHeaders();
  const res = await fetch(`/api/count?${params.toString()}`, { headers });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count || 0;
}
