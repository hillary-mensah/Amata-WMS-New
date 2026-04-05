import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, ORG_ADMIN_ONLY, CASHIER_AND_ABOVE } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';

export const branchRouter = new Hono();

branchRouter.use('*', authMiddleware);

branchRouter.get('/', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const branches = await db.branch.findMany({
      where: { organisationId: user.organisationId },
      include: {
        _count: { select: { users: true, devices: true } },
      },
      orderBy: { name: 'asc' },
    });

    return c.json(successResponse(branches));
  } catch (error) {
    console.error('Get branches error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get branches'), 500);
  }
});

branchRouter.post('/', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, code, address, phone, email } = body;

    if (!name || !code) {
      return c.json(errorResponse('Validation Error', 'Name and code are required'), 400);
    }

    const existingCode = await db.branch.findFirst({
      where: { code, organisationId: user.organisationId },
    });

    if (existingCode) {
      return c.json(errorResponse('Conflict', 'Branch code already exists'), 409);
    }

    const branch = await db.branch.create({
      data: {
        name,
        code,
        address,
        phone,
        email,
        organisationId: user.organisationId,
      },
    });

    return c.json(successResponse(branch, 'Branch created successfully'), 201);
  } catch (error) {
    console.error('Create branch error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to create branch'), 500);
  }
});

branchRouter.get('/:id', CASHIER_AND_ABOVE, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const branch = await db.branch.findFirst({
      where: { id, organisationId: user.organisationId },
      include: {
        users: { select: { id: true, firstName: true, lastName: true, role: true, isActive: true } },
        devices: { select: { id: true, name: true, type: true, status: true, lastHeartbeat: true } },
        _count: { select: { sales: true, products: true } },
      },
    });

    if (!branch) {
      return c.json(errorResponse('Not Found', 'Branch not found'), 404);
    }

    return c.json(successResponse(branch));
  } catch (error) {
    console.error('Get branch error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get branch'), 500);
  }
});

branchRouter.put('/:id', ORG_ADMIN_ONLY, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, address, phone, email, isActive } = body;

    const branch = await db.branch.findFirst({
      where: { id, organisationId: user.organisationId },
    });

    if (!branch) {
      return c.json(errorResponse('Not Found', 'Branch not found'), 404);
    }

    const updated = await db.branch.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return c.json(successResponse(updated, 'Branch updated successfully'));
  } catch (error) {
    console.error('Update branch error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to update branch'), 500);
  }
});