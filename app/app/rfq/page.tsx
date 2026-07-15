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
import { Plus, Search, FileText, ArrowRight } from 'lucide-react';

interface Rfq {
  id: string;
  internal_rfq_no: string;
  customer_rfq_no: string;
  customer_rfq_date: string | null;
  required_response_date: string | null;
  status: string;
  created_at: string;
}

export default function RfqListPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchRfqs = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const eq: Record<string, any> = { org_id: orgId };
      if (statusFilter !== 'all') {
        eq.status = statusFilter;
      }

      const data = await dataQuery<Rfq>('rfqs', {
        select: 'id, internal_rfq_no, customer_rfq_no, customer_rfq_date, required_response_date, status, created_at',
        eq,
        order: { column: 'created_at', ascending: false },
      });

      setRfqs(data ?? []);
    } catch (error) {
      console.error('Error fetching RFQs:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId, statusFilter]);

  useEffect(() => {
    fetchRfqs();
  }, [fetchRfqs]);

  const filteredRfqs = rfqs.filter((rfq) => {
    const searchLower = search.toLowerCase();
    return (
      rfq.internal_rfq_no.toLowerCase().includes(searchLower) ||
      rfq.customer_rfq_no.toLowerCase().includes(searchLower)
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
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">RFQ Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage your Requests for Quotation
          </p>
        </div>
        <Button onClick={() => router.push('/app/rfq/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New RFQ
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All RFQs</CardTitle>
          <CardDescription>{rfqs.length} total RFQs</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by RFQ number..."
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
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="QUOTED">Quoted</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
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
          ) : filteredRfqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium text-foreground">
                {search || statusFilter !== 'all' ? 'No RFQs match your filters' : 'No RFQs yet'}
              </p>
              <p className="text-xs mt-1">
                {search || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Create your first RFQ to get started'}
              </p>
              {!search && statusFilter === 'all' && (
                <Button size="sm" className="mt-4" onClick={() => router.push('/app/rfq/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New RFQ
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Internal RFQ No</TableHead>
                  <TableHead>Customer RFQ No</TableHead>
                  <TableHead>Customer Date</TableHead>
                  <TableHead>Response Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRfqs.map((rfq) => (
                  <TableRow
                    key={rfq.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/app/rfq/${rfq.id}`)}
                  >
                    <TableCell className="font-medium">{rfq.internal_rfq_no}</TableCell>
                    <TableCell>{rfq.customer_rfq_no}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {rfq.customer_rfq_date ? new Date(rfq.customer_rfq_date).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {rfq.required_response_date ? new Date(rfq.required_response_date).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell><StatusBadge status={rfq.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(rfq.created_at).toLocaleDateString()}
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
