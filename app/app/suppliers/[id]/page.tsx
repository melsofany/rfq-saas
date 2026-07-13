'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery } from '@/lib/org-data';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  User,
  Inbox,
  FileText,
  Building2,
} from 'lucide-react';

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

export default function SupplierDetailPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !id) return;
    fetchSupplierData();
  }, [orgId, id]);

  const fetchSupplierData = async () => {
    if (!orgId || !id) return;
    setLoading(true);
    try {
      const supplierData = await dataQuery<Supplier>('suppliers', {
        select: '*',
        eq: { id, org_id: orgId },
      });

      if (!supplierData || supplierData.length === 0) {
        router.push('/app/suppliers');
        return;
      }
      setSupplier(supplierData[0]);

      const offersData = await dataQuery<Offer>('offers', {
        select: 'id, total_price, status, created_at, rfq_id',
        eq: { supplier_id: id, org_id: orgId },
        order: { column: 'created_at', ascending: false },
      });

      // Fetch RFQ numbers for the offers
      const rfqIds = (offersData ?? [])
        .map((offer) => offer.rfq_id)
        .filter((rid): rid is string => rid !== null);

      let rfqMap: Record<string, string> = {};
      if (rfqIds.length > 0) {
        const rfqs = await dataQuery<{ id: string; internal_rfq_no: string }>('rfqs', {
          select: 'id, internal_rfq_no',
          eq: { org_id: orgId },
        });
        rfqs.forEach((r) => {
          rfqMap[r.id] = r.internal_rfq_no;
        });
      }

      const offersWithRfqNos = (offersData ?? []).map((offer) => ({
        ...offer,
        rfq_internal_rfq_no: offer.rfq_id ? rfqMap[offer.rfq_id] : undefined,
      }));

      setOffers(offersWithRfqNos);
    } catch (error) {
      console.error('Error fetching supplier:', error);
    } finally {
      setLoading(false);
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

  const infoItems = [
    { icon: User, label: 'Contact Person', value: supplier.contact_person },
    { icon: Mail, label: 'Email', value: supplier.email },
    { icon: Phone, label: 'Phone', value: supplier.phone },
    { icon: MapPin, label: 'Address', value: supplier.address },
    { icon: Building2, label: 'Category', value: supplier.category },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/app/suppliers')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{supplier.name}</h1>
            <StatusBadge status={supplier.is_active ? 'active' : 'inactive'} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {supplier.supplier_id ? `ID: ${supplier.supplier_id}` : supplier.category}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
                  <p className="text-sm font-medium text-foreground break-words">
                    {item.value ?? '—'}
                  </p>
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

        {/* Offer History */}
        <Card className="lg:col-span-2">
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
                <p className="text-xs mt-1">Offers will appear here once the supplier responds to RFQs</p>
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
                      <TableCell className="font-medium">
                        {offer.rfq_internal_rfq_no ?? '—'}
                      </TableCell>
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
      </div>
    </div>
  );
}
