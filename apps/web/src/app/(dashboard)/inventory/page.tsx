'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { API_BASE_URL, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { Warehouse, AlertTriangle, Package, TrendingUp, RefreshCw, CheckCircle, XCircle, Shield } from 'lucide-react';

interface InventoryItem {
  id: string;
  quantity: number;
  computedQuantity: number;
  product: {
    id: string;
    name: string;
    sku: string;
    minStock: number;
  };
  branch: { name: string };
}

interface DiscrepancyAlert {
  inventoryId: string;
  productId: string;
  branchId: string;
  productName: string;
  actualQuantity: number;
  computedQuantity: number;
  difference: number;
  type: string;
}

export default function InventoryPage() {
  const { accessToken } = useAuthStore();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<DiscrepancyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showDiscrepancies, setShowDiscrepancies] = useState(false);

  useEffect(() => {
    fetchInventory();
    fetchAlerts();
  }, [accessToken]);

  const fetchInventory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory?lowStock=true`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setItems(data.data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/digital-twin/alerts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setAlerts(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const verifyDigitalTwin = async () => {
    setVerifying(true);
    try {
      const response = await fetch(`${API_BASE_URL}/digital-twin/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (data.success) {
        await fetchInventory();
        await fetchAlerts();
      }
    } catch (error) {
      console.error('Failed to verify digital twin:', error);
    } finally {
      setVerifying(false);
    }
  };

  const resolveDiscrepancy = async (discrepancyId: string, resolution: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/digital-twin/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ discrepancyId, resolution, notes: `Resolved via web UI` }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchAlerts();
      }
    } catch (error) {
      console.error('Failed to resolve discrepancy:', error);
    }
  };

  const lowStockItems = items.filter(item => item.quantity <= item.product.minStock);
  const inStockItems = items.filter(item => item.quantity > item.product.minStock);
  const outOfStockItems = items.filter(item => item.quantity === 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">Track and manage your stock levels</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowDiscrepancies(!showDiscrepancies)}
            className="flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            {showDiscrepancies ? 'Hide' : 'Show'} Discrepancies
            {alerts.length > 0 && (
              <Badge className="ml-1 bg-red-500">{alerts.length}</Badge>
            )}
          </Button>
          <Button
            onClick={verifyDigitalTwin}
            disabled={verifying}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
            Verify Stock
          </Button>
        </div>
      </div>

      {/* Digital Twin Alerts */}
      {showDiscrepancies && alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Stock Discrepancies Detected</h3>
              <Badge className="bg-red-100 text-red-700">{alerts.length}</Badge>
            </div>
            <div className="space-y-3">
              {alerts.slice(0, 5).map((alert, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100">
                  <div>
                    <p className="font-medium text-gray-900">{alert.productName}</p>
                    <p className="text-sm text-gray-500">
                      Actual: <span className="font-semibold">{alert.actualQuantity}</span> | 
                      Expected: <span className="font-semibold">{alert.computedQuantity}</span> | 
                      Difference: <span className={`font-semibold ${alert.difference < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {alert.difference > 0 ? '+' : ''}{alert.difference}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveDiscrepancy(alert.inventoryId, 'INVESTIGATING')}
                    >
                      Investigate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveDiscrepancy(alert.inventoryId, 'RESOLVED')}
                    >
                      Resolve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{items.length}</p>
              <p className="text-sm text-gray-500">Total Items</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{inStockItems.length}</p>
              <p className="text-sm text-gray-500">In Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{lowStockItems.length}</p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center">
              <Warehouse className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{outOfStockItems.length}</p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Stock Levels</h3>
          </div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Warehouse className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No inventory records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left py-4 px-6 font-semibold text-gray-600">Product</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-600">SKU</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-600">Branch</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Actual Qty</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Digital Twin</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isLow = item.quantity <= item.product.minStock && item.quantity > 0;
                    const isOut = item.quantity === 0;
                    const hasDiscrepancy = item.quantity !== item.computedQuantity;
                    
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {item.product.name.charAt(0)}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">{item.product.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-mono text-sm text-gray-500">{item.product.sku}</span>
                        </td>
                        <td className="py-4 px-6">
                          <Badge variant="secondary" className="rounded-lg">{item.branch.name}</Badge>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                              {item.quantity}
                            </span>
                            {hasDiscrepancy && (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`font-mono text-sm ${hasDiscrepancy ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                            {item.computedQuantity || 0}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {hasDiscrepancy ? (
                            <Badge className="rounded-lg bg-red-50 text-red-700">Mismatch</Badge>
                          ) : isOut ? (
                            <Badge className="rounded-lg bg-red-50 text-red-700">Out of Stock</Badge>
                          ) : isLow ? (
                            <Badge className="rounded-lg bg-amber-50 text-amber-700">Low Stock</Badge>
                          ) : (
                            <Badge className="rounded-lg bg-emerald-50 text-emerald-700">In Stock</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
