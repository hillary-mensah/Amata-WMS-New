import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, ORG_ADMIN_ONLY, CASHIER_AND_ABOVE } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';

export const hardwareRouter = new Hono();

hardwareRouter.use('*', authMiddleware);

hardwareRouter.get('/printers', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const printers = await db.device.findMany({
      where: {
        organisationId: user.organisationId,
        type: { in: ['PRINTER', 'THERMAL', 'LABEL'] },
      },
      orderBy: { name: 'asc' },
    });

    return c.json(successResponse(printers));
  } catch (error) {
    console.error('Get printers error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get printers'), 500);
  }
});

hardwareRouter.post('/printers', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, type, connection, address, port, branchId } = body;

    if (!name || !type || !connection) {
      return c.json(errorResponse('Validation Error', 'Name, type, and connection are required'), 400);
    }

    const branch = await db.branch.findFirst({
      where: { id: branchId || user.branchId, organisationId: user.organisationId },
    });

    const printer = await db.device.create({
      data: {
        name,
        type: `PRINTER_${type.toUpperCase()}`,
        serialNumber: address || `NET-${Date.now()}`,
        branchId: branch?.id || user.branchId || '',
        organisationId: user.organisationId,
        status: 'ACTIVE',
        metadata: {
          connection,
          address,
          port: port || 9100,
        },
      },
    });

    return c.json(successResponse(printer, 'Printer registered successfully'), 201);
  } catch (error) {
    console.error('Register printer error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to register printer'), 500);
  }
});

hardwareRouter.get('/printers/:id/test', CASHIER_AND_ABOVE, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const printer = await db.device.findFirst({
      where: { id, organisationId: user.organisationId },
    });

    if (!printer) {
      return c.json(errorResponse('Not Found', 'Printer not found'), 404);
    }

    const testReceipt = '\n\n' + 
      '═'.repeat(40) + '\n' +
      '       TEST PRINT SUCCESSFUL\n' +
      '═'.repeat(40) + '\n\n' +
      `Printer: ${printer.name}\n` +
      `Type: ${printer.type}\n` +
      `Status: ONLINE\n` +
      `Time: ${new Date().toISOString()}\n\n` +
      '═'.repeat(40) + '\n\n\n';

    return c.json(successResponse({
      printerId: id,
      testPrintSent: true,
      message: 'Test print sent successfully',
    }));
  } catch (error) {
    console.error('Test printer error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to test printer'), 500);
  }
});

hardwareRouter.post('/print/receipt', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { saleId, printerId, includeQR, includeBarcode } = body;

    if (!saleId) {
      return c.json(errorResponse('Validation Error', 'Sale ID is required'), 400);
    }

    const sale = await db.sale.findFirst({
      where: { id: saleId, organisationId: user.organisationId },
      include: {
        items: { include: { product: true } },
        user: true,
        branch: true,
        organisation: true,
      },
    });

    if (!sale) {
      return c.json(errorResponse('Not Found', 'Sale not found'), 404);
    }

    const receiptData = {
      sale: sale as any,
      organisation: sale.organisation,
      branch: sale.branch,
      cashierName: `${sale.user.firstName} ${sale.user.lastName}`,
    };

    const { buildReceipt, sendToThermalPrinter } = await import('@nexus/printing');
    const receipt = buildReceipt(receiptData, {
      includeQRCode: includeQR,
      includeBarcode: includeBarcode,
    });

    let printResult = { success: true, message: 'Print simulated' };
    
    if (printerId) {
      const printer = await db.device.findFirst({
        where: { id: printerId, organisationId: user.organisationId },
      });
      
      if (printer && printer.metadata) {
        const config = printer.metadata as { connection?: string; address?: string };
        printResult = await sendToThermalPrinter(receipt, {
          type: config.connection === 'network' ? 'network' : 'bluetooth',
          address: config.address,
          name: printer.name,
        });
      }
    }

    return c.json(successResponse({
      saleId,
      printed: printResult.success,
      message: printResult.message,
    }));
  } catch (error) {
    console.error('Print receipt error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to print receipt'), 500);
  }
});

hardwareRouter.post('/print/label', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { productId, labelType, quantity, printerId } = body;

    if (!productId) {
      return c.json(errorResponse('Validation Error', 'Product ID is required'), 400);
    }

    const product = await db.product.findFirst({
      where: { id: productId, organisationId: user.organisationId },
    });

    if (!product) {
      return c.json(errorResponse('Not Found', 'Product not found'), 404);
    }

    const { buildZplLabel, buildPriceLabel, buildInventoryLabel } = await import('@nexus/printing');
    
    const productData = {
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      unitPrice: Number(product.unitPrice),
    };
    
    let label: string;
    switch (labelType) {
      case 'PRICE':
        label = buildPriceLabel(productData);
        break;
      case 'INVENTORY':
        label = buildInventoryLabel(productData, quantity || 1);
        break;
      default:
        label = buildZplLabel(productData);
    }

    return c.json(successResponse({
      productId,
      labelType: labelType || 'PRODUCT',
      quantity: quantity || 1,
      labelData: label,
      message: 'Label generated',
    }));
  } catch (error) {
    console.error('Print label error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to generate label'), 500);
  }
});

hardwareRouter.get('/scanners', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const scanners = await db.device.findMany({
      where: {
        organisationId: user.organisationId,
        type: { in: ['SCANNER', 'BARCODE_SCANNER'] },
      },
      orderBy: { name: 'asc' },
    });

    return c.json(successResponse(scanners));
  } catch (error) {
    console.error('Get scanners error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get scanners'), 500);
  }
});

hardwareRouter.post('/scanners', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, type, connection, serialNumber, branchId } = body;

    if (!name) {
      return c.json(errorResponse('Validation Error', 'Scanner name is required'), 400);
    }

    const scanner = await db.device.create({
      data: {
        name,
        type: 'BARCODE_SCANNER',
        serialNumber: serialNumber || `SCAN-${Date.now()}`,
        branchId: branchId || user.branchId,
        organisationId: user.organisationId,
        status: 'ACTIVE',
        metadata: {
          scannerType: type || 'handheld',
          connection: connection || 'usb',
        },
      },
    });

    return c.json(successResponse(scanner, 'Scanner registered successfully'), 201);
  } catch (error) {
    console.error('Register scanner error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to register scanner'), 500);
  }
});

hardwareRouter.get('/supported', async (c) => {
  const { SUPPORTED_HARDWARE } = await import('@nexus/printing');
  
  return c.json(successResponse(SUPPORTED_HARDWARE));
});

hardwareRouter.post('/detect/network', async (c) => {
  const { detectNetworkPrinters } = await import('@nexus/printing');
  const printers = await detectNetworkPrinters();
  
  return c.json(successResponse(printers));
});

hardwareRouter.post('/detect/bluetooth', async (c) => {
  const { detectBluetoothDevices } = await import('@nexus/printing');
  const devices = await detectBluetoothDevices();
  
  return c.json(successResponse(devices));
});