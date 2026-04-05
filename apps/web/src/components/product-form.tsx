'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProductFormProps {
  onSubmit: (data: ProductFormData) => void;
  categories?: { id: string; name: string }[];
  initialData?: ProductFormData;
  trigger?: React.ReactNode;
}

export interface ProductFormData {
  name: string;
  sku: string;
  barcode?: string;
  unitPrice: number;
  costPrice?: number;
  categoryId?: string;
  isTrackStock: boolean;
  minStock: number;
}

export function ProductForm({ onSubmit, categories = [], initialData, trigger }: ProductFormProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(
    initialData || {
      name: '',
      sku: '',
      barcode: '',
      unitPrice: 0,
      costPrice: 0,
      categoryId: '',
      isTrackStock: true,
      minStock: 10,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setOpen(false);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      unitPrice: 0,
      costPrice: 0,
      categoryId: '',
      isTrackStock: true,
      minStock: 10,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Add Product</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{initialData ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {initialData ? 'Update product details below.' : 'Create a new product in your inventory.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="unitPrice">Selling Price (GHS)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="costPrice">Cost Price (GHS)</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="minStock">Min Stock Level</Label>
                <Input
                  id="minStock"
                  type="number"
                  min="0"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  id="isTrackStock"
                  type="checkbox"
                  checked={formData.isTrackStock}
                  onChange={(e) => setFormData({ ...formData, isTrackStock: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isTrackStock" className="font-normal">Track Inventory</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{initialData ? 'Update' : 'Create'} Product</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}