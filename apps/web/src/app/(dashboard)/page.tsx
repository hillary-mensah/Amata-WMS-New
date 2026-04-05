'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt, 
  Package, 
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  AlertTriangle,
  Shield
} from 'lucide-react';

interface SummaryData {
  date: string;
  totalSales: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  byPaymentMethod: Record<string, number>;
  byBranch: Record<string, number>;
  byCashier: Record<string, number>;
  topProducts: { productId: string; name: string; quantity: number }[];
}

interface AnomalyStats {
  total: number;
  byStatus: { status: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
}

const stats = [
  { 
    label: 'Total Sales', 
    value: '247', 
    change: '+12.5%', 
    trend: 'up',
    icon: Receipt,
    color: 'bg-indigo-500',
    lightColor: 'bg-indigo-50'
  },
  { 
    label: 'Revenue', 
    value: 'GHS 24,580', 
    change: '+8.2%', 
    trend: 'up',
    icon: DollarSign,
    color: 'bg-emerald-500',
    lightColor: 'bg-emerald-50'
  },
  { 
    label: 'Tax Collected', 
    value: 'GHS 4,916', 
    change: '+15.3%', 
    trend: 'up',
    icon: Activity,
    color: 'bg-amber-500',
    lightColor: 'bg-amber-50'
  },
  { 
    label: 'Discounts', 
    value: 'GHS 1,240', 
    change: '-3.2%', 
    trend: 'down',
    icon: TrendingDown,
    color: 'bg-rose-500',
    lightColor: 'bg-rose-50'
  },
];

export default function DashboardPage() {
  const { accessToken } = useAuthStore();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [anomalyStats, setAnomalyStats] = useState<AnomalyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/pos/summary`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        });
        const data = await response.json();
        if (data.success) {
          setSummary(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch summary:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchAnomalyStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/anomaly/stats`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        });
        const data = await response.json();
        if (data.success) {
          setAnomalyStats(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch anomaly stats:', error);
      }
    };

    fetchSummary();
    fetchAnomalyStats();
  }, [accessToken]);

  const pendingAnomalies = anomalyStats?.byStatus?.find((s) => s.status === 'DETECTED')?.count || 0;
  const criticalAnomalies = anomalyStats?.bySeverity?.find((s) => s.severity === 'CRITICAL')?.count || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back! 👋</h1>
          <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with your store today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Download Report
          </button>
          <button className="px-4 py-2 gradient-primary text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity">
            + New Sale
          </button>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {(pendingAnomalies > 0 || criticalAnomalies > 0) && (
        <Card className={`border-0 shadow-sm ${criticalAnomalies > 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${criticalAnomalies > 0 ? 'bg-red-100' : 'bg-amber-100'} flex items-center justify-center`}>
                <Shield className={`w-5 h-5 ${criticalAnomalies > 0 ? 'text-red-600' : 'text-amber-600'}`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {criticalAnomalies > 0 ? `${criticalAnomalies} Critical` : `${pendingAnomalies} Pending`} Anomalies Detected
                </p>
                <p className="text-sm text-gray-500">
                  {criticalAnomalies > 0 
                    ? 'Immediate attention required - potential fraud detected'
                    : 'Review flagged transactions in the anomaly panel'}
                </p>
              </div>
            </div>
            <button className={`px-4 py-2 rounded-lg text-sm font-medium ${criticalAnomalies > 0 ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
              View Alerts
            </button>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const isUp = stat.trend === 'up';
          
          return (
            <Card 
              key={stat.label} 
              className={`card-hover border-0 shadow-sm overflow-hidden animate-slide-up stagger-${index + 1}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-2xl ${stat.lightColor} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Payment Method */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Sales by Payment Method</h3>
              <select className="text-sm text-gray-500 bg-gray-50 border-0 rounded-lg px-3 py-1">
                <option>Today</option>
                <option>This Week</option>
                <option>This Month</option>
              </select>
            </div>
            <div className="space-y-4">
              {[
                { method: 'Cash', amount: 12450, percentage: 45, color: 'bg-emerald-500' },
                { method: 'Card', amount: 8200, percentage: 30, color: 'bg-indigo-500' },
                { method: 'Mobile Money', amount: 6930, percentage: 25, color: 'bg-amber-500' },
              ].map((item) => (
                <div key={item.method} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{item.method}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${item.color} rounded-full transition-all duration-500`} 
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Top Products</h3>
              <button className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
                View All →
              </button>
            </div>
            <div className="space-y-4">
              {[
                { name: 'USB Cable', sold: 145, revenue: 3625 },
                { name: 'Phone Charger', sold: 89, revenue: 4005 },
                { name: 'Power Bank', sold: 67, revenue: 12060 },
                { name: 'Headphones', sold: 42, revenue: 5040 },
                { name: 'Water Bottle', sold: 156, revenue: 780 },
              ].map((product, index) => (
                <div key={product.name} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.sold} sold</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'New Sale', icon: '💰', color: 'bg-emerald-50 hover:bg-emerald-100' },
          { label: 'Add Product', icon: '📦', color: 'bg-indigo-50 hover:bg-indigo-100' },
          { label: 'Stock Adjustment', icon: '📊', color: 'bg-amber-50 hover:bg-amber-100' },
          { label: 'Transfer Stock', icon: '🔄', color: 'bg-rose-50 hover:bg-rose-100' },
        ].map((action) => (
          <button 
            key={action.label}
            className={`flex items-center gap-3 p-4 rounded-2xl ${action.color} transition-all hover:scale-105`}
          >
            <span className="text-2xl">{action.icon}</span>
            <span className="text-sm font-semibold text-gray-700">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}