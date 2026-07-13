'use client';

import { useEffect, useState } from 'react';
import { adminQuery, adminCount } from '@/lib/admin-data-client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  CreditCard,
  DollarSign,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardStats {
  totalOrganizations: number;
  activeSubscriptions: number;
  mrr: number;
  totalUsers: number;
  organizationsGrowth: { month: string; count: number }[];
  revenueByPlan: { name: string; revenue: number }[];
  subscriptionStatusBreakdown: { name: string; value: number; color: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  active: 'hsl(142, 71%, 45%)',
  trialing: 'hsl(38, 92%, 50%)',
  past_due: 'hsl(0, 79%, 63%)',
  canceled: 'hsl(215, 16%, 47%)',
  suspended: 'hsl(278, 68%, 58%)',
};

const PLAN_COLORS = [
  'hsl(199, 89%, 48%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(278, 68%, 58%)',
  'hsl(0, 79%, 63%)',
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch organizations
      const orgs = await adminQuery<{ id: string; created_at: string; status: string }>('organizations', {
        select: 'id, created_at, status',
      });

      // Fetch active subscriptions with plan info
      const activeSubs = await adminQuery<{
        id: string;
        status: string;
        billing_cycle: string;
        plan_id: string;
      }>('subscriptions', {
        select: 'id, status, billing_cycle, plan_id',
        eq: { status: 'active' },
      });

      // Fetch all subscriptions for status breakdown
      const allSubs = await adminQuery<{ id: string; status: string }>('subscriptions', {
        select: 'id, status',
      });

      // Fetch total users
      const userCount = await adminCount('organization_members');

      // Fetch all plans for revenue breakdown
      const plans = await adminQuery<{
        id: string;
        name: string;
        price_monthly: number;
        price_yearly: number;
      }>('subscription_plans', {
        select: 'id, name, price_monthly, price_yearly',
      });

      // Build plan map
      const planMap: Record<string, { name: string; price_monthly: number; price_yearly: number }> = {};
      plans.forEach((p) => {
        planMap[p.id] = { name: p.name, price_monthly: p.price_monthly, price_yearly: p.price_yearly };
      });

      // Calculate MRR from active subscriptions
      let mrr = 0;
      const planRevenueMap: Record<string, number> = {};
      activeSubs.forEach((sub) => {
        const plan = planMap[sub.plan_id];
        if (!plan) return;
        const monthlyAmount =
          sub.billing_cycle === 'yearly'
            ? (plan.price_yearly || 0) / 12
            : plan.price_monthly || 0;
        mrr += monthlyAmount;
        planRevenueMap[plan.name] = (planRevenueMap[plan.name] || 0) + monthlyAmount;
      });

      // Revenue by plan
      const revenueByPlan = plans.map((plan) => ({
        name: plan.name,
        revenue: Math.round((planRevenueMap[plan.name] || 0) * 100) / 100,
      }));

      // Organizations growth by month (last 12 months)
      const now = new Date();
      const monthMap: Record<string, number> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthMap[key] = 0;
      }
      orgs.forEach((org) => {
        const d = new Date(org.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key in monthMap) {
          monthMap[key]++;
        }
      });
      // Build cumulative growth
      const windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      let cumulative = orgs.filter(
        (o) => new Date(o.created_at) < windowStart
      ).length;
      const sortedKeys = Object.keys(monthMap).sort();
      const organizationsGrowth = sortedKeys.map((key) => {
        cumulative += monthMap[key];
        const [y, m] = key.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, 1);
        const label = date.toLocaleString('en-US', { month: 'short' });
        return { month: label, count: cumulative };
      });

      // Subscription status breakdown
      const statusCounts: Record<string, number> = {};
      allSubs.forEach((s) => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      });
      const subscriptionStatusBreakdown = Object.entries(statusCounts).map(
        ([name, value]) => ({
          name,
          value,
          color: STATUS_COLORS[name] || 'hsl(215, 16%, 47%)',
        })
      );

      setStats({
        totalOrganizations: orgs.length,
        activeSubscriptions: activeSubs.length,
        mrr: Math.round(mrr * 100) / 100,
        totalUsers: userCount || 0,
        organizationsGrowth,
        revenueByPlan,
        subscriptionStatusBreakdown,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-8" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2 mb-8">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Organizations',
      value: stats?.totalOrganizations ?? 0,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Active Subscriptions',
      value: stats?.activeSubscriptions ?? 0,
      icon: CreditCard,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'MRR (Monthly Recurring)',
      value: `$${(stats?.mrr ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Platform Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of your SaaS platform performance and metrics
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-11 h-11 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2 mb-8">
        {/* Organizations Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Organizations Growth
            </CardTitle>
            <CardDescription>Cumulative organizations over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stats?.organizationsGrowth || []}>
                <defs>
                  <linearGradient id="orgGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 89%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid hsl(214, 20%, 89%)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(199, 89%, 48%)"
                  strokeWidth={2}
                  fill="url(#orgGrowthGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Revenue by Plan
            </CardTitle>
            <CardDescription>Monthly recurring revenue per plan</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats?.revenueByPlan || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 89%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid hsl(214, 20%, 89%)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {(stats?.revenueByPlan || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Subscription Status Breakdown
          </CardTitle>
          <CardDescription>Distribution of all subscriptions by status</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.subscriptionStatusBreakdown && stats.subscriptionStatusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.subscriptionStatusBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  label={(entry: any) => `${entry.name}: ${entry.value}`}
                >
                  {stats.subscriptionStatusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid hsl(214, 20%, 89%)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              No subscription data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
