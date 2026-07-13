'use client';

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_access_token');
}

function restUrl(table: string) {
  return `/api/rest/${table}`;
}

function restHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
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
  const params = new URLSearchParams();
  params.set('select', options.select || '*');
  if (options.eq) {
    for (const [k, v] of Object.entries(options.eq)) {
      params.set(k, `eq.${v}`);
    }
  }
  if (options.order) {
    params.set('order', `${options.order.column}.${options.order.ascending ? 'asc' : 'desc'}`);
  }
  if (options.limit) params.set('limit', String(options.limit));

  const token = getAdminToken();
  const res = await fetch(`${restUrl(table)}?${params.toString()}`, { headers: restHeaders(token) });
  if (!res.ok) throw new Error(`Query ${table} failed: ${res.status}`);
  return await res.json() as T[];
}

export async function adminInsert<T = any>(table: string, data: Record<string, any>): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(restUrl(table), {
    method: 'POST',
    headers: { ...restHeaders(token), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Insert ${table} failed: ${res.status}`);
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

export async function adminUpdate<T = any>(
  table: string,
  data: Record<string, any>,
  eq: Record<string, any>
): Promise<T[]> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(eq)) {
    params.set(k, `eq.${v}`);
  }
  const token = getAdminToken();
  const res = await fetch(`${restUrl(table)}?${params.toString()}`, {
    method: 'PATCH',
    headers: { ...restHeaders(token), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Update ${table} failed: ${res.status}`);
  return await res.json() as T[];
}

export async function adminDelete(table: string, eq: Record<string, any>): Promise<void> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(eq)) {
    params.set(k, `eq.${v}`);
  }
  const token = getAdminToken();
  const res = await fetch(`${restUrl(table)}?${params.toString()}`, {
    method: 'DELETE',
    headers: restHeaders(token),
  });
  if (!res.ok) throw new Error(`Delete ${table} failed: ${res.status}`);
}

export async function adminCount(table: string, eq?: Record<string, any>): Promise<number> {
  const params = new URLSearchParams();
  params.set('select', '*');
  if (eq) {
    for (const [k, v] of Object.entries(eq)) {
      params.set(k, `eq.${v}`);
    }
  }
  const token = getAdminToken();
  const res = await fetch(`${restUrl(table)}?${params.toString()}`, {
    headers: { ...restHeaders(token), 'Prefer': 'count=exact' },
  });
  if (!res.ok) return 0;
  const count = res.headers.get('content-range');
  if (count) {
    const parts = count.split('/');
    if (parts.length > 1 && parts[1] !== '*') {
      return parseInt(parts[1], 10);
    }
  }
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}
