'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle, Shield } from 'lucide-react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_access_token');
    if (token) {
      router.push('/admin/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid credentials');
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      localStorage.setItem('admin_access_token', data.session.access_token);
      localStorage.setItem('admin_refresh_token', data.session.refresh_token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      localStorage.setItem('admin_role', JSON.stringify(data.admin));
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-sidebar-foreground">SaaS Admin Panel</span>
        </div>

        <Card className="p-6">
          <h1 className="text-xl font-bold text-foreground">Admin Sign In</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Access the platform administration panel</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Admin Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@rfqmanager.com" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In to Admin Panel'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-sidebar-foreground/50 mt-4">
          <Link href="/" className="hover:text-sidebar-foreground">← Back to site</Link>
        </p>

        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-center">
          <p className="text-xs font-semibold text-primary mb-1">Trial Admin Account</p>
          <p className="text-xs text-sidebar-foreground/60">
            Email: <span className="font-mono font-medium text-sidebar-foreground">admin@rfqmanager.com</span>
          </p>
          <p className="text-xs text-sidebar-foreground/60">
            Password: <span className="font-mono font-medium text-sidebar-foreground">Admin2026!</span>
          </p>
          <button
            type="button"
            onClick={() => { setEmail('admin@rfqmanager.com'); setPassword('Admin2026!'); }}
            className="mt-2 text-xs text-primary font-medium hover:underline"
          >
            Click to fill credentials
          </button>
        </div>
      </div>
    </div>
  );
}
