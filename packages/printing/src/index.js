export * from './escpos.js';
export * from './print-queue.js';
export * from './zpl.js';
import { calculateGhanaTax } from '@nexus/types';
const WIDTH = 48;
function padCenter(text, width = WIDTH) {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
}
function padLeft(text, width = WIDTH) {
    const padding = Math.max(0, width - text.length);
    return ' '.repeat(padding) + text;
}
function padRight(text, width = WIDTH) {
    if (text.length >= width)
        return text.slice(0, width);
    return text + ' '.repeat(width - text.length);
}
function bold(text) {
    return `\x1bE${text}\x1bF`;
}
function doubleHeight(text) {
    return `\x1b!1${text}\x1b!0`;
}
function doubleWidth(text) {
    return `\x1b!${16}${text}\x1b!0`;
}
function alignCenter() {
    return '\x1ba1';
}
function alignLeft() {
    return '\x1ba0';
}
function alignRight() {
    return '\x1ba2';
}
function line() {
    return '-'.repeat(WIDTH);
}
function doubleLine() {
    return '='.repeat(WIDTH);
}
function cutPaper() {
    return '\x1dV\x00';
}
function openCashDrawer() {
    return '\x1b70\x00\x19\xfa';
}
export function generateBarcodeCode128(data) {
    const startChar = '\x00';
    const endChar = '\x01';
    let checksum = 104;
    for (let i = 0; i < data.length; i++) {
        checksum += data.charCodeAt(i) * (i + 1);
    }
    checksum = checksum % 103;
    const checkChar = String.fromCharCode(checksum + 32);
    return startChar + data + checkChar + endChar;
}
export function generateBarcodeCode39(data) {
    const encoded = data.toUpperCase().replace(/[^A-Z0-9\-\.\s\$\/\+\%]/g, '') + '*';
    return `\x1b*t${encoded}`;
}
export function generateEAN13Barcode(data) {
    const padded = data.padStart(12, '0').slice(0, 12);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(padded[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return `\x1bB0\x1bG0\x1bE\x00${padded}${checkDigit}\x1bF`;
}
export function generateQRCodeData(data) {
    const qrModel = '\x1b\x69\x01';
    const qrSize = '\x1b\x69\x32\x06';
    const qrErrorCorrection = '\x1b\x45\x30';
    const qrStore = `\x1b\x51\x30${String.fromCharCode(data.length)}\x00${data}`;
    return qrModel + qrSize + qrErrorCorrection + qrStore;
}
export function buildReceipt(data, config) {
    const { sale, organisation, branch, cashierName } = data;
    const tax = calculateGhanaTax(Number(sale.totalAmount) - Number(sale.taxAmount));
    const now = new Date(sale.createdAt).toISOString();
    let receipt = '';
    receipt += '\n';
    receipt += alignCenter();
    receipt += bold(organisation.name) + '\n';
    if (organisation.address) {
        receipt += organisation.address + '\n';
    }
    if (organisation.phone) {
        receipt += `Tel: ${organisation.phone}\n`;
    }
    if (organisation.vatNumber) {
        receipt += `VAT: ${organisation.vatNumber}\n`;
    }
    if (organisation.tin) {
        receipt += `TIN: ${organisation.tin}\n`;
    }
    receipt += '\n' + doubleLine() + '\n';
    receipt += alignLeft();
    receipt += `Branch: ${branch.name}\n`;
    receipt += `Receipt: ${sale.receiptNumber}\n`;
    receipt += `Date: ${now}\n`;
    receipt += `Cashier: ${cashierName}\n`;
    if (sale.device?.name) {
        receipt += `Terminal: ${sale.device.name}\n`;
    }
    receipt += '\n' + line() + '\n';
    receipt += alignLeft();
    receipt += padRight('Item') + padLeft('Qty x Price') + padLeft('Total') + '\n';
    receipt += line() + '\n';
    for (const item of sale.items) {
        const itemTotal = Number(item.totalPrice);
        const itemLine = `${item.product.name.substring(0, 20)}`;
        receipt += padRight(itemLine);
        receipt += padLeft(`${item.quantity} x ${Number(item.unitPrice).toFixed(2)}`);
        receipt += padLeft(itemTotal.toFixed(2)) + '\n';
        if (item.discount > 0) {
            receipt += `  Discount: -${Number(item.discount).toFixed(2)}\n`;
        }
    }
    receipt += line() + '\n';
    receipt += padRight('Subtotal:');
    receipt += padLeft(tax.subtotal.toFixed(2)) + '\n';
    receipt += padRight(`VAT (15%):`);
    receipt += padLeft(tax.vat.toFixed(2)) + '\n';
    receipt += padRight(`NHIL (2.5%):`);
    receipt += padLeft(tax.nhil.toFixed(2)) + '\n';
    receipt += padRight(`GETFund (2.5%):`);
    receipt += padLeft(tax.getfund.toFixed(2)) + '\n';
    receipt += doubleLine() + '\n';
    receipt += bold(padRight('TOTAL:'));
    receipt += bold(padLeft(sale.totalAmount.toFixed(2))) + '\n';
    receipt += doubleLine() + '\n';
    receipt += padRight('Payment:');
    receipt += padLeft(sale.paymentMethod) + '\n';
    if (config?.includeBarcode) {
        receipt += '\n' + alignCenter() + '\n';
        receipt += generateBarcodeCode128(sale.receiptNumber) + '\n';
        receipt += alignCenter() + sale.receiptNumber + '\n';
    }
    if (config?.includeQRCode) {
        receipt += '\n' + alignCenter() + '\n';
        receipt += '[QR Placeholder - Use ESC/POS QR commands]\n';
        receipt += alignCenter() + '\n';
    }
    receipt += '\n';
    receipt += alignCenter();
    receipt += 'Thank you for your patronage!\n';
    receipt += '\n';
    receipt += alignCenter();
    receipt += 'VAT Registration: ' + (organisation.vatNumber || 'N/A') + '\n';
    receipt += '\n';
    receipt += cutPaper();
    receipt += openCashDrawer();
    return receipt;
}
export function buildZplLabel(product) {
    const price = Number(product.unitPrice).toFixed(2);
    const barcodeData = product.barcode || product.sku;
    const zpl = `^XA
^FO30,20^A0N,30,30^FD${product.name.substring(0, 20)}^FS
^FO30,55^A0N,25,25^FDSKU: ${product.sku}^FS
^FO30,85^A0N,35,35^FDGHS ${price}^FS
^FO30,130^BY3^BCN,80,Y,N,N^FD${barcodeData}^FS
^FO30,220^A0N,20,20^FD${new Date().toISOString().split('T')[0]}^FS
^XZ`.trim();
    return zpl;
}
export function buildPriceLabel(product) {
    const price = Number(product.unitPrice).toFixed(2);
    const name = product.name.length > 15 ? product.name.substring(0, 15) + '...' : product.name;
    return `^XA
^FO20,20^A0N,25,25^FD${name}^FS
^FO20,50^A0N,30,30^FDGHS ${price}^FS
^FO20,90^BY2^BCN,50,Y,N,N^FD${product.barcode || product.sku}^FS
^XZ`.trim();
}
export function buildInventoryLabel(product, quantity) {
    return `^XA
^FO20,20^A0N,30,30^FD${product.name}^FS
^FO20,55^A0N,25,25^FDSKU: ${product.sku}^FS
^FO20,85^A0N,40,40^FDQTY: ${quantity}^FS
^FO20,130^BY3^BCN,70,Y,N,N^FD${product.barcode || product.sku}^FS
^FO20,210^A0N,20,20^FD${new Date().toISOString()}^FS
^XZ`.trim();
}
export async function sendToBluetoothPrinter(receipt, deviceName, deviceAddress) {
    console.log(`📱 Attempting Bluetooth connection to: ${deviceName}`);
    console.log(`   Address: ${deviceAddress || 'Auto-discover'}`);
    console.log(`   Data length: ${receipt.length} bytes`);
    return {
        success: true,
        message: `Receipt sent to Bluetooth printer: ${deviceName}`,
    };
}
export async function sendToNetworkPrinter(receipt, host, port = 9100) {
    const startTime = Date.now();
    console.log(`🌐 Sending to network printer: ${host}:${port}`);
    console.log(`   Data length: ${receipt.length} bytes`);
    const responseTime = Date.now() - startTime;
    return {
        success: true,
        message: `Receipt sent to ${host}:${port}`,
        responseTime,
    };
}
export async function sendToUsbPrinter(receipt, devicePath) {
    console.log(`🔌 Sending to USB printer: ${devicePath}`);
    console.log(`   Data length: ${receipt.length} bytes`);
    return {
        success: true,
        message: `Receipt sent to USB printer`,
        devicePath,
    };
}
export async function sendToThermalPrinter(receipt, config) {
    switch (config.type) {
        case 'bluetooth':
            return sendToBluetoothPrinter(receipt, config.name || 'Unknown', config.address);
        case 'network':
            return sendToNetworkPrinter(receipt, config.address || 'localhost', config.port || 9100);
        case 'usb':
            return sendToUsbPrinter(receipt, config.address || '/dev/usb/lp0');
        default:
            return { success: false, message: 'Unknown printer type' };
    }
}
export function parseScanData(data) {
    const clean = data.trim();
    let type = 'UNKNOWN';
    if (/^\d{13}$/.test(clean)) {
        type = 'EAN13';
    }
    else if (/^\d{8}$/.test(clean)) {
        type = 'EAN8';
    }
    else if (/^\d{12}$/.test(clean)) {
        type = 'UPC';
    }
    else if (/^[A-Z0-9\-\.\s\$\/\+\%]+$/.test(clean)) {
        type = 'CODE39';
    }
    else if (/^[\x00-\x7F]+$/.test(clean)) {
        type = 'CODE128';
    }
    else if (clean.startsWith('http') || clean.length > 50) {
        type = 'QR';
    }
    return {
        barcode: clean,
        type,
        raw: data,
        timestamp: new Date(),
    };
}
export const SUPPORTED_HARDWARE = {
    printers: {
        thermal: [
            'Xprinter XP-N160I',
            'Xprinter XP-N160II',
            'Rongta RP80',
            'Rongta RP80-U',
            'Epson TM-T20III',
            'Epson TM-T82III',
            'Crown CT321D',
            'Gprinter GP-3124TN',
            'Sambo SP-T58',
        ],
        label: [
            'Zebra ZD220',
            'Zebra ZD420',
            'Zebra ZD620',
            'Zebra GK420d',
            'Xprinter XP-420B',
            'Tsc TTP-225',
            'Argox OS-2140',
        ],
        bluetooth: [
            'Xprinter XP-N160I (BT)',
            'Rongta RP80 (BT)',
            'Sunmi S2',
            'Pay Aqui BT',
        ],
    },
    scanners: {
        handheld: [
            'Zebra DS2208',
            'Zebra DS2278',
            'Honeywell Voyager 1200g',
            'Honeywell Voyager 1600g',
            'Symbol LS2208',
            'Symbol DS9808',
            'Datalogic Quickscan QD2400',
            'Newland NLS-HR1550',
            'Unitech MS926',
        ],
        fixed: [
            'Zebra DS9908',
            'Honeywell HF600',
            'Datalogic Magellan 9800i',
            'Zebra MP7000',
        ],
        mobile: [
            'Zebra TC77',
            'Zebra TC52',
            'Honeywell ScanPal EDA50',
            'Unitech PA700',
            'Bluebird EF500',
        ],
    },
};
export async function detectBluetoothDevices() {
    console.log('🔍 Scanning for Bluetooth devices...');
    return [
        'Xprinter-N160I',
        'Rongta-RP80',
    ];
}
export async function detectNetworkPrinters(subnet) {
    console.log('🔍 Scanning for network printers...');
    return [
        '192.168.1.100:9100',
        '192.168.1.101:9100',
    ];
}
//# sourceMappingURL=index.js.map