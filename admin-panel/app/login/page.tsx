'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';
import { adminLogin } from '@/lib/admin-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await adminLogin(email, password);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sidebar-accent shadow-lg">
            <Shield className="h-8 w-8 text-sidebar-accent-foreground" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-sidebar-foreground">Admin Control Panel</h1>
            <p className="text-sm text-sidebar-foreground/60">
              Sign in to manage your SaaS platform
            </p>
          </div>
        </div>

        <Card className="border-sidebar-border/50 bg-sidebar-foreground/5 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-sidebar-foreground">Sign In</CardTitle>
            <CardDescription className="text-sidebar-foreground/60">
              Enter your admin credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sidebar-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-sidebar-foreground/5 border-sidebar-border/50 text-sidebar-foreground placeholder:text-sidebar-foreground/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sidebar-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-sidebar-foreground/5 border-sidebar-border/50 text-sidebar-foreground placeholder:text-sidebar-foreground/40"
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/15 px-4 py-3 text-sm text-destructive border border-destructive/30">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to main site
          </a>
        </div>

        {/* Trial admin account banner */}
        <div className="rounded-lg border border-sidebar-accent/30 bg-sidebar-accent/10 p-3 text-center">
          <p className="text-xs font-semibold text-sidebar-accent mb-1">Trial Admin Account</p>
          <p className="text-xs text-sidebar-foreground/60">
            Email: <span className="font-mono font-medium text-sidebar-foreground">admin@rfqmanager.com</span>
          </p>
          <p className="text-xs text-sidebar-foreground/60">
            Password: <span className="font-mono font-medium text-sidebar-foreground">Admin2026!</span>
          </p>
          <button
            type="button"
            onClick={() => { setEmail('admin@rfqmanager.com'); setPassword('Admin2026!'); }}
            className="mt-2 text-xs text-sidebar-accent font-medium hover:underline"
          >
            Click to fill credentials
          </button>
        </div>
      </div>
    </div>
  );
}
