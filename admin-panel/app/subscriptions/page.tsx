'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard,
  Inbox,
  Loader2,
  XCircle,
  Pencil,
} from 'lucide-react';
import { adminQuery, adminUpdate } from '@/lib/admin-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
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

interface SubRow {
  id: string;
  org_id: string;
  org_name: string;
  plan_id: string;
  plan_name: string;
  status: string;
  billing_cycle: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface Plan {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-success/15 text-success border-success/30',
  trialing: 'bg-primary/15 text-primary border-primary/30',
  past_due: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog state
  const [planDialogSub, setPlanDialogSub] = useState<SubRow | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('');

  // AlertDialog state
  const [cancelSub, setCancelSub] = useState<SubRow | null>(null);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch subscriptions
      const subData = await adminQuery<{
        id: string;
        org_id: string;
        plan_id: string;
        status: string;
        billing_cycle: string;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
      }>('subscriptions', {
        select: '*',
        order: { column: 'created_at', ascending: false },
      });

      // Fetch organizations
      const orgData = await adminQuery<{ id: string; name: string }>('organizations', {
        select: 'id, name',
      });

      // Fetch plans
      const planData = await adminQuery<Plan>('subscription_plans', {
        select: 'id, name',
        order: { column: 'sort_order', ascending: true },
      });

      setPlans(planData ?? []);

      const orgMap = new Map<string, string>();
      orgData.forEach((o) => orgMap.set(o.id, o.name));

      const planMap = new Map<string, string>();
      planData.forEach((p) => planMap.set(p.id, p.name));

      const rows: SubRow[] = (subData ?? []).map((sub) => ({
        id: sub.id,
        org_id: sub.org_id,
        org_name: orgMap.get(sub.org_id) ?? 'Unknown',
        plan_id: sub.plan_id,
        plan_name: planMap.get(sub.plan_id) ?? 'Unknown',
        status: sub.status,
        billing_cycle: sub.billing_cycle,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
      }));

      setSubs(rows);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Fetch subs error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  const filtered = subs.filter((sub) => {
    return statusFilter === 'all' || sub.status === statusFilter;
  });

  const handleCancelAtPeriodEnd = async () => {
    if (!cancelSub) return;
    setActionLoading(true);
    try {
      await adminUpdate('subscriptions', { cancel_at_period_end: true }, { id: cancelSub.id });
      setCancelSub(null);
      await fetchSubs();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Cancel sub error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!planDialogSub || !selectedPlan) return;
    setActionLoading(true);
    try {
      await adminUpdate('subscriptions', { plan_id: selectedPlan }, { id: planDialogSub.id });
      setPlanDialogSub(null);
      setSelectedPlan('');
      await fetchSubs();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Change plan error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            Manage all subscriptions across the platform
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="past_due">Past Due</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Subscriptions</CardTitle>
          <CardDescription>{filtered.length} subscription(s) found</CardDescription>
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
                <p className="text-sm font-medium">No subscriptions found</p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your filter
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billing Cycle</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Cancel at Period End</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                          <CreditCard className="h-4 w-4 text-primary" />
                        </div>
                        {sub.org_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sub.plan_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE[sub.status] ?? ''}
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {sub.billing_cycle}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.current_period_end
                        ? new Date(sub.current_period_end).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {sub.cancel_at_period_end ? (
                        <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
                          Yes
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
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
                          title="Change Plan"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!sub.cancel_at_period_end && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelSub(sub)}
                            title="Cancel at Period End"
                            className="text-destructive hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
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
        open={!!planDialogSub}
        onOpenChange={(open) => {
          if (!open) {
            setPlanDialogSub(null);
            setSelectedPlan('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Select a new plan for {planDialogSub?.org_name}
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
                setPlanDialogSub(null);
                setSelectedPlan('');
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePlan} disabled={actionLoading || !selectedPlan}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel at Period End AlertDialog */}
      <AlertDialog open={!!cancelSub} onOpenChange={(open) => !open && setCancelSub(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription at Period End?</AlertDialogTitle>
            <AlertDialogDescription>
              The subscription for <strong>{cancelSub?.org_name}</strong> will remain
              active until the end of the current billing period, after which it will be
              cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelAtPeriodEnd}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
