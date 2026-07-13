'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataInsert, dataUpdate, dataDelete } from '@/lib/org-data';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Save, AlertCircle, CheckCircle2, Building2, CreditCard,
  Upload, X, ImageIcon, Shield, MessageSquare, Plus, Trash2,
  Eye, EyeOff, Mail, Pencil,
} from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'EGP', 'JPY', 'CNY', 'INR'];
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

interface OrgIntegrations {
  id: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  whatsapp_token: string | null;
  whatsapp_verify_token: string | null;
  whatsapp_phone_number: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  whatsapp_app_secret: string | null;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
}

interface TemplateForm {
  id?: string;
  name: string;
  body: string;
}

function SecretInput({
  id, value, onChange, placeholder,
}: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
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

  // ── Integrations state ──
  const [integrations, setIntegrations] = useState<OrgIntegrations | null>(null);
  const [intForm, setIntForm] = useState({
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_pass: '',
    whatsapp_token: '',
    whatsapp_verify_token: '',
    whatsapp_phone_number: '',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    whatsapp_app_secret: '',
  });
  const [intSaving, setIntSaving] = useState(false);
  const [intError, setIntError] = useState('');
  const [intSuccess, setIntSuccess] = useState(false);

  // ── WhatsApp Templates state ──
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateForm, setTemplateForm] = useState<TemplateForm>({ name: '', body: '' });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── Fetch company settings ── */
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
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  /* ── Fetch integrations ── */
  const fetchIntegrations = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await dataQuery<OrgIntegrations>('org_integrations', {
        select: '*',
        eq: { org_id: orgId },
        limit: 1,
      });
      if (data && data.length > 0) {
        const int = data[0];
        setIntegrations(int);
        setIntForm({
          smtp_host: int.smtp_host ?? '',
          smtp_port: int.smtp_port != null ? String(int.smtp_port) : '',
          smtp_user: int.smtp_user ?? '',
          smtp_pass: int.smtp_pass ?? '',
          whatsapp_token: int.whatsapp_token ?? '',
          whatsapp_verify_token: int.whatsapp_verify_token ?? '',
          whatsapp_phone_number: int.whatsapp_phone_number ?? '',
          whatsapp_phone_number_id: int.whatsapp_phone_number_id ?? '',
          whatsapp_business_account_id: int.whatsapp_business_account_id ?? '',
          whatsapp_app_secret: int.whatsapp_app_secret ?? '',
        });
      }
    } catch {
      // table may not exist yet — silently ignore
    }
  }, [orgId]);

  /* ── Fetch templates ── */
  const fetchTemplates = useCallback(async () => {
    if (!orgId) return;
    setTemplatesLoading(true);
    try {
      const data = await dataQuery<WhatsAppTemplate>('whatsapp_templates', {
        select: '*',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: true },
      });
      setTemplates(data ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

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

  /* ── Save company settings ── */
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

  /* ── Save integrations ── */
  const handleIntSave = async () => {
    if (!orgId) return;
    setIntError('');
    setIntSuccess(false);
    setIntSaving(true);
    try {
      const payload = {
        org_id: orgId,
        smtp_host: intForm.smtp_host || null,
        smtp_port: intForm.smtp_port ? parseInt(intForm.smtp_port, 10) : null,
        smtp_user: intForm.smtp_user || null,
        smtp_pass: intForm.smtp_pass || null,
        whatsapp_token: intForm.whatsapp_token || null,
        whatsapp_verify_token: intForm.whatsapp_verify_token || null,
        whatsapp_phone_number: intForm.whatsapp_phone_number || null,
        whatsapp_phone_number_id: intForm.whatsapp_phone_number_id || null,
        whatsapp_business_account_id: intForm.whatsapp_business_account_id || null,
        whatsapp_app_secret: intForm.whatsapp_app_secret || null,
        updated_at: new Date().toISOString(),
      };
      if (integrations) {
        await dataUpdate('org_integrations', payload, { id: integrations.id, org_id: orgId });
      } else {
        await dataInsert('org_integrations', payload);
      }
      await dataInsert('audit_log', {
        org_id: orgId,
        action: 'update',
        entity_type: 'integrations',
        description: 'Updated sensitive integrations settings',
      } as any);
      setIntSuccess(true);
      setTimeout(() => setIntSuccess(false), 3000);
      fetchIntegrations();
    } catch (err: any) {
      setIntError(err.message || 'Failed to save integrations');
    } finally {
      setIntSaving(false);
    }
  };

  /* ── Template CRUD ── */
  const openNewTemplate = () => {
    setEditingTemplateId(null);
    setTemplateForm({ name: '', body: '' });
    setTemplateError('');
    setShowTemplateForm(true);
  };

  const openEditTemplate = (t: WhatsAppTemplate) => {
    setEditingTemplateId(t.id);
    setTemplateForm({ name: t.name, body: t.body });
    setTemplateError('');
    setShowTemplateForm(true);
  };

  const cancelTemplateForm = () => {
    setShowTemplateForm(false);
    setEditingTemplateId(null);
    setTemplateForm({ name: '', body: '' });
    setTemplateError('');
  };

  const handleTemplateSave = async () => {
    if (!orgId) return;
    if (!templateForm.name.trim()) { setTemplateError('Template name is required'); return; }
    if (!templateForm.body.trim()) { setTemplateError('Template body is required'); return; }
    setTemplateError('');
    setTemplateSaving(true);
    try {
      if (editingTemplateId) {
        await dataUpdate('whatsapp_templates', {
          name: templateForm.name.trim(),
          body: templateForm.body.trim(),
          updated_at: new Date().toISOString(),
        }, { id: editingTemplateId, org_id: orgId });
      } else {
        await dataInsert('whatsapp_templates', {
          org_id: orgId,
          name: templateForm.name.trim(),
          body: templateForm.body.trim(),
        });
      }
      cancelTemplateForm();
      fetchTemplates();
    } catch (err: any) {
      setTemplateError(err.message || 'Failed to save template');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleTemplateDelete = async (id: string) => {
    if (!orgId) return;
    setDeletingId(id);
    try {
      await dataDelete('whatsapp_templates', { id, org_id: orgId });
      fetchTemplates();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
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
          <TabsTrigger value="sensitive">
            <Shield className="w-4 h-4 mr-2" />
            Sensitive Data
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
              <CardDescription>Update your company profile and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : (
                <>
                  {error && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-lg mb-4">
                      <AlertCircle size={16} /> {error}
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Names */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="name_en">Company Name (English)</Label>
                        <Input
                          id="name_en"
                          value={formData.name_en}
                          onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                          placeholder="Acme Corp"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="name_ar">Company Name (Arabic)</Label>
                        <Input
                          id="name_ar"
                          value={formData.name_ar}
                          onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                          placeholder="شركة أكمي"
                          dir="rtl"
                        />
                      </div>
                    </div>

                    {/* Logo */}
                    <div className="space-y-2">
                      <Label>Company Logo</Label>
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden flex-shrink-0">
                          {logoPreview ? (
                            <img
                              src={logoPreview}
                              alt="Logo preview"
                              className="w-full h-full object-contain"
                              onError={() => setLogoPreview('')}
                            />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoFile}
                          />
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={logoUploading}
                            >
                              {logoUploading ? (
                                <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4 mr-2" />
                              )}
                              {logoUploading ? 'Loading...' : 'Upload Logo'}
                            </Button>
                            {logoPreview && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={removeLogo}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Remove
                              </Button>
                            )}
                          </div>
                          {logoError && (
                            <p className="text-xs text-destructive">{logoError}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG, SVG — max {MAX_LOGO_SIZE_MB} MB
                          </p>
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
                        placeholder="123 Main St, City, Country"
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
                        <Label htmlFor="commercial_registration">Commercial Registration</Label>
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
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((curr) => (
                            <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {success && (
                    <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-4 py-3 rounded-lg mt-6">
                      <CheckCircle2 size={16} /> Settings saved successfully!
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
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

        {/* ── Sensitive Data Tab ── */}
        <TabsContent value="sensitive">
          <div className="space-y-6">

            {/* SMTP Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  SMTP Configuration
                </CardTitle>
                <CardDescription>Email server settings for sending notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="smtp_host">SMTP_HOST</Label>
                    <Input
                      id="smtp_host"
                      value={intForm.smtp_host}
                      onChange={(e) => setIntForm({ ...intForm, smtp_host: e.target.value })}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="smtp_port">SMTP_PORT</Label>
                    <Input
                      id="smtp_port"
                      type="number"
                      value={intForm.smtp_port}
                      onChange={(e) => setIntForm({ ...intForm, smtp_port: e.target.value })}
                      placeholder="587"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="smtp_user">SMTP_USER</Label>
                    <Input
                      id="smtp_user"
                      value={intForm.smtp_user}
                      onChange={(e) => setIntForm({ ...intForm, smtp_user: e.target.value })}
                      placeholder="user@gmail.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="smtp_pass">SMTP_PASS</Label>
                    <SecretInput
                      id="smtp_pass"
                      value={intForm.smtp_pass}
                      onChange={(v) => setIntForm({ ...intForm, smtp_pass: v })}
                      placeholder="••••••••••••"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  WhatsApp Business Configuration
                </CardTitle>
                <CardDescription>WhatsApp Business API credentials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="whatsapp_phone_number">WHATSAPP_PHONE_NUMBER</Label>
                    <Input
                      id="whatsapp_phone_number"
                      value={intForm.whatsapp_phone_number}
                      onChange={(e) => setIntForm({ ...intForm, whatsapp_phone_number: e.target.value })}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="whatsapp_phone_number_id">WHATSAPP_PHONE_NUMBER_ID</Label>
                    <Input
                      id="whatsapp_phone_number_id"
                      value={intForm.whatsapp_phone_number_id}
                      onChange={(e) => setIntForm({ ...intForm, whatsapp_phone_number_id: e.target.value })}
                      placeholder="123456789012345"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="whatsapp_business_account_id">WHATSAPP_BUSINESS_ACCOUNT_ID</Label>
                    <Input
                      id="whatsapp_business_account_id"
                      value={intForm.whatsapp_business_account_id}
                      onChange={(e) => setIntForm({ ...intForm, whatsapp_business_account_id: e.target.value })}
                      placeholder="123456789012345"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="whatsapp_verify_token">WHATSAPP_VERIFY_TOKEN</Label>
                    <SecretInput
                      id="whatsapp_verify_token"
                      value={intForm.whatsapp_verify_token}
                      onChange={(v) => setIntForm({ ...intForm, whatsapp_verify_token: v })}
                      placeholder="your_verify_token"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="whatsapp_token">WHATSAPP_TOKEN</Label>
                    <SecretInput
                      id="whatsapp_token"
                      value={intForm.whatsapp_token}
                      onChange={(v) => setIntForm({ ...intForm, whatsapp_token: v })}
                      placeholder="EAAxxxxxxxxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="whatsapp_app_secret">WHATSAPP_APP_SECRET</Label>
                    <SecretInput
                      id="whatsapp_app_secret"
                      value={intForm.whatsapp_app_secret}
                      onChange={(v) => setIntForm({ ...intForm, whatsapp_app_secret: v })}
                      placeholder="••••••••••••••••"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save integrations */}
            <div className="flex flex-col gap-3">
              {intError && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-lg">
                  <AlertCircle size={16} /> {intError}
                </div>
              )}
              {intSuccess && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-4 py-3 rounded-lg">
                  <CheckCircle2 size={16} /> Integrations saved successfully!
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleIntSave} disabled={intSaving}>
                  {intSaving ? (
                    <><div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Saving...</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Save Integrations</>
                  )}
                </Button>
              </div>
            </div>

            {/* WhatsApp Templates */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-green-600" />
                      WhatsApp Templates
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Manage reusable message templates for WhatsApp
                    </CardDescription>
                  </div>
                  {!showTemplateForm && (
                    <Button size="sm" onClick={openNewTemplate}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Template
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Template form */}
                {showTemplateForm && (
                  <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      {editingTemplateId ? 'Edit Template' : 'New Template'}
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="tpl_name">Template Name</Label>
                      <Input
                        id="tpl_name"
                        value={templateForm.name}
                        onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                        placeholder="e.g. RFQ Notification"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tpl_body">Template Body</Label>
                      <Textarea
                        id="tpl_body"
                        value={templateForm.body}
                        onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                        placeholder="Hello {{name}}, your RFQ #{{rfq_id}} has been received..."
                        rows={4}
                        className="resize-y"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use {'{{variable}}'} for dynamic values
                      </p>
                    </div>
                    {templateError && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle size={14} /> {templateError}
                      </p>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={cancelTemplateForm}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleTemplateSave} disabled={templateSaving}>
                        {templateSaving ? (
                          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        ) : editingTemplateId ? 'Update' : 'Save Template'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Template list */}
                {templatesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : templates.length === 0 && !showTemplateForm ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm font-medium text-foreground">No templates yet</p>
                    <p className="text-xs mt-1">Click "Add Template" to create your first WhatsApp template</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{t.name}</p>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words line-clamp-3">
                            {t.body}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditTemplate(t)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleTemplateDelete(t.id)}
                            disabled={deletingId === t.id}
                          >
                            {deletingId === t.id ? (
                              <div className="w-3 h-3 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!showTemplateForm && templates.length > 0 && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" size="sm" onClick={openNewTemplate}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Another Template
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
