'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { API_BASE_URL } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { AlertTriangle, Package, RefreshCw, DollarSign, TrendingDown, CheckCircle, X, AlertCircle } from 'lucide-react';

interface ExpiryStats {
  expired: number;
  nearExpiry30Days: number;
  nearExpiry90Days: number;
  nearExpiry180Days: number;
  totalAtRisk: number;
  pendingAlerts: number;
}

interface NearExpiryItem {
  id: string;
  batchNumber: string;
  productName: string;
  productSku: string;
  branchName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  isDiscounted: boolean;
  expiresAt: string;
  daysUntilExpiry: number;
  status: string;
}

interface Alert {
  id: string;
  title: string;
  message: string;
  status: string;
  suggestedDiscount: number | null;
  createdAt: string;
  product: { name: string; sku: string } | null;
  branch: { name: string } | null;
}

export default function ExpiryPage() {
  const { accessToken, user } = useAuthStore();
  const [stats, setStats] = useState<ExpiryStats | null>(null);
  const [nearExpiryItems, setNearExpiryItems] = useState<NearExpiryItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountValue, setDiscountValue] = useState(10);

  const canManage = user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_MANAGER';

  useEffect(() => {
    fetchData();
  }, [accessToken]);

  const fetchData = async () => {
    try {
      const [statsRes, nearExpiryRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/expiry/stats`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        }),
        fetch(`${API_BASE_URL}/expiry/near-expiry`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        }),
        fetch(`${API_BASE_URL}/expiry/alerts?status=PENDING`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        }),
      ]);

      const statsData = await statsRes.json();
      const nearExpiryData = await nearExpiryRes.json();
      const alertsData = await alertsRes.json();

      if (statsData.success) setStats(statsData.data);
      if (nearExpiryData.success) setNearExpiryItems(nearExpiryData.data || []);
      if (alertsData.success) setAlerts(alertsData.data || []);
    } catch (error) {
      console.error('Failed to fetch expiry data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyDiscount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/expiry/bulk-apply-discount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          batchIds: selectedItems,
          discountPercent: discountValue,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setDiscountDialogOpen(false);
        setSelectedItems([]);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to apply discount:', error);
    }
  };

  const generateAlerts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/expiry/generate-alerts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to generate alerts:', error);
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Loading expiry data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expiry Management</h1>
          <p className="text-gray-500 mt-1">Track near-expiry products and apply discounts</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={generateAlerts}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Scan & Generate Alerts
            </Button>
            {selectedItems.length > 0 && (
              <Button className="gradient-primary shadow-lg shadow-indigo-500/25" onClick={() => setDiscountDialogOpen(true)}>
                <DollarSign className="w-4 h-4 mr-2" />
                Apply Discount ({selectedItems.length})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats?.expired || 0}</p>
              <p className="text-sm text-gray-500">Already Expired</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats?.nearExpiry30Days || 0}</p>
              <p className="text-sm text-gray-500">Expires in 30 Days</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <Package className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats?.nearExpiry90Days || 0}</p>
              <p className="text-sm text-gray-500">Expires in 90 Days</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats?.nearExpiry180Days || 0}</p>
              <p className="text-sm text-gray-500">Expires in 180 Days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Active Alerts</CardTitle>
                  <CardDescription className="text-sm text-gray-500">{stats?.pendingAlerts} pending alerts</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{alert.title}</p>
                      <p className="text-sm text-gray-500">{alert.branch?.name}</p>
                    </div>
                  </div>
                  {alert.suggestedDiscount && (
                    <Badge className="bg-amber-100 text-amber-700">
                      Suggested: {alert.suggestedDiscount}% off
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Near Expiry Items Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Near Expiry Items</CardTitle>
                <CardDescription className="text-sm text-gray-500">Products expiring within 6 months</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {nearExpiryItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckCircle className="w-16 h-16 text-emerald-300 mb-4" />
              <p className="text-gray-500 font-medium">All products are fresh!</p>
              <p className="text-gray-400 text-sm mt-1">No items expiring in the next 6 months</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left py-4 px-6">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems(nearExpiryItems.map(i => i.id));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                        checked={selectedItems.length === nearExpiryItems.length && nearExpiryItems.length > 0}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-600">Product</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-600">Batch</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-600">Branch</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Qty</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Price</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Discount</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Expires</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {nearExpiryItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-4 px-6">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.productSku}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-sm text-gray-500">{item.batchNumber}</span>
                      </td>
                      <td className="py-4 px-6">
                        <Badge variant="secondary" className="rounded-lg">{item.branchName}</Badge>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="font-medium text-gray-900">{item.quantity}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="font-medium text-gray-900">GHS {item.unitPrice.toFixed(2)}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {item.isDiscounted ? (
                          <Badge className="rounded-lg bg-emerald-50 text-emerald-700">{item.discountPercent}% OFF</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div>
                          <span className={`font-medium ${item.daysUntilExpiry <= 30 ? 'text-red-600' : item.daysUntilExpiry <= 90 ? 'text-orange-600' : 'text-amber-600'}`}>
                            {item.daysUntilExpiry} days
                          </span>
                          <p className="text-xs text-gray-500">{new Date(item.expiresAt).toLocaleDateString()}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge className={`rounded-lg ${item.status === 'NEAR_EXPIRY' ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {item.status === 'NEAR_EXPIRY' ? 'Near Expiry' : 'Fresh'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Discount</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 mb-4">Apply discount to {selectedItems.length} selected items:</p>
            <div className="space-y-3">
              {[5, 10, 15, 20, 25].map((discount) => (
                <button
                  key={discount}
                  onClick={() => setDiscountValue(discount)}
                  className={`w-full p-3 rounded-xl border-2 transition-all ${
                    discountValue === discount
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-semibold text-gray-900">{discount}% Discount</span>
                  {discount >= 20 && <span className="ml-2 text-xs text-red-500">(High)</span>}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountDialogOpen(false)}>Cancel</Button>
            <Button onClick={applyDiscount}>Apply {discountValue}% Discount</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}