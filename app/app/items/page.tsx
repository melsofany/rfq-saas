'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataInsert, dataUpdate, dataDelete } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Search, Package, Pencil, Trash2, AlertCircle } from 'lucide-react';

interface Item {
  id: string;
  item_id: string | null;
  part_no: string | null;
  description: string;
  uom: string | null;
  reference_price: number | null;
  category: string | null;
  created_at: string;
}

export default function ItemsPage() {
  const { orgId, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    item_id: '',
    part_no: '',
    description: '',
    uom: '',
    reference_price: '',
    category: '',
  });

  const fetchItems = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await dataQuery<Item>('items', {
        select: '*',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
      });

      setItems(data ?? []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = items.filter((item) => {
    const searchLower = search.toLowerCase();
    return (
      item.description.toLowerCase().includes(searchLower) ||
      (item.part_no?.toLowerCase().includes(searchLower) ?? false) ||
      (item.item_id?.toLowerCase().includes(searchLower) ?? false) ||
      (item.category?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const openAddDialog = () => {
    setEditingItem(null);
    setFormData({ item_id: '', part_no: '', description: '', uom: '', reference_price: '', category: '' });
    setError('');
    setDialogOpen(true);
  };

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    setFormData({
      item_id: item.item_id ?? '',
      part_no: item.part_no ?? '',
      description: item.description,
      uom: item.uom ?? '',
      reference_price: item.reference_price?.toString() ?? '',
      category: item.category ?? '',
    });
    setError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setError('');

    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        org_id: orgId,
        item_id: formData.item_id || null,
        part_no: formData.part_no || null,
        description: formData.description,
        uom: formData.uom || null,
        reference_price: formData.reference_price ? parseFloat(formData.reference_price) : null,
        category: formData.category || null,
      };

      if (editingItem) {
        await dataUpdate('items', payload, { id: editingItem.id, org_id: orgId });

        await dataInsert('audit_log', {
          org_id: orgId,
          action: 'update',
          entity_type: 'item',
          entity_id: editingItem.id,
          description: `Updated item ${formData.description}`,
        });
      } else {
        await dataInsert('items', payload);

        await dataInsert('audit_log', {
          org_id: orgId,
          action: 'create',
          entity_type: 'item',
          description: `Created item ${formData.description}`,
        });
      }

      setDialogOpen(false);
      fetchItems();
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Item) => {
    if (!orgId) return;
    if (!confirm(`Are you sure you want to delete "${item.description}"?`)) return;

    try {
      await dataDelete('items', { id: item.id, org_id: orgId });

      await dataInsert('audit_log', {
        org_id: orgId,
        action: 'delete',
        entity_type: 'item',
        entity_id: item.id,
        description: `Deleted item ${item.description}`,
      });

      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
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
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Items</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your catalog of items
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Catalog Items</CardTitle>
          <CardDescription>{items.length} total items</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by description, part number, or category..."
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
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium text-foreground">
                {search ? 'No items match your search' : 'No items yet'}
              </p>
              <p className="text-xs mt-1">
                {search ? 'Try adjusting your search' : 'Add your first item to get started'}
              </p>
              {!search && (
                <Button size="sm" className="mt-4" onClick={openAddDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item ID</TableHead>
                  <TableHead>Part No</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Ref Price</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.item_id ?? '—'}
                    </TableCell>
                    <TableCell className="font-medium">{item.part_no ?? '—'}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.uom ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      {item.reference_price != null
                        ? `$${item.reference_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {item.category ? (
                        <span className="text-sm text-muted-foreground">{item.category}</span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(item)}
                          className="h-8 w-8"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the item details' : 'Enter the details for the new item'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="item_id">Item ID</Label>
                <Input
                  id="item_id"
                  value={formData.item_id}
                  onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                  placeholder="ITM-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="part_no">Part No</Label>
                <Input
                  id="part_no"
                  value={formData.part_no}
                  onChange={(e) => setFormData({ ...formData, part_no: e.target.value })}
                  placeholder="P-001"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Widget assembly kit"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="uom">UOM</Label>
                <Input
                  id="uom"
                  value={formData.uom}
                  onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                  placeholder="PCS"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reference_price">Reference Price</Label>
                <Input
                  id="reference_price"
                  type="number"
                  value={formData.reference_price}
                  onChange={(e) => setFormData({ ...formData, reference_price: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Electronics"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
