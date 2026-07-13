'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  Building2,
  Users,
  CreditCard,
  Package,
  Shield,
  UserPlus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Inbox,
} from 'lucide-react';
import { adminQuery, adminCount, adminInsert, adminDelete } from '@/lib/admin-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface AdminRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email: string;
}

interface PlatformStats {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  totalUsers: number;
  totalSubs: number;
  totalPlans: number;
}

export default function SettingsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Add admin
  const [adminEmail, setAdminEmail] = useState('');
  const [adminUserId, setAdminUserId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Delete admin
  const [deleteAdmin, setDeleteAdmin] = useState<AdminRow | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Platform stats — run counts in parallel
      const [totalOrgs, activeOrgs, suspendedOrgs, totalUsers, totalSubs, totalPlans] =
        await Promise.all([
          adminCount('organizations'),
          adminCount('organizations', { status: 'active' }),
          adminCount('organizations', { status: 'suspended' }),
          adminCount('organization_members'),
          adminCount('subscriptions'),
          adminCount('subscription_plans'),
        ]);

      setStats({
        totalOrgs,
        activeOrgs,
        suspendedOrgs,
        totalUsers,
        totalSubs,
        totalPlans,
      });

      // Fetch admins
      const adminData = await adminQuery<AdminRow>('saas_admins', {
        select: 'id, user_id, role, created_at',
        order: { column: 'created_at', ascending: false },
      });

      setAdmins(adminData ?? []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Settings fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAddAdmin = async () => {
    setAddError(null);
    setAddSuccess(null);
    setActionLoading(true);

    try {
      const userId = adminEmail || adminUserId;
      if (!userId) {
        setAddError('Please enter a user email or user ID.');
        setActionLoading(false);
        return;
      }

      // Check if already admin (by user_id)
      const existing = await adminQuery<{ id: string }>('saas_admins', {
        select: 'id',
        eq: { user_id: userId },
      });

      if (existing && existing.length > 0) {
        setAddError('This user is already a SaaS admin.');
        setActionLoading(false);
        return;
      }

      await adminInsert('saas_admins', { user_id: userId, role: 'admin' });

      setAddSuccess(`Successfully added ${userId} as SaaS admin.`);
      setAdminEmail('');
      setAdminUserId('');
      await fetchAll();
    } catch (err: any) {
      setAddError(err?.message || 'Failed to add admin.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!deleteAdmin) return;
    setActionLoading(true);
    try {
      await adminDelete('saas_admins', { id: deleteAdmin.id });
      setDeleteAdmin(null);
      await fetchAll();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Remove admin error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Orgs',
      value: stats?.totalOrgs ?? 0,
      icon: Building2,
      color: 'text-chart-1',
      bg: 'bg-chart-1/10',
    },
    {
      label: 'Active Orgs',
      value: stats?.activeOrgs ?? 0,
      icon: CheckCircle2,
      color: 'text-chart-2',
      bg: 'bg-chart-2/10',
    },
    {
      label: 'Suspended Orgs',
      value: stats?.suspendedOrgs ?? 0,
      icon: XCircle,
      color: 'text-chart-5',
      bg: 'bg-chart-5/10',
    },
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: 'text-chart-4',
      bg: 'bg-chart-4/10',
    },
    {
      label: 'Total Subscriptions',
      value: stats?.totalSubs ?? 0,
      icon: CreditCard,
      color: 'text-chart-3',
      bg: 'bg-chart-3/10',
    },
    {
      label: 'Total Plans',
      value: stats?.totalPlans ?? 0,
      icon: Package,
      color: 'text-chart-1',
      bg: 'bg-chart-1/10',
    },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Platform configuration and SaaS admin management
        </p>
      </div>

      {/* Platform Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Platform Statistics</CardTitle>
              <CardDescription>Overview of platform-wide metrics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))
              : statCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="text-sm text-muted-foreground">{card.label}</p>
                        <p className="text-2xl font-bold">{card.value}</p>
                      </div>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                        <Icon className={`h-5 w-5 ${card.color}`} />
                      </div>
                    </div>
                  );
                })}
          </div>
        </CardContent>
      </Card>

      {/* SaaS Admin Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">SaaS Admin Management</CardTitle>
              <CardDescription>Manage users with platform admin access</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add Admin */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Add SaaS Admin</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="admin-email">User Email or User ID</Label>
                <Input
                  id="admin-email"
                  type="text"
                  placeholder="user@example.com or user-uuid"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    setAddError(null);
                    setAddSuccess(null);
                  }}
                  disabled={actionLoading}
                />
              </div>
              <Button
                onClick={handleAddAdmin}
                disabled={actionLoading || !adminEmail}
                className="sm:w-auto"
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Add Admin
              </Button>
            </div>
            {addError && (
              <div className="rounded-md bg-destructive/15 px-4 py-2 text-sm text-destructive border border-destructive/30">
                {addError}
              </div>
            )}
            {addSuccess && (
              <div className="rounded-md bg-success/15 px-4 py-2 text-sm text-success border border-success/30">
                {addSuccess}
              </div>
            )}
          </div>

          {/* Admin List */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Current SaaS Admins</p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : admins.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Inbox className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No SaaS admins found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {admin.email || `User: ${admin.user_id.slice(0, 12)}…`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(admin.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{admin.role}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteAdmin(admin)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Platform Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Platform Configuration</CardTitle>
              <CardDescription>Current platform settings and configuration</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground">Platform Name</p>
              <p className="text-sm font-semibold">RFQ Manager</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground">Database</p>
              <p className="text-sm font-semibold">Render PostgreSQL 16</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground">Region</p>
              <p className="text-sm font-semibold">Oregon</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground">Auth Provider</p>
              <p className="text-sm font-semibold">Custom Admin Auth</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Admin AlertDialog */}
      <AlertDialog open={!!deleteAdmin} onOpenChange={(open) => !open && setDeleteAdmin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove SaaS Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>
                {deleteAdmin?.email || `User: ${deleteAdmin?.user_id.slice(0, 12)}…`}
              </strong>{' '}
              from SaaS admins? They will lose access to the admin panel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAdmin}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
