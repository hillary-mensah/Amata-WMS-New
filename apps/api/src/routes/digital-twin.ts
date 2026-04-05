import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '@nexus/db';
import { authMiddleware, MANAGER_AND_ABOVE } from '@nexus/auth';
import { successResponse, errorResponse, DiscrepancyStatusSchema } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';
import {
  verifyDigitalTwin,
  getDiscrepancyAlerts,
  resolveDiscrepancy,
  reconcileInventory,
} from '@nexus/sync';
import { DiscrepancyType, DiscrepancyStatus } from '@nexus/types';

const digitalTwinRouter = new Hono();

digitalTwinRouter.use('*', authMiddleware);

digitalTwinRouter.post('/verify', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const branchId = body.branchId as string | undefined;

    const results = await verifyDigitalTwin(user.organisationId, branchId);

    const unbalanced = results.filter((r) => !r.isBalanced);
    const balanced = results.filter((r) => r.isBalanced);

    return c.json(successResponse({
      total: results.length,
      balanced: balanced.length,
      unbalanced: unbalanced.length,
      discrepancies: unbalanced,
    }));
  } catch (error) {
    console.error('Verify digital twin error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to verify inventory'), 500);
  }
});

digitalTwinRouter.get('/alerts', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const statusParam = c.req.query('status');
    const status = statusParam ? (statusParam as DiscrepancyStatus) : undefined;

    const alerts = await getDiscrepancyAlerts(user.organisationId, status);

    return c.json(successResponse(alerts));
  } catch (error) {
    console.error('Get alerts error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get alerts'), 500);
  }
});

const ResolveDiscrepancySchema = z.object({
  discrepancyId: z.string().uuid(),
  resolution: z.enum(['RESOLVED', 'WRITE_OFF', 'INVESTIGATING']),
  notes: z.string().optional(),
});

digitalTwinRouter.post('/resolve', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const parsed = ResolveDiscrepancySchema.safeParse(body);

    if (!parsed.success) {
      return c.json(errorResponse('Validation Error', parsed.error.errors.join(', ')), 400);
    }

    const { discrepancyId, resolution, notes } = parsed.data;

    await resolveDiscrepancy(discrepancyId, resolution, user.userId, notes);

    return c.json(successResponse({ message: 'Discrepancy resolved' }));
  } catch (error) {
    console.error('Resolve discrepancy error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to resolve discrepancy'), 500);
  }
});

const ReconcileInventorySchema = z.object({
  inventoryId: z.string().uuid(),
  actualQuantity: z.number().int(),
  type: z.enum(['THEFT', 'DAMAGE', 'EXPIRY', 'SPOILAGE', 'MANUAL_ADJUSTMENT', 'UNKNOWN']),
  notes: z.string().optional(),
});

digitalTwinRouter.post('/reconcile', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const parsed = ReconcileInventorySchema.safeParse(body);

    if (!parsed.success) {
      return c.json(errorResponse('Validation Error', parsed.error.errors.join(', ')), 400);
    }

    const { inventoryId, actualQuantity, type, notes } = parsed.data;

    await reconcileInventory(inventoryId, actualQuantity, user.userId, type, notes);

    return c.json(successResponse({ message: 'Inventory reconciled' }));
  } catch (error) {
    console.error('Reconcile inventory error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to reconcile inventory'), 500);
  }
});

export { digitalTwinRouter };
