export * from "./escpos";
export * from "./print-queue";
export * from "./zpl";

export interface ReceiptData {
  sale: Record<string, unknown>;
  organisation: Record<string, unknown>;
  branch: Record<string, unknown>;
  cashierName: string;
}

export interface LabelData {
  type: "PRODUCT" | "PRICE" | "INVENTORY";
  data: Record<string, unknown>;
}

export interface PrintConfig {
  width?: number;
  includeQRCode?: boolean;
  includeBarcode?: boolean;
  copies?: number;
}

export interface BarcodeFormat {
  type: "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC" | "QR" | "DATAMATRIX";
}

export interface PrinterConfig {
  type: "bluetooth" | "network" | "usb";
  name?: string;
  address?: string;
  port?: number;
}

export interface PrinterStatus {
  status: "OK" | "LOW" | "OUT" | "OPEN" | "CLOSED";
  paperLevel?: number;
}

export type PrintResult = {
  success: boolean;
  jobId?: string;
  error?: string;
};

export const WIDTH = 48;

export function buildReceipt(data: ReceiptData): Buffer {
  return Buffer.from("Receipt");
}

export function buildLabel(data: LabelData): Buffer {
  return Buffer.from("Label");
}

export function buildPriceLabel(data: Record<string, unknown>): Buffer {
  return Buffer.from("Price Label");
}

export function buildInventoryLabel(data: Record<string, unknown>): Buffer {
  return Buffer.from("Inventory Label");
}

export function buildZplLabel(data: Record<string, unknown>): string {
  return "^XA^XZ";
}

export const SUPPORTED_HARDWARE = {
  printers: ["Xprinter", "Rongta", "Epson", "Crown", "Gprinter"],
  scanners: ["Zebra", "Honeywell"],
};

export async function sendToThermalPrinter(
  data: Buffer,
  config: PrinterConfig,
): Promise<PrintResult> {
  return { success: true };
}

export async function detectNetworkPrinters(): Promise<string[]> {
  return [];
}

export async function detectBluetoothDevices(): Promise<string[]> {
  return [];
}
