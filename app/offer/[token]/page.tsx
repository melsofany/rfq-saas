'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertCircle, CheckCircle2, FileText, Send } from 'lucide-react';

interface RfqItem {
  id: string;
  description: string;
  part_no: string | null;
  qty: number | null;
  uom: string | null;
}

interface OfferData {
  rfq: {
    internal_rfq_no: string;
    customer_rfq_no: string | null;
    notes: string | null;
    required_response_date: string | null;
    status: string;
  };
  supplier: { name: string; email: string | null };
  items: RfqItem[];
  close_date: string | null;
  offer_submitted: boolean;
}

interface ItemInput {
  price: string;
  delivery_days: string;
  notes: string;
}

export default function PublicOfferPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<OfferData | null>(null);
  const [inputs, setInputs] = useState<Record<string, ItemInput>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/offer/${token}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Failed to load this RFQ link');
          return;
        }
        setData(json);
        const initial: Record<string, ItemInput> = {};
        json.items.forEach((it: RfqItem) => {
          initial[it.id] = { price: '', delivery_days: '', notes: '' };
        });
        setInputs(initial);
      } catch {
        setError('Failed to load this RFQ link');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const updateInput = (itemId: string, field: keyof ItemInput, value: string) => {
    setInputs((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setError('');

    const items = Object.entries(inputs)
      .filter(([, v]) => v.price.trim() !== '')
      .map(([itemId, v]) => ({
        rfq_item_id: itemId,
        price: parseFloat(v.price),
        delivery_days: v.delivery_days ? parseInt(v.delivery_days, 10) : undefined,
        notes: v.notes || undefined,
      }));

    if (items.length === 0) {
      setError('Enter a price for at least one item');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/offer/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, general_notes: generalNotes || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to submit offer');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Failed to submit offer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  if (submitted || data.offer_submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-600" />
            <h2 className="text-lg font-semibold mb-1">Offer Submitted</h2>
            <p className="text-sm text-muted-foreground">
              Thank you, {data.supplier.name}. Your offer for RFQ {data.rfq.internal_rfq_no} has been received.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold">RFQ {data.rfq.internal_rfq_no}</h1>
            <p className="text-sm text-muted-foreground">
              Submitting as {data.supplier.name}
              {data.rfq.required_response_date && (
                <> · Response due {new Date(data.rfq.required_response_date).toLocaleDateString()}</>
              )}
            </p>
          </div>
        </div>

        {data.rfq.notes && (
          <Card className="mb-6">
            <CardContent className="p-4 text-sm text-muted-foreground whitespace-pre-wrap">
              {data.rfq.notes}
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Requested Items</CardTitle>
              <CardDescription>Enter your price and delivery time for each item</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Description</TableHead>
                      <TableHead>Part No</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="w-[140px]">Your Price</TableHead>
                      <TableHead className="w-[120px]">Delivery (days)</TableHead>
                      <TableHead className="min-w-[160px]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.part_no ?? '—'}</TableCell>
                        <TableCell>{item.qty ?? '—'}</TableCell>
                        <TableCell>{item.uom ?? '—'}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={inputs[item.id]?.price ?? ''}
                            onChange={(e) => updateInput(item.id, 'price', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={inputs[item.id]?.delivery_days ?? ''}
                            onChange={(e) => updateInput(item.id, 'delivery_days', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={inputs[item.id]?.notes ?? ''}
                            onChange={(e) => updateInput(item.id, 'notes', e.target.value)}
                            placeholder="Optional"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1.5">
              <label className="text-sm font-medium">General Notes</label>
              <Textarea
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="Any additional notes about your offer..."
                rows={3}
              />
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-lg">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Offer
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
