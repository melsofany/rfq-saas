'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminQuery, adminInsert, adminDelete, adminCount } from '@/lib/admin-data-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Settings,
  Shield,
  UserPlus,
  Trash2,
  Loader2,
  Building2,
  Users,
  CreditCard,
  Package,
  AlertCircle,
} from 'lucide-react';

interface AdminUser {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email: string | null;
}

interface PlatformStats {
  totalOrganizations: number;
  totalUsers: number;
  totalSubscriptions: number;
  totalPlans: number;
  activeOrgs: number;
  suspendedOrgs: number;
}

export default function AdminSettingsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeAdmin, setRemoveAdmin] = useState<AdminUser | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchAdmins = useCallback(async () => {
    try {
      const data = await adminQuery<AdminUser>('saas_admins', {
        select: 'id, user_id, role, created_at',
        order: { column: 'created_at', ascending: false },
      });

      // We can't query auth.users directly, so we'll display user_id truncated
      // Try to match with current admin user from localStorage for email display
      let currentAdminEmail: string | null = null;
      if (typeof window !== 'undefined') {
        const adminUserStr = localStorage.getItem('admin_user');
        if (adminUserStr) {
          try {
            const adminUser = JSON.parse(adminUserStr);
            currentAdminEmail = adminUser.email || null;
          } catch {}
        }
      }

      const adminUsers: AdminUser[] = (data || []).map((a: any) => ({
        ...a,
        email: currentAdminEmail,
      }));

      setAdmins(adminUsers);
    } catch (err: any) {
      console.error('Failed to fetch admins:', err.message);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [
        totalOrgs,
        totalUsers,
        totalSubs,
        totalPlans,
        activeOrgs,
        suspendedOrgs,
      ] = await Promise.all([
        adminCount('organizations'),
        adminCount('organization_members'),
        adminCount('subscriptions'),
        adminCount('subscription_plans'),
        adminCount('organizations', { status: 'active' }),
        adminCount('organizations', { status: 'suspended' }),
      ]);

      setStats({
        totalOrganizations: totalOrgs || 0,
        totalUsers: totalUsers || 0,
        totalSubscriptions: totalSubs || 0,
        totalPlans: totalPlans || 0,
        activeOrgs: activeOrgs || 0,
        suspendedOrgs: suspendedOrgs || 0,
      });
    } catch (err: any) {
      console.error('Failed to fetch stats:', err.message);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchAdmins(), fetchStats()]);
    setLoading(false);
  }, [fetchAdmins, fetchStats]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newAdminEmail.trim()) {
      setAddError('Please enter an email address');
      return;
    }

    setAdding(true);
    try {
      // We can't query auth.users from the client side with the admin data client.
      // The admin-auth edge function would need a lookup endpoint.
      // For now, we inform the admin that user lookup by email requires server-side.
      setAddError(
        'Unable to look up users by email from the admin panel. Please enter the user UUID instead.'
      );
    } catch (err: any) {
      setAddError(err.message || 'Failed to add admin user');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!removeAdmin) return;
    setRemoving(true);
    try {
      await adminDelete('saas_admins', { id: removeAdmin.id });
      setRemoveAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      alert(err.message || 'Failed to remove admin');
    } finally {
      setRemoving(false);
    }
  };

  const statCards = [
    { label: 'Organizations', value: stats?.totalOrganizations ?? 0, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Orgs', value: stats?.activeOrgs ?? 0, icon: Building2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Subscriptions', value: stats?.totalSubscriptions ?? 0, icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Plans', value: stats?.totalPlans ?? 0, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Suspended Orgs', value: stats?.suspendedOrgs ?? 0, icon: Building2, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage platform administrators and view platform statistics
        </p>
      </div>

      {/* Platform Stats */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          Platform Statistics
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {loading ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (
            statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                        <p className="text-xl font-bold mt-1">{stat.value}</p>
                      </div>
                      <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* SaaS Admin Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            SaaS Admin Users
          </CardTitle>
          <CardDescription>
            Users with platform-level administrative access. Admins can manage all organizations, subscriptions, and plans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add Admin Form */}
          <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-3 mb-6 pb-6 border-b">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="adminEmail">Add Admin by User Email</Label>
              <Input
                id="adminEmail"
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={adding}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={adding || !newAdminEmail.trim()} className="w-full sm:w-auto">
                {adding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Admin
                  </>
                )}
              </Button>
            </div>
          </form>

          {addError && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2.5 rounded-md mb-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{addError}</span>
            </div>
          )}

          {/* Admins Table */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No admin users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          {admin.email ? (
                            <span className="font-medium">{admin.email}</span>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              {admin.user_id.substring(0, 8)}...
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{admin.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(admin.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRemoveAdmin(admin)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove Admin Confirmation */}
      <AlertDialog open={!!removeAdmin} onOpenChange={(open) => !open && setRemoveAdmin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user&apos;s SaaS admin access? They will no longer be able to access the admin panel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAdmin}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Admin'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
