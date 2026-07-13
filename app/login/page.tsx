'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { orgLogin } from '@/lib/org-auth';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle, FileText } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, refreshOrg } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/app/dashboard');
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await orgLogin(email, password);
      await refreshOrg(); // sync AuthContext with the new token
      router.push('/app/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-foreground">RFQ Manager</span>
        </Link>

        <Card className="p-6">
          <h1 className="text-xl font-bold text-foreground">Sign in to your account</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Welcome back. Please enter your details.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus />
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
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card>

        {/* Trial account banner */}
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
          <p className="text-xs font-semibold text-primary mb-1">Trial Account</p>
          <p className="text-xs text-muted-foreground">
            Email: <span className="font-mono font-medium text-foreground">trial@rfqmanager.com</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Password: <span className="font-mono font-medium text-foreground">Trial2026!</span>
          </p>
          <button
            type="button"
            onClick={() => { setEmail('trial@rfqmanager.com'); setPassword('Trial2026!'); }}
            className="mt-2 text-xs text-primary font-medium hover:underline"
          >
            Click to fill credentials
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          New to RFQ Manager?{' '}
          <Link href="/register" className="text-primary font-medium hover:underline">Create an account</Link>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2">
          <Link href="/admin/login" className="hover:text-foreground">SaaS Admin Login →</Link>
        </p>
      </div>
    </div>
  );
}
