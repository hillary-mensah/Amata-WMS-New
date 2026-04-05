import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, MANAGER_AND_ABOVE, ORG_ADMIN_ONLY } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';
import {
  initializePaystackPayment,
  verifyPaystackPayment,
  initializeMomoPayment,
  verifyMomoPayment,
  retryPaymentConfirmation,
  runPaymentReconciliation,
  getPendingPayments,
  processScheduledPaymentRetries,
  triggerWebhook,
  retryFailedWebhookDeliveries,
} from '@nexus/payments';

const paymentRouter = new Hono();

paymentRouter.use('*', authMiddleware);

paymentRouter.post('/initialize', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { saleId, method, phone, email } = body;

    const sale = await db.sale.findUnique({
      where: { id: saleId, organisationId: user.organisationId },
    });

    if (!sale) {
      return c.json(errorResponse('Not Found', 'Sale not found'), 404);
    }

    const payment = await db.payment.create({
      data: {
        saleId,
        amount: sale.totalAmount,
        method,
        provider: method === 'MOMO' ? 'MTN' : 'PAYSTACK',
        reference: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });

    let initResult;

    if (method === 'MOMO' && phone) {
      initResult = await initializeMomoPayment(
        Number(sale.totalAmount),
        payment.reference!,
        phone
      );
    } else {
      initResult = await initializePaystackPayment(
        Number(sale.totalAmount),
        payment.reference!,
        email || user.email
      );
    }

    if (initResult.success) {
      await db.payment.update({
        where: { id: payment.id },
        data: { providerRef: initResult.providerRef },
      });
    }

    return c.json(successResponse({
      paymentId: payment.id,
      ...initResult,
    }));
  } catch (error) {
    console.error('Initialize payment error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to initialize payment'), 500);
  }
});

paymentRouter.post('/verify/:reference', async (c) => {
  try {
    const reference = c.req.param('reference');

    const payment = await db.payment.findFirst({
      where: { reference },
      include: { sale: true },
    });

    if (!payment) {
      return c.json(errorResponse('Not Found', 'Payment not found'), 404);
    }

    let result;
    if (payment.provider === 'PAYSTACK') {
      result = await verifyPaystackPayment(reference);
    } else if (payment.provider === 'MTN') {
      result = await verifyMomoPayment(reference, 'MTN');
    } else {
      return c.json(errorResponse('Bad Request', 'Provider not supported'), 400);
    }

    if (result.status === 'COMPLETED') {
      await db.payment.update({
        where: { id: payment.id },
        data: { 
          status: 'COMPLETED', 
          confirmedAt: new Date(),
          callbackData: JSON.parse(JSON.stringify(result)) as any,
        },
      });

      await db.sale.update({
        where: { id: payment.saleId },
        data: { status: 'COMPLETED' },
      });

      await triggerWebhook(payment.sale.organisationId, 'payment.completed', {
        paymentId: payment.id,
        saleId: payment.saleId,
        amount: result.amount,
        reference,
      });
    }

    return c.json(successResponse({ ...result, paymentId: payment.id }));
  } catch (error) {
    console.error('Verify payment error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to verify payment'), 500);
  }
});

paymentRouter.post('/:paymentId/retry', async (c) => {
  try {
    const paymentId = c.req.param('paymentId');

    const success = await retryPaymentConfirmation(paymentId);

    return c.json(successResponse({ success }));
  } catch (error) {
    console.error('Retry payment error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to retry payment'), 500);
  }
});

paymentRouter.get('/pending', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const provider = c.req.query('provider') as string | undefined;

    const pending = await getPendingPayments(user.organisationId, provider);

    return c.json(successResponse(pending));
  } catch (error) {
    console.error('Get pending error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get pending payments'), 500);
  }
});

paymentRouter.post('/retry-scheduled', async (c) => {
  try {
    const result = await processScheduledPaymentRetries();

    return c.json(successResponse(result));
  } catch (error) {
    console.error('Scheduled retry error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to process retries'), 500);
  }
});

paymentRouter.post('/reconcile', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { startDate, endDate } = body;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const result = await runPaymentReconciliation(user.organisationId, start, end);

    return c.json(successResponse(result));
  } catch (error) {
    console.error('Reconciliation error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to run reconciliation'), 500);
  }
});

paymentRouter.get('/reconciliations', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const reconciliations = await db.paymentReconciliation.findMany({
      where: { organisationId: user.organisationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return c.json(successResponse(reconciliations));
  } catch (error) {
    console.error('Get reconciliations error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get reconciliations'), 500);
  }
});

const webhookConfigRouter = new Hono();

webhookConfigRouter.use('*', authMiddleware);

webhookConfigRouter.post('/', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, url, secret, events, headers, retryPolicy } = body;

    if (!name || !url || !events?.length) {
      return c.json(errorResponse('Validation Error', 'name, url, and events are required'), 400);
    }

    const config = await db.webhookConfig.create({
      data: {
        name,
        url,
        secret: secret || generateRandomSecret(),
        events,
        headers: headers || {},
        retryPolicy: retryPolicy || { maxRetries: 3, retryInterval: 60 },
        organisationId: user.organisationId,
      },
    });

    return c.json(successResponse(config));
  } catch (error) {
    console.error('Create webhook config error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to create webhook'), 500);
  }
});

webhookConfigRouter.get('/', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const configs = await db.webhookConfig.findMany({
      where: { organisationId: user.organisationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
      },
    });

    return c.json(successResponse(configs));
  } catch (error) {
    console.error('Get webhook configs error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get webhooks'), 500);
  }
});

webhookConfigRouter.delete('/:configId', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const configId = c.req.param('configId');

    await db.webhookConfig.delete({
      where: { id: configId, organisationId: user.organisationId },
    });

    return c.json(successResponse({ message: 'Webhook deleted' }));
  } catch (error) {
    console.error('Delete webhook config error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to delete webhook'), 500);
  }
});

webhookConfigRouter.put('/:configId/toggle', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const configId = c.req.param('configId');

    const config = await db.webhookConfig.findFirst({
      where: { id: configId, organisationId: user.organisationId },
    });

    if (!config) {
      return c.json(errorResponse('Not Found', 'Webhook not found'), 404);
    }

    await db.webhookConfig.update({
      where: { id: configId },
      data: { isActive: !config.isActive },
    });

    return c.json(successResponse({ message: `Webhook ${config.isActive ? 'disabled' : 'enabled'}` }));
  } catch (error) {
    console.error('Toggle webhook error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to toggle webhook'), 500);
  }
});

webhookConfigRouter.get('/deliveries', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const configId = c.req.query('configId');
    const status = c.req.query('status') as string | undefined;
    const limit = parseInt(c.req.query('limit') || '50');

    const whereClause: Record<string, unknown> = {
      config: { organisationId: user.organisationId },
    };

    if (configId) whereClause.configId = configId;
    if (status) whereClause.status = status;

    const deliveries = await db.webhookDelivery.findMany({
      where: whereClause,
      include: { config: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return c.json(successResponse(deliveries));
  } catch (error) {
    console.error('Get deliveries error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get deliveries'), 500);
  }
});

webhookConfigRouter.post('/deliveries/:deliveryId/retry', MANAGER_AND_ABOVE, async (c) => {
  try {
    const deliveryId = c.req.param('deliveryId');

    const success = await retryFailedWebhookDeliveries();

    return c.json(successResponse({ message: 'Retry initiated', ...success }));
  } catch (error) {
    console.error('Retry delivery error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to retry delivery'), 500);
  }
});

function generateRandomSecret(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export { paymentRouter, webhookConfigRouter };
