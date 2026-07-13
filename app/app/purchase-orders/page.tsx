'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, ShoppingCart, ArrowRight } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  internal_po_no: string;
  external_po_no: string;
  receiver_name: string | null;
  status: string;
  created_at: string;
}

export default function PurchaseOrdersListPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchPos = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const eq: Record<string, any> = { org_id: orgId };
      if (statusFilter !== 'all') {
        eq.status = statusFilter;
      }

      const data = await dataQuery<PurchaseOrder>('purchase_orders', {
        select: 'id, internal_po_no, external_po_no, receiver_name, status, created_at',
        eq,
        order: { column: 'created_at', ascending: false },
      });

      setPos(data ?? []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId, statusFilter]);

  useEffect(() => {
    fetchPos();
  }, [fetchPos]);

  const filteredPos = pos.filter((po) => {
    const searchLower = search.toLowerCase();
    return (
      po.internal_po_no.toLowerCase().includes(searchLower) ||
      po.external_po_no.toLowerCase().includes(searchLower) ||
      (po.receiver_name?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  if (authLoading || !orgId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your purchase orders
          </p>
        </div>
        <Button onClick={() => router.push('/app/purchase-orders/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New PO
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Purchase Orders</CardTitle>
          <CardDescription>{pos.length} total purchase orders</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredPos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium text-foreground">
                {search || statusFilter !== 'all' ? 'No POs match your filters' : 'No purchase orders yet'}
              </p>
              <p className="text-xs mt-1">
                {search || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Create your first PO to get started'}
              </p>
              {!search && statusFilter === 'all' && (
                <Button size="sm" className="mt-4" onClick={() => router.push('/app/purchase-orders/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New PO
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Internal PO No</TableHead>
                  <TableHead>External PO No</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPos.map((po) => (
                  <TableRow
                    key={po.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/app/purchase-orders/${po.id}`)}
                  >
                    <TableCell className="font-medium">{po.internal_po_no}</TableCell>
                    <TableCell>{po.external_po_no}</TableCell>
                    <TableCell>{po.receiver_name ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={po.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(po.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
