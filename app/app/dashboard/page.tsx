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
  Users,
  DollarSign,
  RefreshCw,
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
  completedRfqs: number;
  totalSuppliers: number;
  responseRate: number;
  totalPos: number;
  totalPoValue: number;
  conversionRate: number;
  totalEmployees: number;
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

interface RecentPo {
  id: string;
  internal_po_no: string;
  external_po_no: string;
  receiver_name: string | null;
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
  const [poStatusData, setPoStatusData] = useState<StatusData[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<TopSupplier[]>([]);
  const [recentRfqs, setRecentRfqs] = useState<RecentRfq[]>([]);
  const [recentPos, setRecentPos] = useState<RecentPo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    fetchDashboardData();
  }, [orgId]);

  const fetchDashboardData = async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      // ── Parallel fetch: RFQs, suppliers, sent_log, offers, POs, employees ──
      const [
        allRfqs,
        totalSuppliers,
        sentLogs,
        allOffers,
        allPos,
        poItems,
        employees,
      ] = await Promise.all([
        dataQuery<{ id: string; status: string; created_at: string }>('rfqs', {
          select: 'id, status, created_at',
          eq: { org_id: orgId },
        }),
        dataCount('suppliers', { org_id: orgId, is_active: true }),
        dataQuery<{ rfq_id: string; supplier_id: string }>('sent_log', {
          select: 'rfq_id, supplier_id',
          eq: { org_id: orgId },
        }),
        dataQuery<{ id: string; rfq_id: string; supplier_id: string; status: string; total_price: number }>('offers', {
          select: 'id, rfq_id, supplier_id, status, total_price',
          eq: { org_id: orgId },
        }),
        dataQuery<{ id: string; status: string; created_at: string }>('purchase_orders', {
          select: 'id, status, created_at',
          eq: { org_id: orgId },
        }),
        dataQuery<{ reference_price: number; qty: number }>('purchase_order_items', {
          select: 'reference_price, qty',
          eq: { org_id: orgId },
        }),
        dataQuery<{ id: string; is_active: boolean }>('organization_members', {
          select: 'id, is_active',
          eq: { org_id: orgId },
        }),
      ]);

      // ── RFQ stats ──
      const openStatuses = ['draft', 'sent', 'partial'];
      const completedStatuses = ['completed', 'closed'];
      const openRfqs = allRfqs.filter((r) => openStatuses.includes(r.status)).length;
      const completedRfqs = allRfqs.filter((r) => completedStatuses.includes(r.status)).length;

      // ── RFQ status distribution ──
      const rfqStatusCounts: Record<string, number> = {};
      allRfqs.forEach((rfq) => {
        const s = rfq.status || 'draft';
        rfqStatusCounts[s] = (rfqStatusCounts[s] ?? 0) + 1;
      });
      const statusOrder = ['draft', 'sent', 'partial', 'completed', 'closed'];
      setStatusData(
        statusOrder
          .filter((s) => rfqStatusCounts[s] !== undefined)
          .map((s) => ({ status: s, count: rfqStatusCounts[s] }))
      );

      // ── Response rate: unique rfq+supplier pairs sent vs those that submitted an offer ──
      // Dedupe sent pairs
      const sentPairSet = new Set<string>();
      sentLogs.forEach((s) => {
        if (s.rfq_id && s.supplier_id) sentPairSet.add(`${s.rfq_id}:${s.supplier_id}`);
      });
      // Build responded set: rfq+supplier pairs that have an offer
      const respondedPairSet = new Set<string>();
      allOffers.forEach((o) => {
        if (o.rfq_id && o.supplier_id) respondedPairSet.add(`${o.rfq_id}:${o.supplier_id}`);
      });
      const totalSent = sentPairSet.size;
      const responded = Array.from(sentPairSet).filter((pair) => respondedPairSet.has(pair)).length;
      const responseRate = totalSent > 0 ? Math.round((responded / totalSent) * 100) : 0;

      // ── PO stats ──
      const totalPos = allPos.length;
      const totalPoValue = poItems.reduce((sum, item) => {
        return sum + (item.reference_price ?? 0) * (item.qty ?? 0);
      }, 0);

      // RFQ-to-PO conversion rate: POs / completed+closed RFQs
      const conversionRate =
        completedRfqs > 0 ? Math.round((totalPos / completedRfqs) * 100) : 0;

      // PO status distribution
      const poStatusCounts: Record<string, number> = {};
      allPos.forEach((po) => {
        const s = po.status || 'draft';
        poStatusCounts[s] = (poStatusCounts[s] ?? 0) + 1;
      });
      setPoStatusData(
        statusOrder
          .filter((s) => poStatusCounts[s] !== undefined)
          .map((s) => ({ status: s, count: poStatusCounts[s] }))
      );

      // ── Employees ──
      const totalEmployees = employees.filter((e) => e.is_active).length;

      setStats({
        totalRfqs: allRfqs.length,
        openRfqs,
        completedRfqs,
        totalSuppliers: totalSuppliers ?? 0,
        responseRate,
        totalPos,
        totalPoValue: Math.round(totalPoValue),
        conversionRate,
        totalEmployees,
      });

      // ── Top suppliers by offer count ──
      const supplierOfferCounts: Record<string, number> = {};
      allOffers.forEach((o) => {
        if (o.supplier_id) {
          supplierOfferCounts[o.supplier_id] = (supplierOfferCounts[o.supplier_id] ?? 0) + 1;
        }
      });

      const topSupplierIds = Object.keys(supplierOfferCounts)
        .sort((a, b) => supplierOfferCounts[b] - supplierOfferCounts[a])
        .slice(0, 5);

      if (topSupplierIds.length > 0) {
        const suppliers = await dataQuery<{ id: string; name: string; category: string }>(
          'suppliers',
          { select: 'id, name, category', eq: { org_id: orgId } }
        );
        setTopSuppliers(
          topSupplierIds
            .map((sid) => {
              const supplier = suppliers.find((s) => s.id === sid);
              return supplier
                ? { id: supplier.id, name: supplier.name, category: supplier.category, offerCount: supplierOfferCounts[sid] }
                : null;
            })
            .filter((s): s is TopSupplier => s !== null)
        );
      }

      // ── Recent RFQs ──
      const recent = await dataQuery<RecentRfq>('rfqs', {
        select: 'id, internal_rfq_no, customer_rfq_no, status, created_at',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
        limit: 5,
      });
      setRecentRfqs(recent ?? []);

      // ── Recent POs ──
      const recentPosData = await dataQuery<RecentPo>('purchase_orders', {
        select: 'id, internal_po_no, external_po_no, receiver_name, status, created_at',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
        limit: 5,
      });
      setRecentPos(recentPosData ?? []);
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
          {Array.from({ length: 8 }).map((_, i) => (
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
      label: 'Active Suppliers',
      value: stats?.totalSuppliers ?? 0,
      icon: Truck,
      color: 'text-green-600 bg-green-50',
      href: '/app/suppliers',
    },
    {
      label: 'Employees',
      value: stats?.totalEmployees ?? 0,
      icon: Users,
      color: 'text-cyan-600 bg-cyan-50',
      href: '/app/employees',
    },
    {
      label: 'Total POs',
      value: stats?.totalPos ?? 0,
      icon: ShoppingCart,
      color: 'text-indigo-600 bg-indigo-50',
      href: '/app/purchase-orders',
    },
    {
      label: 'PO Total Value',
      value: `$${(stats?.totalPoValue ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-600 bg-emerald-50',
      href: '/app/purchase-orders',
    },
    {
      label: 'Response Rate',
      value: `${stats?.responseRate ?? 0}%`,
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-50',
      href: '/app/analytics',
    },
    {
      label: 'RFQ → PO Rate',
      value: `${stats?.conversionRate ?? 0}%`,
      icon: RefreshCw,
      color: 'text-rose-600 bg-rose-50',
      href: '/app/analytics',
      tooltip: 'POs issued vs completed/closed RFQs',
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

      {/* KPI Cards — 4 columns on large screens */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : kpiCards.map((card) => (
              <Link key={card.label} href={card.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                        {card.tooltip && (
                          <p className="text-xs text-muted-foreground mt-1">{card.tooltip}</p>
                        )}
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

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* RFQs by Status */}
        <Card>
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
              <ResponsiveContainer width="100%" height={240}>
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

        {/* POs by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Purchase Orders by Status</CardTitle>
            <CardDescription>Distribution of POs across different statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : poStatusData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No purchase orders to display</p>
                <Button size="sm" className="mt-3" onClick={() => router.push('/app/purchase-orders/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New PO
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={poStatusData}>
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
                    {poStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] ?? 'hsl(var(--primary))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top suppliers + conversion summary */}
      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        {/* Top Suppliers */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Top Suppliers</CardTitle>
            <CardDescription>By number of offers submitted</CardDescription>
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

        {/* Conversion Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conversion Summary</CardTitle>
            <CardDescription>RFQ pipeline to PO</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { label: 'Total RFQs', value: stats?.totalRfqs ?? 0, color: 'text-blue-600' },
                  { label: 'Completed / Closed', value: stats?.completedRfqs ?? 0, color: 'text-green-600' },
                  { label: 'Total POs Issued', value: stats?.totalPos ?? 0, color: 'text-indigo-600' },
                  {
                    label: 'Conversion Rate',
                    value: `${stats?.conversionRate ?? 0}%`,
                    color: 'text-rose-600',
                    note: 'POs ÷ completed RFQs',
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      {item.note && <p className="text-xs text-muted-foreground/70">{item.note}</p>}
                    </div>
                    <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent RFQs & POs */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent RFQs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent RFQs</CardTitle>
                <CardDescription>Latest RFQs in your organization</CardDescription>
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
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <FileText className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No RFQs yet</p>
                <Button size="sm" className="mt-3" onClick={() => router.push('/app/rfq/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New RFQ
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Internal No</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRfqs.map((rfq) => (
                    <TableRow
                      key={rfq.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/app/rfq/${rfq.id}`)}
                    >
                      <TableCell className="font-medium">{rfq.internal_rfq_no}</TableCell>
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

        {/* Recent POs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Purchase Orders</CardTitle>
                <CardDescription>Latest POs in your organization</CardDescription>
              </div>
              <Link href="/app/purchase-orders">
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
            ) : recentPos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No purchase orders yet</p>
                <Button size="sm" className="mt-3" onClick={() => router.push('/app/purchase-orders/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New PO
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Internal No</TableHead>
                    <TableHead>Receiver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPos.map((po) => (
                    <TableRow
                      key={po.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/app/purchase-orders/${po.id}`)}
                    >
                      <TableCell className="font-medium">{po.internal_po_no}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{po.receiver_name ?? '—'}</TableCell>
                      <TableCell><StatusBadge status={po.status} /></TableCell>
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
    </div>
  );
}
