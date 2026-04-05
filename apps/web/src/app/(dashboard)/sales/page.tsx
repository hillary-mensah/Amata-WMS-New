'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL, formatCurrency, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { Search, Filter, Download, Eye, X, RefreshCw } from 'lucide-react';

interface Sale {
  id: string;
  receiptNumber: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
  branch: { name: string };
  items: { product: { name: string }; quantity: number }[];
}

export default function SalesPage() {
  const { accessToken } = useAuthStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  useEffect(() => {
    fetchSales();
  }, [accessToken, page]);

  const fetchSales = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sales?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setSales(data.data.items || []);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter(
    (s) =>
      s.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.user.firstName.toLowerCase().includes(search.toLowerCase()) ||
      s.user.lastName.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const completedSales = sales.filter(s => s.status === 'COMPLETED').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="rounded-lg bg-emerald-50 text-emerald-700">Completed</Badge>;
      case 'VOIDED':
        return <Badge className="rounded-lg bg-red-50 text-red-700">Voided</Badge>;
      case 'REFUNDED':
        return <Badge className="rounded-lg bg-amber-50 text-amber-700">Refunded</Badge>;
      default:
        return <Badge className="rounded-lg bg-gray-100 text-gray-700">{status}</Badge>;
    }
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'CASH': return '💵';
      case 'CARD': return '💳';
      case 'MOMO': return '📱';
      default: return '💰';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Loading sales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-500 mt-1">View and manage all transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button className="gradient-primary shadow-lg shadow-indigo-500/25">
            + New Sale
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{sales.length}</p>
              <p className="text-sm text-gray-500">Total Transactions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
              <p className="text-sm text-gray-500">Total Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{completedSales}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search by receipt or cashier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl border-gray-200 bg-white"
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Sales Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <span className="text-6xl mb-4">🛒</span>
              <p className="text-gray-500 font-medium">No sales found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left py-4 px-6 font-semibold text-gray-600">Receipt</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-600">Date</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-600">Cashier</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-600">Branch</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Items</th>
                    <th className="text-right py-4 px-6 font-semibold text-gray-600">Amount</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Payment</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-4 px-6">
                        <span className="font-mono text-sm font-medium text-indigo-600">{sale.receiptNumber}</span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">
                        {formatDateTime(sale.createdAt)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                            <span className="text-white text-xs font-semibold">
                              {sale.user.firstName.charAt(0)}{sale.user.lastName.charAt(0)}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {sale.user.firstName} {sale.user.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge variant="secondary" className="rounded-lg">{sale.branch.name}</Badge>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm text-gray-600">{sale.items.length} items</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="font-semibold text-gray-900">{formatCurrency(sale.totalAmount)}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-lg">{getPaymentIcon(sale.paymentMethod)}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {getStatusBadge(sale.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between p-6 border-t border-gray-100">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(p => p - 1)} 
                disabled={page === 1}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(p => p + 1)} 
                disabled={page >= pagination.pages}
              >
                Next
                <RefreshCw className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}