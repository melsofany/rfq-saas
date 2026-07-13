'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminQuery, adminUpdate, adminInsert } from '@/lib/admin-data-client';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Building2, ChevronRight, Ban, CheckCircle, Package, Loader2 } from 'lucide-react';

interface OrgRow {
  id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
  plan_name: string | null;
  member_count: number;
}

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Suspend/activate dialog
  const [suspendOrg, setSuspendOrg] = useState<OrgRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Change plan dialog
  const [planDialogOrg, setPlanDialogOrg] = useState<OrgRow | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [planLoading, setPlanLoading] = useState(false);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all organizations
      const orgData = await adminQuery<{ id: string; name: string; email: string; status: string; created_at: string; plan_id: string }>('organizations', {
        select: 'id, name, email, status, created_at, plan_id',
        order: { column: 'created_at', ascending: false },
      });

      // Fetch all plans for mapping
      const planData = await adminQuery<{ id: string; name: string }>('subscription_plans', {
        select: 'id, name',
        order: { column: 'sort_order', ascending: true },
      });
      setPlans(planData ?? []);

      const planMap: Record<string, string> = {};
      (planData ?? []).forEach((p) => {
        planMap[p.id] = p.name;
      });

      // Fetch member counts per org
      const memberData = await adminQuery<{ org_id: string }>('organization_members', {
        select: 'org_id',
      });

      const memberCountMap: Record<string, number> = {};
      (memberData ?? []).forEach((m) => {
        memberCountMap[m.org_id] = (memberCountMap[m.org_id] || 0) + 1;
      });

      const rows: OrgRow[] = (orgData ?? []).map((org) => ({
        id: org.id,
        name: org.name,
        email: org.email,
        status: org.status,
        created_at: org.created_at,
        plan_name: org.plan_id ? planMap[org.plan_id] || null : null,
        member_count: memberCountMap[org.id] || 0,
      }));

      setOrgs(rows);
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const filteredOrgs = orgs.filter((org) => {
    const matchesSearch =
      !search ||
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSuspendConfirm = async () => {
    if (!suspendOrg) return;
    setActionLoading(true);
    try {
      const newStatus = suspendOrg.status === 'suspended' ? 'active' : 'suspended';
      await adminUpdate('organizations', { status: newStatus, updated_at: new Date().toISOString() }, { id: suspendOrg.id });
      setOrgs((prev) =>
        prev.map((o) => (o.id === suspendOrg.id ? { ...o, status: newStatus } : o))
      );
      setSuspendOrg(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update organization');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!planDialogOrg || !selectedPlan) return;
    setPlanLoading(true);
    try {
      // Update org's plan_id
      await adminUpdate('organizations', { plan_id: selectedPlan, updated_at: new Date().toISOString() }, { id: planDialogOrg.id });

      // Update or create subscription
      const existingSubs = await adminQuery<{ id: string }>('subscriptions', {
        select: 'id',
        eq: { org_id: planDialogOrg.id },
        limit: 1,
      });

      if (existingSubs && existingSubs.length > 0) {
        await adminUpdate('subscriptions', { plan_id: selectedPlan, updated_at: new Date().toISOString() }, { id: existingSubs[0].id });
      } else {
        await adminInsert('subscriptions', {
          org_id: planDialogOrg.id,
          plan_id: selectedPlan,
          status: 'active',
          billing_cycle: 'monthly',
        } as any);
      }

      // Update local state
      const planName = plans.find((p) => p.id === selectedPlan)?.name || null;
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === planDialogOrg.id ? { ...o, plan_name: planName } : o
        )
      );
      setPlanDialogOrg(null);
      setSelectedPlan('');
    } catch (err: any) {
      alert(err.message || 'Failed to change plan');
    } finally {
      setPlanLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 hover:bg-green-500">Active</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      case 'trial':
        return <Badge className="bg-amber-500 hover:bg-amber-500">Trial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage all organizations on the platform
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            All Organizations
            <Badge variant="secondary" className="ml-1">{filteredOrgs.length}</Badge>
          </CardTitle>
          <CardDescription>Click any row to view organization details</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {search || statusFilter !== 'all'
                  ? 'No organizations match your filters'
                  : 'No organizations have been registered yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Members</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs.map((org) => (
                    <TableRow
                      key={org.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/organizations/${org.id}`)}
                    >
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="text-muted-foreground">{org.email}</TableCell>
                      <TableCell>
                        {org.plan_name ? (
                          <Badge variant="outline">{org.plan_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No plan</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(org.status)}</TableCell>
                      <TableCell className="text-center">{org.member_count}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(org.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/organizations/${org.id}`)}
                          >
                            View
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPlanDialogOrg(org);
                              const planId = plans.find((p) => p.name === org.plan_name)?.id || '';
                              setSelectedPlan(planId);
                            }}
                          >
                            <Package className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSuspendOrg(org)}
                          >
                            {org.status === 'suspended' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <Ban className="w-4 h-4 text-red-600" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suspend/Activate Confirmation Dialog */}
      <AlertDialog open={!!suspendOrg} onOpenChange={(open) => !open && setSuspendOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendOrg?.status === 'suspended' ? 'Activate Organization' : 'Suspend Organization'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendOrg?.status === 'suspended'
                ? `This will reactivate "${suspendOrg?.name}" and restore access for all its members.`
                : `This will suspend "${suspendOrg?.name}". All members will lose access to the platform.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspendConfirm}
              disabled={actionLoading}
              className={suspendOrg?.status === 'suspended' ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : suspendOrg?.status === 'suspended' ? (
                'Activate'
              ) : (
                'Suspend'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Plan Dialog */}
      <Dialog open={!!planDialogOrg} onOpenChange={(open) => { if (!open) { setPlanDialogOrg(null); setSelectedPlan(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan for {planDialogOrg?.name}</DialogTitle>
            <DialogDescription>
              Select a new subscription plan for this organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>New Plan</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPlanDialogOrg(null); setSelectedPlan(''); }}>
              Cancel
            </Button>
            <Button onClick={handleChangePlan} disabled={planLoading || !selectedPlan}>
              {planLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
