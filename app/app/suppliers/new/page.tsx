'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataInsert, dataQuery } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, AlertCircle, Plus, Tag } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

export default function NewSupplierPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [supplierId, setSupplierId] = useState('');

  // Categories from DB
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [addingCat, setAddingCat] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!orgId) return;
    setCatsLoading(true);
    try {
      const data = await dataQuery<Category>('supplier_categories', {
        select: 'id, name',
        eq: { org_id: orgId },
        order: { column: 'name', ascending: true },
      });
      setCategories(data ?? []);
    } catch {/* ignore */} finally {
      setCatsLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleAddCategory = async () => {
    if (!orgId || !newCatName.trim()) return;
    setAddingCat(true);
    try {
      await dataInsert('supplier_categories', { org_id: orgId, name: newCatName.trim() } as any);
      await fetchCategories();
      setCategory(newCatName.trim());
      setNewCatName('');
      setShowNewCat(false);
    } catch (err: any) {
      setError(err.message?.includes('unique') ? 'هذا التصنيف موجود بالفعل' : (err.message || 'فشل الحفظ'));
    } finally {
      setAddingCat(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setError('');
    if (!name) { setError('Supplier name is required'); return; }

    setSaving(true);
    try {
      const data = await dataInsert<{ id: string }>('suppliers', {
        org_id: orgId,
        name,
        contact_person: contactPerson || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        category: category || null,
        supplier_id: supplierId || null,
        is_active: true,
      } as any);

      router.push(`/app/suppliers/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create supplier');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !orgId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/app/suppliers')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">New Supplier</h1>
          <p className="text-sm text-muted-foreground mt-1">Add a new supplier to your directory</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Supplier Information</CardTitle>
            <CardDescription>Enter the supplier's details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corporation" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplierId">Supplier ID</Label>
                <Input id="supplierId" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="SUP-001" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="John Smith" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="supplier@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address, city, state..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Category Card */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" /> Category
            </CardTitle>
            <CardDescription>Classify this supplier for easier filtering</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {catsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No categories yet — add one below</div>
                  ) : (
                    categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}

            {!showNewCat ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNewCat(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New Category
              </Button>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name..."
                  className="h-9 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                  autoFocus
                />
                <Button type="button" size="sm" onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()}>
                  {addingCat ? '...' : 'Add'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewCat(false); setNewCatName(''); }}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-lg mb-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push('/app/suppliers')}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <><div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Create Supplier</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
