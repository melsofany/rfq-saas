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
import { ArrowLeft, Package, User, Phone, ShoppingCart } from 'lucide-react';

interface PoItem {
  id: string;
  description: string;
  part_no: string | null;
  qty: number | null;
  uom: string | null;
  reference_price: number | null;
  supplier_id: string | null;
  supplier_name?: string;
}

interface PurchaseOrder {
  id: string;
  internal_po_no: string;
  external_po_no: string;
  receiver_name: string | null;
  receiver_phone: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export default function PoDetailPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !id) return;
    fetchPoData();
  }, [orgId, id]);

  const fetchPoData = async () => {
    if (!orgId || !id) return;
    setLoading(true);
    try {
      const poData = await dataQuery<PurchaseOrder>('purchase_orders', {
        select: '*',
        eq: { id, org_id: orgId },
      });

      if (!poData || poData.length === 0) {
        router.push('/app/purchase-orders');
        return;
      }
      setPo(poData[0]);

      const itemsData = await dataQuery<PoItem>('purchase_order_items', {
        select: 'id, description, part_no, qty, uom, reference_price, supplier_id',
        eq: { po_id: id, org_id: orgId },
        order: { column: 'created_at', ascending: true },
      });

      // Fetch supplier names for items that have supplier_id
      const supplierIds = (itemsData ?? [])
        .map((item) => item.supplier_id)
        .filter((sid): sid is string => sid !== null);

      let supplierMap: Record<string, string> = {};
      if (supplierIds.length > 0) {
        const suppliers = await dataQuery<{ id: string; name: string }>('suppliers', {
          select: 'id, name',
          eq: { org_id: orgId },
        });
        suppliers.forEach((s) => {
          supplierMap[s.id] = s.name;
        });
      }

      const itemsWithSuppliers = (itemsData ?? []).map((item) => ({
        ...item,
        supplier_name: item.supplier_id ? supplierMap[item.supplier_id] : undefined,
      }));

      setItems(itemsWithSuppliers);
    } catch (error) {
      console.error('Error fetching PO:', error);
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

  if (!po) return null;

  const totalValue = items.reduce((sum, item) => {
    const price = item.reference_price ?? 0;
    const qty = item.qty ?? 0;
    return sum + price * qty;
  }, 0);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/app/purchase-orders')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{po.internal_po_no}</h1>
            <StatusBadge status={po.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">External PO: {po.external_po_no}</p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Receiver Name</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{po.receiver_name ?? '—'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Receiver Phone</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{po.receiver_phone ?? '—'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Value</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xl font-bold text-foreground">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">PO Items</CardTitle>
          <CardDescription>
            {items.length} {items.length === 1 ? 'item' : 'items'} in this purchase order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No items in this purchase order</p>
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
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead>Supplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const subtotal = (item.reference_price ?? 0) * (item.qty ?? 0);
                  return (
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
                      <TableCell className="text-right font-medium">
                        ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.supplier_name ?? '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-semibold">
                  <TableCell colSpan={5} className="text-right">Total</TableCell>
                  <TableCell className="text-right text-lg">
                    ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {po.notes && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{po.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
