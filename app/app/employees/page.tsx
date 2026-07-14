'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataInsert, dataUpdate } from '@/lib/org-data';
import { getAccessToken } from '@/lib/org-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Users, AlertCircle, ShieldAlert, Mail, User, Phone, Lock, Pencil, Trash2, KeyRound } from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export default function EmployeesPage() {
  const { orgId, orgRole, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Edit member ──
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // ── Delete member ──
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Reset password ──
  const [resetPwMember, setResetPwMember] = useState<Member | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [resetPwError, setResetPwError] = useState('');
  const [resetPwDone, setResetPwDone] = useState(false);

  const isAdmin = orgRole === 'admin';

  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await dataQuery<Member>('organization_members', {
        select: 'id, user_id, role, is_active, created_at, full_name, email, phone',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
      });

      setMembers(data ?? []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/app/dashboard');
      return;
    }
    if (orgId && isAdmin) {
      fetchMembers();
    }
  }, [orgId, isAdmin, authLoading, router, fetchMembers]);

  const handleAddMember = async () => {
    if (!orgId) return;
    setError('');

    if (!newFullName.trim() || !newEmail.trim() || !newPhone.trim() || !newPassword.trim()) {
      setError('الاسم ورقم الهاتف والبريد الإلكتروني وكلمة المرور كلها مطلوبة');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          full_name: newFullName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة الموظف');

      setAddDialogOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setNewRole('member');
      fetchMembers();
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    if (!orgId) return;
    setUpdatingId(memberId);
    try {
      await dataUpdate('organization_members', { role }, { id: memberId, org_id: orgId });

      // Log to audit
      await dataInsert('audit_log', {
        org_id: orgId,
        action: 'update',
        entity_type: 'member',
        entity_id: memberId,
        description: `Changed member role to ${role}`,
      });

      fetchMembers();
    } catch (error) {
      console.error('Error updating role:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (member: Member) => {
    if (!orgId) return;
    setUpdatingId(member.id);
    try {
      await dataUpdate('organization_members', { is_active: !member.is_active }, { id: member.id, org_id: orgId });

      // Log to audit
      await dataInsert('audit_log', {
        org_id: orgId,
        action: 'update',
        entity_type: 'member',
        entity_id: member.id,
        description: `${member.is_active ? 'Deactivated' : 'Activated'} member`,
      });

      fetchMembers();
    } catch (error) {
      console.error('Error toggling active:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenEdit = (member: Member) => {
    setEditingMember(member);
    setEditFullName(member.full_name || '');
    setEditEmail(member.email || '');
    setEditPhone(member.phone || '');
    setEditError('');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;
    setEditError('');
    if (!editFullName.trim() || !editEmail.trim() || !editPhone.trim()) {
      setEditError('الاسم ورقم الهاتف والبريد الإلكتروني كلها مطلوبة');
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/employees/${editingMember.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          full_name: editFullName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحديث بيانات الموظف');

      setEditDialogOpen(false);
      setEditingMember(null);
      fetchMembers();
    } catch (err: any) {
      setEditError(err.message || 'حدث خطأ ما');
    } finally {
      setEditSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/employees/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حذف الموظف');

      setDeleteTarget(null);
      fetchMembers();
    } catch (err: any) {
      setDeleteError(err.message || 'حدث خطأ ما');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenResetPw = (member: Member) => {
    setResetPwMember(member);
    setTempPassword('');
    setResetPwError('');
    setResetPwDone(false);
  };

  const handleSubmitResetPw = async () => {
    if (!resetPwMember) return;
    setResetPwError('');
    if (tempPassword.length < 6) {
      setResetPwError('كلمة المرور المؤقتة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setResettingPw(true);
    try {
      const res = await fetch(`/api/employees/${resetPwMember.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ temp_password: tempPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إعادة تعيين كلمة المرور');
      setResetPwDone(true);
    } catch (err: any) {
      setResetPwError(err.message || 'حدث خطأ ما');
    } finally {
      setResettingPw(false);
    }
  };

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    setTempPassword(pass);
  };

  if (authLoading || !orgId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You need admin privileges to view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization members
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Organization Members</CardTitle>
          <CardDescription>{members.length} total members</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium text-foreground">No members found</p>
              <p className="text-xs mt-1">Add your first member to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium text-sm">
                      {member.full_name || <span className="text-muted-foreground font-mono text-xs">{member.user_id.slice(0, 8)}...</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{member.email || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground" dir="ltr">{member.phone || '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member.id, value)}
                        disabled={updatingId === member.id}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={member.is_active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(member)}
                          disabled={updatingId === member.id}
                        >
                          {member.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" title="تعديل" onClick={() => handleOpenEdit(member)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" title="إعادة تعيين كلمة المرور" onClick={() => handleOpenResetPw(member)}>
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="حذف"
                          onClick={() => { setDeleteError(''); setDeleteTarget(member); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة موظف جديد</DialogTitle>
            <DialogDescription>
              أدخل بيانات الموظف لإنشاء حساب دخول له في النظام
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">الاسم الكامل</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="full_name"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="اسم الموظف"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  dir="ltr"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newmember@company.com"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">الصلاحية</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddMember} disabled={adding}>
              {adding ? 'جارِ الإضافة...' : 'إضافة الموظف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل بيانات الموظف</DialogTitle>
            <DialogDescription>عدّل اسم أو رقم هاتف أو بريد الموظف</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit_full_name">الاسم الكامل</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="edit_full_name" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_phone">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="edit_phone" type="tel" dir="ltr" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="edit_email" type="email" dir="ltr" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="pl-9" />
              </div>
            </div>
          </div>

          {editError && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {editError}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? 'جارِ الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPwMember} onOpenChange={(open) => !open && setResetPwMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
            <DialogDescription>
              حدد كلمة مرور مؤقتة لـ {resetPwMember?.full_name || resetPwMember?.email}. الموظف هيُطلب منه تعيين كلمة مرور جديدة بنفسه عند أول تسجيل دخول.
            </DialogDescription>
          </DialogHeader>

          {resetPwDone ? (
            <div className="py-2 space-y-3">
              <div className="text-sm bg-primary/10 text-primary px-3 py-2 rounded">
                تم تحديث كلمة المرور بنجاح. أرسل كلمة المرور المؤقتة دي للموظف بأي وسيلة آمنة:
              </div>
              <div className="font-mono text-sm bg-muted px-3 py-2 rounded select-all" dir="ltr">{tempPassword}</div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="temp_password">كلمة المرور المؤقتة</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="temp_password"
                      dir="ltr"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="6 أحرف على الأقل"
                      className="pl-9"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={generateTempPassword}>توليد</Button>
                </div>
              </div>
            </div>
          )}

          {resetPwError && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {resetPwError}
            </div>
          )}

          <DialogFooter>
            {resetPwDone ? (
              <Button onClick={() => setResetPwMember(null)}>تم</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setResetPwMember(null)}>إلغاء</Button>
                <Button onClick={handleSubmitResetPw} disabled={resettingPw}>
                  {resettingPw ? 'جارِ التحديث...' : 'تحديث كلمة المرور'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الموظف؟</AlertDialogTitle>
            <AlertDialogDescription>
              هيتم حذف {deleteTarget?.full_name || deleteTarget?.email} من الشركة نهائياً ولن يقدر يسجل دخول بعد كده. الإجراء ده لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'جارِ الحذف...' : 'حذف نهائياً'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
