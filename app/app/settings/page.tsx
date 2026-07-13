'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import {
  Save, AlertCircle, CheckCircle2, Building2, CreditCard,
  Upload, X, ImageIcon,
} from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JPY', 'CNY', 'INR'];
const MAX_LOGO_SIZE_MB = 2;

interface CompanySettings {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_number: string | null;
  commercial_registration: string | null;
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
    commercial_registration: '',
    currency: 'USD',
  });

  // Logo upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoError, setLogoError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  /* ── Fetch ── */
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
        const s = settingsData[0];
        setSettings(s);
        setFormData({
          name_en: s.name_en ?? '',
          name_ar: s.name_ar ?? '',
          logo_url: s.logo_url ?? '',
          address: s.address ?? '',
          phone: s.phone ?? '',
          email: s.email ?? '',
          tax_number: s.tax_number ?? '',
          commercial_registration: s.commercial_registration ?? '',
          currency: s.currency ?? 'USD',
        });
        setLogoPreview(s.logo_url ?? '');
      }

      const subData = await dataQuery<{
        status: string;
        billing_cycle: string;
        current_period_end: string | null;
        plan_id: string | null;
      }>('subscriptions', {
        select: 'status, billing_cycle, current_period_end, plan_id',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
        limit: 1,
      });

      if (subData && subData.length > 0) {
        const sub = subData[0] as any;
        let planName = 'Free';
        let maxEmployees = 0, maxSuppliers = 0, maxRfqsPerMonth = 0;

        if (sub.plan_id) {
          const planData = await dataQuery<{
            name: string; max_employees: number; max_suppliers: number; max_rfqs_per_month: number;
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
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  /* ── Logo upload ── */
  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoError('Please upload an image file (PNG, JPG, SVG, etc.)');
      return;
    }
    if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
      setLogoError(`Image must be smaller than ${MAX_LOGO_SIZE_MB} MB`);
      return;
    }

    setLogoUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      setFormData((prev) => ({ ...prev, logo_url: dataUrl }));
      setLogoUploading(false);
    };
    reader.onerror = () => {
      setLogoError('Failed to read file');
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoPreview('');
    setFormData((prev) => ({ ...prev, logo_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Save ── */
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
        commercial_registration: formData.commercial_registration || null,
        currency: formData.currency,
      };

      if (settings) {
        await dataUpdate('company_settings', payload, { id: settings.id, org_id: orgId });
      } else {
        await dataInsert('company_settings', payload);
      }

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

  /* ── Guard ── */
  if (authLoading || !orgId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
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

        {/* ── Company Tab ── */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Information</CardTitle>
              <CardDescription>Update your company details and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : (
                <>
                  {/* Company Names */}
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

                  {/* Logo Upload */}
                  <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <div className="flex items-start gap-4">
                      {/* Preview */}
                      <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                        {logoPreview ? (
                          <>
                            <img
                              src={logoPreview}
                              alt="Company logo"
                              className="w-full h-full object-contain p-1"
                            />
                            <button
                              type="button"
                              onClick={removeLogo}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                        )}
                      </div>

                      {/* Upload controls */}
                      <div className="flex-1 space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoFile}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={logoUploading}
                        >
                          {logoUploading ? (
                            <><div className="w-3.5 h-3.5 mr-2 border-2 border-foreground border-t-transparent rounded-full animate-spin" />Loading...</>
                          ) : (
                            <><Upload className="w-3.5 h-3.5 mr-2" />Upload from device</>
                          )}
                        </Button>

                        {/* Or paste URL */}
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Or paste an image URL:</p>
                          <Input
                            value={logoPreview.startsWith('data:') ? '' : logoPreview}
                            onChange={(e) => {
                              const url = e.target.value;
                              setLogoPreview(url);
                              setFormData((prev) => ({ ...prev, logo_url: url }));
                            }}
                            placeholder="https://example.com/logo.png"
                            className="h-8 text-sm"
                          />
                        </div>

                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, SVG, WebP — max {MAX_LOGO_SIZE_MB} MB
                        </p>
                        {logoError && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {logoError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-1.5">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="123 Main St, City, State, ZIP"
                    />
                  </div>

                  {/* Phone & Email */}
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

                  {/* Tax Number & Commercial Registration */}
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
                      <Label htmlFor="commercial_registration">
                        Commercial Registration
                        <span className="mr-1 text-xs text-muted-foreground font-normal"> (السجل التجاري)</span>
                      </Label>
                      <Input
                        id="commercial_registration"
                        value={formData.commercial_registration}
                        onChange={(e) => setFormData({ ...formData, commercial_registration: e.target.value })}
                        placeholder="CR-1234567890"
                      />
                    </div>
                  </div>

                  {/* Currency */}
                  <div className="space-y-1.5 max-w-xs">
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

                  {error && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-lg">
                      <AlertCircle size={16} /> {error}
                    </div>
                  )}

                  {success && (
                    <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-4 py-3 rounded-lg">
                      <CheckCircle2 size={16} /> Settings saved successfully!
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <><div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Saving...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" />Save Changes</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Subscription Tab ── */}
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subscription Information</CardTitle>
              <CardDescription>View your current plan and usage limits</CardDescription>
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
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {subscription.billing_cycle} billing
                      </p>
                    </div>
                  </div>

                  {/* Usage Limits */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">Usage Limits</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-4 rounded-lg border border-border bg-card">
                        <p className="text-xs text-muted-foreground">Employees</p>
                        <p className="text-xl font-bold text-foreground mt-1">
                          {subscription.max_employees === 0 ? 'Unlimited' : subscription.max_employees}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border border-border bg-card">
                        <p className="text-xs text-muted-foreground">Suppliers</p>
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

                  {subscription.current_period_end && (
                    <div className="p-4 rounded-lg border border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground">Current Period Ends</p>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {new Date(subscription.current_period_end).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'long', day: 'numeric',
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
                  <Button className="mt-4">View Plans</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
