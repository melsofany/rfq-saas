'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataInsert } from '@/lib/org-data';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Truck, Users, Plus, Star, AlertCircle, Trophy, TrendingUp,
} from 'lucide-react';
import { StarRating, StarBadge, ScoreBar } from '@/components/StarRating';

/* ─── Types ─────────────────────────────────────── */

interface Supplier {
  id: string;
  name: string;
  category: string;
}

interface Member {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

interface SupplierRating {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  rated_by: string | null;
  rater_name?: string;
  rfq_id: string | null;
  po_id: string | null;
  price_score: number;
  delivery_score: number;
  quality_score: number;
  communication_score: number;
  compliance_score: number;
  overall_score: number;
  notes: string | null;
  created_at: string;
}

interface EmployeeRating {
  id: string;
  member_id: string;
  member_name?: string;
  rated_by: string | null;
  rater_name?: string;
  period_label: string | null;
  work_quality_score: number;
  timeliness_score: number;
  teamwork_score: number;
  initiative_score: number;
  communication_score: number;
  overall_score: number;
  notes: string | null;
  created_at: string;
}

interface SupplierSummary {
  id: string;
  name: string;
  category: string;
  avgOverall: number;
  avgPrice: number;
  avgDelivery: number;
  avgQuality: number;
  avgCommunication: number;
  avgCompliance: number;
  count: number;
}

interface MemberSummary {
  id: string;
  name: string;
  role: string;
  avgOverall: number;
  avgWorkQuality: number;
  avgTimeliness: number;
  avgTeamwork: number;
  avgInitiative: number;
  avgCommunication: number;
  count: number;
}

/* ─── Helpers ─────────────────────────────────── */

function avg(...scores: number[]) {
  const valid = scores.filter((s) => s > 0);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function medalColor(rank: number) {
  if (rank === 1) return 'text-amber-500';
  if (rank === 2) return 'text-slate-400';
  if (rank === 3) return 'text-amber-700';
  return 'text-muted-foreground';
}

const SCORE_LABEL: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

/* ─── Component ─────────────────────────────────── */

export default function RatingsPage() {
  const { orgId, orgMember, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  // Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [supplierRatings, setSupplierRatings] = useState<SupplierRating[]>([]);
  const [employeeRatings, setEmployeeRatings] = useState<EmployeeRating[]>([]);

  // Supplier rating dialog
  const [sRatingOpen, setSRatingOpen] = useState(false);
  const [sSelectedId, setSSelectedId] = useState('');
  const [sPriceScore, setSPriceScore] = useState(0);
  const [sDeliveryScore, setSDeliveryScore] = useState(0);
  const [sQualityScore, setSQualityScore] = useState(0);
  const [sCommScore, setSCommScore] = useState(0);
  const [sComplianceScore, setSComplianceScore] = useState(0);
  const [sNotes, setSNotes] = useState('');
  const [sSaving, setSSaving] = useState(false);
  const [sError, setSError] = useState('');

  // Employee rating dialog
  const [eRatingOpen, setERatingOpen] = useState(false);
  const [eSelectedId, setESelectedId] = useState('');
  const [ePeriod, setEPeriod] = useState('');
  const [eWorkScore, setEWorkScore] = useState(0);
  const [eTimeScore, setETimeScore] = useState(0);
  const [eTeamScore, setETeamScore] = useState(0);
  const [eInitScore, setEInitScore] = useState(0);
  const [eCommScore, setECommScore] = useState(0);
  const [eNotes, setENotes] = useState('');
  const [eSaving, setESaving] = useState(false);
  const [eError, setEError] = useState('');

  /* ── Fetch ── */
  const fetchAll = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [suppliersData, membersData, sRatingsData, eRatingsData] = await Promise.all([
        dataQuery<Supplier>('suppliers', {
          select: 'id, name, category',
          eq: { org_id: orgId, is_active: true },
          order: { column: 'name', ascending: true },
        }),
        dataQuery<Member>('organization_members', {
          select: 'id, full_name, email, role',
          eq: { org_id: orgId, is_active: true },
          order: { column: 'created_at', ascending: true },
        }),
        dataQuery<SupplierRating>('supplier_ratings', {
          select: 'id, supplier_id, rated_by, rfq_id, po_id, price_score, delivery_score, quality_score, communication_score, compliance_score, overall_score, notes, created_at',
          eq: { org_id: orgId },
          order: { column: 'created_at', ascending: false },
        }),
        dataQuery<EmployeeRating>('employee_ratings', {
          select: 'id, member_id, rated_by, period_label, work_quality_score, timeliness_score, teamwork_score, initiative_score, communication_score, overall_score, notes, created_at',
          eq: { org_id: orgId },
          order: { column: 'created_at', ascending: false },
        }),
      ]);

      setSuppliers(suppliersData ?? []);
      setMembers(membersData ?? []);

      // Enrich supplier ratings with names
      const supplierMap: Record<string, string> = {};
      (suppliersData ?? []).forEach((s) => { supplierMap[s.id] = s.name; });
      const memberMap: Record<string, string> = {};
      (membersData ?? []).forEach((m) => { memberMap[m.id] = m.full_name || m.email || m.id; });

      setSupplierRatings(
        (sRatingsData ?? []).map((r) => ({
          ...r,
          supplier_name: r.supplier_id ? supplierMap[r.supplier_id] : undefined,
          rater_name: r.rated_by ? memberMap[r.rated_by] : undefined,
        }))
      );
      setEmployeeRatings(
        (eRatingsData ?? []).map((r) => ({
          ...r,
          member_name: r.member_id ? memberMap[r.member_id] : undefined,
          rater_name: r.rated_by ? memberMap[r.rated_by] : undefined,
        }))
      );
    } catch (err) {
      console.error('Error fetching ratings:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Computed summaries ── */
  const supplierSummaries: SupplierSummary[] = suppliers.map((s) => {
    const sRatings = supplierRatings.filter((r) => r.supplier_id === s.id);
    const count = sRatings.length;
    if (count === 0) return { ...s, avgOverall: 0, avgPrice: 0, avgDelivery: 0, avgQuality: 0, avgCommunication: 0, avgCompliance: 0, count: 0 };
    const mean = (field: keyof SupplierRating) =>
      sRatings.reduce((a, r) => a + ((r[field] as number) || 0), 0) / count;
    return {
      ...s,
      avgOverall: parseFloat(mean('overall_score').toFixed(2)),
      avgPrice: parseFloat(mean('price_score').toFixed(2)),
      avgDelivery: parseFloat(mean('delivery_score').toFixed(2)),
      avgQuality: parseFloat(mean('quality_score').toFixed(2)),
      avgCommunication: parseFloat(mean('communication_score').toFixed(2)),
      avgCompliance: parseFloat(mean('compliance_score').toFixed(2)),
      count,
    };
  }).sort((a, b) => b.avgOverall - a.avgOverall);

  const memberSummaries: MemberSummary[] = members.map((m) => {
    const mRatings = employeeRatings.filter((r) => r.member_id === m.id);
    const count = mRatings.length;
    if (count === 0) return { id: m.id, name: m.full_name || m.email || m.id, role: m.role, avgOverall: 0, avgWorkQuality: 0, avgTimeliness: 0, avgTeamwork: 0, avgInitiative: 0, avgCommunication: 0, count: 0 };
    const mean = (field: keyof EmployeeRating) =>
      mRatings.reduce((a, r) => a + ((r[field] as number) || 0), 0) / count;
    return {
      id: m.id,
      name: m.full_name || m.email || m.id,
      role: m.role,
      avgOverall: parseFloat(mean('overall_score').toFixed(2)),
      avgWorkQuality: parseFloat(mean('work_quality_score').toFixed(2)),
      avgTimeliness: parseFloat(mean('timeliness_score').toFixed(2)),
      avgTeamwork: parseFloat(mean('teamwork_score').toFixed(2)),
      avgInitiative: parseFloat(mean('initiative_score').toFixed(2)),
      avgCommunication: parseFloat(mean('communication_score').toFixed(2)),
      count,
    };
  }).sort((a, b) => b.avgOverall - a.avgOverall);

  /* ── Supplier rating submit ── */
  const resetSupplierForm = () => {
    setSSelectedId(''); setSPriceScore(0); setSDeliveryScore(0); setSQualityScore(0);
    setSCommScore(0); setSComplianceScore(0); setSNotes(''); setSError('');
  };

  const handleSubmitSupplierRating = async () => {
    if (!orgId) return;
    setSError('');
    if (!sSelectedId) { setSError('Please select a supplier'); return; }
    if ([sPriceScore, sDeliveryScore, sQualityScore, sCommScore, sComplianceScore].some((s) => s === 0)) {
      setSError('Please rate all criteria (1–5 stars)');
      return;
    }
    setSSaving(true);
    try {
      const overall = avg(sPriceScore, sDeliveryScore, sQualityScore, sCommScore, sComplianceScore);
      await dataInsert('supplier_ratings', {
        org_id: orgId,
        supplier_id: sSelectedId,
        rated_by: orgMember?.id || null,
        price_score: sPriceScore,
        delivery_score: sDeliveryScore,
        quality_score: sQualityScore,
        communication_score: sCommScore,
        compliance_score: sComplianceScore,
        overall_score: parseFloat(overall.toFixed(2)),
        notes: sNotes.trim() || null,
      } as any);
      setSRatingOpen(false);
      resetSupplierForm();
      await fetchAll();
    } catch (err: any) {
      setSError(err.message || 'Failed to save rating');
    } finally {
      setSSaving(false);
    }
  };

  /* ── Employee rating submit ── */
  const resetEmployeeForm = () => {
    setESelectedId(''); setEPeriod(''); setEWorkScore(0); setETimeScore(0);
    setETeamScore(0); setEInitScore(0); setECommScore(0); setENotes(''); setEError('');
  };

  const handleSubmitEmployeeRating = async () => {
    if (!orgId) return;
    setEError('');
    if (!eSelectedId) { setEError('Please select an employee'); return; }
    if ([eWorkScore, eTimeScore, eTeamScore, eInitScore, eCommScore].some((s) => s === 0)) {
      setEError('Please rate all criteria (1–5 stars)');
      return;
    }
    setESaving(true);
    try {
      const overall = avg(eWorkScore, eTimeScore, eTeamScore, eInitScore, eCommScore);
      await dataInsert('employee_ratings', {
        org_id: orgId,
        member_id: eSelectedId,
        rated_by: orgMember?.id || null,
        period_label: ePeriod.trim() || null,
        work_quality_score: eWorkScore,
        timeliness_score: eTimeScore,
        teamwork_score: eTeamScore,
        initiative_score: eInitScore,
        communication_score: eCommScore,
        overall_score: parseFloat(overall.toFixed(2)),
        notes: eNotes.trim() || null,
      } as any);
      setERatingOpen(false);
      resetEmployeeForm();
      await fetchAll();
    } catch (err: any) {
      setEError(err.message || 'Failed to save rating');
    } finally {
      setESaving(false);
    }
  };

  /* ── Skeleton ── */
  if (authLoading || !orgId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  /* ── Summary KPIs ── */
  const ratedSuppliers = supplierSummaries.filter((s) => s.count > 0);
  const ratedMembers   = memberSummaries.filter((m) => m.count > 0);
  const avgSupplierScore = ratedSuppliers.length
    ? ratedSuppliers.reduce((a, s) => a + s.avgOverall, 0) / ratedSuppliers.length
    : 0;
  const avgEmployeeScore = ratedMembers.length
    ? ratedMembers.reduce((a, m) => a + m.avgOverall, 0) / ratedMembers.length
    : 0;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Ratings & Evaluations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance evaluation for suppliers and team members
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { resetSupplierForm(); setSRatingOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Rate Supplier
          </Button>
          <Button onClick={() => { resetEmployeeForm(); setERatingOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Rate Employee
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[
          { label: 'Supplier Ratings', value: supplierRatings.length, icon: Truck, color: 'text-blue-600 bg-blue-50' },
          { label: 'Avg Supplier Score', value: avgSupplierScore > 0 ? `★ ${avgSupplierScore.toFixed(1)}` : '—', icon: Star, color: 'text-amber-600 bg-amber-50' },
          { label: 'Employee Ratings', value: employeeRatings.length, icon: Users, color: 'text-green-600 bg-green-50' },
          { label: 'Avg Employee Score', value: avgEmployeeScore > 0 ? `★ ${avgEmployeeScore.toFixed(1)}` : '—', icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
        ].map((card) => (
          loading ? <Skeleton key={card.label} className="h-24" /> : (
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
          )
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="suppliers">
        <TabsList className="mb-6">
          <TabsTrigger value="suppliers">
            <Truck className="w-4 h-4 mr-2" />
            Suppliers ({supplierRatings.length})
          </TabsTrigger>
          <TabsTrigger value="employees">
            <Users className="w-4 h-4 mr-2" />
            Employees ({employeeRatings.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Suppliers Tab ── */}
        <TabsContent value="suppliers">
          {loading ? (
            <Skeleton className="h-96" />
          ) : (
            <div className="space-y-6">
              {/* Leaderboard */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Supplier Leaderboard
                  </CardTitle>
                  <CardDescription>Ranked by average overall score</CardDescription>
                </CardHeader>
                <CardContent>
                  {supplierSummaries.filter((s) => s.count > 0).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Truck className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm font-medium">No supplier ratings yet</p>
                      <p className="text-xs mt-1">Add the first rating to start tracking performance</p>
                      <Button size="sm" className="mt-4" onClick={() => { resetSupplierForm(); setSRatingOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Rate a Supplier
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead className="text-right">Overall</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Price</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Delivery</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Quality</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">Communication</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">Compliance</TableHead>
                          <TableHead className="text-right">Ratings</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierSummaries
                          .filter((s) => s.count > 0)
                          .map((s, idx) => (
                            <TableRow key={s.id}>
                              <TableCell>
                                <span className={`font-bold text-sm ${medalColor(idx + 1)}`}>
                                  {idx + 1}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{s.name}</p>
                                  <p className="text-xs text-muted-foreground">{s.category}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <StarBadge score={s.avgOverall} />
                              </TableCell>
                              <TableCell className="text-right hidden md:table-cell">
                                <span className="text-sm">{s.avgPrice > 0 ? s.avgPrice.toFixed(1) : '—'}</span>
                              </TableCell>
                              <TableCell className="text-right hidden md:table-cell">
                                <span className="text-sm">{s.avgDelivery > 0 ? s.avgDelivery.toFixed(1) : '—'}</span>
                              </TableCell>
                              <TableCell className="text-right hidden md:table-cell">
                                <span className="text-sm">{s.avgQuality > 0 ? s.avgQuality.toFixed(1) : '—'}</span>
                              </TableCell>
                              <TableCell className="text-right hidden lg:table-cell">
                                <span className="text-sm">{s.avgCommunication > 0 ? s.avgCommunication.toFixed(1) : '—'}</span>
                              </TableCell>
                              <TableCell className="text-right hidden lg:table-cell">
                                <span className="text-sm">{s.avgCompliance > 0 ? s.avgCompliance.toFixed(1) : '—'}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary">{s.count}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Recent Ratings History */}
              {supplierRatings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Rating History</CardTitle>
                    <CardDescription>All supplier evaluations in chronological order</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Overall</TableHead>
                          <TableHead className="hidden md:table-cell">Breakdown</TableHead>
                          <TableHead className="hidden md:table-cell">Rated By</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierRatings.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium text-sm">
                              {r.supplier_name ?? '—'}
                            </TableCell>
                            <TableCell>
                              <StarBadge score={Number(r.overall_score)} />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="text-xs text-muted-foreground space-y-0.5 min-w-[160px]">
                                <div className="flex gap-4">
                                  <span>💰 {r.price_score}</span>
                                  <span>🚚 {r.delivery_score}</span>
                                  <span>⭐ {r.quality_score}</span>
                                  <span>💬 {r.communication_score}</span>
                                  <span>✅ {r.compliance_score}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                              {r.rater_name ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                              {r.notes ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Employees Tab ── */}
        <TabsContent value="employees">
          {loading ? (
            <Skeleton className="h-96" />
          ) : (
            <div className="space-y-6">
              {/* Leaderboard */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Employee Performance Leaderboard
                  </CardTitle>
                  <CardDescription>Ranked by average overall score</CardDescription>
                </CardHeader>
                <CardContent>
                  {memberSummaries.filter((m) => m.count > 0).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Users className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm font-medium">No employee ratings yet</p>
                      <p className="text-xs mt-1">Add the first evaluation to track team performance</p>
                      <Button size="sm" className="mt-4" onClick={() => { resetEmployeeForm(); setERatingOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Rate an Employee
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Employee</TableHead>
                          <TableHead className="text-right">Overall</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Work Quality</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Timeliness</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Teamwork</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">Initiative</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">Communication</TableHead>
                          <TableHead className="text-right">Ratings</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {memberSummaries
                          .filter((m) => m.count > 0)
                          .map((m, idx) => (
                            <TableRow key={m.id}>
                              <TableCell>
                                <span className={`font-bold text-sm ${medalColor(idx + 1)}`}>
                                  {idx + 1}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{m.name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <StarBadge score={m.avgOverall} />
                              </TableCell>
                              <TableCell className="text-right hidden md:table-cell">
                                <span className="text-sm">{m.avgWorkQuality > 0 ? m.avgWorkQuality.toFixed(1) : '—'}</span>
                              </TableCell>
                              <TableCell className="text-right hidden md:table-cell">
                                <span className="text-sm">{m.avgTimeliness > 0 ? m.avgTimeliness.toFixed(1) : '—'}</span>
                              </TableCell>
                              <TableCell className="text-right hidden md:table-cell">
                                <span className="text-sm">{m.avgTeamwork > 0 ? m.avgTeamwork.toFixed(1) : '—'}</span>
                              </TableCell>
                              <TableCell className="text-right hidden lg:table-cell">
                                <span className="text-sm">{m.avgInitiative > 0 ? m.avgInitiative.toFixed(1) : '—'}</span>
                              </TableCell>
                              <TableCell className="text-right hidden lg:table-cell">
                                <span className="text-sm">{m.avgCommunication > 0 ? m.avgCommunication.toFixed(1) : '—'}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary">{m.count}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Employee Score Breakdown Cards */}
              {memberSummaries.filter((m) => m.count > 0).length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {memberSummaries
                    .filter((m) => m.count > 0)
                    .slice(0, 6)
                    .map((m) => (
                      <Card key={m.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-sm font-semibold">{m.name}</CardTitle>
                              <CardDescription className="capitalize text-xs">{m.role}</CardDescription>
                            </div>
                            <StarBadge score={m.avgOverall} />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <ScoreBar label="Work Quality"  score={m.avgWorkQuality} />
                          <ScoreBar label="Timeliness"    score={m.avgTimeliness} />
                          <ScoreBar label="Teamwork"      score={m.avgTeamwork} />
                          <ScoreBar label="Initiative"    score={m.avgInitiative} />
                          <ScoreBar label="Communication" score={m.avgCommunication} />
                          <p className="text-xs text-muted-foreground pt-1">
                            Based on {m.count} evaluation{m.count !== 1 ? 's' : ''}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}

              {/* Rating History */}
              {employeeRatings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Evaluation History</CardTitle>
                    <CardDescription>All employee evaluations in chronological order</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Overall</TableHead>
                          <TableHead className="hidden md:table-cell">Breakdown</TableHead>
                          <TableHead className="hidden md:table-cell">Rated By</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeRatings.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium text-sm">{r.member_name ?? '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {r.period_label ?? 'General'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <StarBadge score={Number(r.overall_score)} />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="text-xs text-muted-foreground">
                                <div className="flex gap-3">
                                  <span>🏆 {r.work_quality_score}</span>
                                  <span>⏱ {r.timeliness_score}</span>
                                  <span>🤝 {r.teamwork_score}</span>
                                  <span>💡 {r.initiative_score}</span>
                                  <span>💬 {r.communication_score}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                              {r.rater_name ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                              {r.notes ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add Supplier Rating Dialog ── */}
      <Dialog open={sRatingOpen} onOpenChange={(o) => { if (!o) resetSupplierForm(); setSRatingOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rate a Supplier</DialogTitle>
            <DialogDescription>
              Evaluate supplier performance across five criteria (1 = Poor, 5 = Excellent)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Supplier select */}
            <div className="space-y-1.5">
              <Label>Supplier <span className="text-destructive">*</span></Label>
              <Select value={sSelectedId} onValueChange={setSSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Criteria */}
            {([
              { label: '💰 Price Competitiveness', value: sPriceScore, set: setSPriceScore },
              { label: '🚚 Delivery Speed & Reliability', value: sDeliveryScore, set: setSDeliveryScore },
              { label: '⭐ Product / Service Quality', value: sQualityScore, set: setSQualityScore },
              { label: '💬 Communication & Responsiveness', value: sCommScore, set: setSCommScore },
              { label: '✅ Compliance with Specifications', value: sComplianceScore, set: setSComplianceScore },
            ] as { label: string; value: number; set: (v: number) => void }[]).map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-4">
                <Label className="text-sm">{c.label}</Label>
                <div className="flex items-center gap-3">
                  <StarRating value={c.value} onChange={c.set} size="lg" />
                  <span className="text-xs text-muted-foreground w-16">
                    {c.value > 0 ? SCORE_LABEL[c.value] : '—'}
                  </span>
                </div>
              </div>
            ))}

            {/* Overall preview */}
            {[sPriceScore, sDeliveryScore, sQualityScore, sCommScore, sComplianceScore].every((s) => s > 0) && (
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overall Score</span>
                <StarBadge
                  score={avg(sPriceScore, sDeliveryScore, sQualityScore, sCommScore, sComplianceScore)}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={sNotes}
                onChange={(e) => setSNotes(e.target.value)}
                placeholder="Any comments or observations..."
                rows={3}
              />
            </div>
          </div>

          {sError && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {sError}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSRatingOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitSupplierRating} disabled={sSaving}>
              {sSaving ? 'Saving...' : 'Save Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Employee Rating Dialog ── */}
      <Dialog open={eRatingOpen} onOpenChange={(o) => { if (!o) resetEmployeeForm(); setERatingOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Evaluate an Employee</DialogTitle>
            <DialogDescription>
              Rate team member performance across five criteria (1 = Poor, 5 = Excellent)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Employee select */}
            <div className="space-y-1.5">
              <Label>Employee <span className="text-destructive">*</span></Label>
              <Select value={eSelectedId} onValueChange={setESelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team member..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name || m.email || m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period */}
            <div className="space-y-1.5">
              <Label>Evaluation Period (optional)</Label>
              <Input
                value={ePeriod}
                onChange={(e) => setEPeriod(e.target.value)}
                placeholder="e.g. Q2 2025, July 2025"
              />
            </div>

            {/* Criteria */}
            {([
              { label: '🏆 Work Quality',     value: eWorkScore,  set: setEWorkScore },
              { label: '⏱ Timeliness & Deadlines', value: eTimeScore, set: setETimeScore },
              { label: '🤝 Teamwork & Collaboration', value: eTeamScore, set: setETeamScore },
              { label: '💡 Initiative & Problem-Solving', value: eInitScore, set: setEInitScore },
              { label: '💬 Communication Skills', value: eCommScore, set: setECommScore },
            ] as { label: string; value: number; set: (v: number) => void }[]).map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-4">
                <Label className="text-sm">{c.label}</Label>
                <div className="flex items-center gap-3">
                  <StarRating value={c.value} onChange={c.set} size="lg" />
                  <span className="text-xs text-muted-foreground w-16">
                    {c.value > 0 ? SCORE_LABEL[c.value] : '—'}
                  </span>
                </div>
              </div>
            ))}

            {/* Overall preview */}
            {[eWorkScore, eTimeScore, eTeamScore, eInitScore, eCommScore].every((s) => s > 0) && (
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overall Score</span>
                <StarBadge
                  score={avg(eWorkScore, eTimeScore, eTeamScore, eInitScore, eCommScore)}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={eNotes}
                onChange={(e) => setENotes(e.target.value)}
                placeholder="Any comments or observations..."
                rows={3}
              />
            </div>
          </div>

          {eError && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {eError}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setERatingOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitEmployeeRating} disabled={eSaving}>
              {eSaving ? 'Saving...' : 'Save Evaluation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
