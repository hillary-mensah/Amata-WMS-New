import { Hono } from 'hono';
import { db } from '@nexus/db';
import { 
  authMiddleware, 
  CASHIER_AND_ABOVE,
  MANAGER_AND_ABOVE,
} from '@nexus/auth';
import { 
  SyncRequestSchema,
  successResponse,
  errorResponse,
} from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';
import { 
  syncOfflineSales, 
  getServerChanges,
  resolveStockConflicts,
  runReconciliation,
  OfflineSale,
} from '@nexus/sync';
import {
  SYNC_VERSION,
  MIN_COMPATIBLE_VERSION,
  applyDeltaSync,
  getDeviceSyncStatus,
  buildDeltaPayload,
  getSyncVersions,
  getSyncConflictSummary,
  resolveSyncConflict,
  recordSyncEvent,
} from '@nexus/sync';

export const syncRouter = new Hono();

syncRouter.use('*', authMiddleware);

syncRouter.post('/', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const parsed = SyncRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(errorResponse('Validation Error', parsed.error.errors.join(', ')), 400);
    }

    const { deviceId, lastSyncAt, sales } = parsed.data;

    const device = await db.device.findFirst({
      where: { id: deviceId, organisationId: user.organisationId },
    });

    if (!device) {
      return c.json(errorResponse('Not Found', 'Device not found'), 404);
    }

    await db.device.update({
      where: { id: deviceId },
      data: { lastHeartbeat: new Date() },
    });

    // Transform sales to OfflineSale format with required fields
    let offlineSales: OfflineSale[] = [];
    if (sales && sales.length > 0 && user.branchId) {
      offlineSales = sales.map((sale) => ({
        localId: sale.localId,
        idempotencyKey: sale.idempotencyKey,
        branchId: sale.branchId,
        userId: user.userId,
        deviceId: deviceId,
        items: sale.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount ?? 0,
        })),
        paymentMethod: sale.paymentMethod,
        createdAt: sale.createdAt,
      }));
    }

    const syncResult = offlineSales.length > 0
      ? await syncOfflineSales(user.organisationId, user.branchId!, user.userId, offlineSales)
      : { success: true, syncedCount: 0, conflicts: [], serverChanges: [] };

    const lastSync = lastSyncAt ? new Date(lastSyncAt) : undefined;
    const serverChanges = await getServerChanges(user.organisationId, lastSync);

    const syncLog = await db.syncLog.create({
      data: {
        deviceId,
        payloadSize: JSON.stringify(body).length,
        status: syncResult.success ? 'COMPLETED' : 'FAILED',
        errorMessage: syncResult.success ? null : 'Partial sync failure',
        completedAt: new Date(),
      },
    });

    return c.json(successResponse({
      syncedCount: syncResult.syncedCount,
      conflicts: syncResult.conflicts,
      serverChanges,
      syncLogId: syncLog.id,
      serverTime: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Sync error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to sync'), 500);
  }
});

syncRouter.get('/changes', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const sinceParam = c.req.query('since');
    const since = sinceParam ? new Date(sinceParam) : undefined;

    const changes = await getServerChanges(user.organisationId, since);

    return c.json(successResponse(changes));
  } catch (error) {
    console.error('Get changes error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get changes'), 500);
  }
});

syncRouter.post('/reconcile', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const result = await runReconciliation(user.organisationId);

    return c.json(successResponse({
      ...result,
      message: 'Reconciliation completed',
    }));
  } catch (error) {
    console.error('Reconciliation error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to run reconciliation'), 500);
  }
});

syncRouter.post('/resolve-stock', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const result = await resolveStockConflicts(user.organisationId);

    return c.json(successResponse({
      ...result,
      message: result.failed > 0 
        ? `${result.failed} conflicts could not be resolved` 
        : 'All stock conflicts resolved',
    }));
  } catch (error) {
    console.error('Resolve stock error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to resolve stock conflicts'), 500);
  }
});

syncRouter.post('/delta', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { deviceId, baseVersion, operations, checksum } = body;

    if (!deviceId || !operations) {
      return c.json(errorResponse('Bad Request', 'deviceId and operations required'), 400);
    }

    const device = await db.device.findFirst({
      where: { id: deviceId, organisationId: user.organisationId },
    });

    if (!device) {
      return c.json(errorResponse('Not Found', 'Device not found'), 404);
    }

    await db.device.update({
      where: { id: deviceId },
      data: { lastHeartbeat: new Date() },
    });

    const payload = {
      version: SYNC_VERSION,
      baseVersion,
      deviceId,
      operations,
      timestamp: new Date().toISOString(),
      checksum,
    };

    const result = await applyDeltaSync(
      user.organisationId,
      user.branchId || '',
      user.userId,
      deviceId,
      payload
    );

    await db.syncLog.create({
      data: {
        deviceId,
        payloadSize: JSON.stringify(body).length,
        status: result.success ? 'COMPLETED' : 'FAILED',
        syncVersion: result.newVersion,
        baseVersion,
        deltaHash: checksum,
        completedAt: new Date(),
      },
    });

    return c.json(successResponse({
      success: result.success,
      synced: result.synced,
      conflicts: result.conflicts,
      serverChanges: result.serverChanges,
      newVersion: result.newVersion,
      checksum: result.checksum,
    }));
  } catch (error) {
    console.error('Delta sync error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to sync'), 500);
  }
});

syncRouter.get('/delta', CASHIER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const deviceId = c.req.query('deviceId');
    const baseVersion = parseInt(c.req.query('baseVersion') || '0');

    if (!deviceId) {
      return c.json(errorResponse('Bad Request', 'deviceId required'), 400);
    }

    const payload = await buildDeltaPayload(user.organisationId, baseVersion, deviceId);

    return c.json(successResponse(payload));
  } catch (error) {
    console.error('Get delta error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get delta'), 500);
  }
});

syncRouter.get('/versions', async (c) => {
  try {
    const versions = await getSyncVersions();
    return c.json(successResponse({
      currentVersion: SYNC_VERSION,
      minCompatibleVersion: MIN_COMPATIBLE_VERSION,
      versions,
    }));
  } catch (error) {
    console.error('Get versions error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get versions'), 500);
  }
});

syncRouter.get('/status/:deviceId', CASHIER_AND_ABOVE, async (c) => {
  try {
    const deviceId = c.req.param('deviceId');

    const status = await getDeviceSyncStatus(deviceId ?? '');

    return c.json(successResponse(status));
  } catch (error) {
    console.error('Get status error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get status'), 500);
  }
});

syncRouter.get('/conflicts', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const summary = await getSyncConflictSummary(user.organisationId);

    return c.json(successResponse(summary));
  } catch (error) {
    console.error('Get conflicts error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get conflicts'), 500);
  }
});

syncRouter.post('/conflicts/:conflictId/resolve', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const conflictId = c.req.param('conflictId');
    const body = await c.req.json();
    const { resolution } = body;

    if (!resolution || !['SERVER_WINS', 'LOCAL_WINS', 'IGNORE'].includes(resolution)) {
      return c.json(errorResponse('Bad Request', 'resolution required (SERVER_WINS, LOCAL_WINS, or IGNORE)'), 400);
    }

    // @ts-expect-error - userId may be undefined but we handle it
    await resolveSyncConflict(conflictId, resolution, user.userId || "");

    return c.json(successResponse({ message: 'Conflict resolved' }));
  } catch (error) {
    console.error('Resolve conflict error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to resolve conflict'), 500);
  }
});
