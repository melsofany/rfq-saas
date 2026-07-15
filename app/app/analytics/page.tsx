'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataCount } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  FileText,
  Truck,
  BarChart3,
  ShoppingCart,
  RefreshCw,
  Package,
} from 'lucide-react';

const COLORS = [
  'hsl(199, 89%, 48%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(278, 68%, 58%)',
  'hsl(0, 79%, 63%)',
];

const PO_STATUS_COLORS: Record<string, string> = {
  draft: 'hsl(215, 20%, 65%)',
  sent: 'hsl(199, 89%, 48%)',
  partial: 'hsl(38, 92%, 50%)',
  completed: 'hsl(142, 71%, 45%)',
  closed: 'hsl(215, 28%, 45%)',
};

export default function AnalyticsPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  // RFQ analytics
  const [rfqTrendData, setRfqTrendData] = useState<{ month: string; count: number }[]>([]);
  const [rfqStatusData, setRfqStatusData] = useState<{ name: string; value: number }[]>([]);

  // PO analytics
  const [poTrendData, setPoTrendData] = useState<{ month: string; count: number }[]>([]);
  const [poStatusData, setPoStatusData] = useState<{ status: string; count: number }[]>([]);

  // Supplier performance
  const [supplierPerfData, setSupplierPerfData] = useState<
    { name: string; offers: number; accepted: number }[]
  >([]);

  // Spending analysis
  const [spendingData, setSpendingData] = useState<{ month: string; amount: number }[]>([]);

  // Summary stats
  const [summaryStats, setSummaryStats] = useState({
    totalRfqs: 0,
    totalOffers: 0,
    totalSpend: 0,
    avgOfferValue: 0,
    totalPos: 0,
    completedRfqs: 0,
    conversionRate: 0,
    responseRate: 0,
  });

  useEffect(() => {
    if (!orgId) return;
    fetchAnalyticsData();
  }, [orgId]);

  const fetchAnalyticsData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // ── Parallel fetch everything ──
      const [rfqs, allOffers, allPos, poItems, sentLogs] = await Promise.all([
        dataQuery<{ id: string; status: string; created_at: string }>('rfqs', {
          select: 'id, status, created_at',
          eq: { org_id: orgId },
          order: { column: 'created_at', ascending: true },
        }),
        dataQuery<{
          id: string;
          supplier_id: string;
          rfq_id: string;
          total_price: number;
          status: string;
          created_at: string;
        }>('offers', {
          select: 'id, supplier_id, rfq_id, total_price, status, created_at',
          eq: { org_id: orgId },
        }),
        dataQuery<{ id: string; status: string; created_at: string }>('purchase_orders', {
          select: 'id, status, created_at',
          eq: { org_id: orgId },
          order: { column: 'created_at', ascending: true },
        }),
        dataQuery<{ reference_price: number; qty: number; created_at: string }>(
          'purchase_order_items',
          {
            select: 'reference_price, qty, created_at',
            eq: { org_id: orgId },
          }
        ),
        dataQuery<{ rfq_id: string; supplier_id: string }>('sent_log', {
          select: 'rfq_id, supplier_id',
          eq: { org_id: orgId },
        }),
      ]);

      // ── RFQ trend by month ──
      const rfqMonthMap: Record<string, number> = {};
      rfqs.forEach((rfq) => {
        const date = new Date(rfq.created_at);
        const monthKey = date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
        rfqMonthMap[monthKey] = (rfqMonthMap[monthKey] ?? 0) + 1;
      });
      setRfqTrendData(
        Object.entries(rfqMonthMap)
          .map(([month, count]) => ({ month, count }))
          .slice(-12)
      );

      // ── RFQ status distribution ──
      const rfqStatusMap: Record<string, number> = {};
      rfqs.forEach((rfq) => {
        const s = rfq.status || 'draft';
        rfqStatusMap[s] = (rfqStatusMap[s] ?? 0) + 1;
      });
      setRfqStatusData(Object.entries(rfqStatusMap).map(([name, value]) => ({ name, value })));

      // ── PO trend by month ──
      const poMonthMap: Record<string, number> = {};
      allPos.forEach((po) => {
        const date = new Date(po.created_at);
        const monthKey = date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
        poMonthMap[monthKey] = (poMonthMap[monthKey] ?? 0) + 1;
      });
      setPoTrendData(
        Object.entries(poMonthMap)
          .map(([month, count]) => ({ month, count }))
          .slice(-12)
      );

      // ── PO status distribution ──
      const poStatusMap: Record<string, number> = {};
      allPos.forEach((po) => {
        const s = po.status || 'draft';
        poStatusMap[s] = (poStatusMap[s] ?? 0) + 1;
      });
      const statusOrder = ['draft', 'sent', 'partial', 'completed', 'closed'];
      setPoStatusData(
        statusOrder
          .filter((s) => poStatusMap[s] !== undefined)
          .map((s) => ({ status: s, count: poStatusMap[s] }))
      );

      // ── Response rate ──
      const sentPairSet = new Set<string>();
      sentLogs.forEach((s) => {
        if (s.rfq_id && s.supplier_id) sentPairSet.add(`${s.rfq_id}:${s.supplier_id}`);
      });
      const respondedPairSet = new Set<string>();
      allOffers.forEach((o) => {
        if (o.rfq_id && o.supplier_id) respondedPairSet.add(`${o.rfq_id}:${o.supplier_id}`);
      });
      const totalSent = sentPairSet.size;
      const responded = Array.from(sentPairSet).filter((pair) =>
        respondedPairSet.has(pair)
      ).length;
      const responseRate = totalSent > 0 ? Math.round((responded / totalSent) * 100) : 0;

      // ── Conversion rate ──
      const completedRfqs = rfqs.filter((r) =>
        ['completed', 'closed'].includes(r.status)
      ).length;
      const conversionRate =
        completedRfqs > 0 ? Math.round((allPos.length / completedRfqs) * 100) : 0;

      // ── Supplier performance ──
      const supplierMap: Record<string, { offers: number; accepted: number }> = {};
      allOffers.forEach((offer) => {
        const sid = offer.supplier_id;
        if (!supplierMap[sid]) supplierMap[sid] = { offers: 0, accepted: 0 };
        supplierMap[sid].offers += 1;
        if (offer.status === 'approved' || offer.status === 'completed' || offer.status === 'accepted') {
          supplierMap[sid].accepted += 1;
        }
      });

      const supplierIds = Object.keys(supplierMap);
      if (supplierIds.length > 0) {
        const suppliers = await dataQuery<{ id: string; name: string }>('suppliers', {
          select: 'id, name',
          eq: { org_id: orgId },
        });
        const perfArr = supplierIds
          .map((sid) => {
            const supplier = suppliers.find((s) => s.id === sid);
            return supplier
              ? {
                  name: supplier.name,
                  offers: supplierMap[sid].offers,
                  accepted: supplierMap[sid].accepted,
                }
              : null;
          })
          .filter((s): s is { name: string; offers: number; accepted: number } => s !== null)
          .sort((a, b) => b.offers - a.offers)
          .slice(0, 10);
        setSupplierPerfData(perfArr);
      }

      // ── Spending analysis — from PO items ──
      const spendingMap: Record<string, number> = {};
      let totalSpend = 0;
      poItems.forEach((item) => {
        const amount = (item.reference_price ?? 0) * (item.qty ?? 0);
        totalSpend += amount;
        const date = new Date(item.created_at);
        const monthKey = date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
        spendingMap[monthKey] = (spendingMap[monthKey] ?? 0) + amount;
      });
      setSpendingData(
        Object.entries(spendingMap)
          .map(([month, amount]) => ({ month, amount: Math.round(amount) }))
          .slice(-12)
      );

      // ── Summary stats ──
      const totalOffers = allOffers.length;
      const totalOfferValue = allOffers.reduce((sum, o) => sum + (o.total_price ?? 0), 0);
      setSummaryStats({
        totalRfqs: rfqs.length,
        totalOffers,
        totalSpend: Math.round(totalSpend),
        avgOfferValue: totalOffers > 0 ? Math.round(totalOfferValue / totalOffers) : 0,
        totalPos: allPos.length,
        completedRfqs,
        conversionRate,
        responseRate,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
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
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80 mb-6" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Total RFQs',
      value: summaryStats.totalRfqs,
      icon: FileText,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Total Offers',
      value: summaryStats.totalOffers,
      icon: Truck,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Total POs',
      value: summaryStats.totalPos,
      icon: ShoppingCart,
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      label: 'Total Spend',
      value: `$${summaryStats.totalSpend.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Avg Offer Value',
      value: `$${summaryStats.avgOfferValue.toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Response Rate',
      value: `${summaryStats.responseRate}%`,
      icon: BarChart3,
      color: 'text-cyan-600 bg-cyan-50',
    },
    {
      label: 'Completed RFQs',
      value: summaryStats.completedRfqs,
      icon: Package,
      color: 'text-teal-600 bg-teal-50',
    },
    {
      label: 'RFQ → PO Rate',
      value: `${summaryStats.conversionRate}%`,
      icon: RefreshCw,
      color: 'text-rose-600 bg-rose-50',
    },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Insights into your procurement performance
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : summaryCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                      <p className="text-xl font-bold text-foreground mt-1">{card.value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                      <card.icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* RFQ & PO Trends side by side */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* RFQ Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">RFQ Trends</CardTitle>
            <CardDescription>Number of RFQs created per month</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : rfqTrendData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={rfqTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
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
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(199, 89%, 48%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(199, 89%, 48%)', r: 4 }}
                    name="RFQs"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* PO Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Purchase Order Trends</CardTitle>
            <CardDescription>Number of POs created per month</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : poTrendData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No purchase orders yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={poTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
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
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(278, 68%, 58%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(278, 68%, 58%)', r: 4 }}
                    name="POs"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status distributions */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* RFQ Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">RFQ Status Distribution</CardTitle>
            <CardDescription>Breakdown of RFQs by current status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : rfqStatusData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={rfqStatusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    label={(entry: any) => `${entry.name}: ${entry.value}`}
                    labelLine={false}
                  >
                    {rfqStatusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* PO Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">PO Status Distribution</CardTitle>
            <CardDescription>Breakdown of purchase orders by current status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : poStatusData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No purchase orders yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={poStatusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
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
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="POs">
                    {poStatusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PO_STATUS_COLORS[entry.status] ?? 'hsl(var(--primary))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Spending Analysis */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Spending Analysis</CardTitle>
          <CardDescription>Monthly spend from purchase order items (price × qty)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72" />
          ) : spendingData.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-muted-foreground">
              <DollarSign className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">No spending data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={spendingData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) =>
                    value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Spend']}
                />
                <Bar
                  dataKey="amount"
                  fill="hsl(278, 68%, 58%)"
                  radius={[6, 6, 0, 0]}
                  name="Spend"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Supplier Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Supplier Performance</CardTitle>
          <CardDescription>
            Top suppliers by offer count and acceptance rate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : supplierPerfData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Truck className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No supplier performance data available</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Total Offers</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead className="text-right">Acceptance Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierPerfData.map((supplier) => {
                  const rate =
                    supplier.offers > 0
                      ? Math.round((supplier.accepted / supplier.offers) * 100)
                      : 0;
                  return (
                    <TableRow key={supplier.name}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell className="text-right">{supplier.offers}</TableCell>
                      <TableCell className="text-right">{supplier.accepted}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-medium ${
                            rate >= 50 ? 'text-green-600' : 'text-amber-600'
                          }`}
                        >
                          {rate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
