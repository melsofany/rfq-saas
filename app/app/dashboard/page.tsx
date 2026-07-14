'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataCount } from '@/lib/org-data';
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
  FileText,
  FileClock,
  Truck,
  TrendingUp,
  ArrowRight,
  Plus,
  Package,
  ShoppingCart,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DashboardStats {
  totalRfqs: number;
  openRfqs: number;
  totalSuppliers: number;
  responseRate: number;
}

interface StatusData {
  status: string;
  count: number;
}

interface TopSupplier {
  id: string;
  name: string;
  category: string;
  offerCount: number;
}

interface RecentRfq {
  id: string;
  internal_rfq_no: string;
  customer_rfq_no: string;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'hsl(215, 20%, 65%)',
  sent: 'hsl(199, 89%, 48%)',
  partial: 'hsl(38, 92%, 50%)',
  completed: 'hsl(142, 71%, 45%)',
  closed: 'hsl(215, 28%, 45%)',
};

export default function DashboardPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<TopSupplier[]>([]);
  const [recentRfqs, setRecentRfqs] = useState<RecentRfq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    fetchDashboardData();
  }, [orgId]);

  const fetchDashboardData = async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      // Fetch RFQ stats
      const totalRfqs = await dataCount('rfqs', { org_id: orgId });

      const allRfqsForOpen = await dataQuery<{ status: string }>('rfqs', {
        select: 'status',
        eq: { org_id: orgId },
      });
      const openStatuses = ['draft', 'sent', 'partial'];
      const openRfqs = allRfqsForOpen.filter((r) => openStatuses.includes(r.status)).length;

      // Fetch suppliers count
      const totalSuppliers = await dataCount('suppliers', { org_id: orgId, is_active: true });

      // Fetch sent log for response rate. A supplier can be (re)sent the same RFQ
      // multiple times (e.g. a retry over WhatsApp + Email) — dedupe by
      // rfq_id+supplier_id so retries don't inflate "total sent" or skew the rate.
      const sentLogs = await dataQuery<{ rfq_id: string; supplier_id: string; offer_submitted: boolean }>('sent_log', {
        select: 'rfq_id, supplier_id, offer_submitted',
        eq: { org_id: orgId },
      });

      const uniqueSends = new Map<string, boolean>();
      for (const s of sentLogs) {
        const key = `${s.rfq_id}:${s.supplier_id}`;
        uniqueSends.set(key, (uniqueSends.get(key) ?? false) || s.offer_submitted);
      }
      const totalSent = uniqueSends.size;
      const responded = Array.from(uniqueSends.values()).filter(Boolean).length;
      const responseRate = totalSent > 0 ? Math.round((responded / totalSent) * 100) : 0;

      setStats({
        totalRfqs: totalRfqs ?? 0,
        openRfqs: openRfqs ?? 0,
        totalSuppliers: totalSuppliers ?? 0,
        responseRate,
      });

      // Fetch RFQs by status
      const rfqs = await dataQuery<{ status: string }>('rfqs', {
        select: 'status',
        eq: { org_id: orgId },
      });

      const statusCounts: Record<string, number> = {};
      rfqs.forEach((rfq) => {
        const s = rfq.status || 'draft';
        statusCounts[s] = (statusCounts[s] ?? 0) + 1;
      });

      const statusOrder = ['draft', 'sent', 'partial', 'completed', 'closed'];
      const statusDataArr = statusOrder
        .filter((s) => statusCounts[s] !== undefined)
        .map((s) => ({ status: s, count: statusCounts[s] }));
      setStatusData(statusDataArr);

      // Fetch top suppliers by offer count
      const offers = await dataQuery<{ supplier_id: string }>('offers', {
        select: 'supplier_id',
        eq: { org_id: orgId },
      });

      const supplierOfferCounts: Record<string, number> = {};
      offers.forEach((o) => {
        if (o.supplier_id) {
          supplierOfferCounts[o.supplier_id] = (supplierOfferCounts[o.supplier_id] ?? 0) + 1;
        }
      });

      const topSupplierIds = Object.keys(supplierOfferCounts)
        .sort((a, b) => supplierOfferCounts[b] - supplierOfferCounts[a])
        .slice(0, 5);

      if (topSupplierIds.length > 0) {
        const suppliers = await dataQuery<{ id: string; name: string; category: string }>('suppliers', {
          select: 'id, name, category',
          eq: { org_id: orgId },
        });

        const topSuppliersArr = topSupplierIds
          .map((sid) => {
            const supplier = suppliers.find((s) => s.id === sid);
            return supplier
              ? {
                  id: supplier.id,
                  name: supplier.name,
                  category: supplier.category,
                  offerCount: supplierOfferCounts[sid],
                }
              : null;
          })
          .filter((s): s is TopSupplier => s !== null);

        setTopSuppliers(topSuppliersArr);
      }

      // Fetch recent RFQs
      const recent = await dataQuery<RecentRfq>('rfqs', {
        select: 'id, internal_rfq_no, customer_rfq_no, status, created_at',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
        limit: 5,
      });

      setRecentRfqs(recent ?? []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !orgId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Total RFQs',
      value: stats?.totalRfqs ?? 0,
      icon: FileText,
      color: 'text-blue-600 bg-blue-50',
      href: '/app/rfq',
    },
    {
      label: 'Open RFQs',
      value: stats?.openRfqs ?? 0,
      icon: FileClock,
      color: 'text-amber-600 bg-amber-50',
      href: '/app/rfq',
    },
    {
      label: 'Suppliers',
      value: stats?.totalSuppliers ?? 0,
      icon: Truck,
      color: 'text-green-600 bg-green-50',
      href: '/app/suppliers',
    },
    {
      label: 'Response Rate',
      value: `${stats?.responseRate ?? 0}%`,
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-50',
      href: '/app/analytics',
    },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your procurement activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/app/rfq/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New RFQ
          </Button>
          <Button variant="outline" onClick={() => router.push('/app/purchase-orders/new')}>
            <ShoppingCart className="w-4 h-4 mr-2" />
            New PO
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))
          : kpiCards.map((card) => (
              <Link key={card.label} href={card.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                      </div>
                      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${card.color}`}>
                        <card.icon className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      {/* Charts and lists */}
      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        {/* RFQs by Status Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">RFQs by Status</CardTitle>
            <CardDescription>Distribution of RFQs across different statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : statusData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <FileText className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No RFQs to display</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Count">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] ?? 'hsl(var(--primary))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Suppliers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Suppliers</CardTitle>
            <CardDescription>By offer count</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : topSuppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Truck className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No supplier offers yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {topSuppliers.map((supplier, index) => (
                  <Link
                    key={supplier.id}
                    href={`/app/suppliers/${supplier.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{supplier.name}</p>
                      <p className="text-xs text-muted-foreground">{supplier.category}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{supplier.offerCount}</span>
                      <span className="text-xs text-muted-foreground ml-1">offers</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent RFQs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent RFQs</CardTitle>
              <CardDescription>Latest RFQs created in your organization</CardDescription>
            </div>
            <Link href="/app/rfq">
              <Button variant="ghost" size="sm" className="text-primary">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : recentRfqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">No RFQs yet</p>
              <p className="text-xs mt-1">Create your first RFQ to get started</p>
              <Button size="sm" className="mt-4" onClick={() => router.push('/app/rfq/new')}>
                <Plus className="w-4 h-4 mr-2" />
                New RFQ
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Internal RFQ No</TableHead>
                  <TableHead>Customer RFQ No</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRfqs.map((rfq) => (
                  <TableRow key={rfq.id} className="cursor-pointer" onClick={() => router.push(`/app/rfq/${rfq.id}`)}>
                    <TableCell className="font-medium">{rfq.internal_rfq_no}</TableCell>
                    <TableCell>{rfq.customer_rfq_no}</TableCell>
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
