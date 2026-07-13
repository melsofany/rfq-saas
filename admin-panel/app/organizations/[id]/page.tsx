'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Users,
  CreditCard,
  BarChart3,
  Info,
  Ban,
  CheckCircle2,
  XCircle,
  Pencil,
  Loader2,
  Inbox,
} from 'lucide-react';
import { adminQuery, adminCount, adminUpdate } from '@/lib/admin-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

interface OrgData {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  email: string;
  phone: string | null;
  address: string | null;
  country: string | null;
  status: string;
  created_at: string;
  trial_ends_at: string | null;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface Plan {
  id: string;
  name: string;
}

interface UsageCounts {
  rfqs: number;
  suppliers: number;
  purchase_orders: number;
  offers: number;
  items: number;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-success/15 text-success border-success/30',
  suspended: 'bg-warning/15 text-warning border-warning/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
  trialing: 'bg-primary/15 text-primary border-primary/30',
  past_due: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = useState<OrgData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planName, setPlanName] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog/AlertDialog state
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [activateDialog, setActivateDialog] = useState(false);
  const [cancelSubDialog, setCancelSubDialog] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Org
      const orgData = await adminQuery<OrgData>('organizations', {
        select: '*',
        eq: { id: orgId },
      });
      setOrg(orgData[0] ?? null);

      // Members
      const memberData = await adminQuery<Member>('organization_members', {
        select: '*',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: true },
      });
      setMembers(memberData ?? []);

      // Subscription
      const subData = await adminQuery<Subscription>('subscriptions', {
        select: '*',
        eq: { org_id: orgId },
      });
      const sub = subData[0] ?? null;
      setSubscription(sub);

      // Plans
      const planData = await adminQuery<Plan>('subscription_plans', {
        select: 'id, name',
        order: { column: 'sort_order', ascending: true },
      });
      setPlans(planData ?? []);

      if (sub) {
        const plan = planData.find((p) => p.id === sub.plan_id);
        setPlanName(plan?.name ?? null);
      }

      // Usage counts
      const [rfqCount, supplierCount, poCount, offerCount, itemCount] = await Promise.all([
        adminCount('rfqs', { org_id: orgId }),
        adminCount('suppliers', { org_id: orgId }),
        adminCount('purchase_orders', { org_id: orgId }),
        adminCount('offers', { org_id: orgId }),
        adminCount('items', { org_id: orgId }),
      ]);

      setUsage({
        rfqs: rfqCount,
        suppliers: supplierCount,
        purchase_orders: poCount,
        offers: offerCount,
        items: itemCount,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Org detail fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSuspend = async () => {
    setActionLoading(true);
    try {
      await adminUpdate('organizations', { status: 'suspended' }, { id: orgId });
      setSuspendDialog(false);
      await fetchAll();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Suspend error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    setActionLoading(true);
    try {
      await adminUpdate('organizations', { status: 'active' }, { id: orgId });
      setActivateDialog(false);
      await fetchAll();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Activate error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = async () => {
    setActionLoading(true);
    try {
      await adminUpdate('organizations', { plan_id: selectedPlan }, { id: orgId });
      if (subscription) {
        await adminUpdate('subscriptions', { plan_id: selectedPlan }, { id: subscription.id });
      }
      setPlanDialogOpen(false);
      setSelectedPlan('');
      await fetchAll();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Change plan error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSub = async () => {
    setActionLoading(true);
    try {
      if (subscription) {
        await adminUpdate('subscriptions', { cancel_at_period_end: true }, { id: subscription.id });
      }
      setCancelSubDialog(false);
      await fetchAll();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Cancel sub error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Organization not found</p>
        <Button variant="outline" onClick={() => router.push('/organizations')}>
          Back to Organizations
        </Button>
      </div>
    );
  }

  const usageCards = [
    { label: 'RFQs', value: usage?.rfqs ?? 0, icon: BarChart3 },
    { label: 'Suppliers', value: usage?.suppliers ?? 0, icon: Users },
    { label: 'Purchase Orders', value: usage?.purchase_orders ?? 0, icon: CreditCard },
    { label: 'Offers', value: usage?.offers ?? 0, icon: BarChart3 },
    { label: 'Items', value: usage?.items ?? 0, icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/organizations')}
        className="text-muted-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Organizations
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
            <p className="text-sm text-muted-foreground">{org.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const currentPlan = plans.find((p) => p.id === subscription?.plan_id);
              setSelectedPlan(currentPlan?.id ?? '');
              setPlanDialogOpen(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Change Plan
          </Button>
          {org.status === 'suspended' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivateDialog(true)}
              className="text-success hover:text-success"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Activate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuspendDialog(true)}
              className="text-warning hover:text-warning"
            >
              <Ban className="mr-2 h-4 w-4" />
              Suspend
            </Button>
          )}
          {subscription && !subscription.cancel_at_period_end && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelSubDialog(true)}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Sub
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="details">
            <Info className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="mr-2 h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <CreditCard className="mr-2 h-4 w-4" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="usage">
            <BarChart3 className="mr-2 h-4 w-4" />
            Usage
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Organization Details</CardTitle>
              <CardDescription>Basic information about this organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Name" value={org.name} />
                <DetailField label="Name (Arabic)" value={org.name_ar ?? '—'} />
                <DetailField label="Slug" value={org.slug} />
                <DetailField label="Email" value={org.email} />
                <DetailField label="Phone" value={org.phone ?? '—'} />
                <DetailField label="Address" value={org.address ?? '—'} />
                <DetailField label="Country" value={org.country ?? '—'} />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge
                    variant="outline"
                    className={STATUS_BADGE[org.status] ?? ''}
                  >
                    {org.status}
                  </Badge>
                </div>
                <DetailField
                  label="Created At"
                  value={new Date(org.created_at).toLocaleString()}
                />
                <DetailField
                  label="Trial Ends At"
                  value={org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleString() : '—'}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Members</CardTitle>
              <CardDescription>
                {members.length} member(s) in this organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No members yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {member.user_id.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            User ID: {member.user_id.slice(0, 8)}…
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(member.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{member.role}</Badge>
                        <Badge
                          variant="outline"
                          className={
                            member.is_active
                              ? 'bg-success/15 text-success border-success/30'
                              : 'bg-muted text-muted-foreground'
                          }
                        >
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subscription</CardTitle>
              <CardDescription>Current subscription details</CardDescription>
            </CardHeader>
            <CardContent>
              {!subscription ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No subscription found</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailField label="Plan" value={planName ?? 'Unknown'} />
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE[subscription.status] ?? ''}
                    >
                      {subscription.status}
                    </Badge>
                  </div>
                  <DetailField label="Billing Cycle" value={subscription.billing_cycle} />
                  <DetailField
                    label="Cancel at Period End"
                    value={subscription.cancel_at_period_end ? 'Yes' : 'No'}
                  />
                  <DetailField
                    label="Period Start"
                    value={
                      subscription.current_period_start
                        ? new Date(subscription.current_period_start).toLocaleDateString()
                        : '—'
                    }
                  />
                  <DetailField
                    label="Period End"
                    value={
                      subscription.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString()
                        : '—'
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage Statistics</CardTitle>
              <CardDescription>Resource usage for this organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {usageCards.map((card) => {
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Change Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>Select a new plan for {org.name}</DialogDescription>
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
              onClick={() => setPlanDialogOpen(false)}
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

      {/* Suspend AlertDialog */}
      <AlertDialog open={suspendDialog} onOpenChange={setSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend <strong>{org.name}</strong>. The organization and its
              members will lose access to the platform.
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
      <AlertDialog open={activateDialog} onOpenChange={setActivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reactivate <strong>{org.name}</strong>. The organization and
              its members will regain access to the platform.
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

      {/* Cancel Subscription AlertDialog */}
      <AlertDialog open={cancelSubDialog} onOpenChange={setCancelSubDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription at Period End?</AlertDialogTitle>
            <AlertDialogDescription>
              The subscription for <strong>{org.name}</strong> will remain active until
              the end of the current billing period, after which it will be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSub}
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium">{value}</p>
      <Separator className="mt-2" />
    </div>
  );
}
