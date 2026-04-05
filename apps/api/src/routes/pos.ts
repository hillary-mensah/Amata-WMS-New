import { Hono } from 'hono';
import { db } from '@nexus/db';
import { 
  authMiddleware, 
  CASHIER_AND_ABOVE,
  BRANCH_MANAGER_AND_ABOVE 
} from '@nexus/auth';
import { 
  CreateSaleRequestSchema, 
  VoidSaleRequestSchema,
  SaleStatus,
  PaymentMethod,
  calculateGhanaTax,
  successResponse,
  errorResponse,
} from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';
import { addFraudCheckJob, addPrintJob } from '@nexus/queue';

export const posRouter = new Hono();

posRouter.use('*', authMiddleware);

posRouter.post('/sale', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const parsed = CreateSaleRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(errorResponse('Validation Error', parsed.error.errors.join(', ')), 400);
    }

    const { idempotencyKey, branchId, items, paymentMethod, paymentReference, notes, deviceId } = parsed.data;

    const existingSale = await db.sale.findFirst({
      where: { receiptNumber: idempotencyKey },
    });

    if (existingSale) {
      return c.json(successResponse({ 
        id: existingSale.id, 
        receiptNumber: existingSale.receiptNumber,
        status: existingSale.status 
      }, 'Sale already processed'), 200);
    }

    const branch = await db.branch.findFirst({
      where: { id: branchId, organisationId: user.organisationId },
      include: { organisation: true },
    });

    if (!branch) {
      return c.json(errorResponse('Not Found', 'Branch not found'), 404);
    }

    for (const item of items) {
      const product = await db.product.findFirst({
        where: { 
          id: item.productId,
          OR: [
            { organisationId: user.organisationId },
            { branchId },
          ],
        },
      });

      if (!product) {
        return c.json(errorResponse('Not Found', `Product ${item.productId} not found`), 404);
      }
    }

    const subtotal = items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice - item.discount;
      return sum + itemTotal;
    }, 0);

    const taxBreakdown = calculateGhanaTax(subtotal);
    const totalAmount = taxBreakdown.total;

    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const saleItemsData = [];
    for (const item of items) {
      let remainingQty = item.quantity;
      const unitPrice = item.unitPrice;
      
      const availableBatches = await db.productBatch.findMany({
        where: {
          inventory: {
            productId: item.productId,
            branchId,
          },
          remainingQty: { gt: 0 },
          expiryStatus: { in: ['FRESH', 'NEAR_EXPIRY'] },
        },
        orderBy: { expiresAt: 'asc' },
        take: 10,
      });

      let totalItemDiscount = 0;
      let totalItemPrice = 0;

      for (const batch of availableBatches) {
        if (remainingQty <= 0) break;

        const qtyFromBatch = Math.min(batch.remainingQty, remainingQty);
        
        const basePrice = Number(batch.unitPrice);
        const discountPercent = Number(batch.discountPercent || 0);
        const discountedPrice = basePrice * (1 - discountPercent / 100);
        
        totalItemPrice += qtyFromBatch * discountedPrice;
        totalItemDiscount += qtyFromBatch * (basePrice - discountedPrice);

        await db.productBatch.update({
          where: { id: batch.id },
          data: { remainingQty: { decrement: qtyFromBatch } },
        });

        remainingQty -= qtyFromBatch;
      }

      if (remainingQty > 0) {
        const regularPrice = unitPrice;
        totalItemPrice += remainingQty * regularPrice;
      }

      const saleItem = {
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: totalItemPrice,
        discount: item.discount + totalItemDiscount,
        taxAmount: (totalItemPrice - item.discount) * 0.2,
        productId: item.productId,
      };
      saleItemsData.push(saleItem);
    }

    const sale = await db.sale.create({
      data: {
        receiptNumber,
        totalAmount,
        taxAmount: taxBreakdown.vat + taxBreakdown.nhil + taxBreakdown.getfund,
        discountAmount: items.reduce((sum, item) => sum + item.discount, 0),
        status: SaleStatus.COMPLETED,
        paymentMethod,
        notes,
        userId: user.userId,
        organisationId: user.organisationId,
        branchId,
        deviceId,
        items: {
          create: saleItemsData,
        },
        payments: {
          create: {
            amount: totalAmount,
            method: paymentMethod,
            status: 'COMPLETED',
            reference: paymentReference,
            provider: paymentMethod === PaymentMethod.CARD ? 'PAYSTACK' : paymentMethod === PaymentMethod.MOMO ? 'MTN_MOMO' : 'INTERNAL',
            completedAt: new Date(),
          },
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        user: true,
        branch: true,
        device: true,
      },
    });

    if (paymentMethod === PaymentMethod.CARD || paymentMethod === PaymentMethod.MOMO) {
      await addFraudCheckJob({
        saleId: sale.id,
        amount: Number(totalAmount),
        paymentMethod,
        userId: user.userId,
        branchId,
      });
    }

    try {
      await addPrintJob({
        saleId: sale.id,
        receiptData: sale,
        printerType: 'network',
        printerTarget: process.env.PRINTER_HOST || '192.168.1.100',
      });
    } catch (printError) {
      console.error('Failed to queue print job:', printError);
    }

    return c.json(successResponse({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      totalAmount: sale.totalAmount,
      status: sale.status,
      taxBreakdown,
      createdAt: sale.createdAt,
    }, 'Sale completed successfully'), 201);
  } catch (error) {
    console.error('Create sale error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to create sale'), 500);
  }
});

posRouter.get('/sale/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const sale = await db.sale.findFirst({
      where: { 
        id,
        organisationId: user.organisationId,
      },
      include: {
        items: {
          include: { product: true },
        },
        user: { select: { firstName: true, lastName: true } },
        branch: true,
        device: true,
        voidedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!sale) {
      return c.json(errorResponse('Not Found', 'Sale not found'), 404);
    }

    return c.json(successResponse(sale));
  } catch (error) {
    console.error('Get sale error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get sale'), 500);
  }
});

posRouter.post('/sale/:id/void', BRANCH_MANAGER_AND_ABOVE, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const parsed = VoidSaleRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(errorResponse('Validation Error', parsed.error.errors.join(', ')), 400);
    }

    const sale = await db.sale.findFirst({
      where: { 
        id,
        organisationId: user.organisationId,
        branchId: user.branchId ?? undefined,
      },
    });

    if (!sale) {
      return c.json(errorResponse('Not Found', 'Sale not found'), 404);
    }

    if (sale.status === SaleStatus.VOIDED) {
      return c.json(errorResponse('Bad Request', 'Sale already voided'), 400);
    }

    const voidedSale = await db.sale.update({
      where: { id },
      data: {
        status: SaleStatus.VOIDED,
        voidedAt: new Date(),
        voidReason: parsed.data.reason,
        voidedById: user.userId,
      },
      include: {
        items: true,
      },
    });

    return c.json(successResponse(voidedSale, 'Sale voided successfully'));
  } catch (error) {
    console.error('Void sale error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to void sale'), 500);
  }
});

posRouter.get('/summary', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const dateParam = c.req.query('date');
    const date = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const branchId = user.branchId;

    const sales = await db.sale.findMany({
      where: {
        organisationId: user.organisationId,
        ...(branchId ? { branchId } : {}),
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: SaleStatus.COMPLETED as typeof SaleStatus.COMPLETED,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
    const totalTax = sales.reduce((sum, sale) => sum + Number(sale.taxAmount), 0);
    const totalDiscount = sales.reduce((sum, sale) => sum + Number(sale.discountAmount), 0);

    const byPaymentMethod = sales.reduce((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + Number(sale.totalAmount);
      return acc;
    }, {} as Record<string, number>);

    const byBranch: Record<string, number> = {};
    for (const sale of sales) {
      const branchName = sale.branchId;
      byBranch[branchName] = (byBranch[branchName] || 0) + Number(sale.totalAmount);
    }

    const byCashier: Record<string, number> = {};
    for (const sale of sales) {
      byCashier[sale.userId] = (byCashier[sale.userId] || 0) + Number(sale.totalAmount);
    }

    const topProducts = await db.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          organisationId: user.organisationId,
          ...(branchId ? { branchId } : {}),
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: SaleStatus.COMPLETED as typeof SaleStatus.COMPLETED,
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    const topProductIds = topProducts.map(p => p.productId);
    const topProductDetails = await db.product.findMany({
      where: { id: { in: topProductIds } },
    });

    const topProductsWithDetails = topProducts.map(p => {
      const product = topProductDetails.find(prod => prod.id === p.productId);
      return {
        productId: p.productId,
        name: product?.name || 'Unknown',
        quantity: p._sum.quantity || 0,
      };
    });

    return c.json(successResponse({
      date: startOfDay.toISOString(),
      totalSales,
      totalRevenue,
      totalTax,
      totalDiscount,
      byPaymentMethod,
      byBranch,
      byCashier,
      topProducts: topProductsWithDetails,
    }));
  } catch (error) {
    console.error('Get summary error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get summary'), 500);
  }
});