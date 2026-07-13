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
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const session = await orgGetSession();
      if (session) {
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

  const signOut = useCallback(async () => {
    try {
      await orgLogout();
    } catch {
      // ignore
    }
    setUser(null);
    setOrgMember(null);
  }, []);

  const refreshOrg = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  const value: AuthContextType = {
    user,
    orgId: orgMember?.org_id ?? null,
    orgRole: orgMember?.role ?? null,
    orgMember,
    isSaasAdmin: false,
    isLoading,
    signOut,
    refreshOrg,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
