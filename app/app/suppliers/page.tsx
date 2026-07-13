'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataInsert, dataDelete } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Search, Truck, ArrowRight, Mail, Phone, Tag, Trash2, AlertCircle } from 'lucide-react';

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

interface Category {
  id: string;
  name: string;
  created_at: string;
}

export default function SuppliersListPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    if (!orgId) return;
    setSuppliersLoading(true);
    try {
      const data = await dataQuery<Supplier>('suppliers', {
        select: 'id, name, contact_person, email, phone, category, is_active, created_at',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
      });
      setSuppliers(data ?? []);
    } catch {
      /* ignore */
    } finally {
      setSuppliersLoading(false);
    }
  }, [orgId]);

  const fetchCategories = useCallback(async () => {
    if (!orgId) return;
    setCategoriesLoading(true);
    try {
      const data = await dataQuery<Category>('supplier_categories', {
        select: 'id, name, created_at',
        eq: { org_id: orgId },
        order: { column: 'name', ascending: true },
      });
      setCategories(data ?? []);
    } catch {
      /* ignore */
    } finally {
      setCategoriesLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchSuppliers();
    fetchCategories();
  }, [fetchSuppliers, fetchCategories]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !newCatName.trim()) return;
    setCatError('');
    setCatSaving(true);
    try {
      await dataInsert('supplier_categories', {
        org_id: orgId,
        name: newCatName.trim(),
      } as any);
      setNewCatName('');
      await fetchCategories();
    } catch (err: any) {
      setCatError(err.message?.includes('unique') ? 'هذا التصنيف موجود بالفعل' : (err.message || 'فشل الحفظ'));
    } finally {
      setCatSaving(false);
    }
  };

  const confirmDelete = (cat: Category) => {
    setCategoryToDelete(cat);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete || !orgId) return;
    setDeleting(true);
    try {
      await dataDelete('supplier_categories', { id: categoryToDelete.id, org_id: orgId });
      setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id));
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    } catch (err: any) {
      setCatError(err.message || 'فشل الحذف');
    } finally {
      setDeleting(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contact_person?.toLowerCase().includes(q) ?? false) ||
      (s.email?.toLowerCase().includes(q) ?? false) ||
      s.category?.toLowerCase().includes(q)
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
          <p className="text-sm text-muted-foreground mt-1">Manage your supplier directory</p>
        </div>
        <Button onClick={() => router.push('/app/suppliers/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Supplier
        </Button>
      </div>

      <Tabs defaultValue="suppliers">
        <TabsList className="mb-6">
          <TabsTrigger value="suppliers">
            <Truck className="w-4 h-4 mr-2" />
            Suppliers ({suppliers.length})
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tag className="w-4 h-4 mr-2" />
            Categories ({categories.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Suppliers Tab ── */}
        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Suppliers</CardTitle>
              <CardDescription>{suppliers.length} total suppliers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, contact, email, or category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {suppliersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
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
                      <Plus className="w-4 h-4 mr-2" /> New Supplier
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
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {supplier.phone ? (
                            <span className="flex items-center gap-1.5 text-sm">
                              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                              {supplier.phone}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {supplier.category ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                              <Tag className="w-3 h-3" />
                              {supplier.category}
                            </span>
                          ) : '—'}
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
        </TabsContent>

        {/* ── Categories Tab ── */}
        <TabsContent value="categories">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Add Category Form */}
            <Card className="lg:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-base">Add Category</CardTitle>
                <CardDescription>Create a new supplier category</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddCategory} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="catName">Category Name</Label>
                    <Input
                      id="catName"
                      value={newCatName}
                      onChange={(e) => { setNewCatName(e.target.value); setCatError(''); }}
                      placeholder="e.g. Electronics"
                      required
                    />
                  </div>
                  {catError && (
                    <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 px-3 py-2 rounded">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {catError}
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={catSaving || !newCatName.trim()}>
                    {catSaving ? (
                      <><div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Saving...</>
                    ) : (
                      <><Plus className="w-4 h-4 mr-2" />Add Category</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Categories List */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">All Categories</CardTitle>
                <CardDescription>{categories.length} categories</CardDescription>
              </CardHeader>
              <CardContent>
                {categoriesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                  </div>
                ) : categories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Tag className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm">No categories yet</p>
                    <p className="text-xs mt-1">Add your first category using the form</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((cat) => {
                      const usedBy = suppliers.filter((s) => s.category === cat.name).length;
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                              <Tag className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{cat.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {usedBy} {usedBy === 1 ? 'supplier' : 'suppliers'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => confirmDelete(cat)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{categoryToDelete?.name}"</span>?
            {suppliers.filter((s) => s.category === categoryToDelete?.name).length > 0 && (
              <span className="block mt-2 text-amber-600">
                ⚠ {suppliers.filter((s) => s.category === categoryToDelete?.name).length} supplier(s) use this category.
              </span>
            )}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
