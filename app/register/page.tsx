'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { orgRegister } from '@/lib/org-auth';
import { useAuth } from '@/lib/auth-context';
import { dataQuery } from '@/lib/org-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle, FileText, ArrowLeft, Check } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { refreshOrg } = useAuth();
  const [step, setStep] = useState<'org' | 'user'>('org');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [orgName, setOrgName] = useState('');
  const [orgNameAr, setOrgNameAr] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgCountry, setOrgCountry] = useState('');
  const [planId, setPlanId] = useState('');

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await dataQuery('subscription_plans', {
          select: '*',
          eq: { is_active: true },
          order: { column: 'sort_order', ascending: true },
        });
        setPlans(data as any[]);
      } catch {}
    })();
  }, []);

  const handleOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!orgName || !orgEmail) {
      setError('Organization name and email are required');
      return;
    }
    setStep('user');
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userName || !userEmail || !userPassword) {
      setError('All fields are required');
      return;
    }
    if (userPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (userPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2, 6);

      await orgRegister({
        email: userEmail,
        password: userPassword,
        full_name: userName,
        org_name: orgName,
        org_name_ar: orgNameAr || undefined,
        slug,
        phone: orgPhone || undefined,
        address: undefined,
        country: orgCountry || undefined,
        plan_id: planId || undefined,
      });

      window.location.href = '/app/dashboard';
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-foreground">Qotix</span>
        </Link>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step === 'org' ? 'bg-primary text-primary-foreground' : 'bg-success text-success-foreground'}`}>
              {step === 'org' ? '1' : <Check className="w-3.5 h-3.5" />}
            </span>
            <div className="flex-1 h-px bg-border" />
            <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
          </div>

          {step === 'org' ? (
            <>
              <h1 className="text-xl font-bold text-foreground mt-4">Register your organization</h1>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Tell us about your company to get started</p>

              <form onSubmit={handleOrgSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="orgName">Company Name (English) *</Label>
                  <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Industries" required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="orgNameAr">Company Name (Arabic)</Label>
                  <Input id="orgNameAr" value={orgNameAr} onChange={(e) => setOrgNameAr(e.target.value)} placeholder="شركة أكم" dir="rtl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="orgEmail">Company Email *</Label>
                  <Input id="orgEmail" type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} placeholder="info@company.com" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="orgPhone">Phone</Label>
                    <Input id="orgPhone" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} placeholder="+1 555 0100" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="orgCountry">Country</Label>
                    <Input id="orgCountry" value={orgCountry} onChange={(e) => setOrgCountry(e.target.value)} placeholder="Saudi Arabia" />
                  </div>
                </div>

                {plans.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="plan">Select Plan</Label>
                    <select
                      id="plan"
                      value={planId}
                      onChange={(e) => setPlanId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Free Trial (14 days)</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} — ${p.price_monthly}/mo</option>
                      ))}
                    </select>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}

                <Button type="submit" className="w-full">Continue</Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-foreground mt-4">Create your admin account</h1>
              <p className="text-sm text-muted-foreground mt-1 mb-4">You'll be the admin for {orgName}</p>

              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="userName">Full Name *</Label>
                  <Input id="userName" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="John Doe" required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="userEmail">Email *</Label>
                  <Input id="userEmail" type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="you@company.com" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="userPassword">Password *</Label>
                  <Input id="userPassword" type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Min. 6 characters" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" required />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account & Start Trial'}
                </Button>
              </form>

              <button onClick={() => setStep('org')} className="mt-4 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
                <ArrowLeft className="w-3 h-3" /> Back to organization info
              </button>
            </>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
