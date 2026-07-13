'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminQuery, adminUpdate } from '@/lib/admin-data-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { CreditCard, XCircle, Package, Loader2 } from 'lucide-react';

interface SubRow {
  id: string;
  org_id: string;
  org_name: string;
  plan_id: string;
  plan_name: string;
  status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Cancel dialog
  const [cancelSub, setCancelSub] = useState<SubRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Change plan dialog
  const [planDialogSub, setPlanDialogSub] = useState<SubRow | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [planLoading, setPlanLoading] = useState(false);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all subscriptions
      const subData = await adminQuery<{
        id: string;
        org_id: string;
        plan_id: string;
        status: string;
        billing_cycle: string;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        created_at: string;
      }>('subscriptions', {
        select: 'id, org_id, plan_id, status, billing_cycle, current_period_start, current_period_end, cancel_at_period_end, created_at',
        order: { column: 'created_at', ascending: false },
      });

      // Fetch plans
      const planData = await adminQuery<{ id: string; name: string }>('subscription_plans', {
        select: 'id, name',
        order: { column: 'sort_order', ascending: true },
      });
      setPlans(planData || []);

      // Fetch organizations for names
      const orgData = await adminQuery<{ id: string; name: string }>('organizations', {
        select: 'id, name',
      });

      // Build lookup maps
      const orgMap: Record<string, string> = {};
      (orgData || []).forEach((o) => { orgMap[o.id] = o.name; });

      const planMap: Record<string, string> = {};
      (planData || []).forEach((p) => { planMap[p.id] = p.name; });

      const rows: SubRow[] = (subData || []).map((s) => ({
        id: s.id,
        org_id: s.org_id,
        org_name: orgMap[s.org_id] || 'Unknown',
        plan_id: s.plan_id,
        plan_name: planMap[s.plan_id] || 'Unknown',
        status: s.status,
        billing_cycle: s.billing_cycle,
        current_period_start: s.current_period_start,
        current_period_end: s.current_period_end,
        cancel_at_period_end: s.cancel_at_period_end,
        created_at: s.created_at,
      }));

      setSubs(rows);
    } catch (err: any) {
      console.error('Failed to fetch subscriptions:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  const filteredSubs = subs.filter((s) => {
    return statusFilter === 'all' || s.status === statusFilter;
  });

  const handleCancelConfirm = async () => {
    if (!cancelSub) return;
    setActionLoading(true);
    try {
      await adminUpdate('subscriptions', {
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      } as any, { id: cancelSub.id });

      setSubs((prev) =>
        prev.map((s) =>
          s.id === cancelSub.id ? { ...s, cancel_at_period_end: true } : s
        )
      );
      setCancelSub(null);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!planDialogSub || !selectedPlan) return;
    setPlanLoading(true);
    try {
      await adminUpdate('subscriptions', {
        plan_id: selectedPlan,
        updated_at: new Date().toISOString(),
      } as any, { id: planDialogSub.id });

      // Also update the org's plan_id
      await adminUpdate('organizations', {
        plan_id: selectedPlan,
        updated_at: new Date().toISOString(),
      } as any, { id: planDialogSub.org_id });

      const planName = plans.find((p) => p.id === selectedPlan)?.name || 'Unknown';
      setSubs((prev) =>
        prev.map((s) =>
          s.id === planDialogSub.id ? { ...s, plan_id: selectedPlan, plan_name: planName } : s
        )
      );
      setPlanDialogSub(null);
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
      case 'trialing':
        return <Badge className="bg-amber-500 hover:bg-amber-500">Trialing</Badge>;
      case 'past_due':
        return <Badge className="bg-red-500 hover:bg-red-500">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Canceled</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage all subscriptions across the platform
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="past_due">Past Due</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            All Subscriptions
            <Badge variant="secondary" className="ml-1">{filteredSubs.length}</Badge>
          </CardTitle>
          <CardDescription>Manage billing and plan changes for all subscriptions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredSubs.length === 0 ? (
            <div className="text-center py-16">
              <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {statusFilter !== 'all'
                  ? 'No subscriptions match your filter'
                  : 'No subscriptions have been created yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Billing Cycle</TableHead>
                    <TableHead>Period End</TableHead>
                    <TableHead>Cancel at End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubs.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.org_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{sub.plan_name}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell className="capitalize">{sub.billing_cycle}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.current_period_end
                          ? new Date(sub.current_period_end).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {sub.cancel_at_period_end ? (
                          <Badge variant="destructive">Yes</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPlanDialogSub(sub);
                              setSelectedPlan(sub.plan_id);
                            }}
                          >
                            <Package className="w-4 h-4 mr-1" />
                            Change Plan
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={sub.cancel_at_period_end}
                            onClick={() => setCancelSub(sub)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancel
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

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={!!cancelSub} onOpenChange={(open) => !open && setCancelSub(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the subscription for &quot;{cancelSub?.org_name}&quot; to be canceled at the end of the current billing period. The organization will retain access until then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Keep Active</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Cancel at Period End'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Plan Dialog */}
      <Dialog open={!!planDialogSub} onOpenChange={(open) => { if (!open) { setPlanDialogSub(null); setSelectedPlan(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan for {planDialogSub?.org_name}</DialogTitle>
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
            <Button variant="outline" onClick={() => { setPlanDialogSub(null); setSelectedPlan(''); }}>
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
