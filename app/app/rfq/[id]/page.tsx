'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
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
import { ArrowLeft, FileText, Package, Inbox, Calendar, User, Clock } from 'lucide-react';

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

export default function RfqDetailPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [items, setItems] = useState<RfqItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !id) return;
    fetchRfqData();
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
      </div>

      {/* Details Grid */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
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
            <CardDescription>Required Response Date</CardDescription>
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
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Expires At</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {rfq.expires_at ? new Date(rfq.expires_at).toLocaleDateString() : '—'}
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
    </div>
  );
}
