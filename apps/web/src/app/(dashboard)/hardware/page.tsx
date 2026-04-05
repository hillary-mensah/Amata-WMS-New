'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { Printer, ScanLine, Wifi, Bluetooth, Usb, Plus, RefreshCw, Settings, Trash2, TestTube } from 'lucide-react';

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  lastHeartbeat?: string;
  metadata?: {
    connection?: string;
    address?: string;
    port?: number;
  };
}

export default function HardwarePage() {
  const { accessToken, user } = useAuthStore();
  const [printers, setPrinters] = useState<Device[]>([]);
  const [scanners, setScanLines] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [showAddScanLine, setShowAddScanLine] = useState(false);

  useEffect(() => {
    fetchHardware();
  }, [accessToken]);

  const fetchHardware = async () => {
    try {
      const [printersRes, scannersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/hardware/printers`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        }),
        fetch(`${API_BASE_URL}/hardware/scanners`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        }),
      ]);

      const printersData = await printersRes.json();
      const scannersData = await scannersRes.json();

      if (printersData.success) setPrinters(printersData.data || []);
      if (scannersData.success) setScanLines(scannersData.data || []);
    } catch (error) {
      console.error('Failed to fetch hardware:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConnectionIcon = (connection?: string) => {
    switch (connection) {
      case 'network': return <Wifi className="w-4 h-4" />;
      case 'bluetooth': return <Bluetooth className="w-4 h-4" />;
      case 'usb': return <Usb className="w-4 h-4" />;
      default: return <Printer className="w-4 h-4" />;
    }
  };

  const canManage = user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Loading hardware...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hardware</h1>
          <p className="text-gray-500 mt-1">Manage printers, scanners, and connected devices</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setShowAddScanLine(true)}>
              <ScanLine className="w-4 h-4 mr-2" />
              Add ScanLine
            </Button>
            <Button className="gradient-primary shadow-lg shadow-indigo-500/25" onClick={() => setShowAddPrinter(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Printer
            </Button>
          </div>
        )}
      </div>

      {/* Printers Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Printer className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Thermal Printers</CardTitle>
                <CardDescription className="text-sm text-gray-500">Receipt and label printers</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchHardware}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {printers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Printer className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No printers configured</p>
              <p className="text-gray-400 text-sm mt-1">Add a printer to enable receipt printing</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {printers.map((printer) => (
                <div key={printer.id} className="p-4 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                        <Printer className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{printer.name}</p>
                        <p className="text-xs text-gray-500">{printer.type}</p>
                      </div>
                    </div>
                    <Badge className={printer.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}>
                      {printer.status === 'ACTIVE' ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      {getConnectionIcon(printer.metadata?.connection)}
                      <span className="capitalize">{printer.metadata?.connection || 'USB'}</span>
                    </div>
                    {printer.metadata?.address && (
                      <span className="font-mono">{printer.metadata.address}</span>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <TestTube className="w-4 h-4 mr-1" />
                        Test
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Settings className="w-4 h-4 mr-1" />
                        Configure
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ScanLines Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <ScanLine className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Barcode ScanLines</CardTitle>
                <CardDescription className="text-sm text-gray-500">Handheld and fixed scanners</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {scanners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ScanLine className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No scanners configured</p>
              <p className="text-gray-400 text-sm mt-1">ScanLines are typically auto-detected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scanners.map((scanner) => (
                <div key={scanner.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-emerald-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <ScanLine className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{scanner.name}</p>
                      <p className="text-sm text-gray-500">{scanner.metadata?.address || 'Auto-detected'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-50 text-emerald-700">
                      {scanner.metadata?.connection || 'Handheld'}
                    </Badge>
                    {canManage && (
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supported Hardware Info */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Supported Hardware</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Thermal Printers</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Xprinter XP-N160I / XP-N160II</li>
                <li>• Rongta RP80 / RP80-U</li>
                <li>• Epson TM-T20III / TM-T82III</li>
                <li>• Crown CT321D</li>
                <li>• Gprinter GP-3124TN</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">ScanLines</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Zebra DS2208 / DS2278</li>
                <li>• Honeywell Voyager 1200g</li>
                <li>• Symbol LS2208</li>
                <li>• Datalogic Quickscan QD2400</li>
                <li>• Newland NLS-HR1550</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}