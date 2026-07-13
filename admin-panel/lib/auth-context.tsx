'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  adminGetSession,
  adminLogout,
  type AdminUser,
  type AdminRole,
} from './admin-auth';

interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
}

interface AuthContextValue {
  user: AdminUser | null;
  orgId: string | null;
  orgRole: string | null;
  orgMember: OrgMember | null;
  isSaasAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshOrg: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
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
  const [user, setUser] = useState<AdminUser | null>(null);
  const [admin, setAdmin] = useState<AdminRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const session = await adminGetSession();
      if (!mounted) return;

      setUser(session.user);
      setAdmin(session.admin);
      setIsLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    await adminLogout();
    setUser(null);
    setAdmin(null);
  }, []);

  const refreshOrg = useCallback(async () => {
    // Admin panel doesn't need org context — no-op for compatibility
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        orgId: null,
        orgRole: null,
        orgMember: null,
        isSaasAdmin: !!admin,
        isLoading,
        signOut,
        refreshOrg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
