'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getAccessToken } from '@/lib/org-auth';
import { dataQuery } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare, Send, AlertCircle, CheckCircle2, Settings as SettingsIcon,
  Phone, ShieldCheck, ShieldAlert,
} from 'lucide-react';

interface WhatsAppStatus {
  configured: boolean;
  phone_number: string | null;
  phone_number_id: string | null;
  business_account_id: string | null;
  has_token: boolean;
  has_app_secret: boolean;
  has_verify_token: boolean;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
}

export default function WhatsAppPage() {
  const { orgId, isLoading: authLoading } = useAuth();

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);

  const [to, setTo] = useState('');
  const [mode, setMode] = useState<'text' | 'template'>('text');
  const [text, setText] = useState('');
  const [previewUrl, setPreviewUrl] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [languageCode, setLanguageCode] = useState('en_US');

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchStatus = useCallback(async () => {
    if (!orgId) return;
    setStatusLoading(true);
    try {
      const res = await fetch('/api/whatsapp/status', {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore */
    } finally {
      setStatusLoading(false);
    }
  }, [orgId]);

  const fetchTemplates = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await dataQuery<WhatsAppTemplate>('whatsapp_templates', {
        select: '*',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: true },
      });
      setTemplates(data ?? []);
    } catch {
      setTemplates([]);
    }
  }, [orgId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const selectedTemplate = templates.find((t) => t.name === templateName);

  const handleSend = async () => {
    setError('');
    setSuccess('');
    if (!to.trim()) { setError('Please enter a recipient phone number.'); return; }
    if (mode === 'text' && !text.trim()) { setError('Please enter a message.'); return; }
    if (mode === 'template' && !templateName) { setError('Please select a template.'); return; }

    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          to: to.trim(),
          type: mode,
          text: mode === 'text' ? text.trim() : undefined,
          preview_url: mode === 'text' ? previewUrl : undefined,
          template_name: mode === 'template' ? templateName : undefined,
          language_code: mode === 'template' ? languageCode.trim() || 'en_US' : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');
      setSuccess(`Message sent to ${to.trim()} successfully.`);
      if (mode === 'text') setText('');
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
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
    <div className="p-4 lg:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send messages through the WhatsApp Business Cloud API
          </p>
        </div>
      </div>

      {/* Connection status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {statusLoading ? (
              <ShieldAlert className="w-5 h-5 text-muted-foreground" />
            ) : status?.configured ? (
              <ShieldCheck className="w-5 h-5 text-green-600" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            )}
            Connection
          </CardTitle>
          <CardDescription>
            Credentials are read from Settings → Sensitive Data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <Skeleton className="h-16" />
          ) : status?.configured ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 size={16} /> WhatsApp Business API is connected
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-1">
                {status.phone_number && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone size={14} /> {status.phone_number}
                  </div>
                )}
                <div className="text-muted-foreground">
                  Phone Number ID: <span className="font-mono text-xs">{status.phone_number_id}</span>
                </div>
                <div className="text-muted-foreground">
                  App Secret: {status.has_app_secret ? 'set' : 'not set'}
                </div>
                <div className="text-muted-foreground">
                  Verify Token: {status.has_verify_token ? 'set' : 'not set'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle size={16} />
                WhatsApp is not configured yet. Add your token and phone number id first.
              </div>
              <Link href="/app/settings">
                <Button variant="outline" size="sm">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Open Settings
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send message */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Send a message</CardTitle>
          <CardDescription>Send a free-form text or a pre-approved template</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="wa_to">Recipient phone number</Label>
            <Input
              id="wa_to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="e.g. 20100xxxxxxx (international format)"
            />
            <p className="text-xs text-muted-foreground">
              Include the country code, without &apos;+&apos; or spaces.
            </p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as 'text' | 'template')}>
            <TabsList>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="template">Template</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="wa_text">Message</Label>
                <Textarea
                  id="wa_text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type your message..."
                  rows={5}
                  className="resize-y"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="wa_preview" checked={previewUrl} onCheckedChange={setPreviewUrl} />
                <Label htmlFor="wa_preview" className="text-sm font-normal">
                  Show link preview for URLs
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="template" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label>Template</Label>
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No templates yet. Add them in{' '}
                    <Link href="/app/settings" className="underline">Settings → Sensitive Data</Link>.
                  </p>
                ) : (
                  <Select value={templateName} onValueChange={setTemplateName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  The template name must match an approved template in your WhatsApp Business account.
                </p>
              </div>
              {selectedTemplate && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedTemplate.body}
                </div>
              )}
              <div className="space-y-1.5 max-w-xs">
                <Label htmlFor="wa_lang">Language code</Label>
                <Input
                  id="wa_lang"
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  placeholder="en_US"
                />
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-lg">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-4 py-3 rounded-lg">
              <CheckCircle2 size={16} /> {success}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSend} disabled={sending || !status?.configured}>
              {sending ? (
                <><div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Send Message</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
