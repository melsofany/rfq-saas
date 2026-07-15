'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataUpdate, dataDelete } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Mail, Phone, MapPin, User, Inbox, Building2, Pencil, Trash2, AlertCircle,
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

interface EditData {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  is_active: boolean;
}

export default function SupplierDetailPage() {
  const { orgId, isLoading: authLoading, isAdmin } = useAuth() as any;
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<EditData>({
    name: '', contact_person: '', email: '', phone: '', address: '', category: '', is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSupplierData = useCallback(async () => {
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

      const rfqIds = (offersData ?? []).map((o) => o.rfq_id).filter(Boolean);
      let rfqMap: Record<string, string> = {};
      if (rfqIds.length > 0) {
        const rfqs = await dataQuery<{ id: string; internal_rfq_no: string }>('rfqs', {
          select: 'id, internal_rfq_no',
          eq: { org_id: orgId },
        });
        rfqs.forEach((r) => { rfqMap[r.id] = r.internal_rfq_no; });
      }

      setOffers((offersData ?? []).map((o) => ({ ...o, rfq_internal_rfq_no: o.rfq_id ? rfqMap[o.rfq_id] : undefined })));
    } catch (error) {
      console.error('Error fetching supplier:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId, id, router]);

  useEffect(() => {
    if (!orgId || !id) return;
    fetchSupplierData();
  }, [orgId, id, fetchSupplierData]);

  const openEdit = () => {
    if (!supplier) return;
    setEditData({
      name: supplier.name,
      contact_person: supplier.contact_person ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      category: supplier.category,
      is_active: supplier.is_active,
    });
    setSaveError('');
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editData.name.trim()) {
      setSaveError('اسم المورد مطلوب');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await dataUpdate('suppliers', {
        name: editData.name.trim(),
        contact_person: editData.contact_person.trim() || null,
        email: editData.email.trim() || null,
        phone: editData.phone.trim() || null,
        address: editData.address.trim() || null,
        category: editData.category.trim() || 'general',
        is_active: editData.is_active,
        updated_at: new Date().toISOString(),
      }, { id, org_id: orgId });
      setEditOpen(false);
      await fetchSupplierData();
    } catch (err: any) {
      setSaveError(err.message || 'فشل حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await dataDelete('suppliers', { id, org_id: orgId });
      router.push('/app/suppliers');
    } catch (err: any) {
      console.error('Delete supplier error:', err);
      setDeleting(false);
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
    { icon: User, label: 'مسؤول التواصل', value: supplier.contact_person },
    { icon: Mail, label: 'البريد الإلكتروني', value: supplier.email },
    { icon: Phone, label: 'الهاتف', value: supplier.phone },
    { icon: MapPin, label: 'العنوان', value: supplier.address },
    { icon: Building2, label: 'التصنيف', value: supplier.category },
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

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="w-4 h-4 mr-1.5" />
              تعديل
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              حذف
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Supplier Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">بيانات التواصل</CardTitle>
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
                أُضيف في {new Date(supplier.created_at).toLocaleDateString('ar')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Offer History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">سجل العروض</CardTitle>
            <CardDescription>
              {offers.length} {offers.length === 1 ? 'عرض' : 'عروض'} من هذا المورد
            </CardDescription>
          </CardHeader>
          <CardContent>
            {offers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Inbox className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">لا توجد عروض من هذا المورد بعد</p>
                <p className="text-xs mt-1">ستظهر العروض هنا عندما يستجيب المورد لطلبات التسعير</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الطلب</TableHead>
                    <TableHead className="text-right">إجمالي السعر</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التاريخ</TableHead>
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
                        {new Date(offer.created_at).toLocaleDateString('ar')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المورد</DialogTitle>
            <DialogDescription>عدّل المعلومات ثم احفظ التغييرات</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">اسم المورد *</Label>
              <Input
                id="edit-name"
                value={editData.name}
                onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))}
                placeholder="اسم الشركة أو المورد"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-contact">مسؤول التواصل</Label>
                <Input
                  id="edit-contact"
                  value={editData.contact_person}
                  onChange={(e) => setEditData((p) => ({ ...p, contact_person: e.target.value }))}
                  placeholder="الاسم الكامل"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">الهاتف</Label>
                <Input
                  id="edit-phone"
                  value={editData.phone}
                  onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+966..."
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email">البريد الإلكتروني</Label>
              <Input
                id="edit-email"
                type="email"
                value={editData.email}
                onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-category">التصنيف</Label>
                <Input
                  id="edit-category"
                  value={editData.category}
                  onChange={(e) => setEditData((p) => ({ ...p, category: e.target.value }))}
                  placeholder="مثال: كهرباء"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <div className="flex items-center gap-4 h-10">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      checked={editData.is_active}
                      onChange={() => setEditData((p) => ({ ...p, is_active: true }))}
                    />
                    نشط
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      checked={!editData.is_active}
                      onChange={() => setEditData((p) => ({ ...p, is_active: false }))}
                    />
                    غير نشط
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-address">العنوان</Label>
              <Input
                id="edit-address"
                value={editData.address}
                onChange={(e) => setEditData((p) => ({ ...p, address: e.target.value }))}
                placeholder="المدينة، الدولة"
              />
            </div>

            {saveError && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {saveError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <><div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />جارٍ الحفظ...</>
              ) : 'حفظ التعديلات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المورد</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف <strong>{supplier.name}</strong>؟ لن يمكن التراجع عن هذا الإجراء، وسيتم حذف جميع بيانات المورد نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'جارٍ الحذف...' : 'حذف نهائياً'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
