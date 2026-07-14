'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataInsert, dataCount } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Save, AlertCircle } from 'lucide-react';

interface LineItem {
  id: string;
  description: string;
  part_no: string;
  qty: string;
  uom: string;
  reference_price: string;
}

export default function NewRfqPage() {
  const { orgId, user, orgMember, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [internalRfqNo, setInternalRfqNo] = useState('');
  const [customerRfqNo, setCustomerRfqNo] = useState('');
  const [customerRfqDate, setCustomerRfqDate] = useState('');
  const [requiredResponseDate, setRequiredResponseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', part_no: '', qty: '', uom: '', reference_price: '' },
  ]);

  useEffect(() => {
    if (orgId) {
      generateRfqNumber();
    }
  }, [orgId]);

  const generateRfqNumber = async () => {
    if (!orgId) return;
    try {
      const count = await dataCount('rfqs', { org_id: orgId });

      const num = (count ?? 0) + 1;
      const year = new Date().getFullYear();
      setInternalRfqNo(`RFQ-${year}-${String(num).padStart(4, '0')}`);
    } catch {
      setInternalRfqNo(`RFQ-${Date.now()}`);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        description: '',
        part_no: '',
        qty: '',
        uom: '',
        reference_price: '',
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(
      lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !user) return;

    setError('');

    if (!internalRfqNo) {
      setError('Internal RFQ No is required');
      return;
    }

    const validItems = lineItems.filter((item) => item.description.trim() !== '');
    if (validItems.length === 0) {
      setError('At least one line item with a description is required');
      return;
    }

    setSaving(true);
    try {
      const rfq = await dataInsert<{ id: string }>('rfqs', {
        org_id: orgId,
        internal_rfq_no: internalRfqNo,
        customer_rfq_no: customerRfqNo || null,
        customer_rfq_date: customerRfqDate || null,
        required_response_date: requiredResponseDate || null,
        expires_at: requiredResponseDate || null,
        status: 'draft',
        created_by: orgMember?.id || null,
        notes: notes || null,
      } as any);

      const itemsToInsert = validItems.map((item) => ({
        org_id: orgId,
        rfq_id: rfq.id,
        description: item.description,
        part_no: item.part_no || null,
        qty: item.qty ? parseFloat(item.qty) : null,
        uom: item.uom || null,
        reference_price: item.reference_price ? parseFloat(item.reference_price) : null,
      }));

      for (const itemData of itemsToInsert) {
        await dataInsert('rfq_items', itemData as any);
      }

      // Log to audit
      await dataInsert('audit_log', {
        org_id: orgId,
        action: 'create',
        entity_type: 'rfq',
        entity_id: rfq.id,
        description: `Created RFQ ${internalRfqNo}`,
      } as any);

      router.push(`/app/rfq/${rfq.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create RFQ');
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
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/app/rfq')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">New RFQ</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new Request for Quotation
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* RFQ Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">RFQ Details</CardTitle>
            <CardDescription>Basic information about this RFQ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="internal_rfq_no">Internal RFQ No <span className="text-destructive">*</span></Label>
                <Input
                  id="internal_rfq_no"
                  value={internalRfqNo}
                  onChange={(e) => setInternalRfqNo(e.target.value)}
                  placeholder="RFQ-2024-0001"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer_rfq_no">Customer RFQ No</Label>
                <Input
                  id="customer_rfq_no"
                  value={customerRfqNo}
                  onChange={(e) => setCustomerRfqNo(e.target.value)}
                  placeholder="CUST-RFQ-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer_rfq_date">Customer RFQ Date</Label>
                <Input
                  id="customer_rfq_date"
                  type="date"
                  value={customerRfqDate}
                  onChange={(e) => setCustomerRfqDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="required_response_date">Required Response / Expiry Date</Label>
                <Input
                  id="required_response_date"
                  type="date"
                  value={requiredResponseDate}
                  onChange={(e) => setRequiredResponseDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or instructions..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Line Items</CardTitle>
                <CardDescription>Add items to this RFQ</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Description</TableHead>
                    <TableHead className="min-w-[120px]">Part No</TableHead>
                    <TableHead className="w-[80px]">Qty</TableHead>
                    <TableHead className="w-[80px]">UOM</TableHead>
                    <TableHead className="w-[120px]">Ref Price</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          placeholder="Item description"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.part_no}
                          onChange={(e) => updateLineItem(item.id, 'part_no', e.target.value)}
                          placeholder="P-001"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateLineItem(item.id, 'qty', e.target.value)}
                          placeholder="0"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.uom}
                          onChange={(e) => updateLineItem(item.id, 'uom', e.target.value)}
                          placeholder="PCS"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.reference_price}
                          onChange={(e) => updateLineItem(item.id, 'reference_price', e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                          className="text-muted-foreground hover:text-destructive"
                        >
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
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push('/app/rfq')}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create RFQ
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
