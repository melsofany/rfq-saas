'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  CreditCard,
  DollarSign,
  Users,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Inbox,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { adminQuery, adminCount } from '@/lib/admin-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  totalOrgs: number;
  activeSubs: number;
  mrr: number;
  totalUsers: number;
}

interface OrgGrowthPoint {
  month: string;
  count: number;
}

interface RevenueByPlan {
  name: string;
  revenue: number;
}

interface SubStatusBreakdown {
  name: string;
  value: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'hsl(var(--chart-2))',
  trialing: 'hsl(var(--chart-3))',
  past_due: 'hsl(var(--chart-4))',
  cancelled: 'hsl(var(--chart-5))',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [orgGrowth, setOrgGrowth] = useState<OrgGrowthPoint[]>([]);
  const [revenueByPlan, setRevenueByPlan] = useState<RevenueByPlan[]>([]);
  const [subStatus, setSubStatus] = useState<SubStatusBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Total Organizations
        const totalOrgs = await adminCount('organizations');

        // Active Subscriptions + MRR
        const activeSubs = await adminQuery<{ plan_id: string }>('subscriptions', {
          select: 'plan_id',
          eq: { status: 'active' },
        });

        const activeSubCount = activeSubs.length;

        // Get plan prices for MRR calculation
        const plans = await adminQuery<{ id: string; name: string; price_monthly: number }>(
          'subscription_plans',
          { select: 'id, name, price_monthly' }
        );

        const planPriceMap = new Map<string, number>();
        plans.forEach((p) => planPriceMap.set(p.id, p.price_monthly));

        let mrr = 0;
        for (const sub of activeSubs) {
          mrr += planPriceMap.get(sub.plan_id) ?? 0;
        }

        // Total Users
        const totalUsers = await adminCount('organization_members');

        setStats({
          totalOrgs,
          activeSubs: activeSubCount,
          mrr,
          totalUsers,
        });

        // Org Growth over last 12 months
        const orgs = await adminQuery<{ created_at: string }>('organizations', {
          select: 'created_at',
        });

        const months: OrgGrowthPoint[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push({
            month: d.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
            count: 0,
          });
        }

        for (const org of orgs) {
          const created = new Date(org.created_at);
          const monthIdx =
            (created.getFullYear() - (now.getFullYear() - 1)) * 12 +
            created.getMonth() -
            (now.getMonth() + 1 - 12);
          if (monthIdx >= 0 && monthIdx < 12) {
            months[monthIdx].count++;
          }
        }
        setOrgGrowth(months);

        // Revenue by Plan
        const allSubs = await adminQuery<{ plan_id: string; status: string }>('subscriptions', {
          select: 'plan_id, status',
          eq: { status: 'active' },
        });

        const revMap = new Map<string, number>();
        const planNameMap = new Map<string, string>();
        plans.forEach((p) => {
          planNameMap.set(p.id, p.name);
          planPriceMap.set(p.id, p.price_monthly);
        });
        for (const sub of allSubs) {
          const planName = planNameMap.get(sub.plan_id) ?? 'Unknown';
          const price = planPriceMap.get(sub.plan_id) ?? 0;
          revMap.set(planName, (revMap.get(planName) ?? 0) + price);
        }
        setRevenueByPlan(
          Array.from(revMap.entries()).map(([name, revenue]) => ({ name, revenue }))
        );

        // Subscription Status Breakdown
        const allSubsForStatus = await adminQuery<{ status: string }>('subscriptions', {
          select: 'status',
        });

        const statusMap = new Map<string, number>();
        for (const sub of allSubsForStatus) {
          statusMap.set(sub.status, (statusMap.get(sub.status) ?? 0) + 1);
        }
        setSubStatus(
          Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }))
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statCards = [
    {
      label: 'Total Organizations',
      value: stats?.totalOrgs ?? 0,
      icon: Building2,
      color: 'text-chart-1',
      bg: 'bg-chart-1/10',
    },
    {
      label: 'Active Subscriptions',
      value: stats?.activeSubs ?? 0,
      icon: CreditCard,
      color: 'text-chart-2',
      bg: 'bg-chart-2/10',
    },
    {
      label: 'MRR',
      value: `$${(stats?.mrr ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-chart-3',
      bg: 'bg-chart-3/10',
    },
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: 'text-chart-4',
      bg: 'bg-chart-4/10',
    },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-sm text-muted-foreground">
          Monitor your SaaS platform performance at a glance
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))
          : statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          {card.label}
                        </p>
                        <p className="text-2xl font-bold">{card.value}</p>
                      </div>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${card.bg}`}>
                        <Icon className={`h-6 w-6 ${card.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Org Growth Area Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-chart-1" />
              <div>
                <CardTitle className="text-lg">Organizations Growth</CardTitle>
                <CardDescription>New organizations over the last 12 months</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : orgGrowth.every((d) => d.count === 0) ? (
              <EmptyChartState message="No organization data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={orgGrowth}>
                  <defs>
                    <linearGradient id="orgGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fill="url(#orgGrowthGradient)"
                    name="New Orgs"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Plan Bar Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-chart-2" />
              <div>
                <CardTitle className="text-lg">Revenue by Plan</CardTitle>
                <CardDescription>Monthly recurring revenue per plan</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : revenueByPlan.length === 0 ? (
              <EmptyChartState message="No revenue data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByPlan}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-chart-4" />
            <div>
              <CardTitle className="text-lg">Subscription Status Breakdown</CardTitle>
              <CardDescription>Distribution of all subscriptions by status</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : subStatus.length === 0 ? (
            <EmptyChartState message="No subscription data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={subStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry: any) => `${entry.name}: ${entry.value}`}
                  labelLine={false}
                >
                  {subStatus.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[entry.name] ?? 'hsl(var(--muted-foreground))'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
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
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
