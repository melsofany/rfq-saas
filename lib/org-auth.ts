'use client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TOKEN_KEY = 'org_access_token';
const REFRESH_KEY = 'org_refresh_token';
const USER_KEY = 'org_user';
const MEMBER_KEY = 'org_member';

export interface OrgUser {
  id: string;
  email: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  role: string;
  is_active: boolean;
}

function getStoredTokens() {
  if (typeof window === 'undefined') return null;
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  const userStr = localStorage.getItem(USER_KEY);
  const memberStr = localStorage.getItem(MEMBER_KEY);
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken,
    user: userStr ? JSON.parse(userStr) : null,
    member: memberStr ? JSON.parse(memberStr) : null,
  };
}

function storeSession(accessToken: string, refreshToken: string, user: OrgUser, member: OrgMember) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(MEMBER_KEY, JSON.stringify(member));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(MEMBER_KEY);
}

export async function orgLogin(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/org-auth/login`, {
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

  storeSession(data.session.access_token, data.session.refresh_token, data.user, data.member);
  return data;
}

export async function orgRegister(data: {
  email: string;
  password: string;
  org_name: string;
  org_name_ar?: string;
  slug: string;
  phone?: string;
  address?: string;
  country?: string;
  plan_id?: string;
}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/org-auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.error || 'Registration failed');
  }

  const result = await res.json();
  if (result.error) throw new Error(result.error);

  if (result.session) {
    storeSession(result.session.access_token, result.session.refresh_token, result.user, result.member);
  }
  return result;
}

export async function orgGetSession(): Promise<{ user: OrgUser | null; member: OrgMember | null }> {
  const stored = getStoredTokens();
  if (!stored) return { user: null, member: null };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/org-auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body: JSON.stringify({ access_token: stored.accessToken, refresh_token: stored.refreshToken }),
    });

    if (!res.ok) {
      clearSession();
      return { user: null, member: null };
    }

    const data = await res.json();
    if (!data.user) {
      clearSession();
      return { user: null, member: null };
    }

    return { user: data.user, member: data.member };
  } catch {
    return { user: stored.user, member: stored.member };
  }
}

export async function orgRefreshToken(): Promise<string | null> {
  const stored = getStoredTokens();
  if (!stored?.refreshToken) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/org-auth/refresh`, {
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

export async function orgLogout() {
  const stored = getStoredTokens();
  if (stored?.accessToken) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/org-auth/logout`, {
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

export function getStoredUser(): OrgUser | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

export function getStoredMember(): OrgMember | null {
  if (typeof window === 'undefined') return null;
  const memberStr = localStorage.getItem(MEMBER_KEY);
  return memberStr ? JSON.parse(memberStr) : null;
}
