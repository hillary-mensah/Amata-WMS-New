import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, ORG_ADMIN_ONLY, BRANCH_MANAGER_AND_ABOVE } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';

export const productRouter = new Hono();

productRouter.use('*', authMiddleware);

productRouter.get('/', BRANCH_MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const search = c.req.query('search');
    const categoryId = c.req.query('categoryId');
    const isActive = c.req.query('isActive');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');

    const where: Record<string, unknown> = {
      organisationId: user.organisationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      db.product.count({ where }),
    ]);

    return c.json(successResponse({
      items: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }));
  } catch (error) {
    console.error('Get products error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get products'), 500);
  }
});

productRouter.post('/', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, sku, barcode, unitPrice, costPrice, categoryId, isTrackStock, minStock, branchId } = body;

    if (!name || !sku || !unitPrice) {
      return c.json(errorResponse('Validation Error', 'Name, SKU, and price are required'), 400);
    }

    const existingSku = await db.product.findUnique({ where: { sku } });
    if (existingSku) {
      return c.json(errorResponse('Conflict', 'SKU already exists'), 409);
    }

    const product = await db.product.create({
      data: {
        name,
        sku,
        barcode,
        unitPrice,
        costPrice,
        categoryId,
        isTrackStock: isTrackStock ?? true,
        minStock: minStock ?? 10,
        organisationId: user.organisationId,
        branchId: branchId || user.branchId,
      },
      include: { category: true },
    });

    if (user.branchId) {
      await db.inventory.create({
        data: {
          productId: product.id,
          branchId: user.branchId,
          quantity: 0,
        },
      });
    }

    return c.json(successResponse(product, 'Product created successfully'), 201);
  } catch (error) {
    console.error('Create product error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to create product'), 500);
  }
});

productRouter.get('/:id', BRANCH_MANAGER_AND_ABOVE, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const product = await db.product.findFirst({
      where: { id, organisationId: user.organisationId },
      include: {
        category: true,
        inventories: { include: { branch: { select: { id: true, name: true } } } },
      },
    });

    if (!product) {
      return c.json(errorResponse('Not Found', 'Product not found'), 404);
    }

    return c.json(successResponse(product));
  } catch (error) {
    console.error('Get product error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get product'), 500);
  }
});

productRouter.put('/:id', ORG_ADMIN_ONLY, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, barcode, unitPrice, costPrice, categoryId, isActive, isTrackStock, minStock } = body;

    const product = await db.product.findFirst({
      where: { id, organisationId: user.organisationId },
    });

    if (!product) {
      return c.json(errorResponse('Not Found', 'Product not found'), 404);
    }

    const updated = await db.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(barcode !== undefined && { barcode }),
        ...(unitPrice && { unitPrice }),
        ...(costPrice !== undefined && { costPrice }),
        ...(categoryId && { categoryId }),
        ...(isActive !== undefined && { isActive }),
        ...(isTrackStock !== undefined && { isTrackStock }),
        ...(minStock !== undefined && { minStock }),
      },
      include: { category: true },
    });

    return c.json(successResponse(updated, 'Product updated successfully'));
  } catch (error) {
    console.error('Update product error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to update product'), 500);
  }
});

productRouter.delete('/:id', ORG_ADMIN_ONLY, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const product = await db.product.findFirst({
      where: { id, organisationId: user.organisationId },
    });

    if (!product) {
      return c.json(errorResponse('Not Found', 'Product not found'), 404);
    }

    await db.product.update({
      where: { id },
      data: { isActive: false },
    });

    return c.json(successResponse({ message: 'Product deactivated' }));
  } catch (error) {
    console.error('Delete product error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to delete product'), 500);
  }
});