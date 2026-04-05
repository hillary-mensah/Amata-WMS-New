import { Hono } from 'hono';
import { db } from '@nexus/db';
import { successResponse, errorResponse } from '@nexus/types';

export const webhookRouter = new Hono();

webhookRouter.post('/paystack', async (c) => {
  try {
    const body = await c.req.json();
    const { event, data } = body;

    if (event === 'charge.success') {
      const reference = data.reference;
      
      const payment = await db.payment.findFirst({
        where: { reference },
        include: { sale: true },
      });

      if (payment) {
        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            providerRef: data.id?.toString(),
          },
        });

        console.log(`Payment verified: ${reference}`);
      }
    }

    return c.json(successResponse({ received: true }));
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return c.json(errorResponse('Internal Server Error', 'Webhook processing failed'), 500);
  }
});

webhookRouter.post('/mtn-momo', async (c) => {
  try {
    const body = await c.req.json();
    const { reference, status } = body;

    if (reference) {
      const payment = await db.payment.findFirst({
        where: { reference: { contains: reference } },
        include: { sale: true },
      });

      if (payment) {
        const newStatus = status === 'SUCCESSFUL' ? 'COMPLETED' : 'FAILED';
        
        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: newStatus,
            completedAt: newStatus === 'COMPLETED' ? new Date() : undefined,
          },
        });

        console.log(`MoMo payment ${status}: ${reference}`);
      }
    }

    return c.json(successResponse({ received: true }));
  } catch (error) {
    console.error('MTN MoMo webhook error:', error);
    return c.json(errorResponse('Internal Server Error', 'Webhook processing failed'), 500);
  }
});