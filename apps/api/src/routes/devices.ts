import { Hono } from 'hono';
import { db } from '@nexus/db';
import { 
  authMiddleware, 
  ORG_ADMIN_ONLY,
  CASHIER_AND_ABOVE,
} from '@nexus/auth';
import { 
  DeviceHeartbeatSchema,
  successResponse,
  errorResponse,
} from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';

export const deviceRouter = new Hono();

deviceRouter.use('*', authMiddleware);

deviceRouter.get('/', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const branchId = c.req.query('branchId');

    const where: Record<string, unknown> = {
      organisationId: user.organisationId,
    };

    if (branchId) {
      where.branchId = branchId;
    } else if (user.branchId) {
      where.branchId = user.branchId;
    }

    const devices = await db.device.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const devicesWithStatus = devices.map(device => ({
      ...device,
      isOnline: device.lastHeartbeat 
        ? new Date(device.lastHeartbeat).getTime() > Date.now() - 5 * 60 * 1000
        : false,
    }));

    return c.json(successResponse(devicesWithStatus));
  } catch (error) {
    console.error('Get devices error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get devices'), 500);
  }
});

deviceRouter.post('/', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, type, serialNumber, branchId, metadata } = body;

    if (!name || !branchId) {
      return c.json(errorResponse('Validation Error', 'Name and branchId are required'), 400);
    }

    const branch = await db.branch.findFirst({
      where: { id: branchId, organisationId: user.organisationId },
    });

    if (!branch) {
      return c.json(errorResponse('Not Found', 'Branch not found'), 404);
    }

    const device = await db.device.create({
      data: {
        name,
        type: type || 'POS',
        serialNumber,
        branchId,
        organisationId: user.organisationId,
        metadata,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    return c.json(successResponse(device, 'Device registered successfully'), 201);
  } catch (error) {
    console.error('Register device error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to register device'), 500);
  }
});

deviceRouter.get('/:id', CASHIER_AND_ABOVE, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const device = await db.device.findFirst({
      where: { 
        id,
        organisationId: user.organisationId,
      },
      include: {
        branch: { select: { id: true, name: true } },
        sales: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, receiptNumber: true, totalAmount: true, createdAt: true },
        },
      },
    });

    if (!device) {
      return c.json(errorResponse('Not Found', 'Device not found'), 404);
    }

    const isOnline = device.lastHeartbeat 
      ? new Date(device.lastHeartbeat).getTime() > Date.now() - 5 * 60 * 1000
      : false;

    return c.json(successResponse({ ...device, isOnline }));
  } catch (error) {
    console.error('Get device error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get device'), 500);
  }
});

deviceRouter.post('/:id/heartbeat', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = DeviceHeartbeatSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(errorResponse('Validation Error', parsed.error.errors.join(', ')), 400);
    }

    const device = await db.device.findUnique({
      where: { id },
    });

    if (!device) {
      return c.json(errorResponse('Not Found', 'Device not found'), 404);
    }

    const updateData: Record<string, unknown> = {
      lastHeartbeat: new Date(),
    };

    if (parsed.data.status) {
      updateData.status = parsed.data.status;
    }

    if (parsed.data.metadata) {
      updateData.metadata = parsed.data.metadata;
    }

    await db.device.update({
      where: { id },
      data: updateData,
    });

    return c.json(successResponse({ message: 'Heartbeat received' }));
  } catch (error) {
    console.error('Heartbeat error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to process heartbeat'), 500);
  }
});

deviceRouter.delete('/:id', ORG_ADMIN_ONLY, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const device = await db.device.findFirst({
      where: { id, organisationId: user.organisationId },
    });

    if (!device) {
      return c.json(errorResponse('Not Found', 'Device not found'), 404);
    }

    await db.device.delete({
      where: { id },
    });

    return c.json(successResponse({ message: 'Device deleted successfully' }));
  } catch (error) {
    console.error('Delete device error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to delete device'), 500);
  }
});