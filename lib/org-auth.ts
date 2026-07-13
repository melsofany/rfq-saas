'use client';

const TOKEN_KEY = 'org_access_token';
const USER_KEY = 'org_user';
const MEMBER_KEY = 'org_member';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export interface OrgUser {
  id: string;
  email: string;
  full_name?: string;
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
  const userStr = localStorage.getItem(USER_KEY);
  const memberStr = localStorage.getItem(MEMBER_KEY);
  if (!accessToken) return null;
  return {
    accessToken,
    user: userStr ? JSON.parse(userStr) : null,
    member: memberStr ? JSON.parse(memberStr) : null,
  };
}

function storeSession(accessToken: string, user: OrgUser, member: OrgMember) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(MEMBER_KEY, JSON.stringify(member));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(MEMBER_KEY);
}

function edgeUrl(action: string) {
  return `${SUPABASE_URL}/functions/v1/org-auth/${action}`;
}

function edgeHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
  };
}

export async function orgLogin(email: string, password: string) {
  const res = await fetch(edgeUrl('login'), {
    method: 'POST',
    headers: edgeHeaders(),
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Login failed');

  storeSession(data.session.access_token, data.user, data.member);
  return data;
}

export async function orgRegister(data: {
  email: string;
  password: string;
  full_name?: string;
  org_name: string;
  org_name_ar?: string;
  slug: string;
  phone?: string;
  address?: string;
  country?: string;
  plan_id?: string;
}) {
  const res = await fetch(edgeUrl('register'), {
    method: 'POST',
    headers: edgeHeaders(),
    body: JSON.stringify(data),
  });

  const result = await res.json();
  if (!res.ok || result.error) throw new Error(result.error || 'Registration failed');

  if (result.session) {
    storeSession(result.session.access_token, result.user, result.member);
  }
  return result;
}

export async function orgGetSession(): Promise<{ user: OrgUser | null; member: OrgMember | null }> {
  const stored = getStoredTokens();
  if (!stored) return { user: null, member: null };

  try {
    const res = await fetch(edgeUrl('session'), {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({ access_token: stored.accessToken }),
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

    storeSession(stored.accessToken, data.user, data.member);
    return { user: data.user, member: data.member };
  } catch {
    clearSession();
    return { user: null, member: null };
  }
}

export async function orgLogout() {
  try {
    await fetch(edgeUrl('logout'), {
      method: 'POST',
      headers: edgeHeaders(),
    });
  } catch {}
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
