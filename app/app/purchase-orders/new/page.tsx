'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataInsert, dataCount } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Save, AlertCircle, FileSearch, CheckCircle2, ChevronRight } from 'lucide-react';
import { getAccessToken } from '@/lib/org-auth';

/* ─── Types ─────────────────────────────────────────── */

interface LineItem {
  id: string;
  description: string;
  part_no: string;
  qty: string;
  uom: string;
  reference_price: string;
  supplier_id: string;
}

interface Supplier { id: string; name: string; }

interface Rfq {
  id: string;
  internal_rfq_no: string;
  customer_rfq_no: string;
  status: string;
  created_at: string;
}

interface RfqItem {
  id: string;
  rfq_id: string;
  description: string;
  part_no: string | null;
  qty: number | null;
  uom: string | null;
  reference_price: number | null;
  line_item: string | null;
}

interface Offer {
  id: string;
  rfq_id: string;
  supplier_id: string;
  supplier_name?: string;
  total_price: number | null;
  status: string;
}

interface OfferItem {
  id: string;
  offer_id: string;
  rfq_item_id: string;
  price: number;
  tax_included: boolean;
}

/* ─── Component ──────────────────────────────────────── */

export default function NewPurchaseOrderPage() {
  const { orgId, user, orgMember, isLoading: authLoading } = useAuth();
  const router = useRouter();

  /* PO form state */
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [internalPoNo, setInternalPoNo] = useState('');
  const [externalPoNo, setExternalPoNo] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', part_no: '', qty: '', uom: '', reference_price: '', supplier_id: '' },
  ]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  /* Import-from-RFQ dialog state */
  const [rfqDialogOpen, setRfqDialogOpen] = useState(false);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [rfqsLoading, setRfqsLoading] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [rfqItems, setRfqItems] = useState<RfqItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('none');
  const [offerItems, setOfferItems] = useState<OfferItem[]>([]);
  const [rfqDetailLoading, setRfqDetailLoading] = useState(false);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const [importedFromRfqId, setImportedFromRfqId] = useState<string | null>(null);

  /* ── Init ── */
  useEffect(() => {
    if (orgId) {
      generatePoNumber();
      fetchSuppliers();
    }
  }, [orgId]);

  const generatePoNumber = async () => {
    if (!orgId) return;
    try {
      const count = await dataCount('purchase_orders', { org_id: orgId });
      const num = (count ?? 0) + 1;
      const year = new Date().getFullYear();
      setInternalPoNo(`PO-${year}-${String(num).padStart(4, '0')}`);
    } catch {
      setInternalPoNo(`PO-${Date.now()}`);
    }
  };

  const fetchSuppliers = async () => {
    if (!orgId) return;
    try {
      const data = await dataQuery<Supplier>('suppliers', {
        select: 'id, name',
        eq: { org_id: orgId, is_active: true },
        order: { column: 'name', ascending: true },
      });
      setSuppliers(data ?? []);
    } catch {}
  };

  /* ── Line item helpers ── */
  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: Date.now().toString(), description: '', part_no: '', qty: '', uom: '', reference_price: '', supplier_id: '',
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  /* ── RFQ dialog ── */
  const openRfqDialog = async () => {
    if (!orgId) return;
    setRfqDialogOpen(true);
    setSelectedRfq(null);
    setRfqItems([]);
    setOffers([]);
    setSelectedOfferId('none');
    setOfferItems([]);
    setRfqsLoading(true);
    try {
      const data = await dataQuery<Rfq>('rfqs', {
        select: 'id, internal_rfq_no, customer_rfq_no, status, created_at',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
        limit: 50,
      });
      setRfqs(data ?? []);
    } catch {}
    setRfqsLoading(false);
  };

  const selectRfq = async (rfq: Rfq) => {
    setSelectedRfq(rfq);
    setSelectedOfferId('none');
    setOfferItems([]);
    setRfqDetailLoading(true);
    try {
      const [items, offersRaw] = await Promise.all([
        dataQuery<RfqItem>('rfq_items', {
          select: 'id, rfq_id, description, part_no, qty, uom, reference_price, line_item',
          eq: { rfq_id: rfq.id, org_id: orgId! },
          order: { column: 'created_at', ascending: true },
        }),
        dataQuery<Offer>('offers', {
          select: 'id, rfq_id, supplier_id, total_price, status',
          eq: { rfq_id: rfq.id, org_id: orgId! },
          order: { column: 'created_at', ascending: false },
        }),
      ]);
      setRfqItems(items ?? []);

      // Attach supplier names
      const enrichedOffers = (offersRaw ?? []).map((o) => ({
        ...o,
        supplier_name: suppliers.find((s) => s.id === o.supplier_id)?.name ?? 'Unknown',
      }));
      setOffers(enrichedOffers);
    } catch {}
    setRfqDetailLoading(false);
  };

  const handleOfferChange = async (offerId: string) => {
    setSelectedOfferId(offerId);
    if (offerId === 'none' || !orgId) { setOfferItems([]); return; }
    try {
      const items = await dataQuery<OfferItem>('offer_items', {
        select: 'id, offer_id, rfq_item_id, price, tax_included',
        eq: { offer_id: offerId, org_id: orgId },
      });
      setOfferItems(items ?? []);
    } catch {}
  };

  const handleImport = () => {
    if (!selectedRfq || rfqItems.length === 0) return;

    const offer = offers.find((o) => o.id === selectedOfferId);
    const offerItemMap: Record<string, OfferItem> = {};
    offerItems.forEach((oi) => { offerItemMap[oi.rfq_item_id] = oi; });

    const imported: LineItem[] = rfqItems.map((ri) => {
      const oi = offerItemMap[ri.id];
      return {
        id: `rfq-${ri.id}`,
        description: ri.description,
        part_no: ri.part_no ?? '',
        qty: ri.qty != null ? String(ri.qty) : '',
        uom: ri.uom ?? '',
        reference_price: oi ? String(oi.price) : (ri.reference_price != null ? String(ri.reference_price) : ''),
        supplier_id: offer ? offer.supplier_id : '',
      };
    });

    setLineItems(imported);
    setImportedFrom(
      offer
        ? `${selectedRfq.internal_rfq_no} — ${offer.supplier_name}`
        : selectedRfq.internal_rfq_no
    );
    // Track RFQ id so we can mark it SUCCESS after PO is saved (only when an offer was selected)
    setImportedFromRfqId(offer ? selectedRfq.id : null);
    setRfqDialogOpen(false);
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !user) return;
    setError('');

    if (!internalPoNo || !externalPoNo) {
      setError('Internal PO No and External PO No are required');
      return;
    }

    const validItems = lineItems.filter((item) => item.description.trim() !== '');
    if (validItems.length === 0) {
      setError('At least one line item with a description is required');
      return;
    }

    setSaving(true);
    try {
      const po = await dataInsert<{ id: string }>('purchase_orders', {
        org_id: orgId,
        internal_po_no: internalPoNo,
        external_po_no: externalPoNo,
        receiver_name: receiverName || null,
        receiver_phone: receiverPhone || null,
        status: 'draft',
        created_by: orgMember?.id || null,
        notes: notes || null,
      } as any);

      const poId = po.id;
      for (const item of validItems) {
        await dataInsert('purchase_order_items', {
          org_id: orgId,
          po_id: poId,
          description: item.description,
          part_no: item.part_no || null,
          qty: item.qty ? parseFloat(item.qty) : null,
          uom: item.uom || null,
          reference_price: item.reference_price ? parseFloat(item.reference_price) : null,
          supplier_id: item.supplier_id || null,
        } as any);
      }

      await dataInsert('audit_log', {
        org_id: orgId,
        action: 'create',
        entity_type: 'purchase_order',
        entity_id: poId,
        description: `Created PO ${internalPoNo}${importedFrom ? ` (from RFQ ${importedFrom})` : ''}`,
      } as any);

      // Mark the originating RFQ as SUCCESS now that a PO has been issued from it
      if (importedFromRfqId) {
        try {
          const token = getAccessToken();
          await fetch(`/api/rfq/${importedFromRfqId}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ status: 'SUCCESS' }),
          });
        } catch { /* non-fatal — PO is already saved */ }
      }

      router.push(`/app/purchase-orders/${poId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create purchase order');
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
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/app/purchase-orders')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">New Purchase Order</h1>
          <p className="text-sm text-muted-foreground mt-1">Create a new purchase order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PO Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">PO Details</CardTitle>
            <CardDescription>Basic information about this purchase order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="internal_po_no">Internal PO No <span className="text-destructive">*</span></Label>
                <Input id="internal_po_no" value={internalPoNo} onChange={(e) => setInternalPoNo(e.target.value)} placeholder="PO-2026-0001" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="external_po_no">External PO No <span className="text-destructive">*</span></Label>
                <Input id="external_po_no" value={externalPoNo} onChange={(e) => setExternalPoNo(e.target.value)} placeholder="EXT-PO-001" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receiver_name">Receiver Name</Label>
                <Input id="receiver_name" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receiver_phone">Receiver Phone</Label>
                <Input id="receiver_phone" value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes or instructions..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg">Line Items</CardTitle>
                <CardDescription>
                  {importedFrom
                    ? <span className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" />Imported from: {importedFrom}</span>
                    : 'Add items manually or import from an RFQ'}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={openRfqDialog}>
                  <FileSearch className="w-4 h-4 mr-2" />
                  Import from RFQ
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Description</TableHead>
                    <TableHead className="min-w-[100px]">Part No</TableHead>
                    <TableHead className="w-[80px]">Qty</TableHead>
                    <TableHead className="w-[80px]">UOM</TableHead>
                    <TableHead className="w-[110px]">Ref Price</TableHead>
                    <TableHead className="min-w-[150px]">Supplier</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input value={item.description} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)} placeholder="Item description" />
                      </TableCell>
                      <TableCell>
                        <Input value={item.part_no} onChange={(e) => updateLineItem(item.id, 'part_no', e.target.value)} placeholder="P-001" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.qty} onChange={(e) => updateLineItem(item.id, 'qty', e.target.value)} placeholder="0" min="0" />
                      </TableCell>
                      <TableCell>
                        <Input value={item.uom} onChange={(e) => updateLineItem(item.id, 'uom', e.target.value)} placeholder="PCS" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.reference_price} onChange={(e) => updateLineItem(item.id, 'reference_price', e.target.value)} placeholder="0.00" min="0" step="0.01" />
                      </TableCell>
                      <TableCell>
                        <Select value={item.supplier_id || 'none'} onValueChange={(v) => updateLineItem(item.id, 'supplier_id', v === 'none' ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLineItem(item.id)} disabled={lineItems.length === 1} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-lg">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push('/app/purchase-orders')}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <><div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Create PO</>
            )}
          </Button>
        </div>
      </form>

      {/* ── Import from RFQ Dialog ── */}
      <Dialog open={rfqDialogOpen} onOpenChange={setRfqDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="w-5 h-5" /> Import from RFQ
            </DialogTitle>
            <DialogDescription>
              {!selectedRfq
                ? 'Select an RFQ to import its items into this purchase order.'
                : 'Choose an offer to use its prices and supplier, or import RFQ items only.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {/* Step 1: Pick RFQ */}
            {!selectedRfq ? (
              rfqsLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
              ) : rfqs.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <FileSearch className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">No RFQs found</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {rfqs.map((rfq) => (
                    <button
                      key={rfq.id}
                      type="button"
                      onClick={() => selectRfq(rfq)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium">{rfq.internal_rfq_no}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Customer RFQ: {rfq.customer_rfq_no} · {new Date(rfq.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={rfq.status} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              /* Step 2: Pick offer (optional) */
              rfqDetailLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : (
                <div className="space-y-5">
                  {/* Back button */}
                  <button type="button" onClick={() => setSelectedRfq(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    ← Back to RFQ list
                  </button>

                  {/* Selected RFQ info */}
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm font-semibold">{selectedRfq.internal_rfq_no}</p>
                    <p className="text-xs text-muted-foreground">{rfqItems.length} item(s)</p>
                  </div>

                  {/* Offer selector */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Choose an Offer (optional)</Label>
                    <p className="text-xs text-muted-foreground">Selecting an offer will use its unit prices and supplier. Leave as "RFQ items only" to import without offer data.</p>
                    <div className="space-y-1.5">
                      {/* No offer option */}
                      <button
                        type="button"
                        onClick={() => handleOfferChange('none')}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${selectedOfferId === 'none' ? 'border-primary bg-primary/5' : 'bg-card hover:bg-accent/30'}`}
                      >
                        <div>
                          <p className="text-sm font-medium">RFQ items only</p>
                          <p className="text-xs text-muted-foreground">Import descriptions, quantities, and reference prices — no supplier assigned</p>
                        </div>
                        {selectedOfferId === 'none' && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                      </button>

                      {offers.length === 0 && (
                        <p className="text-xs text-muted-foreground px-1">No offers submitted for this RFQ yet.</p>
                      )}

                      {offers.map((offer) => (
                        <button
                          key={offer.id}
                          type="button"
                          onClick={() => handleOfferChange(offer.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${selectedOfferId === offer.id ? 'border-primary bg-primary/5' : 'bg-card hover:bg-accent/30'}`}
                        >
                          <div>
                            <p className="text-sm font-medium">{offer.supplier_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Total: {offer.total_price != null ? `$${Number(offer.total_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                              {' · '}<StatusBadge status={offer.status} />
                            </p>
                          </div>
                          {selectedOfferId === offer.id && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview of items to be imported */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Items Preview</Label>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead>Part No</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>UOM</TableHead>
                            <TableHead>Price</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rfqItems.map((ri) => {
                            const oi = offerItems.find((o) => o.rfq_item_id === ri.id);
                            const price = oi ? oi.price : ri.reference_price;
                            return (
                              <TableRow key={ri.id}>
                                <TableCell className="text-sm">{ri.description}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{ri.part_no ?? '—'}</TableCell>
                                <TableCell className="text-sm">{ri.qty ?? '—'}</TableCell>
                                <TableCell className="text-sm">{ri.uom ?? '—'}</TableCell>
                                <TableCell className="text-sm">
                                  {price != null ? `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          <DialogFooter className="pt-2 border-t gap-2">
            <Button variant="outline" type="button" onClick={() => setRfqDialogOpen(false)}>Cancel</Button>
            {selectedRfq && (
              <Button type="button" onClick={handleImport} disabled={rfqItems.length === 0}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Import {rfqItems.length} Item{rfqItems.length !== 1 ? 's' : ''}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
