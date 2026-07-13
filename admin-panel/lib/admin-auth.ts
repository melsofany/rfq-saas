'use client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TOKEN_KEY = 'admin_access_token';
const REFRESH_KEY = 'admin_refresh_token';
const USER_KEY = 'admin_user';
const ADMIN_KEY = 'admin_role';

export interface AdminUser {
  id: string;
  email: string;
}

export interface AdminRole {
  id: string;
  role: string;
}

function getStoredTokens() {
  if (typeof window === 'undefined') return null;
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  const userStr = localStorage.getItem(USER_KEY);
  const adminStr = localStorage.getItem(ADMIN_KEY);
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken,
    user: userStr ? JSON.parse(userStr) : null,
    admin: adminStr ? JSON.parse(adminStr) : null,
  };
}

function storeSession(accessToken: string, refreshToken: string, user: AdminUser, admin: AdminRole) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Login failed');
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  storeSession(data.session.access_token, data.session.refresh_token, data.user, data.admin);
  return data;
}

export async function adminGetSession(): Promise<{ user: AdminUser | null; admin: AdminRole | null }> {
  const stored = getStoredTokens();
  if (!stored) return { user: null, admin: null };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body: JSON.stringify({ access_token: stored.accessToken, refresh_token: stored.refreshToken }),
    });

    if (!res.ok) {
      clearSession();
      return { user: null, admin: null };
    }

    const data = await res.json();
    if (!data.user) {
      clearSession();
      return { user: null, admin: null };
    }

    return { user: data.user, admin: data.admin };
  } catch {
    return { user: stored.user, admin: stored.admin };
  }
}

export async function adminRefreshToken(): Promise<string | null> {
  const stored = getStoredTokens();
  if (!stored?.refreshToken) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body: JSON.stringify({ refresh_token: stored.refreshToken }),
    });

    if (!res.ok) {
      clearSession();
      return null;
    }

    const data = await res.json();
    if (data.error) {
      clearSession();
      return null;
    }

    localStorage.setItem(TOKEN_KEY, data.session.access_token);
    localStorage.setItem(REFRESH_KEY, data.session.refresh_token);
    return data.session.access_token;
  } catch {
    return null;
  }
}

export async function adminLogout() {
  const stored = getStoredTokens();
  if (stored?.accessToken) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/admin-auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify({ access_token: stored.accessToken }),
      });
    } catch {}
  }
  clearSession();
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

export function getStoredAdmin(): AdminRole | null {
  if (typeof window === 'undefined') return null;
  const adminStr = localStorage.getItem(ADMIN_KEY);
  return adminStr ? JSON.parse(adminStr) : null;
}
