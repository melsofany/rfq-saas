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
import { Plus, Search, Truck, ArrowRight, Mail, Phone } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  category: string;
  is_active: boolean;
  created_at: string;
}

export default function SuppliersListPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchSuppliers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await dataQuery<Supplier>('suppliers', {
        select: 'id, name, contact_person, email, phone, category, is_active, created_at',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
      });

      setSuppliers(data ?? []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const searchLower = search.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(searchLower) ||
      (supplier.contact_person?.toLowerCase().includes(searchLower) ?? false) ||
      (supplier.email?.toLowerCase().includes(searchLower) ?? false) ||
      supplier.category.toLowerCase().includes(searchLower)
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
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your supplier directory
          </p>
        </div>
        <Button onClick={() => router.push('/app/suppliers/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Supplier
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Suppliers</CardTitle>
          <CardDescription>{suppliers.length} total suppliers</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, contact, email, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Truck className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium text-foreground">
                {search ? 'No suppliers match your search' : 'No suppliers yet'}
              </p>
              <p className="text-xs mt-1">
                {search ? 'Try adjusting your search' : 'Add your first supplier to get started'}
              </p>
              {!search && (
                <Button size="sm" className="mt-4" onClick={() => router.push('/app/suppliers/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Supplier
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/app/suppliers/${supplier.id}`)}
                  >
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.contact_person ?? '—'}</TableCell>
                    <TableCell>
                      {supplier.email ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          {supplier.email}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {supplier.phone ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          {supplier.phone}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{supplier.category}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={supplier.is_active ? 'active' : 'inactive'} />
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
