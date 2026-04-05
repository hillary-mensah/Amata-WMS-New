import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '@nexus/db';
import { authMiddleware, AUDITOR_AND_ABOVE, MANAGER_AND_ABOVE } from '@nexus/auth';
import { successResponse, errorResponse, AnomalyStatusSchema } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';
import {
  runAnomalyDetection,
  createAnomaly,
  resolveAnomaly,
  analyzeCashierBehavior,
} from '@nexus/sync';

const anomalyRouter = new Hono();

anomalyRouter.use('*', authMiddleware);

anomalyRouter.post('/detect', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const context = {
      organisationId: user.organisationId,
      branchId: body.branchId || user.branchId,
      userId: body.userId,
    };

    const result = await runAnomalyDetection(user.organisationId, context);

    if (result.detected) {
      for (const anomaly of result.anomalies) {
        await createAnomaly(user.organisationId, anomaly);
      }
    }

    return c.json(successResponse({
      detected: result.detected,
      count: result.anomalies.length,
      anomalies: result.anomalies,
    }));
  } catch (error) {
    console.error('Anomaly detection error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to detect anomalies'), 500);
  }
});

anomalyRouter.get('/list', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const status = c.req.query('status') as string | undefined;
    const severity = c.req.query('severity') as string | undefined;
    const userId = c.req.query('userId') as string | undefined;
    const limit = parseInt(c.req.query('limit') || '50');

    const whereClause: Record<string, unknown> = {
      organisationId: user.organisationId,
    };

    if (status) whereClause.status = status;
    if (severity) whereClause.severity = severity;
    if (userId) whereClause.userId = userId;

    const anomalies = await db.anomaly.findMany({
      where: whereClause,
      include: {
        user: { select: { firstName: true, lastName: true } },
        sale: { select: { receiptNumber: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const stats = await db.anomaly.groupBy({
      by: ['status', 'severity'],
      where: { organisationId: user.organisationId },
      _count: { id: true },
    });

    return c.json(successResponse({ anomalies, stats }));
  } catch (error) {
    console.error('Get anomalies error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get anomalies'), 500);
  }
});

anomalyRouter.get('/stats', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const total = await db.anomaly.count({
      where: { organisationId: user.organisationId },
    });

    const byStatus = await db.anomaly.groupBy({
      by: ['status'],
      where: { organisationId: user.organisationId },
      _count: { id: true },
    });

    const bySeverity = await db.anomaly.groupBy({
      by: ['severity'],
      where: { organisationId: user.organisationId },
      _count: { id: true },
    });

    const byType = await db.anomaly.groupBy({
      by: ['type'],
      where: { organisationId: user.organisationId },
      _count: { id: true },
    });

    return c.json(successResponse({
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count.id })),
      byType: byType.map((t) => ({ type: t.type, count: t._count.id })),
    }));
  } catch (error) {
    console.error('Get anomaly stats error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get anomaly stats'), 500);
  }
});

const ResolveAnomalySchema = z.object({
  anomalyId: z.string().uuid(),
  status: z.enum(['CONFIRMED_FRAUD', 'FALSE_POSITIVE', 'RESOLVED']),
  notes: z.string().optional(),
});

anomalyRouter.post('/resolve', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const parsed = ResolveAnomalySchema.safeParse(body);

    if (!parsed.success) {
      return c.json(errorResponse('Validation Error', parsed.error.errors.join(', ')), 400);
    }

    const { anomalyId, status, notes } = parsed.data;

    await resolveAnomaly(anomalyId, status, notes);

    return c.json(successResponse({ message: 'Anomaly resolved' }));
  } catch (error) {
    console.error('Resolve anomaly error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to resolve anomaly'), 500);
  }
});

anomalyRouter.post('/analyze-cashier', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { userId, days = 7 } = body;

    if (!userId) {
      return c.json(errorResponse('Validation Error', 'userId is required'), 400);
    }

    const anomalies = await analyzeCashierBehavior(user.organisationId, userId, days);

    return c.json(successResponse({
      userId,
      days,
      anomalies,
      count: anomalies.length,
    }));
  } catch (error) {
    console.error('Analyze cashier error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to analyze cashier'), 500);
  }
});

export { anomalyRouter };
