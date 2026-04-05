import { Hono } from 'hono';
import { db } from '@nexus/db';
import { 
  authMiddleware, 
  CASHIER_AND_ABOVE,
  WAREHOUSE_AND_ABOVE,
  BRANCH_MANAGER_AND_ABOVE,
} from '@nexus/auth';
import { 
  InventoryAdjustmentSchema,
  InventoryTransferSchema,
  successResponse,
  errorResponse,
} from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';

export const inventoryRouter = new Hono();

inventoryRouter.use('*', authMiddleware);

inventoryRouter.get('/', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const branchId = c.req.query('branchId');
    const productId = c.req.query('productId');
    const search = c.req.query('search');
    const lowStock = c.req.query('lowStock') === 'true';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');

    const where: Record<string, unknown> = {
      branch: { organisationId: user.organisationId },
    };

    if (branchId) {
      where.branchId = branchId;
    } else if (user.branchId) {
      where.branchId = user.branchId;
    }

    if (productId) {
      where.productId = productId;
    }

    if (lowStock) {
      where.product = { isTrackStock: true };
    }

    const skip = (page - 1) * limit;

    const [inventories, total] = await Promise.all([
      db.inventory.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              unitPrice: true,
              isTrackStock: true,
              minStock: true,
            },
          },
          branch: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      db.inventory.count({ where }),
    ]);

    let filtered = inventories;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = inventories.filter(inv => 
        inv.product.name.toLowerCase().includes(searchLower) ||
        inv.product.sku.toLowerCase().includes(searchLower) ||
        (inv.product.barcode?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    if (lowStock) {
      filtered = filtered.filter(inv => inv.quantity <= inv.product.minStock);
    }

    return c.json(successResponse({
      items: filtered,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }));
  } catch (error) {
    console.error('Get inventory error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get inventory'), 500);
  }
});

inventoryRouter.post('/adjust', WAREHOUSE_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const parsed = InventoryAdjustmentSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(errorResponse('Validation Error', parsed.error.errors.join(', ')), 400);
    }

    const { productId, branchId, quantity, reason, reference } = parsed.data;

    const product = await db.product.findFirst({
      where: {
        id: productId,
        OR: [
          { organisationId: user.organisationId },
          { branchId },
        ],
      },
    });

    if (!product) {
      return c.json(errorResponse('Not Found', 'Product not found'), 404);
    }

    const branch = await db.branch.findFirst({
      where: { id: branchId, organisationId: user.organisationId },
    });

    if (!branch) {
      return c.json(errorResponse('Not Found', 'Branch not found'), 404);
    }

    const inventory = await db.inventory.upsert({
      where: {
        productId_branchId: { productId, branchId },
      },
      create: {
        productId,
        branchId,
        quantity,
      },
      update: {
        quantity: { increment: quantity },
      },
    });

    await db.inventoryAdjustment.create({
      data: {
        productId,
        branchId,
        quantity,
        reason,
        reference,
        userId: user.userId,
      },
    });

    return c.json(successResponse({
      id: inventory.id,
      productId: inventory.productId,
      branchId: inventory.branchId,
      quantity: inventory.quantity,
      adjustedAt: new Date(),
    }, 'Inventory adjusted successfully'));
  } catch (error) {
    console.error('Adjust inventory error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to adjust inventory'), 500);
  }
});

inventoryRouter.post('/transfer', BRANCH_MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const parsed = InventoryTransferSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(errorResponse('Validation Error', parsed.error.errors.join(', ')), 400);
    }

    const { fromBranchId, toBranchId, items, notes } = parsed.data;

    if (fromBranchId === toBranchId) {
      return c.json(errorResponse('Bad Request', 'Source and destination branches must be different'), 400);
    }

    const [fromBranch, toBranch] = await Promise.all([
      db.branch.findFirst({ where: { id: fromBranchId, organisationId: user.organisationId } }),
      db.branch.findFirst({ where: { id: toBranchId, organisationId: user.organisationId } }),
    ]);

    if (!fromBranch || !toBranch) {
      return c.json(errorResponse('Not Found', 'One or both branches not found'), 404);
    }

    for (const item of items) {
      const sourceInventory = await db.inventory.findUnique({
        where: {
          productId_branchId: { productId: item.productId, branchId: fromBranchId },
        },
      });

      if (!sourceInventory || sourceInventory.quantity < item.quantity) {
        return c.json(errorResponse('Bad Request', `Insufficient stock for product ${item.productId}`), 400);
      }
    }

    const transfer = await db.inventoryTransfer.create({
      data: {
        fromBranchId,
        toBranchId,
        notes,
        userId: user.userId,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    for (const item of items) {
      await db.inventory.update({
        where: {
          productId_branchId: { productId: item.productId, branchId: fromBranchId },
        },
        data: {
          quantity: { decrement: item.quantity },
        },
      });

      await db.inventory.upsert({
        where: {
          productId_branchId: { productId: item.productId, branchId: toBranchId },
        },
        create: {
          productId: item.productId,
          branchId: toBranchId,
          quantity: item.quantity,
        },
        update: {
          quantity: { increment: item.quantity },
        },
      });
    }

    await db.inventoryTransfer.update({
      where: { id: transfer.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return c.json(successResponse(transfer, 'Transfer completed successfully'));
  } catch (error) {
    console.error('Transfer inventory error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to transfer inventory'), 500);
  }
});

inventoryRouter.get('/transfers', BRANCH_MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const transfers = await db.inventoryTransfer.findMany({
      where: {
        OR: [
          { fromBranchId: user.branchId || undefined },
          { toBranchId: user.branchId || undefined },
        ],
      },
      include: {
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return c.json(successResponse(transfers));
  } catch (error) {
    console.error('Get transfers error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get transfers'), 500);
  }
});