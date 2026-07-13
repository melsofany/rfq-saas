'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminQuery, adminUpdate, adminInsert, adminCount } from '@/lib/admin-data-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Building2,
  Users,
  CreditCard,
  FileText,
  Package,
  Ban,
  CheckCircle,
  XCircle,
  Loader2,
  Mail,
  Phone,
  Globe,
  Calendar,
} from 'lucide-react';

interface OrgDetail {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  email: string;
  phone: string | null;
  address: string | null;
  country: string | null;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  plan_id: string | null;
  plan_name: string | null;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  user_email: string | null;
}

interface Subscription {
  id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  plan_name: string | null;
}

interface UsageStats {
  rfqsCount: number;
  suppliersCount: number;
  posCount: number;
  offersCount: number;
}

export default function AdminOrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [planDialog, setPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [cancelSubDialog, setCancelSubDialog] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch org
      const orgData = await adminQuery<OrgDetail>('organizations', {
        select: '*',
        eq: { id: orgId },
        limit: 1,
      });

      if (!orgData || orgData.length === 0) {
        setError('Organization not found');
        setLoading(false);
        return;
      }

      // Fetch plans
      const planData = await adminQuery<{ id: string; name: string }>('subscription_plans', {
        select: 'id, name',
        order: { column: 'sort_order', ascending: true },
      });
      setPlans(planData ?? []);

      const planMap: Record<string, string> = {};
      (planData ?? []).forEach((p) => (planMap[p.id] = p.name));

      const orgRow = orgData[0];
      setOrg({
        ...orgRow,
        plan_name: orgRow.plan_id ? planMap[orgRow.plan_id] || null : null,
      });

      // Fetch members
      const memberData = await adminQuery<Member>('organization_members', {
        select: 'id, user_id, role, is_active, created_at',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: true },
      });

      const membersWithEmails: Member[] = (memberData ?? []).map((m) => ({
        ...m,
        user_email: null,
      }));
      setMembers(membersWithEmails);

      // Fetch subscription
      const subData = await adminQuery<{
        id: string;
        status: string;
        billing_cycle: string;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        plan_id: string;
      }>('subscriptions', {
        select: 'id, status, billing_cycle, current_period_start, current_period_end, cancel_at_period_end, plan_id',
        eq: { org_id: orgId },
        limit: 1,
      });

      if (subData && subData.length > 0) {
        const sub = subData[0];
        setSubscription({
          id: sub.id,
          status: sub.status,
          billing_cycle: sub.billing_cycle,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: sub.cancel_at_period_end,
          plan_name: sub.plan_id ? planMap[sub.plan_id] || null : null,
        });
      } else {
        setSubscription(null);
      }

      // Fetch usage stats
      const [rfqsCount, suppliersCount, posCount, offersCount] = await Promise.all([
        adminCount('rfqs', { org_id: orgId }),
        adminCount('suppliers', { org_id: orgId }),
        adminCount('purchase_orders', { org_id: orgId }),
        adminCount('offers', { org_id: orgId }),
      ]);

      setUsage({
        rfqsCount: rfqsCount || 0,
        suppliersCount: suppliersCount || 0,
        posCount: posCount || 0,
        offersCount: offersCount || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSuspendToggle = async () => {
    if (!org) return;
    setActionLoading(true);
    try {
      const newStatus = org.status === 'suspended' ? 'active' : 'suspended';
      await adminUpdate('organizations', { status: newStatus, updated_at: new Date().toISOString() }, { id: org.id });
      setOrg({ ...org, status: newStatus });
      setSuspendDialog(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update organization');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!org || !selectedPlan) return;
    setPlanLoading(true);
    try {
      await adminUpdate('organizations', { plan_id: selectedPlan, updated_at: new Date().toISOString() }, { id: org.id });

      const existingSubs = await adminQuery<{ id: string }>('subscriptions', {
        select: 'id',
        eq: { org_id: org.id },
        limit: 1,
      });

      if (existingSubs && existingSubs.length > 0) {
        await adminUpdate('subscriptions', { plan_id: selectedPlan, updated_at: new Date().toISOString() }, { id: existingSubs[0].id });
      } else {
        await adminInsert('subscriptions', {
          org_id: org.id,
          plan_id: selectedPlan,
          status: 'active',
          billing_cycle: 'monthly',
        } as any);
      }

      const planName = plans.find((p) => p.id === selectedPlan)?.name || null;
      setOrg({ ...org, plan_name: planName, plan_id: selectedPlan });
      setPlanDialog(false);
      setSelectedPlan('');
      // Refresh subscription data
      fetchAll();
    } catch (err: any) {
      alert(err.message || 'Failed to change plan');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!org) return;
    setActionLoading(true);
    try {
      const existingSubs = await adminQuery<{ id: string }>('subscriptions', {
        select: 'id',
        eq: { org_id: org.id },
        limit: 1,
      });

      if (existingSubs && existingSubs.length > 0) {
        await adminUpdate('subscriptions', {
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        }, { id: existingSubs[0].id });
      }
      setCancelSubDialog(false);
      fetchAll();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
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

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-32 w-full mb-6" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => router.push('/admin/organizations')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Organizations
        </Button>
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {error || 'Organization not found'}
        </div>
      </div>
    );
  }

  const usageCards = [
    { label: 'RFQs', value: usage?.rfqsCount ?? 0, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Suppliers', value: usage?.suppliersCount ?? 0, icon: Building2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Purchase Orders', value: usage?.posCount ?? 0, icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Offers', value: usage?.offersCount ?? 0, icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Back link */}
      <Button variant="ghost" onClick={() => router.push('/admin/organizations')} className="mb-4 -ml-3">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Organizations
      </Button>

      {/* Org Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {getStatusBadge(org.status)}
              {org.plan_name && <Badge variant="outline">{org.plan_name} Plan</Badge>}
              <span className="text-sm text-muted-foreground">/{org.slug}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedPlan(org.plan_id || '');
              setPlanDialog(true);
            }}
          >
            <Package className="w-4 h-4 mr-2" />
            Change Plan
          </Button>
          <Button
            variant="outline"
            onClick={() => setSuspendDialog(true)}
            className={org.status === 'suspended' ? '' : 'text-destructive hover:text-destructive'}
          >
            {org.status === 'suspended' ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Activate
              </>
            ) : (
              <>
                <Ban className="w-4 h-4 mr-2" />
                Suspend
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {usageCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-11 h-11 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Organization Information</CardTitle>
              <CardDescription>Basic details about this organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Organization Name</p>
                  <p className="font-medium">{org.name}</p>
                </div>
                {org.name_ar && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Name (Arabic)</p>
                    <p className="font-medium" dir="rtl">{org.name_ar}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Slug</p>
                  <p className="font-medium font-mono">{org.slug}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div>{getStatusBadge(org.status)}</div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </p>
                  <p className="font-medium">{org.email}</p>
                </div>
                {org.phone && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Phone
                    </p>
                    <p className="font-medium">{org.phone}</p>
                  </div>
                )}
                {org.address && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{org.address}</p>
                  </div>
                )}
                {org.country && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" /> Country
                    </p>
                    <p className="font-medium">{org.country}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Created
                  </p>
                  <p className="font-medium">
                    {new Date(org.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                {org.trial_ends_at && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Trial Ends At</p>
                    <p className="font-medium">
                      {new Date(org.trial_ends_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Organization Members
              </CardTitle>
              <CardDescription>{members.length} member(s) in this organization</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No members in this organization</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {member.user_id.substring(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{member.role}</Badge>
                          </TableCell>
                          <TableCell>
                            {member.is_active ? (
                              <Badge className="bg-green-500 hover:bg-green-500">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(member.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Subscription Details
                  </CardTitle>
                  <CardDescription>Current billing and subscription status</CardDescription>
                </div>
                {subscription && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setCancelSubDialog(true)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel at Period End
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {subscription ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="font-medium text-lg">{subscription.plan_name || 'Unknown'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div>
                      <Badge className={
                        subscription.status === 'active' ? 'bg-green-500 hover:bg-green-500' : ''
                      }>
                        {subscription.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Billing Cycle</p>
                    <p className="font-medium capitalize">{subscription.billing_cycle}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Cancel at Period End</p>
                    <p className="font-medium">
                      {subscription.cancel_at_period_end ? 'Yes' : 'No'}
                    </p>
                  </div>
                  {subscription.current_period_start && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Period Start</p>
                      <p className="font-medium">
                        {new Date(subscription.current_period_start).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                  {subscription.current_period_end && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Period End</p>
                      <p className="font-medium">
                        {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm mb-4">
                    No active subscription for this organization
                  </p>
                  <Button onClick={() => { setSelectedPlan(org.plan_id || ''); setPlanDialog(true); }}>
                    <Package className="w-4 h-4 mr-2" />
                    Assign a Plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Suspend/Activate Dialog */}
      <AlertDialog open={suspendDialog} onOpenChange={setSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {org.status === 'suspended' ? 'Activate Organization' : 'Suspend Organization'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {org.status === 'suspended'
                ? `This will reactivate "${org.name}" and restore access for all its members.`
                : `This will suspend "${org.name}". All members will lose access to the platform.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspendToggle}
              disabled={actionLoading}
              className={org.status === 'suspended' ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : org.status === 'suspended' ? 'Activate' : 'Suspend'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Plan Dialog */}
      <Dialog open={planDialog} onOpenChange={(open) => { if (!open) { setPlanDialog(false); setSelectedPlan(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan for {org.name}</DialogTitle>
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
            <Button variant="outline" onClick={() => { setPlanDialog(false); setSelectedPlan(''); }}>
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

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={cancelSubDialog} onOpenChange={setCancelSubDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription at Period End</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the subscription for &quot;{org.name}&quot; to be canceled at the end of the current billing period. The organization will retain access until then.
          </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Keep Active</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
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
    </div>
  );
}
