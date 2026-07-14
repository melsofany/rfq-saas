'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from '@/lib/org-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageCircle, Search, Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  contact_wa_id: string;
  contact_name: string | null;
  last_message: string | null;
  direction: 'in' | 'out';
  status: string;
  last_message_at: string;
}

interface Message {
  id: string;
  contact_wa_id: string;
  contact_name: string | null;
  direction: 'in' | 'out';
  message_type: string;
  body: string | null;
  status: string;
  created_at: string;
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function StatusTick({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-sky-400" />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === 'sent') return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === 'failed') return <Clock className="w-3.5 h-3.5 text-destructive" />;
  return null;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeContact, setActiveContact] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [newContact, setNewContact] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/conversations', { headers: authHeaders() });
      if (res.ok) setConversations(await res.json());
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  const loadMessages = useCallback(async (contact: string) => {
    const res = await fetch(`/api/whatsapp/conversations?contact=${encodeURIComponent(contact)}`, {
      headers: authHeaders(),
    });
    if (res.ok) setMessages(await res.json());
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 8000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!activeContact) return;
    loadMessages(activeContact);
    const interval = setInterval(() => loadMessages(activeContact), 4000);
    return () => clearInterval(interval);
  }, [activeContact, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const to = activeContact || newContact.trim();
    if (!to || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ to, body: draft.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل إرسال الرسالة');
      }
      setDraft('');
      if (!activeContact) {
        setActiveContact(to);
        setNewContact('');
      }
      await Promise.all([loadMessages(to), loadConversations()]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const filteredConvos = conversations.filter((c) =>
    (c.contact_name || c.contact_wa_id).toLowerCase().includes(search.toLowerCase())
  );

  const activeMeta = conversations.find((c) => c.contact_wa_id === activeContact);

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-screen flex bg-[#efeae2] dark:bg-background">
      {/* ── Contacts / conversations list ── */}
      <div className="w-full sm:w-[380px] shrink-0 flex flex-col border-l border-border bg-card">
        <div className="h-16 shrink-0 flex items-center justify-between px-4 bg-muted/40 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-sm">واتساب بيزنس</span>
          </div>
        </div>

        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="بحث أو بدء محادثة جديدة"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9 bg-muted/40 border-0"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvos && (
            <p className="text-center text-sm text-muted-foreground p-6">جارِ التحميل...</p>
          )}
          {!loadingConvos && filteredConvos.length === 0 && (
            <p className="text-center text-sm text-muted-foreground p-6">
              لا توجد محادثات بعد. ابدأ محادثة جديدة برقم واتساب أدناه.
            </p>
          )}
          {filteredConvos.map((c) => (
            <button
              key={c.contact_wa_id}
              onClick={() => setActiveContact(c.contact_wa_id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 border-b border-border/60 text-right hover:bg-muted/50 transition-colors',
                activeContact === c.contact_wa_id && 'bg-muted'
              )}
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                {(c.contact_name || c.contact_wa_id).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{c.contact_name || c.contact_wa_id}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatTime(c.last_message_at)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                  {c.direction === 'out' && <StatusTick status={c.status} />}
                  <span className="truncate">{c.last_message}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-border shrink-0">
          <Input
            placeholder="رقم واتساب لمحادثة جديدة (مثال: 201234567890)"
            value={newContact}
            onChange={(e) => {
              setNewContact(e.target.value);
              setActiveContact(null);
            }}
            className="text-sm"
          />
        </div>
      </div>

      {/* ── Chat thread ── */}
      <div className="hidden sm:flex flex-1 flex-col">
        {!activeContact && !newContact ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageCircle className="w-16 h-16 opacity-30" />
            <p className="text-sm">اختر محادثة أو ابدأ واحدة جديدة برقم واتساب</p>
          </div>
        ) : (
          <>
            <div className="h-16 shrink-0 flex items-center gap-3 px-4 bg-muted/40 border-b border-border">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {(activeMeta?.contact_name || activeContact || newContact).slice(0, 1).toUpperCase()}
              </div>
              <span className="font-medium text-sm">
                {activeMeta?.contact_name || activeContact || newContact}
              </span>
            </div>

            <div
              className="flex-1 overflow-y-auto p-6 space-y-2"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)',
                backgroundSize: '20px 20px',
              }}
            >
              {activeContact &&
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn('flex', m.direction === 'out' ? 'justify-start' : 'justify-end')}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-lg px-3 py-2 shadow-sm text-sm',
                        m.direction === 'out'
                          ? 'bg-[#d9fdd3] dark:bg-primary/20 rounded-tl-none'
                          : 'bg-white dark:bg-muted rounded-tr-none'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-muted-foreground">{formatTime(m.created_at)}</span>
                        {m.direction === 'out' && <StatusTick status={m.status} />}
                      </div>
                    </div>
                  </div>
                ))}
              <div ref={bottomRef} />
            </div>

            {error && <p className="px-4 text-xs text-destructive">{error}</p>}

            <div className="p-3 border-t border-border bg-muted/30 shrink-0 flex items-center gap-2">
              <Input
                placeholder="اكتب رسالة"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1 bg-card"
              />
              <Button onClick={handleSend} disabled={sending || !draft.trim()} size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
