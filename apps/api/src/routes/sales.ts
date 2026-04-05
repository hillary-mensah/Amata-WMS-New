import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, CASHIER_AND_ABOVE } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';

export const salesRouter = new Hono();

salesRouter.use('*', authMiddleware);

salesRouter.get('/', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const status = c.req.query('status');
    const branchId = c.req.query('branchId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const where: Record<string, unknown> = {
      organisationId: user.organisationId,
    };

    if (branchId) where.branchId = branchId;
    else if (user.branchId) where.branchId = user.branchId;

    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true } },
          branch: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.sale.count({ where }),
    ]);

    return c.json(successResponse({
      items: sales,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }));
  } catch (error) {
    console.error('Get sales error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get sales'), 500);
  }
});

salesRouter.get('/:id', CASHIER_AND_ABOVE, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const sale = await db.sale.findFirst({
      where: { id, organisationId: user.organisationId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        branch: true,
        voidedBy: { select: { firstName: true, lastName: true } },
        items: { include: { product: true } },
        payments: true,
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