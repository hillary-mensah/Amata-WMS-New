import { Hono } from 'hono';
import { db } from '@nexus/db';
import { verifyWebhookSignature, processWebhookDelivery } from '@nexus/payments';

const webhookRouter = new Hono();

webhookRouter.post('/payment/callback', async (c) => {
  try {
    const body = await c.req.json();
    const signature = c.req.header('x-paystack-signature') || c.req.header('x-momo-signature');
    
    const event = body.event || body.status;
    const paymentRef = body.reference || body.data?.reference || body.externalId;

    if (!paymentRef) {
      return c.json({ success: false, message: 'No reference found' }, 400);
    }

    const payment = await db.payment.findFirst({
      where: { 
        OR: [
          { reference: paymentRef },
          { providerRef: paymentRef },
        ],
      },
    });

    if (!payment) {
      return c.json({ success: false, message: 'Payment not found' }, 404);
    }

    let status = 'PENDING';
    let verified = true;

    if (signature) {
      const secret = process.env.WEBHOOK_SECRET;
      if (secret) {
        const payload = JSON.stringify(body);
        verified = verifyWebhookSignature(payload, signature, secret);
      }
    }

    if (!verified) {
      return c.json({ success: false, message: 'Invalid signature' }, 401);
    }

    if (event === 'charge.success' || event === 'PAYMENT_SUCCESSFUL' || event === 'SUCCESSFUL') {
      status = 'COMPLETED';
    } else if (event === 'charge.failed' || event === 'PAYMENT_FAILED' || event === 'FAILED') {
      status = 'FAILED';
    }

    if (status !== 'PENDING') {
      await db.payment.update({
        where: { id: payment.id },
        data: { 
          status: status as 'COMPLETED' | 'FAILED',
          confirmedAt: status === 'COMPLETED' ? new Date() : null,
          callbackData: body,
        },
      });

      if (status === 'COMPLETED') {
        await db.sale.update({
          where: { id: payment.saleId },
          data: { status: 'COMPLETED' },
        });

        await triggerPaymentWebhook(payment.saleId, 'completed');
      }
    }

    return c.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Payment webhook error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

async function triggerPaymentWebhook(saleId: string, event: string): Promise<void> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: { 
      payments: { where: { status: 'COMPLETED' } },
      items: { include: { product: true } },
      user: true,
      branch: true,
    },
  });

  if (!sale) return;

  const configs = await db.webhookConfig.findMany({
    where: {
      organisationId: sale.organisationId,
      isActive: true,
      events: { has: 'payment.completed' },
    },
  });

  for (const config of configs) {
    await db.webhookDelivery.create({
      data: {
        configId: config.id,
        event: 'payment.completed',
        payload: {
          saleId: sale.id,
          receiptNumber: sale.receiptNumber,
          totalAmount: sale.totalAmount,
          paymentMethod: sale.paymentMethod,
          status: sale.status,
          branch: sale.branch.name,
          cashier: `${sale.user.firstName} ${sale.user.lastName}`,
          items: sale.items.map((i) => ({
            product: i.product.name,
            quantity: i.quantity,
            price: i.unitPrice,
          })),
        },
        status: 'PENDING',
        maxRetries: 3,
      },
    });
  }
}

webhookRouter.post('/retry', async (c) => {
  try {
    const body = await c.req.json();
    const { deliveryId } = body;

    if (!deliveryId) {
      return c.json({ success: false, message: 'deliveryId required' }, 400);
    }

    const success = await processWebhookDelivery(deliveryId);

    return c.json({ success });
  } catch (error) {
    console.error('Retry webhook error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

export { webhookRouter };
