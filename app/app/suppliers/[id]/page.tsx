'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataInsert } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Mail, Phone, MapPin, User, Inbox, Building2, Plus, Star, AlertCircle,
} from 'lucide-react';
import { StarRating, StarBadge, ScoreBar } from '@/components/StarRating';

/* ─── Types ─────────────────────────── */

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string;
  is_active: boolean;
  supplier_id: string | null;
  created_at: string;
}

interface Offer {
  id: string;
  total_price: number | null;
  status: string;
  created_at: string;
  rfq_id: string;
  rfq_internal_rfq_no?: string;
}

interface SupplierRating {
  id: string;
  rated_by: string | null;
  rater_name?: string;
  price_score: number;
  delivery_score: number;
  quality_score: number;
  communication_score: number;
  compliance_score: number;
  overall_score: number;
  notes: string | null;
  created_at: string;
}

const SCORE_LABEL: Record<number, string> = {
  1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent',
};

function avg(...scores: number[]) {
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/* ─── Component ──────────────────────── */

export default function SupplierDetailPage() {
  const { orgId, orgMember, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [ratings, setRatings] = useState<SupplierRating[]>([]);
  const [loading, setLoading] = useState(true);

  // Rating dialog
  const [ratingOpen, setRatingOpen] = useState(false);
  const [priceScore, setPriceScore] = useState(0);
  const [deliveryScore, setDeliveryScore] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [commScore, setCommScore] = useState(0);
  const [complianceScore, setComplianceScore] = useState(0);
  const [ratingNotes, setRatingNotes] = useState('');
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState('');

  const fetchSupplierData = useCallback(async () => {
    if (!orgId || !id) return;
    setLoading(true);
    try {
      const [supplierData, offersData, ratingsData, membersData] = await Promise.all([
        dataQuery<Supplier>('suppliers', { select: '*', eq: { id, org_id: orgId } }),
        dataQuery<Offer>('offers', {
          select: 'id, total_price, status, created_at, rfq_id',
          eq: { supplier_id: id, org_id: orgId },
          order: { column: 'created_at', ascending: false },
        }),
        dataQuery<SupplierRating>('supplier_ratings', {
          select: 'id, rated_by, price_score, delivery_score, quality_score, communication_score, compliance_score, overall_score, notes, created_at',
          eq: { supplier_id: id, org_id: orgId },
          order: { column: 'created_at', ascending: false },
        }),
        dataQuery<{ id: string; full_name: string | null; email: string | null }>('organization_members', {
          select: 'id, full_name, email',
          eq: { org_id: orgId },
        }),
      ]);

      if (!supplierData || supplierData.length === 0) {
        router.push('/app/suppliers');
        return;
      }
      setSupplier(supplierData[0]);

      // Enrich offers with RFQ numbers
      const rfqIds = (offersData ?? []).map((o) => o.rfq_id).filter(Boolean);
      let rfqMap: Record<string, string> = {};
      if (rfqIds.length > 0) {
        const rfqs = await dataQuery<{ id: string; internal_rfq_no: string }>('rfqs', {
          select: 'id, internal_rfq_no', eq: { org_id: orgId },
        });
        rfqs.forEach((r) => { rfqMap[r.id] = r.internal_rfq_no; });
      }
      setOffers((offersData ?? []).map((o) => ({ ...o, rfq_internal_rfq_no: o.rfq_id ? rfqMap[o.rfq_id] : undefined })));

      // Enrich ratings with rater names
      const memberMap: Record<string, string> = {};
      (membersData ?? []).forEach((m) => { memberMap[m.id] = m.full_name || m.email || m.id; });
      setRatings((ratingsData ?? []).map((r) => ({
        ...r,
        rater_name: r.rated_by ? memberMap[r.rated_by] : undefined,
      })));
    } catch (error) {
      console.error('Error fetching supplier:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId, id, router]);

  useEffect(() => { fetchSupplierData(); }, [fetchSupplierData]);

  const resetRatingForm = () => {
    setPriceScore(0); setDeliveryScore(0); setQualityScore(0);
    setCommScore(0); setComplianceScore(0); setRatingNotes(''); setRatingError('');
  };

  const handleSubmitRating = async () => {
    if (!orgId) return;
    setRatingError('');
    if ([priceScore, deliveryScore, qualityScore, commScore, complianceScore].some((s) => s === 0)) {
      setRatingError('Please rate all criteria (1–5 stars)');
      return;
    }
    setRatingSaving(true);
    try {
      const overall = avg(priceScore, deliveryScore, qualityScore, commScore, complianceScore);
      await dataInsert('supplier_ratings', {
        org_id: orgId,
        supplier_id: id,
        rated_by: orgMember?.id || null,
        price_score: priceScore,
        delivery_score: deliveryScore,
        quality_score: qualityScore,
        communication_score: commScore,
        compliance_score: complianceScore,
        overall_score: parseFloat(overall.toFixed(2)),
        notes: ratingNotes.trim() || null,
      } as any);
      setRatingOpen(false);
      resetRatingForm();
      await fetchSupplierData();
    } catch (err: any) {
      setRatingError(err.message || 'Failed to save rating');
    } finally {
      setRatingSaving(false);
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

  if (!supplier) return null;

  // Compute averages from ratings
  const ratingCount = ratings.length;
  const avgOf = (field: keyof SupplierRating) =>
    ratingCount > 0 ? ratings.reduce((a, r) => a + ((r[field] as number) || 0), 0) / ratingCount : 0;
  const avgOverall      = avgOf('overall_score');
  const avgPrice        = avgOf('price_score');
  const avgDelivery     = avgOf('delivery_score');
  const avgQuality      = avgOf('quality_score');
  const avgCommunication = avgOf('communication_score');
  const avgCompliance   = avgOf('compliance_score');

  const infoItems = [
    { icon: User,     label: 'Contact Person', value: supplier.contact_person },
    { icon: Mail,     label: 'Email',           value: supplier.email },
    { icon: Phone,    label: 'Phone',           value: supplier.phone },
    { icon: MapPin,   label: 'Address',         value: supplier.address },
    { icon: Building2, label: 'Category',       value: supplier.category },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/app/suppliers')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{supplier.name}</h1>
            <StatusBadge status={supplier.is_active ? 'active' : 'inactive'} />
            {ratingCount > 0 && <StarBadge score={avgOverall} count={ratingCount} />}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {supplier.supplier_id ? `ID: ${supplier.supplier_id}` : supplier.category}
          </p>
        </div>
        <Button variant="outline" onClick={() => { resetRatingForm(); setRatingOpen(true); }}>
          <Star className="w-4 h-4 mr-2" />
          Rate Supplier
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Supplier Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium text-foreground break-words">{item.value ?? '—'}</p>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Added on {new Date(supplier.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Rating Summary Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Performance Score</CardTitle>
                <CardDescription>
                  {ratingCount > 0
                    ? `Based on ${ratingCount} evaluation${ratingCount !== 1 ? 's' : ''}`
                    : 'No evaluations yet'}
                </CardDescription>
              </div>
              {ratingCount > 0 && (
                <div className="text-right">
                  <p className="text-3xl font-bold text-foreground">{avgOverall.toFixed(1)}</p>
                  <StarRating value={avgOverall} size="sm" className="justify-end mt-1" />
                  <p className="text-xs text-muted-foreground mt-0.5">out of 5</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {ratingCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Star className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">No ratings yet</p>
                <p className="text-xs mt-1">Be the first to evaluate this supplier</p>
                <Button size="sm" className="mt-4" onClick={() => { resetRatingForm(); setRatingOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Add Rating
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <ScoreBar label="💰 Price Competitiveness" score={avgPrice} />
                <ScoreBar label="🚚 Delivery Speed & Reliability" score={avgDelivery} />
                <ScoreBar label="⭐ Product / Service Quality" score={avgQuality} />
                <ScoreBar label="💬 Communication" score={avgCommunication} />
                <ScoreBar label="✅ Compliance with Specs" score={avgCompliance} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Offers + Ratings history */}
      <Tabs defaultValue="offers">
        <TabsList className="mb-6">
          <TabsTrigger value="offers">
            <Inbox className="w-4 h-4 mr-2" />
            Offer History ({offers.length})
          </TabsTrigger>
          <TabsTrigger value="ratings">
            <Star className="w-4 h-4 mr-2" />
            Rating History ({ratingCount})
          </TabsTrigger>
        </TabsList>

        {/* Offers */}
        <TabsContent value="offers">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Offer History</CardTitle>
              <CardDescription>
                {offers.length} {offers.length === 1 ? 'offer' : 'offers'} submitted by this supplier
              </CardDescription>
            </CardHeader>
            <CardContent>
              {offers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Inbox className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">No offers from this supplier yet</p>
                  <p className="text-xs mt-1">Offers appear once the supplier responds to RFQs</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RFQ No</TableHead>
                      <TableHead className="text-right">Total Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offers.map((offer) => (
                      <TableRow
                        key={offer.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/app/rfq/${offer.rfq_id}`)}
                      >
                        <TableCell className="font-medium">{offer.rfq_internal_rfq_no ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {offer.total_price != null
                            ? `$${offer.total_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '—'}
                        </TableCell>
                        <TableCell><StatusBadge status={offer.status} /></TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(offer.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ratings history */}
        <TabsContent value="ratings">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Rating History</CardTitle>
                  <CardDescription>{ratingCount} evaluation{ratingCount !== 1 ? 's' : ''}</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => { resetRatingForm(); setRatingOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Add Rating
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {ratingCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Star className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">No ratings yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Overall</TableHead>
                      <TableHead className="hidden md:table-cell">Price</TableHead>
                      <TableHead className="hidden md:table-cell">Delivery</TableHead>
                      <TableHead className="hidden md:table-cell">Quality</TableHead>
                      <TableHead className="hidden lg:table-cell">Comm.</TableHead>
                      <TableHead className="hidden lg:table-cell">Compliance</TableHead>
                      <TableHead className="hidden md:table-cell">Rated By</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ratings.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell><StarBadge score={Number(r.overall_score)} /></TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{r.price_score}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{r.delivery_score}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{r.quality_score}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{r.communication_score}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{r.compliance_score}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{r.rater_name ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{r.notes ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Rate Supplier Dialog ── */}
      <Dialog open={ratingOpen} onOpenChange={(o) => { if (!o) resetRatingForm(); setRatingOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rate {supplier.name}</DialogTitle>
            <DialogDescription>
              Evaluate supplier performance (1 = Poor, 5 = Excellent)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {([
              { label: '💰 Price Competitiveness',        value: priceScore,      set: setPriceScore },
              { label: '🚚 Delivery Speed & Reliability', value: deliveryScore,   set: setDeliveryScore },
              { label: '⭐ Product / Service Quality',    value: qualityScore,    set: setQualityScore },
              { label: '💬 Communication & Responsiveness', value: commScore,     set: setCommScore },
              { label: '✅ Compliance with Specifications', value: complianceScore, set: setComplianceScore },
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

            {[priceScore, deliveryScore, qualityScore, commScore, complianceScore].every((s) => s > 0) && (
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overall Score</span>
                <StarBadge score={avg(priceScore, deliveryScore, qualityScore, commScore, complianceScore)} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={ratingNotes}
                onChange={(e) => setRatingNotes(e.target.value)}
                placeholder="Any comments or observations..."
                rows={3}
              />
            </div>
          </div>

          {ratingError && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {ratingError}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRatingOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitRating} disabled={ratingSaving}>
              {ratingSaving ? 'Saving...' : 'Save Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
