export * from './escpos.js';
export * from './print-queue.js';
export * from './zpl.js';
export interface ReceiptData {
    sale: Sale & {
        items: (SaleItem & {
            product: {
                name: string;
                sku: string;
                barcode?: string | null;
            };
        })[];
        user: User;
        device: {
            name: string;
        } | null;
    };
    organisation: Organisation;
    branch: Branch;
    cashierName: string;
}
export interface PrintConfig {
    width?: number;
    includeQRCode?: boolean;
    includeBarcode?: boolean;
    copies?: number;
}
export interface BarcodeFormat {
    type: 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC' | 'QR' | 'DATAMATRIX';
}
export interface PrinterConfig {
    type: 'bluetooth' | 'network' | 'usb';
    name?: string;
    address?: string;
    port?: number;
}
export declare function generateBarcodeCode128(data: string): string;
export declare function generateBarcodeCode39(data: string): string;
export declare function generateEAN13Barcode(data: string): string;
export declare function generateQRCodeData(data: string): string;
export declare function buildReceipt(data: ReceiptData, config?: PrintConfig): string;
export declare function buildZplLabel(product: {
    name: string;
    sku: string;
    barcode?: string | null;
    unitPrice: number;
}): string;
export declare function buildPriceLabel(product: {
    name: string;
    sku: string;
    barcode?: string | null;
    unitPrice: number;
}): string;
export declare function buildInventoryLabel(product: {
    name: string;
    sku: string;
    barcode?: string | null;
}, quantity: number): string;
export interface BluetoothPrinterResult {
    success: boolean;
    message: string;
}
export declare function sendToBluetoothPrinter(receipt: string, deviceName: string, deviceAddress?: string): Promise<BluetoothPrinterResult>;
export interface NetworkPrinterResult {
    success: boolean;
    message: string;
    responseTime?: number;
}
export declare function sendToNetworkPrinter(receipt: string, host: string, port?: number): Promise<NetworkPrinterResult>;
export interface USBPrinterResult {
    success: boolean;
    message: string;
    devicePath?: string;
}
export declare function sendToUsbPrinter(receipt: string, devicePath: string): Promise<USBPrinterResult>;
export declare function sendToThermalPrinter(receipt: string, config: PrinterConfig): Promise<{
    success: boolean;
    message: string;
}>;
export interface ScanResult {
    barcode: string;
    type: 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'QR' | 'UNKNOWN';
    raw: string;
    timestamp: Date;
}
export declare function parseScanData(data: string): ScanResult;
export interface SupportedHardware {
    printers: {
        thermal: string[];
        label: string[];
        bluetooth: string[];
    };
    scanners: {
        handheld: string[];
        fixed: string[];
        mobile: string[];
    };
}
export declare const SUPPORTED_HARDWARE: SupportedHardware;
export declare function detectBluetoothDevices(): Promise<string[]>;
export declare function detectNetworkPrinters(subnet?: string): Promise<string[]>;
//# sourceMappingURL=index.d.ts.map