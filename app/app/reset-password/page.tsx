'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAccessToken } from '@/lib/org-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle, KeyRound } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { refreshOrg, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/org-auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحديث كلمة المرور');

      await refreshOrg();
      router.push('/app/dashboard');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ ما');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card className="p-6">
          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">تعيين كلمة مرور جديدة</h1>
            <p className="text-sm text-muted-foreground mt-1">
              تم إعادة تعيين كلمة مرورك من قِبل الإدارة. برجاء اختيار كلمة مرور جديدة قبل المتابعة.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
              <Input
                id="newPassword"
                type="password"
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6 أحرف على الأقل"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <Input
                id="confirmPassword"
                type="password"
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد كتابة كلمة المرور"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'جارِ الحفظ...' : 'حفظ ومتابعة'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => signOut()}>
              تسجيل الخروج
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
