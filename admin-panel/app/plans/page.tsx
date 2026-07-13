'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Inbox,
  Check,
  X,
} from 'lucide-react';
import { adminQuery, adminInsert, adminUpdate, adminDelete } from '@/lib/admin-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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

interface Plan {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_employees: number;
  max_suppliers: number;
  max_rfqs_per_month: number;
  max_purchase_orders: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

interface PlanFormState {
  name: string;
  name_ar: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  max_employees: string;
  max_suppliers: string;
  max_rfqs_per_month: string;
  max_purchase_orders: string;
  features: string;
  is_active: boolean;
  sort_order: string;
}

const EMPTY_FORM: PlanFormState = {
  name: '',
  name_ar: '',
  description: '',
  price_monthly: '0',
  price_yearly: '0',
  max_employees: '0',
  max_suppliers: '0',
  max_rfqs_per_month: '0',
  max_purchase_orders: '0',
  features: '',
  is_active: true,
  sort_order: '0',
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Create/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);

  // Delete AlertDialog
  const [deletePlan, setDeletePlan] = useState<Plan | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminQuery<Plan>('subscription_plans', {
        select: '*',
        order: { column: 'sort_order', ascending: true },
      });

      setPlans(data ?? []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Fetch plans error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openCreate = () => {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      name_ar: plan.name_ar ?? '',
      description: plan.description ?? '',
      price_monthly: String(plan.price_monthly),
      price_yearly: String(plan.price_yearly),
      max_employees: String(plan.max_employees),
      max_suppliers: String(plan.max_suppliers),
      max_rfqs_per_month: String(plan.max_rfqs_per_month),
      max_purchase_orders: String(plan.max_purchase_orders),
      features: plan.features.join(', '),
      is_active: plan.is_active,
      sort_order: String(plan.sort_order),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setActionLoading(true);
    try {
      const featuresArray = form.features
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      const payload = {
        name: form.name,
        name_ar: form.name_ar || undefined,
        description: form.description || undefined,
        price_monthly: parseFloat(form.price_monthly) || 0,
        price_yearly: parseFloat(form.price_yearly) || 0,
        max_employees: parseInt(form.max_employees) || 0,
        max_suppliers: parseInt(form.max_suppliers) || 0,
        max_rfqs_per_month: parseInt(form.max_rfqs_per_month) || 0,
        max_purchase_orders: parseInt(form.max_purchase_orders) || 0,
        features: featuresArray,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order) || 0,
      };

      if (editingPlan) {
        await adminUpdate('subscription_plans', payload, { id: editingPlan.id });
      } else {
        await adminInsert('subscription_plans', payload);
      }

      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingPlan(null);
      await fetchPlans();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Save plan error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePlan) return;
    setActionLoading(true);
    try {
      await adminDelete('subscription_plans', { id: deletePlan.id });
      setDeletePlan(null);
      await fetchPlans();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Delete plan error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Manage subscription plans available on the platform
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Plan
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Plans</CardTitle>
          <CardDescription>{plans.length} plan(s) configured</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No plans yet</p>
                <p className="text-xs text-muted-foreground">
                  Create your first subscription plan
                </p>
              </div>
              <Button onClick={openCreate} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Plan
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Yearly</TableHead>
                  <TableHead className="text-center">Max Employees</TableHead>
                  <TableHead className="text-center">Max Suppliers</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Sort</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{plan.name}</p>
                          {plan.name_ar && (
                            <p className="text-xs text-muted-foreground">{plan.name_ar}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${plan.price_monthly.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      ${plan.price_yearly.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">{plan.max_employees}</TableCell>
                    <TableCell className="text-center">{plan.max_suppliers}</TableCell>
                    <TableCell className="text-center">
                      {plan.is_active ? (
                        <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                          <Check className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          <X className="mr-1 h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {plan.sort_order}
                    </TableCell>
                    <TableCell>
                      {plan.features.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {plan.features.slice(0, 3).map((f, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {f}
                            </Badge>
                          ))}
                          {plan.features.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{plan.features.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(plan)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletePlan(plan)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan
                ? 'Update the plan details below'
                : 'Fill in the details for the new subscription plan'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Pro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_ar">Name (Arabic)</Label>
              <Input
                id="name_ar"
                value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                placeholder="احترافي"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Plan description…"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_monthly">Price Monthly ($)</Label>
              <Input
                id="price_monthly"
                type="number"
                value={form.price_monthly}
                onChange={(e) => setForm({ ...form, price_monthly: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_yearly">Price Yearly ($)</Label>
              <Input
                id="price_yearly"
                type="number"
                value={form.price_yearly}
                onChange={(e) => setForm({ ...form, price_yearly: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_employees">Max Employees</Label>
              <Input
                id="max_employees"
                type="number"
                value={form.max_employees}
                onChange={(e) => setForm({ ...form, max_employees: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_suppliers">Max Suppliers</Label>
              <Input
                id="max_suppliers"
                type="number"
                value={form.max_suppliers}
                onChange={(e) => setForm({ ...form, max_suppliers: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_rfqs_per_month">Max RFQs / Month</Label>
              <Input
                id="max_rfqs_per_month"
                type="number"
                value={form.max_rfqs_per_month}
                onChange={(e) => setForm({ ...form, max_rfqs_per_month: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_purchase_orders">Max Purchase Orders</Label>
              <Input
                id="max_purchase_orders"
                type="number"
                value={form.max_purchase_orders}
                onChange={(e) => setForm({ ...form, max_purchase_orders: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="features">Features (comma-separated)</Label>
              <Textarea
                id="features"
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                placeholder="Unlimited RFQs, Priority Support, Custom Branding"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Separate each feature with a comma
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={actionLoading || !form.name}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingPlan ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deletePlan} onOpenChange={(open) => !open && setDeletePlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletePlan?.name}</strong>? This
              action cannot be undone. Organizations on this plan will need to be
              reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
