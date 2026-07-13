'use client';

import {
  createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  orgGetSession, orgLogout, clearSession, OrgUser, OrgMember,
} from '@/lib/org-auth';
import { initTabGuard, ConflictReason } from '@/lib/tab-guard';
import { SessionConflictScreen } from '@/components/session-conflict-screen';

const SESSION_POLL_MS = 30_000; // validate server session every 30 s

export type SessionConflict = 'another_tab' | 'takeover' | 'session_replaced' | null;

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
  const router = useRouter();
  const [user, setUser] = useState<OrgUser | null>(null);
  const [orgMember, setOrgMember] = useState<OrgMember | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionConflict, setSessionConflict] = useState<SessionConflict>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load initial session ──────────────────────────────────────────────────
  const loadSession = useCallback(async () => {
    try {
      const session = await orgGetSession();
      if (session.reason === 'session_replaced') {
        setUser(null);
        setOrgMember(null);
        setSessionConflict('session_replaced');
        return;
      }
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

  useEffect(() => { loadSession(); }, [loadSession]);

  // ── Server-session polling (detects login from another browser/device) ───
  useEffect(() => {
    if (!user) {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
      return;
    }
    pollTimer.current = setInterval(async () => {
      const session = await orgGetSession();
      if (session.reason === 'session_replaced') {
        clearSession();
        setUser(null);
        setOrgMember(null);
        setSessionConflict('session_replaced');
      } else if (!session.user) {
        setUser(null);
        setOrgMember(null);
      }
    }, SESSION_POLL_MS);

    return () => {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    };
  }, [user]);

  // ── Tab guard (detects multiple open tabs) ───────────────────────────────
  useEffect(() => {
    const cleanup = initTabGuard({
      onConflict: (reason: ConflictReason) => {
        setSessionConflict(reason);
      },
      onClear: () => {
        // The blocking tab closed — we can take over automatically
        setSessionConflict(null);
      },
    });
    return cleanup;
  }, []);

  // ── Admin token check ────────────────────────────────────────────────────
  useEffect(() => {
    const checkAdmin = async () => {
      if (typeof window === 'undefined') return;
      const adminToken = localStorage.getItem('admin_access_token');
      if (!adminToken) { setIsAdmin(false); return; }
      try {
        const res = await fetch('/api/admin-auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: adminToken }),
        });
        const data = await res.json();
        setIsAdmin(!!data.admin);
      } catch { setIsAdmin(false); }
    };
    checkAdmin();
  }, []);

  // ── Sign out ─────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    const adminToken = localStorage.getItem('admin_access_token');
    if (adminToken) {
      try {
        await fetch('/api/admin-auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: adminToken }),
        });
      } catch {}
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_role');
    }
    try { await orgLogout(); } catch {}
    setUser(null);
    setOrgMember(null);
    setIsAdmin(false);
  }, []);

  const refreshOrg = useCallback(async () => { await loadSession(); }, [loadSession]);

  // ── Session conflict overlay ─────────────────────────────────────────────
  if (sessionConflict) {
    return (
      <SessionConflictScreen
        reason={sessionConflict}
        onUseThisTab={() => setSessionConflict(null)}
        onSignIn={() => {
          clearSession();
          setSessionConflict(null);
          router.push('/login');
        }}
      />
    );
  }

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
