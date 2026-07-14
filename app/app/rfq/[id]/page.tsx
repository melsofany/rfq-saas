'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAccessToken } from '@/lib/org-auth';
import { dataQuery } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ArrowLeft, FileText, Package, Inbox, Calendar, User, Clock,
  Send, AlertCircle, CheckCircle2, XCircle, MessageCircle, Mail,
  Search as SearchIcon,
} from 'lucide-react';

interface RfqItem {
  id: string;
  description: string;
  part_no: string | null;
  qty: number | null;
  uom: string | null;
  reference_price: number | null;
}

interface Offer {
  id: string;
  total_price: number | null;
  status: string;
  created_at: string;
  general_notes: string | null;
  supplier_id: string;
  supplier_name?: string;
  supplier_email?: string | null;
}

interface Rfq {
  id: string;
  internal_rfq_no: string;
  customer_rfq_no: string;
  customer_rfq_date: string | null;
  required_response_date: string | null;
  status: string;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: string;
}

interface Category {
  id: string;
  name: string;
}

interface SentLogEntry {
  id: string;
  supplier_id: string;
  link_opened: boolean;
  open_count: number;
  offer_submitted: boolean;
  created_at: string;
  supplier_name?: string;
}

export default function RfqDetailPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [items, setItems] = useState<RfqItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // Send-to-suppliers state
  const [sendOpen, setSendOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [viaWhatsapp, setViaWhatsapp] = useState(true);
  const [viaEmail, setViaEmail] = useState(true);
  const [sendMessage, setSendMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendResults, setSendResults] = useState<any[] | null>(null);
  const [sentLog, setSentLog] = useState<SentLogEntry[]>([]);

  useEffect(() => {
    if (!orgId || !id) return;
    fetchRfqData();
    fetchSuppliersAndCategories();
    fetchSentLog();
  }, [orgId, id]);

  const fetchSuppliersAndCategories = useCallback(async () => {
    if (!orgId) return;
    try {
      const [supplierData, categoryData] = await Promise.all([
        dataQuery<Supplier>('suppliers', {
          select: 'id, name, email, phone, category',
          eq: { org_id: orgId, is_active: true },
          order: { column: 'name', ascending: true },
        }),
        dataQuery<Category>('supplier_categories', {
          select: 'id, name',
          eq: { org_id: orgId },
          order: { column: 'name', ascending: true },
        }),
      ]);
      setSuppliers(supplierData ?? []);
      setCategories(categoryData ?? []);
    } catch {
      /* ignore */
    }
  }, [orgId]);

  const fetchSentLog = useCallback(async () => {
    if (!orgId || !id) return;
    try {
      const logData = await dataQuery<SentLogEntry>('sent_log', {
        select: 'id, supplier_id, link_opened, open_count, offer_submitted, created_at',
        eq: { rfq_id: id, org_id: orgId },
        order: { column: 'created_at', ascending: false },
      });
      const supplierData = await dataQuery<{ id: string; name: string }>('suppliers', {
        select: 'id, name',
        eq: { org_id: orgId },
      });
      const nameMap: Record<string, string> = {};
      supplierData.forEach((s) => { nameMap[s.id] = s.name; });
      setSentLog((logData ?? []).map((l) => ({ ...l, supplier_name: nameMap[l.supplier_id] ?? 'Unknown' })));
    } catch {
      /* ignore */
    }
  }, [orgId, id]);

  const fetchRfqData = async () => {
    if (!orgId || !id) return;
    setLoading(true);
    try {
      const rfqData = await dataQuery<Rfq>('rfqs', {
        select: '*',
        eq: { id, org_id: orgId },
      });

      if (!rfqData || rfqData.length === 0) {
        router.push('/app/rfq');
        return;
      }
      setRfq(rfqData[0]);

      const itemsData = await dataQuery<RfqItem>('rfq_items', {
        select: 'id, description, part_no, qty, uom, reference_price',
        eq: { rfq_id: id, org_id: orgId },
        order: { column: 'created_at', ascending: true },
      });

      setItems(itemsData ?? []);

      const offersData = await dataQuery<Offer>('offers', {
        select: 'id, total_price, status, created_at, general_notes, supplier_id',
        eq: { rfq_id: id, org_id: orgId },
        order: { column: 'created_at', ascending: false },
      });

      // Fetch supplier names for offers
      const supplierIds = (offersData ?? [])
        .map((offer) => offer.supplier_id)
        .filter((sid): sid is string => sid !== null);

      let supplierMap: Record<string, { name: string; email: string | null }> = {};
      if (supplierIds.length > 0) {
        const suppliers = await dataQuery<{ id: string; name: string; email: string | null }>('suppliers', {
          select: 'id, name, email',
          eq: { org_id: orgId },
        });
        suppliers.forEach((s) => {
          supplierMap[s.id] = { name: s.name, email: s.email };
        });
      }

      const offersWithSuppliers = (offersData ?? []).map((offer) => ({
        ...offer,
        supplier_name: offer.supplier_id ? supplierMap[offer.supplier_id]?.name : undefined,
        supplier_email: offer.supplier_id ? supplierMap[offer.supplier_id]?.email : undefined,
      }));

      setOffers(offersWithSuppliers);
    } catch (error) {
      console.error('Error fetching RFQ:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(s.category);
    const matchesSearch = supplierSearch.trim() === '' || s.name.toLowerCase().includes(supplierSearch.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleCategoryFilter = (name: string) => {
    setCategoryFilters((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  };

  const toggleSupplier = (supplierId: string) => {
    setSelectedSupplierIds((prev) =>
      prev.includes(supplierId) ? prev.filter((sid) => sid !== supplierId) : [...prev, supplierId]
    );
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredSuppliers.map((s) => s.id);
    const allSelected = filteredIds.every((sid) => selectedSupplierIds.includes(sid));
    if (allSelected) {
      setSelectedSupplierIds((prev) => prev.filter((sid) => !filteredIds.includes(sid)));
    } else {
      setSelectedSupplierIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const openSendDialog = () => {
    setSendError('');
    setSendResults(null);
    setSelectedSupplierIds([]);
    setCategoryFilters([]);
    setSupplierSearch('');
    setSendMessage('');
    setSendOpen(true);
  };

  const handleSendToSuppliers = async () => {
    if (selectedSupplierIds.length === 0) {
      setSendError('Select at least one supplier');
      return;
    }
    if (!viaWhatsapp && !viaEmail) {
      setSendError('Select at least one channel (WhatsApp or Email)');
      return;
    }
    setSendError('');
    setSending(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/rfq/${id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          supplierIds: selectedSupplierIds,
          whatsapp: viaWhatsapp,
          email: viaEmail,
          message: sendMessage,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSendError(json.error || 'Failed to send');
        return;
      }
      setSendResults(json.results);
      await fetchRfqData();
      await fetchSentLog();
    } catch {
      setSendError('Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!rfq) {
    return null;
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/app/rfq')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{rfq.internal_rfq_no}</h1>
            <StatusBadge status={rfq.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Customer RFQ: {rfq.customer_rfq_no}</p>
        </div>
        <Button onClick={openSendDialog}>
          <Send className="w-4 h-4 mr-2" />
          Send to Suppliers
        </Button>
      </div>

      {/* Details Grid */}
      <div className="grid gap-6 sm:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Customer RFQ Date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {rfq.customer_rfq_date ? new Date(rfq.customer_rfq_date).toLocaleDateString() : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Required Response / Expiry Date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {rfq.required_response_date ? new Date(rfq.required_response_date).toLocaleDateString() : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="items">
            <Package className="w-4 h-4 mr-2" />
            Items ({items.length})
          </TabsTrigger>
          <TabsTrigger value="offers">
            <Inbox className="w-4 h-4 mr-2" />
            Offers ({offers.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Send className="w-4 h-4 mr-2" />
            Sent ({sentLog.length})
          </TabsTrigger>
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">RFQ Items</CardTitle>
              <CardDescription>Line items in this RFQ</CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">No items in this RFQ</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Part No</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right">Ref Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.part_no ?? '—'}</TableCell>
                        <TableCell className="text-right">{item.qty ?? '—'}</TableCell>
                        <TableCell>{item.uom ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          {item.reference_price != null
                            ? `$${item.reference_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offers Tab */}
        <TabsContent value="offers">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Offers Received</CardTitle>
              <CardDescription>Supplier responses to this RFQ</CardDescription>
            </CardHeader>
            <CardContent>
              {offers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Inbox className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">No offers received yet</p>
                  <p className="text-xs mt-1">Offers will appear here once suppliers respond</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {offers.map((offer) => (
                    <Card key={offer.id} className="border-border/60">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {offer.supplier_name ?? 'Unknown Supplier'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {offer.supplier_email ?? 'No email'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-lg font-bold text-foreground">
                                {offer.total_price != null
                                  ? `$${offer.total_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : '—'}
                              </p>
                              <p className="text-xs text-muted-foreground">Total Price</p>
                            </div>
                            <StatusBadge status={offer.status} />
                          </div>
                        </div>
                        {offer.general_notes && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs text-muted-foreground">{offer.general_notes}</p>
                          </div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground">
                          Submitted {new Date(offer.created_at).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Sent Tab */}
        <TabsContent value="sent">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sent to Suppliers</CardTitle>
              <CardDescription>Delivery and response tracking for this RFQ</CardDescription>
            </CardHeader>
            <CardContent>
              {sentLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Send className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">Not sent to any supplier yet</p>
                  <p className="text-xs mt-1">Use "Send to Suppliers" to reach out via WhatsApp or Email</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Link Opened</TableHead>
                      <TableHead>Offer Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentLog.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.supplier_name}</TableCell>
                        <TableCell>{new Date(entry.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          {entry.link_opened ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Opened ({entry.open_count})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <XCircle className="w-3.5 h-3.5" /> Not yet
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={entry.offer_submitted ? 'submitted' : 'pending'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notes */}
      {rfq.notes && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rfq.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Send to Suppliers Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send RFQ to Suppliers</DialogTitle>
            <DialogDescription>
              Filter by category, pick suppliers, and choose how to reach them.
            </DialogDescription>
          </DialogHeader>

          {sendResults ? (
            <div className="space-y-3">
              {sendResults.map((r) => (
                <div key={r.supplier_id} className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="text-sm font-medium">{r.supplier_name}</span>
                  <div className="flex items-center gap-3 text-xs">
                    {r.whatsapp && (
                      <span className={`inline-flex items-center gap-1 ${r.whatsapp.ok ? 'text-green-700' : 'text-destructive'}`}>
                        <MessageCircle className="w-3.5 h-3.5" /> {r.whatsapp.ok ? 'Sent' : r.whatsapp.error}
                      </span>
                    )}
                    {r.email && (
                      <span className={`inline-flex items-center gap-1 ${r.email.ok ? 'text-green-700' : 'text-destructive'}`}>
                        <Mail className="w-3.5 h-3.5" /> {r.email.ok ? 'Sent' : r.email.error}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <DialogFooter>
                <Button onClick={() => setSendOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Filter by Category (select any number)</label>
                <div className="flex flex-wrap gap-2">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No categories yet</p>
                  ) : (
                    categories.map((c) => {
                      const active = categoryFilters.includes(c.name);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCategoryFilter(c.name)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-muted-foreground border-border hover:bg-accent/40'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })
                  )}
                  {categoryFilters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCategoryFilters([])}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed text-muted-foreground hover:bg-accent/40"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Search Suppliers by Name</label>
                <div className="relative">
                  <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    placeholder="Type a supplier name..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Suppliers ({selectedSupplierIds.length} selected)</label>
                  <Button type="button" variant="ghost" size="sm" onClick={toggleSelectAllFiltered}>
                    Select all shown
                  </Button>
                </div>
                <div className="border rounded-lg max-h-56 overflow-y-auto divide-y">
                  {filteredSuppliers.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">No suppliers in this category</p>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <label key={s.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/30">
                        <Checkbox
                          checked={selectedSupplierIds.includes(s.id)}
                          onCheckedChange={() => toggleSupplier(s.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{s.name}</p>
                            {s.category && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                {s.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {s.phone || 'no phone'} · {s.email || 'no email'}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Send via</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={viaWhatsapp} onCheckedChange={(v) => setViaWhatsapp(!!v)} />
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={viaEmail} onCheckedChange={(v) => setViaEmail(!!v)} />
                    <Mail className="w-4 h-4" /> Email
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Custom Message (optional)</label>
                <Textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  placeholder="Add a note before the RFQ link..."
                  rows={3}
                />
              </div>

              {sendError && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {sendError}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
                <Button onClick={handleSendToSuppliers} disabled={sending}>
                  {sending ? (
                    <><div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Sending...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" />Send</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
