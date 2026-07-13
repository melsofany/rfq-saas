'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminQuery, adminInsert, adminUpdate, adminDelete } from '@/lib/admin-data-client';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Plus, Pencil, Trash2, Loader2, Check, X } from 'lucide-react';

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
  created_at: string;
  updated_at: string;
}

interface PlanFormData {
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

const emptyForm: PlanFormData = {
  name: '',
  name_ar: '',
  description: '',
  price_monthly: '0',
  price_yearly: '0',
  max_employees: '5',
  max_suppliers: '50',
  max_rfqs_per_month: '100',
  max_purchase_orders: '50',
  features: '',
  is_active: true,
  sort_order: '0',
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete dialog
  const [deletePlan, setDeletePlan] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminQuery<Plan>('subscription_plans', {
        select: '*',
        order: { column: 'sort_order', ascending: true },
      });
      setPlans((data || []) as unknown as Plan[]);
    } catch (err: any) {
      console.error('Failed to fetch plans:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openCreateDialog = () => {
    setEditingPlan(null);
    setFormData(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      name_ar: plan.name_ar || '',
      description: plan.description || '',
      price_monthly: String(plan.price_monthly),
      price_yearly: String(plan.price_yearly),
      max_employees: String(plan.max_employees),
      max_suppliers: String(plan.max_suppliers),
      max_rfqs_per_month: String(plan.max_rfqs_per_month),
      max_purchase_orders: String(plan.max_purchase_orders),
      features: Array.isArray(plan.features) ? plan.features.join(', ') : '',
      is_active: plan.is_active,
      sort_order: String(plan.sort_order),
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);

    // Validate
    if (!formData.name.trim()) {
      setFormError('Plan name is required');
      return;
    }

    const featuresArray = formData.features
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const payload = {
      name: formData.name.trim(),
      name_ar: formData.name_ar.trim() || null,
      description: formData.description.trim() || null,
      price_monthly: parseFloat(formData.price_monthly) || 0,
      price_yearly: parseFloat(formData.price_yearly) || 0,
      max_employees: parseInt(formData.max_employees) || 0,
      max_suppliers: parseInt(formData.max_suppliers) || 0,
      max_rfqs_per_month: parseInt(formData.max_rfqs_per_month) || 0,
      max_purchase_orders: parseInt(formData.max_purchase_orders) || 0,
      features: featuresArray,
      is_active: formData.is_active,
      sort_order: parseInt(formData.sort_order) || 0,
    };

    setSaving(true);
    try {
      if (editingPlan) {
        // Update
        await adminUpdate('subscription_plans', { ...payload, updated_at: new Date().toISOString() } as any, { id: editingPlan.id });
      } else {
        // Create
        await adminInsert('subscription_plans', payload as any);
      }
      setDialogOpen(false);
      fetchPlans();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePlan) return;
    setDeleting(true);
    try {
      await adminDelete('subscription_plans', { id: deletePlan.id });
      setDeletePlan(null);
      fetchPlans();
    } catch (err: any) {
      alert(err.message || 'Failed to delete plan');
    } finally {
      setDeleting(false);
    }
  };

  const updateField = (key: keyof PlanFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage pricing plans for your platform
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            All Plans
            <Badge variant="secondary" className="ml-1">{plans.length}</Badge>
          </CardTitle>
          <CardDescription>Manage subscription tiers, pricing, and limits</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm mb-4">
                No subscription plans have been created yet
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Plan
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Monthly</TableHead>
                    <TableHead>Yearly</TableHead>
                    <TableHead className="text-center">Employees</TableHead>
                    <TableHead className="text-center">Suppliers</TableHead>
                    <TableHead className="text-center">RFQs/mo</TableHead>
                    <TableHead className="text-center">POs</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-center">Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{plan.name}</span>
                          {plan.name_ar && (
                            <span className="text-xs text-muted-foreground" dir="rtl">
                              {plan.name_ar}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${Number(plan.price_monthly).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${Number(plan.price_yearly).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">{plan.max_employees}</TableCell>
                      <TableCell className="text-center">{plan.max_suppliers}</TableCell>
                      <TableCell className="text-center">{plan.max_rfqs_per_month}</TableCell>
                      <TableCell className="text-center">{plan.max_purchase_orders}</TableCell>
                      <TableCell className="text-center">
                        {plan.is_active ? (
                          <Badge className="bg-green-500 hover:bg-green-500">
                            <Check className="w-3 h-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <X className="w-3 h-3 mr-1" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {plan.sort_order}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(plan)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletePlan(plan)}
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New Plan'}
            </DialogTitle>
            <DialogDescription>
              {editingPlan
                ? 'Update the details of this subscription plan'
                : 'Fill in the details to create a new subscription plan'}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
              {formError}
            </div>
          )}

          <div className="grid gap-4 py-2">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Pro"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name_ar">Name (Arabic)</Label>
                <Input
                  id="name_ar"
                  value={formData.name_ar}
                  onChange={(e) => updateField('name_ar', e.target.value)}
                  placeholder="e.g. احترافي"
                  dir="rtl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Brief description of the plan"
                rows={2}
              />
            </div>

            {/* Pricing */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="price_monthly">Monthly Price ($)</Label>
                <Input
                  id="price_monthly"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_monthly}
                  onChange={(e) => updateField('price_monthly', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price_yearly">Yearly Price ($)</Label>
                <Input
                  id="price_yearly"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_yearly}
                  onChange={(e) => updateField('price_yearly', e.target.value)}
                />
              </div>
            </div>

            {/* Limits */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="max_employees">Max Employees</Label>
                <Input
                  id="max_employees"
                  type="number"
                  min="0"
                  value={formData.max_employees}
                  onChange={(e) => updateField('max_employees', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_suppliers">Max Suppliers</Label>
                <Input
                  id="max_suppliers"
                  type="number"
                  min="0"
                  value={formData.max_suppliers}
                  onChange={(e) => updateField('max_suppliers', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_rfqs">Max RFQs/mo</Label>
                <Input
                  id="max_rfqs"
                  type="number"
                  min="0"
                  value={formData.max_rfqs_per_month}
                  onChange={(e) => updateField('max_rfqs_per_month', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_pos">Max POs</Label>
                <Input
                  id="max_pos"
                  type="number"
                  min="0"
                  value={formData.max_purchase_orders}
                  onChange={(e) => updateField('max_purchase_orders', e.target.value)}
                />
              </div>
            </div>

            {/* Features */}
            <div className="space-y-1.5">
              <Label htmlFor="features">Features (comma-separated)</Label>
              <Textarea
                id="features"
                value={formData.features}
                onChange={(e) => updateField('features', e.target.value)}
                placeholder="e.g. Dashboard, RFQ Management, Advanced Analytics, PDF Export"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Separate each feature with a comma. They will be stored as an array.
              </p>
            </div>

            {/* Active + Sort Order */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => updateField('is_active', checked)}
                />
                <Label>Plan is active and available for new subscriptions</Label>
              </div>
              <div className="w-32 space-y-1.5">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => updateField('sort_order', e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingPlan ? (
                'Save Changes'
              ) : (
                'Create Plan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePlan} onOpenChange={(open) => !open && setDeletePlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the &quot;{deletePlan?.name}&quot; plan? This action cannot be undone. Organizations currently on this plan will lose their plan reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Plan'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
