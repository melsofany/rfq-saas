'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataInsert, dataUpdate } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, AlertCircle, CheckCircle2, Building2, CreditCard, Check } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JPY', 'CNY', 'INR'];

interface CompanySettings {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_number: string | null;
  currency: string;
}

interface SubscriptionInfo {
  plan_name: string;
  status: string;
  billing_cycle: string;
  current_period_end: string | null;
  max_employees: number;
  max_suppliers: number;
  max_rfqs_per_month: number;
}

export default function SettingsPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name_en: '',
    name_ar: '',
    logo_url: '',
    address: '',
    phone: '',
    email: '',
    tax_number: '',
    currency: 'USD',
  });

  const fetchSettings = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const settingsData = await dataQuery<CompanySettings>('company_settings', {
        select: '*',
        eq: { org_id: orgId },
        limit: 1,
      });

      if (settingsData && settingsData.length > 0) {
        const settingsRow = settingsData[0];
        setSettings(settingsRow);
        setFormData({
          name_en: settingsRow.name_en ?? '',
          name_ar: settingsRow.name_ar ?? '',
          logo_url: settingsRow.logo_url ?? '',
          address: settingsRow.address ?? '',
          phone: settingsRow.phone ?? '',
          email: settingsRow.email ?? '',
          tax_number: settingsRow.tax_number ?? '',
          currency: settingsRow.currency ?? 'USD',
        });
      }

      // Fetch subscription info
      const subData = await dataQuery<{
        status: string;
        billing_cycle: string;
        current_period_end: string | null;
      }>('subscriptions', {
        select: 'status, billing_cycle, current_period_end, plan_id',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
        limit: 1,
      });

      if (subData && subData.length > 0) {
        const sub = subData[0] as any;

        // Fetch plan details
        let planName = 'Free';
        let maxEmployees = 0;
        let maxSuppliers = 0;
        let maxRfqsPerMonth = 0;

        if (sub.plan_id) {
          const planData = await dataQuery<{
            name: string;
            max_employees: number;
            max_suppliers: number;
            max_rfqs_per_month: number;
          }>('subscription_plans', {
            select: 'name, max_employees, max_suppliers, max_rfqs_per_month',
            eq: { id: sub.plan_id },
            limit: 1,
          });

          if (planData && planData.length > 0) {
            planName = planData[0].name;
            maxEmployees = planData[0].max_employees;
            maxSuppliers = planData[0].max_suppliers;
            maxRfqsPerMonth = planData[0].max_rfqs_per_month;
          }
        }

        setSubscription({
          plan_name: planName,
          status: sub.status,
          billing_cycle: sub.billing_cycle,
          current_period_end: sub.current_period_end,
          max_employees: maxEmployees,
          max_suppliers: maxSuppliers,
          max_rfqs_per_month: maxRfqsPerMonth,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!orgId) return;
    setError('');
    setSuccess(false);
    setSaving(true);

    try {
      const payload = {
        org_id: orgId,
        name_en: formData.name_en || null,
        name_ar: formData.name_ar || null,
        logo_url: formData.logo_url || null,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        tax_number: formData.tax_number || null,
        currency: formData.currency,
      };

      if (settings) {
        // Update existing
        await dataUpdate('company_settings', payload, { id: settings.id, org_id: orgId });
      } else {
        // Insert new
        await dataInsert('company_settings', payload);
      }

      // Log to audit
      await dataInsert('audit_log', {
        org_id: orgId,
        action: 'update',
        entity_type: 'settings',
        description: 'Updated company settings',
      } as any);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      fetchSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !orgId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your organization settings and subscription
        </p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="company">
            <Building2 className="w-4 h-4 mr-2" />
            Company
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <CreditCard className="w-4 h-4 mr-2" />
            Subscription
          </TabsTrigger>
        </TabsList>

        {/* Company Settings Tab */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Information</CardTitle>
              <CardDescription>
                Update your company details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name_en">Company Name (English)</Label>
                      <Input
                        id="name_en"
                        value={formData.name_en}
                        onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                        placeholder="Acme Corporation"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="name_ar">Company Name (Arabic)</Label>
                      <Input
                        id="name_ar"
                        value={formData.name_ar}
                        onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                        placeholder="شركة أكم"
                        dir="rtl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="logo_url">Logo URL</Label>
                    <Input
                      id="logo_url"
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="123 Main St, City, State, ZIP"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contact@company.com"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="tax_number">Tax Number</Label>
                      <Input
                        id="tax_number"
                        value={formData.tax_number}
                        onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                        placeholder="TAX-123456789"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(value) => setFormData({ ...formData, currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((curr) => (
                            <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-lg">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-4 py-3 rounded-lg">
                      <CheckCircle2 size={16} />
                      Settings saved successfully!
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subscription Information</CardTitle>
              <CardDescription>
                View your current plan and usage limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              ) : subscription ? (
                <div className="space-y-6">
                  {/* Current Plan */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Plan</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                          {subscription.status}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-foreground mt-1 capitalize">
                        {subscription.plan_name}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 capitalize">
                        {subscription.billing_cycle} billing
                      </p>
                    </div>
                    <CreditCard className="w-10 h-10 text-primary/40" />
                  </div>

                  {/* Plan Limits */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Plan Limits</h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="p-4 rounded-lg border border-border bg-card">
                        <p className="text-xs text-muted-foreground">Max Employees</p>
                        <p className="text-xl font-bold text-foreground mt-1">
                          {subscription.max_employees === 0 ? 'Unlimited' : subscription.max_employees}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border border-border bg-card">
                        <p className="text-xs text-muted-foreground">Max Suppliers</p>
                        <p className="text-xl font-bold text-foreground mt-1">
                          {subscription.max_suppliers === 0 ? 'Unlimited' : subscription.max_suppliers}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border border-border bg-card">
                        <p className="text-xs text-muted-foreground">RFQs / Month</p>
                        <p className="text-xl font-bold text-foreground mt-1">
                          {subscription.max_rfqs_per_month === 0 ? 'Unlimited' : subscription.max_rfqs_per_month}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Billing Period */}
                  {subscription.current_period_end && (
                    <div className="p-4 rounded-lg border border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground">Current Period Ends</p>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {new Date(subscription.current_period_end).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button variant="outline">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Manage Subscription
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium text-foreground">No active subscription</p>
                  <p className="text-xs mt-1">Subscribe to a plan to unlock features</p>
                  <Button className="mt-4">
                    View Plans
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
