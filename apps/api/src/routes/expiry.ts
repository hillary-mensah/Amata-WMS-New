import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, BRANCH_MANAGER_AND_ABOVE, ORG_ADMIN_ONLY } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';

const THRESHOLD_MONTHS = 6;

export const expiryRouter = new Hono();

expiryRouter.use('*', authMiddleware);

expiryRouter.get('/alerts', BRANCH_MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const status = c.req.query('status');
    const branchId = c.req.query('branchId');

    const where: Record<string, unknown> = {
      organisationId: user.organisationId,
    };

    if (branchId) where.branchId = branchId;
    else if (user.branchId) where.branchId = user.branchId;

    if (status) where.status = status;

    const alerts = await db.expiryAlert.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });

    return c.json(successResponse(alerts));
  } catch (error) {
    console.error('Get expiry alerts error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get alerts'), 500);
  }
});

expiryRouter.get('/near-expiry', BRANCH_MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() + THRESHOLD_MONTHS);

    const today = new Date();

    const batches = await db.productBatch.findMany({
      where: {
        organisationId: user.organisationId,
        expiresAt: {
          gte: today,
          lte: thresholdDate,
        },
        remainingQty: { gt: 0 },
        expiryStatus: { in: ['FRESH', 'NEAR_EXPIRY'] },
      },
      include: {
        inventory: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true } },
            branch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });

    const summarised = batches.map(batch => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      productName: batch.inventory.product.name,
      productSku: batch.inventory.product.sku,
      branchName: batch.inventory.branch.name,
      quantity: batch.remainingQty,
      unitPrice: Number(batch.unitPrice),
      discountPercent: Number(batch.discountPercent),
      isDiscounted: batch.isDiscounted,
      expiresAt: batch.expiresAt,
      daysUntilExpiry: Math.ceil((new Date(batch.expiresAt).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      status: batch.expiryStatus,
    }));

    return c.json(successResponse(summarised));
  } catch (error) {
    console.error('Get near expiry error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get near expiry items'), 500);
  }
});

expiryRouter.post('/apply-discount', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { batchId, discountPercent } = body;

    if (!batchId || discountPercent === undefined) {
      return c.json(errorResponse('Validation Error', 'Batch ID and discount percent are required'), 400);
    }

    if (discountPercent < 0 || discountPercent > 25) {
      return c.json(errorResponse('Validation Error', 'Discount must be between 0% and 25%'), 400);
    }

    const batch = await db.productBatch.findFirst({
      where: {
        id: batchId,
        organisationId: user.organisationId,
      },
    });

    if (!batch) {
      return c.json(errorResponse('Not Found', 'Batch not found'), 404);
    }

    const updated = await db.productBatch.update({
      where: { id: batchId },
      data: {
        discountPercent,
        isDiscounted: discountPercent > 0,
      },
    });

    return c.json(successResponse(updated, 'Discount applied successfully'));
  } catch (error) {
    console.error('Apply discount error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to apply discount'), 500);
  }
});

expiryRouter.post('/bulk-apply-discount', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { batchIds, discountPercent, alertIds } = body;

    if (discountPercent < 0 || discountPercent > 25) {
      return c.json(errorResponse('Validation Error', 'Discount must be between 0% and 25%'), 400);
    }

    let updatedCount = 0;

    if (batchIds && batchIds.length > 0) {
      await db.productBatch.updateMany({
        where: {
          id: { in: batchIds },
          organisationId: user.organisationId,
        },
        data: {
          discountPercent,
          isDiscounted: discountPercent > 0,
        },
      });
      updatedCount = batchIds.length;
    }

    if (alertIds && alertIds.length > 0) {
      await db.expiryAlert.updateMany({
        where: {
          id: { in: alertIds },
          organisationId: user.organisationId,
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
      });
    }

    return c.json(successResponse({ updatedCount }, `Applied ${discountPercent}% discount to ${updatedCount} items`));
  } catch (error) {
    console.error('Bulk apply discount error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to apply bulk discount'), 500);
  }
});

expiryRouter.post('/dismiss-alert/:id', BRANCH_MANAGER_AND_ABOVE, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const alert = await db.expiryAlert.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
      },
    });

    if (!alert) {
      return c.json(errorResponse('Not Found', 'Alert not found'), 404);
    }

    await db.expiryAlert.update({
      where: { id },
      data: {
        status: 'DISMISSED',
      },
    });

    return c.json(successResponse({ message: 'Alert dismissed' }));
  } catch (error) {
    console.error('Dismiss alert error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to dismiss alert'), 500);
  }
});

expiryRouter.post('/batch', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { batchNumber, productId, branchId, quantity, unitPrice, costPrice, expiresAt, manufacturedAt } = body;

    if (!batchNumber || !productId || !branchId || !quantity || !unitPrice || !expiresAt) {
      return c.json(errorResponse('Validation Error', 'Required fields missing'), 400);
    }

    const inventory = await db.inventory.findFirst({
      where: {
        productId,
        branchId,
      },
    });

    if (!inventory) {
      return c.json(errorResponse('Not Found', 'Inventory not found'), 404);
    }

    const expiryDate = new Date(expiresAt);
    const today = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    let expiryStatus: 'FRESH' | 'NEAR_EXPIRY' = 'FRESH';
    if (expiryDate <= today) {
      return c.json(errorResponse('Bad Request', 'Expiry date cannot be in the past'), 400);
    } else if (expiryDate <= sixMonthsLater) {
      expiryStatus = 'NEAR_EXPIRY';
    }

    const batch = await db.productBatch.create({
      data: {
        batchNumber,
        quantity,
        remainingQty: quantity,
        unitPrice,
        costPrice,
        expiresAt: expiryDate,
        manufacturedAt: manufacturedAt ? new Date(manufacturedAt) : null,
        expiryStatus,
        inventoryId: inventory.id,
        organisationId: user.organisationId,
        productId: inventory.productId,
      },
    });

    return c.json(successResponse(batch, 'Batch created successfully'), 201);
  } catch (error) {
    console.error('Create batch error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to create batch'), 500);
  }
});

expiryRouter.get('/stats', BRANCH_MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const today = new Date();
    const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDays = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const sixMonths = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000);

    const whereBase = {
      organisationId: user.organisationId,
      remainingQty: { gt: 0 },
    };

    const [expiredCount, nearExpiry30, nearExpiry90, nearExpiry180, totalValue] = await Promise.all([
      db.productBatch.count({
        where: { ...whereBase, expiresAt: { lt: today }, expiryStatus: 'EXPIRED' },
      }),
      db.productBatch.count({
        where: { ...whereBase, expiresAt: { gte: today, lte: thirtyDays }, expiryStatus: { in: ['FRESH', 'NEAR_EXPIRY'] } },
      }),
      db.productBatch.count({
        where: { ...whereBase, expiresAt: { gt: thirtyDays, lte: ninetyDays }, expiryStatus: { in: ['FRESH', 'NEAR_EXPIRY'] } },
      }),
      db.productBatch.count({
        where: { ...whereBase, expiresAt: { gt: ninetyDays, lte: sixMonths }, expiryStatus: { in: ['FRESH', 'NEAR_EXPIRY'] } },
      }),
      db.productBatch.aggregate({
        where: { ...whereBase, expiryStatus: { in: ['FRESH', 'NEAR_EXPIRY'] } },
        _sum: {
          remainingQty: true,
        },
      }),
    ]);

    const pendingAlerts = await db.expiryAlert.count({
      where: {
        organisationId: user.organisationId,
        status: 'PENDING',
      },
    });

    return c.json(successResponse({
      expired: expiredCount,
      nearExpiry30Days: nearExpiry30,
      nearExpiry90Days: nearExpiry90,
      nearExpiry180Days: nearExpiry180,
      totalAtRisk: nearExpiry30 + nearExpiry90 + nearExpiry180,
      pendingAlerts,
    }));
  } catch (error) {
    console.error('Get expiry stats error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get stats'), 500);
  }
});

expiryRouter.post('/generate-alerts', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const today = new Date();
    const thresholdDate = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000);

    const nearExpiryBatches = await db.productBatch.findMany({
      where: {
        organisationId: user.organisationId,
        expiresAt: { gte: today, lte: thresholdDate },
        remainingQty: { gt: 0 },
        expiryStatus: { in: ['FRESH', 'NEAR_EXPIRY'] },
      },
      include: {
        inventory: {
          include: {
            product: true,
            branch: true,
          },
        },
      },
    });

    let alertCount = 0;
    const existingAlerts = await db.expiryAlert.findMany({
      where: {
        organisationId: user.organisationId,
        status: 'PENDING',
      },
      select: { batchId: true },
    });
    const existingBatchIds = new Set(existingAlerts.map(a => a.batchId));

    for (const batch of nearExpiryBatches) {
      if (existingBatchIds.has(batch.id)) continue;

      const daysUntilExpiry = Math.ceil((new Date(batch.expiresAt).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      let suggestedDiscount = 0;
      if (daysUntilExpiry <= 30) suggestedDiscount = 25;
      else if (daysUntilExpiry <= 60) suggestedDiscount = 20;
      else if (daysUntilExpiry <= 90) suggestedDiscount = 15;
      else if (daysUntilExpiry <= 180) suggestedDiscount = 10;

      await db.expiryAlert.create({
        data: {
          title: `Expiring Soon: ${batch.inventory.product.name}`,
          message: `Batch ${batch.batchNumber} expires in ${daysUntilExpiry} days. Consider applying ${suggestedDiscount}% discount.`,
          alertType: 'NEAR_EXPIRY',
          expiresAt: batch.expiresAt,
          organisationId: user.organisationId,
          branchId: batch.inventory.branchId,
          productId: batch.inventory.productId,
          batchId: batch.id,
          suggestedDiscount,
        },
      });
      alertCount++;
    }

    return c.json(successResponse({ alertCount }, `Generated ${alertCount} expiry alerts`));
  } catch (error) {
    console.error('Generate alerts error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to generate alerts'), 500);
  }
});