'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Search,
  Inbox,
  Loader2,
  Ban,
  CheckCircle2,
  Pencil,
  ChevronRight,
} from 'lucide-react';
import { adminQuery, adminCount, adminUpdate } from '@/lib/admin-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
} from '@/components/ui/select';
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
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';

interface OrgRow {
  id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
  plan_name: string | null;
  member_count: number;
}

interface Plan {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-success/15 text-success border-success/30',
  suspended: 'bg-warning/15 text-warning border-warning/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
  trial: 'bg-primary/15 text-primary border-primary/30',
};

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog state
  const [planDialogOrg, setPlanDialogOrg] = useState<OrgRow | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  // AlertDialog state
  const [suspendOrg, setSuspendOrg] = useState<OrgRow | null>(null);
  const [activateOrg, setActivateOrg] = useState<OrgRow | null>(null);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const orgData = await adminQuery<{
        id: string;
        name: string;
        email: string;
        status: string;
        created_at: string;
        plan_id: string | null;
      }>('organizations', {
        select: 'id, name, email, status, created_at, plan_id',
        order: { column: 'created_at', ascending: false },
      });

      // Fetch plans
      const planData = await adminQuery<Plan>('subscription_plans', {
        select: 'id, name',
        order: { column: 'sort_order', ascending: true },
      });

      setPlans(planData ?? []);

      const planMap = new Map<string, string>();
      planData.forEach((p) => planMap.set(p.id, p.name));

      // Fetch member counts per org
      const memberData = await adminQuery<{ org_id: string }>('organization_members', {
        select: 'org_id',
      });

      const memberCountMap = new Map<string, number>();
      memberData.forEach((m) => {
        memberCountMap.set(m.org_id, (memberCountMap.get(m.org_id) ?? 0) + 1);
      });

      const rows: OrgRow[] = (orgData ?? []).map((org) => ({
        id: org.id,
        name: org.name,
        email: org.email,
        status: org.status,
        created_at: org.created_at,
        plan_name: org.plan_id ? planMap.get(org.plan_id) ?? null : null,
        member_count: memberCountMap.get(org.id) ?? 0,
      }));

      setOrgs(rows);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Fetch orgs error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const filtered = orgs.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSuspend = async () => {
    if (!suspendOrg) return;
    setActionLoading(true);
    try {
      await adminUpdate('organizations', { status: 'suspended' }, { id: suspendOrg.id });
      setSuspendOrg(null);
      await fetchOrgs();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Suspend error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!activateOrg) return;
    setActionLoading(true);
    try {
      await adminUpdate('organizations', { status: 'active' }, { id: activateOrg.id });
      setActivateOrg(null);
      await fetchOrgs();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Activate error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!planDialogOrg || !selectedPlan) return;
    setActionLoading(true);
    try {
      await adminUpdate('organizations', { plan_id: selectedPlan }, { id: planDialogOrg.id });

      // Also update the subscription if one exists
      const subs = await adminQuery<{ id: string }>('subscriptions', {
        select: 'id',
        eq: { org_id: planDialogOrg.id },
      });

      if (subs && subs.length > 0) {
        await adminUpdate('subscriptions', { plan_id: selectedPlan }, { id: subs[0].id });
      }

      setPlanDialogOrg(null);
      setSelectedPlan('');
      await fetchOrgs();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Change plan error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const openPlanDialog = (org: OrgRow) => {
    setPlanDialogOrg(org);
    // Pre-select current plan if exists
    const currentPlan = plans.find((p) => p.name === org.plan_name);
    setSelectedPlan(currentPlan?.id ?? '');
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Manage all organizations on the platform
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
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
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Organizations</CardTitle>
          <CardDescription>{filtered.length} organization(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No organizations found</p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your search or filter
                </p>
              </div>
            </div>
          ) : (
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
                {filtered.map((org) => (
                  <TableRow
                    key={org.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/organizations/${org.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        {org.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{org.email}</TableCell>
                    <TableCell>
                      {org.plan_name ? (
                        <Badge variant="secondary">{org.plan_name}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No plan</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE[org.status] ?? ''}
                      >
                        {org.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{org.member_count}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(org.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPlanDialog(org)}
                          title="Change Plan"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {org.status === 'suspended' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActivateOrg(org)}
                            title="Activate"
                            className="text-success hover:text-success"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSuspendOrg(org)}
                            title="Suspend"
                            className="text-warning hover:text-warning"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/organizations/${org.id}`)}
                          title="View Details"
                        >
                          <ChevronRight className="h-4 w-4" />
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

      {/* Change Plan Dialog */}
      <Dialog
        open={!!planDialogOrg}
        onOpenChange={(open) => {
          if (!open) {
            setPlanDialogOrg(null);
            setSelectedPlan('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Select a new plan for {planDialogOrg?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan</Label>
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPlanDialogOrg(null);
                setSelectedPlan('');
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePlan} disabled={actionLoading || !selectedPlan}>
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend AlertDialog */}
      <AlertDialog open={!!suspendOrg} onOpenChange={(open) => !open && setSuspendOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend <strong>{suspendOrg?.name}</strong>. The organization
              and its members will lose access to the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              disabled={actionLoading}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate AlertDialog */}
      <AlertDialog open={!!activateOrg} onOpenChange={(open) => !open && setActivateOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reactivate <strong>{activateOrg?.name}</strong>. The organization
              and its members will regain access to the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleActivate}
              disabled={actionLoading}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
