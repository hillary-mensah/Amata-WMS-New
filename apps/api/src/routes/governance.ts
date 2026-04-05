import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, AUDITOR_AND_ABOVE, MANAGER_AND_ABOVE, ORG_ADMIN_ONLY } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';
import {
  logAuditEvent,
  verifyAuditIntegrity,
  replayAuditEvents,
  queryAuditLogs,
  getAuditLogById,
  createRetentionPolicy,
  getRetentionPolicies,
  updateRetentionPolicy,
  archiveExpiredData,
  restoreArchivedData,
  getArchivedData,
  deleteExpiredData,
  getComplianceReport,
} from '@nexus/governance';

const governanceRouter = new Hono();

governanceRouter.use('*', authMiddleware);

governanceRouter.post('/audit/log', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { action, entityType, entityId, oldValues, newValues } = body;

    if (!action || !entityType) {
      return c.json(errorResponse('Validation Error', 'action and entityType required'), 400);
    }

    const logId = await logAuditEvent(
      user.organisationId,
      user.userId,
      { action, entityType, entityId, oldValues, newValues },
      undefined,
      c.req.header('X-Forwarded-For') || c.req.header('CF-Connecting-IP'),
      c.req.header('User-Agent')
    );

    return c.json(successResponse({ logId }));
  } catch (error) {
    console.error('Audit log error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to log audit event'), 500);
  }
});

governanceRouter.get('/audit/query', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const userId = c.req.query('userId');
    const entityType = c.req.query('entityType');
    const entityId = c.req.query('entityId');
    const action = c.req.query('action');
    const fromDate = c.req.query('fromDate');
    const toDate = c.req.query('toDate');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await queryAuditLogs(user.organisationId, {
      userId,
      entityType,
      entityId,
      action,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit,
      offset,
    });

    return c.json(successResponse(result));
  } catch (error) {
    console.error('Audit query error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to query audit logs'), 500);
  }
});

governanceRouter.get('/audit/:id', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const id = c.req.param('id');

    const log = await getAuditLogById(id);

    if (!log) {
      return c.json(errorResponse('Not Found', 'Audit log not found'), 404);
    }

    return c.json(successResponse(log));
  } catch (error) {
    console.error('Get audit log error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get audit log'), 500);
  }
});

governanceRouter.post('/audit/verify', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { fromDate, toDate } = body;

    const result = await verifyAuditIntegrity(
      user.organisationId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );

    return c.json(successResponse(result));
  } catch (error) {
    console.error('Verify integrity error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to verify integrity'), 500);
  }
});

governanceRouter.post('/audit/replay', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { fromDate, toDate } = body;

    const result = await replayAuditEvents(
      user.organisationId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );

    return c.json(successResponse(result));
  } catch (error) {
    console.error('Replay audit error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to replay events'), 500);
  }
});

const retentionRouter = new Hono();

retentionRouter.use('*', authMiddleware);

retentionRouter.post('/policies', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, entityType, retentionDays, archiveAfterDays, deleteAfterDays, actionOnExpiry } = body;

    if (!name || !entityType || !retentionDays) {
      return c.json(errorResponse('Validation Error', 'name, entityType, and retentionDays required'), 400);
    }

    const policyId = await createRetentionPolicy(user.organisationId, {
      name,
      entityType,
      retentionDays,
      archiveAfterDays,
      deleteAfterDays,
      actionOnExpiry,
    });

    return c.json(successResponse({ policyId }));
  } catch (error) {
    console.error('Create retention policy error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to create policy'), 500);
  }
});

retentionRouter.get('/policies', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const policies = await getRetentionPolicies(user.organisationId);

    return c.json(successResponse(policies));
  } catch (error) {
    console.error('Get retention policies error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get policies'), 500);
  }
});

retentionRouter.put('/policies/:policyId', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const policyId = c.req.param('policyId');
    const body = await c.req.json();

    await updateRetentionPolicy(policyId, user.organisationId, body);

    return c.json(successResponse({ message: 'Policy updated' }));
  } catch (error) {
    console.error('Update retention policy error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to update policy'), 500);
  }
});

retentionRouter.delete('/policies/:policyId', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const policyId = c.req.param('policyId');

    await db.dataRetentionPolicy.delete({
      where: { id: policyId, organisationId: user.organisationId },
    });

    return c.json(successResponse({ message: 'Policy deleted' }));
  } catch (error) {
    console.error('Delete retention policy error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to delete policy'), 500);
  }
});

retentionRouter.post('/archive', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const result = await archiveExpiredData(user.organisationId);

    return c.json(successResponse(result));
  } catch (error) {
    console.error('Archive expired data error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to archive data'), 500);
  }
});

retentionRouter.post('/archive/:archiveId/restore', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const archiveId = c.req.param('archiveId');

    const result = await restoreArchivedData(archiveId, user.organisationId);

    return c.json(successResponse(result));
  } catch (error) {
    console.error('Restore archived data error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to restore data'), 500);
  }
});

retentionRouter.get('/archive', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const entityType = c.req.query('entityType');
    const isRestored = c.req.query('isRestored');

    const archives = await getArchivedData(
      user.organisationId,
      entityType,
      isRestored === 'true' ? true : isRestored === 'false' ? false : undefined
    );

    return c.json(successResponse(archives));
  } catch (error) {
    console.error('Get archived data error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get archives'), 500);
  }
});

retentionRouter.post('/delete-expired', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const result = await deleteExpiredData(user.organisationId);

    return c.json(successResponse(result));
  } catch (error) {
    console.error('Delete expired data error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to delete data'), 500);
  }
});

const complianceRouter = new Hono();

complianceRouter.use('*', authMiddleware);

complianceRouter.get('/report', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const startDateParam = c.req.query('startDate');
    const endDateParam = c.req.query('endDate');

    const startDate = startDateParam 
      ? new Date(startDateParam) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = endDateParam 
      ? new Date(endDateParam) 
      : new Date();

    const report = await getComplianceReport(user.organisationId, startDate, endDate);

    return c.json(successResponse(report));
  } catch (error) {
    console.error('Get compliance report error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get report'), 500);
  }
});

export { governanceRouter, retentionRouter, complianceRouter };
