'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  orgGetSession,
  orgLogout,
  OrgUser,
  OrgMember,
} from '@/lib/org-auth';

interface AuthContextType {
  user: OrgUser | null;
  orgId: string | null;
  orgRole: string | null;
  orgMember: OrgMember | null;
  isSaasAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshOrg: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  orgId: null,
  orgRole: null,
  orgMember: null,
  isSaasAdmin: false,
  isLoading: true,
  signOut: async () => {},
  refreshOrg: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<OrgUser | null>(null);
  const [orgMember, setOrgMember] = useState<OrgMember | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const session = await orgGetSession();
      if (session.user) {
        setUser(session.user);
        setOrgMember(session.member);
      } else {
        setUser(null);
        setOrgMember(null);
      }
    } catch {
      setUser(null);
      setOrgMember(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (typeof window === 'undefined') return;
      const adminToken = localStorage.getItem('admin_access_token');
      if (!adminToken) {
        setIsAdmin(false);
        return;
      }
      try {
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-auth/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ access_token: adminToken }),
        });
        const data = await res.json();
        setIsAdmin(!!data.admin);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  const signOut = useCallback(async () => {
    const adminToken = localStorage.getItem('admin_access_token');
    if (adminToken) {
      try {
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        await fetch(`${SUPABASE_URL}/functions/v1/admin-auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ access_token: adminToken }),
        });
      } catch {}
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_role');
    }
    try {
      await orgLogout();
    } catch {}
    setUser(null);
    setOrgMember(null);
    setIsAdmin(false);
  }, []);

  const refreshOrg = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  const value: AuthContextType = {
    user,
    orgId: orgMember?.org_id ?? null,
    orgRole: orgMember?.role ?? null,
    orgMember,
    isSaasAdmin: isAdmin,
    isLoading,
    signOut,
    refreshOrg,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
