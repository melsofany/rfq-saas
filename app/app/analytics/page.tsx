'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { dataQuery } from '@/lib/org-data';
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
import { TrendingUp, TrendingDown, DollarSign, FileText, Truck, BarChart3 } from 'lucide-react';

const COLORS = ['hsl(199, 89%, 48%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(278, 68%, 58%)', 'hsl(0, 79%, 63%)'];

export default function AnalyticsPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rfqTrendData, setRfqTrendData] = useState<{ month: string; count: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [supplierPerfData, setSupplierPerfData] = useState<{ name: string; offers: number; accepted: number }[]>([]);
  const [spendingData, setSpendingData] = useState<{ month: string; amount: number }[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalRfqs: 0,
    totalOffers: 0,
    totalSpend: 0,
    avgOfferValue: 0,
  });

  useEffect(() => {
    if (!orgId) return;
    fetchAnalyticsData();
  }, [orgId]);

  const fetchAnalyticsData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Fetch RFQs for trend and status analysis
      const rfqs = await dataQuery<{ id: string; status: string; created_at: string }>('rfqs', {
        select: 'id, status, created_at',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: true },
      });

      // RFQ trend by month
      const monthMap: Record<string, number> = {};
      rfqs.forEach((rfq) => {
        const date = new Date(rfq.created_at);
        const monthKey = date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
        monthMap[monthKey] = (monthMap[monthKey] ?? 0) + 1;
      });
      const trendArr = Object.entries(monthMap)
        .map(([month, count]) => ({ month, count }))
        .slice(-12);
      setRfqTrendData(trendArr);

      // RFQ status distribution
      const statusMap: Record<string, number> = {};
      rfqs.forEach((rfq) => {
        const s = rfq.status || 'draft';
        statusMap[s] = (statusMap[s] ?? 0) + 1;
      });
      const statusArr = Object.entries(statusMap).map(([name, value]) => ({ name, value }));
      setStatusData(statusArr);

      // Fetch offers for supplier performance
      const offers = await dataQuery<{ id: string; supplier_id: string; total_price: number; status: string; created_at: string }>('offers', {
        select: 'id, supplier_id, total_price, status, created_at',
        eq: { org_id: orgId },
      });

      // Supplier performance
      const supplierMap: Record<string, { offers: number; accepted: number }> = {};
      offers.forEach((offer) => {
        const sid = offer.supplier_id;
        if (!supplierMap[sid]) {
          supplierMap[sid] = { offers: 0, accepted: 0 };
        }
        supplierMap[sid].offers += 1;
        if (offer.status === 'approved' || offer.status === 'completed') {
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

      // Spending analysis - based on PO items
      const poItems = await dataQuery<{ reference_price: number; qty: number; created_at: string }>('purchase_order_items', {
        select: 'reference_price, qty, created_at',
        eq: { org_id: orgId },
      });

      const spendingMap: Record<string, number> = {};
      let totalSpend = 0;
      poItems.forEach((item) => {
        const price = item.reference_price ?? 0;
        const qty = item.qty ?? 0;
        const amount = price * qty;
        totalSpend += amount;
        const date = new Date(item.created_at);
        const monthKey = date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
        spendingMap[monthKey] = (spendingMap[monthKey] ?? 0) + amount;
      });
      const spendingArr = Object.entries(spendingMap)
        .map(([month, amount]) => ({ month, amount: Math.round(amount) }))
        .slice(-12);
      setSpendingData(spendingArr);

      // Summary stats
      const totalOffers = offers.length;
      const totalOfferValue = offers.reduce((sum, o) => sum + (o.total_price ?? 0), 0);
      setSummaryStats({
        totalRfqs: rfqs.length,
        totalOffers,
        totalSpend: Math.round(totalSpend),
        avgOfferValue: totalOffers > 0 ? Math.round(totalOfferValue / totalOffers) : 0,
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
          {Array.from({ length: 4 }).map((_, i) => (
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
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
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

      {/* RFQ Trend Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">RFQ Trends</CardTitle>
          <CardDescription>Number of RFQs created per month</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72" />
          ) : rfqTrendData.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-muted-foreground">
              <BarChart3 className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">No data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={rfqTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
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
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  name="RFQs"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Two-column charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* RFQ Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">RFQ Status Distribution</CardTitle>
            <CardDescription>Breakdown of RFQs by status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : statusData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    label={(entry: any) => `${entry.name}: ${entry.value}`}
                    labelLine={false}
                  >
                    {statusData.map((_, index) => (
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
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Spending Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spending Analysis</CardTitle>
            <CardDescription>Monthly purchase order spending</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : spendingData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <DollarSign className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No spending data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
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
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
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
                  <Bar dataKey="amount" fill="hsl(278, 68%, 58%)" radius={[6, 6, 0, 0]} name="Spend" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supplier Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Supplier Performance</CardTitle>
          <CardDescription>Top suppliers by offer count and acceptance rate</CardDescription>
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
                  const rate = supplier.offers > 0 ? Math.round((supplier.accepted / supplier.offers) * 100) : 0;
                  return (
                    <TableRow key={supplier.name}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell className="text-right">{supplier.offers}</TableCell>
                      <TableCell className="text-right">{supplier.accepted}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${rate >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
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
