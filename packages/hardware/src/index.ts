export interface BarcodeFormat {
  type: 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC' | 'QR' | 'DATAMATRIX';
}

export interface ScannerConfig {
  type: 'handheld' | 'fixed' | 'mobile';
  connection: 'usb' | 'bluetooth' | 'serial';
  autoConnect: boolean;
  prefixSuffix?: {
    prefix: string;
    suffix: string;
  };
}

export interface PrinterConfig {
  type: 'thermal' | 'label';
  connection: 'network' | 'bluetooth' | 'usb';
  address?: string;
  port?: number;
  name?: string;
  paperWidth?: number;
  charactersPerLine?: number;
}

export interface HardwareCapabilities {
  supportsBarcode: boolean;
  supportsQRCode: boolean;
  supportsLabelPrinting: boolean;
  supportsCashDrawer: boolean;
  supportsMultipleCopies: boolean;
}

export const SCANNER_CAPABILITIES: Record<string, HardwareCapabilities> = {
  'zebra-ds2208': {
    supportsBarcode: true,
    supportsQRCode: false,
    supportsLabelPrinting: false,
    supportsCashDrawer: false,
    supportsMultipleCopies: false,
  },
  'zebra-ds2278': {
    supportsBarcode: true,
    supportsQRCode: true,
    supportsLabelPrinting: false,
    supportsCashDrawer: false,
    supportsMultipleCopies: false,
  },
  'honeywell-voyager-1200g': {
    supportsBarcode: true,
    supportsQRCode: false,
    supportsLabelPrinting: false,
    supportsCashDrawer: false,
    supportsMultipleCopies: false,
  },
  'zebra-tc77': {
    supportsBarcode: true,
    supportsQRCode: true,
    supportsLabelPrinting: false,
    supportsCashDrawer: false,
    supportsMultipleCopies: true,
  },
};

export const PRINTER_CAPABILITIES: Record<string, HardwareCapabilities> = {
  'xprinter-xp-n160i': {
    supportsBarcode: true,
    supportsQRCode: true,
    supportsLabelPrinting: false,
    supportsCashDrawer: true,
    supportsMultipleCopies: true,
  },
  'rongta-rp80': {
    supportsBarcode: true,
    supportsQRCode: true,
    supportsLabelPrinting: false,
    supportsCashDrawer: true,
    supportsMultipleCopies: true,
  },
  'epson-tm-t20iii': {
    supportsBarcode: true,
    supportsQRCode: true,
    supportsLabelPrinting: false,
    supportsCashDrawer: true,
    supportsMultipleCopies: true,
  },
  'zebra-zd220': {
    supportsBarcode: true,
    supportsQRCode: true,
    supportsLabelPrinting: true,
    supportsCashDrawer: false,
    supportsMultipleCopies: true,
  },
  'zebra-zd420': {
    supportsBarcode: true,
    supportsQRCode: true,
    supportsLabelPrinting: true,
    supportsCashDrawer: false,
    supportsMultipleCopies: true,
  },
};

export function getScannerCapabilities(model: string): HardwareCapabilities {
  const normalized = model.toLowerCase().replace(/\s+/g, '-');
  return SCANNER_CAPABILITIES[normalized] || {
    supportsBarcode: true,
    supportsQRCode: false,
    supportsLabelPrinting: false,
    supportsCashDrawer: false,
    supportsMultipleCopies: false,
  };
}

export function getPrinterCapabilities(model: string): HardwareCapabilities {
  const normalized = model.toLowerCase().replace(/\s+/g, '-');
  return PRINTER_CAPABILITIES[normalized] || {
    supportsBarcode: true,
    supportsQRCode: false,
    supportsLabelPrinting: false,
    supportsCashDrawer: false,
    supportsMultipleCopies: false,
  };
}

export interface ScanEvent {
  deviceId: string;
  deviceName: string;
  barcode: string;
  format: BarcodeFormat['type'];
  timestamp: Date;
  signalStrength?: number;
}

export interface PrintEvent {
  printerId: string;
  printerName: string;
  status: 'success' | 'failed' | 'paper-out' | 'offline';
  timestamp: Date;
  pagesPrinted?: number;
  error?: string;
}

export interface CashDrawerEvent {
  drawerId: string;
  status: 'opened' | 'closed' | 'error';
  timestamp: Date;
}

export type HardwareEvent = ScanEvent | PrintEvent | CashDrawerEvent;

export interface DeviceStatus {
  online: boolean;
  batteryLevel?: number;
  lastSeen: Date;
  firmware?: string;
  error?: string;
}

export function createScannerHandler(
  onScan: (barcode: string, format: BarcodeFormat['type']) => void
) {
  return (data: string) => {
    const result = parseBarcodeData(data);
    onScan(result.barcode, result.format);
    return result;
  };
}

export function parseBarcodeData(data: string): {
  barcode: string;
  format: BarcodeFormat['type'];
  raw: string;
} {
  const clean = data.trim().replace(/\r\n|\r|\n/g, '');
  
  let format: BarcodeFormat['type'] = 'CODE128';
  
  if (/^\d{13}$/.test(clean)) {
    format = 'EAN13';
  } else if (/^\d{8}$/.test(clean)) {
    format = 'EAN8';
  } else if (/^\d{12}$/.test(clean)) {
    format = 'UPC';
  } else if (/^[A-Z0-9\-\.\s\$\/\+\%]+$/.test(clean)) {
    format = 'CODE39';
  } else if (clean.length > 40 && !/^[A-Z0-9\-\.\s\$\/\+\%]+$/.test(clean)) {
    format = 'DATAMATRIX';
  } else if (clean.startsWith('http') || clean.length > 100) {
    format = 'QR';
  }
  
  return {
    barcode: clean,
    format,
    raw: data,
  };
}

export function validateBarcode(barcode: string, format: BarcodeFormat['type']): boolean {
  switch (format) {
    case 'EAN13':
      return /^\d{13}$/.test(barcode) && validateEANChecksum(barcode);
    case 'EAN8':
      return /^\d{8}$/.test(barcode) && validateEANChecksum(barcode);
    case 'UPC':
      return /^\d{12}$/.test(barcode);
    case 'CODE39':
      return /^[A-Z0-9\-\.\s\$\/\+\%]+$/.test(barcode);
    case 'CODE128':
      return /^[\x00-\x7F]+$/.test(barcode);
    case 'QR':
      return barcode.length > 0;
    case 'DATAMATRIX':
      return barcode.length >= 1;
    default:
      return barcode.length > 0;
  }
}

function validateEANChecksum(ean: string): boolean {
  if (ean.length !== 13 && ean.length !== 8) return false;
  
  let sum = 0;
  for (let i = 0; i < ean.length - 1; i++) {
    const char = ean[i];
    if (char === undefined) return false;
    sum += parseInt(char) * (i % 2 === 0 ? 1 : 3);
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  const lastChar = ean[ean.length - 1];
  if (lastChar === undefined) return false;
  return checkDigit === parseInt(lastChar);
}

export function generateProductBarcode(
  productId: string,
  format: 'EAN13' | 'CODE128' = 'CODE128'
): string {
  if (format === 'CODE128') {
    return productId.substring(0, 20);
  }
  
  const padded = productId.replace(/\D/g, '').padStart(12, '0').substring(0, 12);
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const char = padded[i];
    if (char === undefined) return padded + '0';
    sum += parseInt(char) * (i % 2 === 0 ? 1 : 3);
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return padded + checkDigit;
}

export const BARCODE_FORMAT_LABELS: Record<BarcodeFormat['type'], string> = {
  EAN13: 'EAN-13',
  EAN8: 'EAN-8',
  UPC: 'UPC-A',
  CODE128: 'Code 128',
  CODE39: 'Code 39',
  QR: 'QR Code',
  DATAMATRIX: 'Data Matrix',
};

export interface BatchScanResult {
  scanned: number;
  duplicates: number;
  errors: number;
  items: {
    barcode: string;
    productId?: string;
    found: boolean;
    error?: string;
  }[];
}

export async function processBatchScan(
  barcodes: string[],
  productLookup: (barcode: string) => Promise<string | null>
): Promise<BatchScanResult> {
  const result: BatchScanResult = {
    scanned: 0,
    duplicates: 0,
    errors: 0,
    items: [],
  };
  
  const seen = new Set<string>();
  
  for (const barcode of barcodes) {
    if (seen.has(barcode)) {
      result.duplicates++;
      result.items.push({ barcode, found: false, error: 'Duplicate scan' });
      continue;
    }
    
    seen.add(barcode);
    result.scanned++;
    
    try {
      const productId = await productLookup(barcode);
      if (productId) {
        result.items.push({ barcode, productId, found: true });
      } else {
        result.items.push({ barcode, found: false, error: 'Product not found' });
      }
    } catch (error) {
      result.errors++;
      result.items.push({ barcode, found: false, error: 'Lookup failed' });
    }
  }
  
  return result;
}
