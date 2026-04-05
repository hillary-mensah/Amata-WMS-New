import { db } from '@nexus/db';
import { createHmac } from 'crypto';
import { TransactionStatus } from '@nexus/types';
export async function initializePaystackPayment(amount, reference, email, metadata) {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
        return { success: false, message: 'Paystack not configured' };
    }
    try {
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecret}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100),
                email,
                reference,
                metadata,
            }),
        });
        const data = (await response.json());
        if (data.status && data.data) {
            return {
                success: true,
                reference,
                paymentUrl: data.data.authorization_url,
                providerRef: data.data.access_code,
            };
        }
        return { success: false, message: data.message };
    }
    catch (error) {
        return { success: false, message: `Payment initialization failed: ${error}` };
    }
}
export async function verifyPaystackPayment(reference) {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
        return { success: false, status: 'FAILED', message: 'Paystack not configured' };
    }
    try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                'Authorization': `Bearer ${paystackSecret}`,
            },
        });
        const data = (await response.json());
        if (data.status && data.data?.status === 'success') {
            return {
                success: true,
                status: 'COMPLETED',
                reference,
                amount: (data.data.amount ?? 0) / 100,
                message: 'Payment verified successfully',
            };
        }
        return {
            success: false,
            status: 'PENDING',
            reference,
            message: data.data?.status || 'Payment not completed',
        };
    }
    catch (error) {
        return { success: false, status: 'PENDING', message: `Verification failed: ${error}` };
    }
}
export async function initializeMomoPayment(amount, reference, phone, provider = 'MTN') {
    const momoApiKey = process.env.MOMO_API_KEY;
    const momoApiUrl = process.env.MOMO_API_URL;
    if (!momoApiKey || !momoApiUrl) {
        return { success: false, message: 'MoMo not configured' };
    }
    try {
        const response = await fetch(`${momoApiUrl}/v1/mobilemoney/payments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${momoApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100),
                currency: 'GHS',
                reference,
                payer: { partyIdType: 'MSISDN', partyId: phone },
                payerMessage: `Payment for ${reference}`,
                payeeNote: `NexusPOS Payment`,
            }),
        });
        const data = (await response.json());
        if (data.status === 'PENDING' || data.status === 'SUCCESSFUL') {
            return {
                success: true,
                reference,
                providerRef: data.financialTransactionId,
                message: 'MoMo payment initiated',
            };
        }
        return { success: false, message: data.message || 'Payment failed' };
    }
    catch (error) {
        return { success: false, message: `MoMo payment failed: ${error}` };
    }
}
export async function verifyMomoPayment(reference, provider) {
    const momoApiKey = process.env.MOMO_API_KEY;
    const momoApiUrl = process.env.MOMO_API_URL;
    if (!momoApiKey || !momoApiUrl) {
        return { success: false, status: 'FAILED', message: 'MoMo not configured' };
    }
    try {
        const response = await fetch(`${momoApiUrl}/v1/mobilemoney/payments/${reference}`, {
            headers: {
                'Authorization': `Bearer ${momoApiKey}`,
            },
        });
        const data = (await response.json());
        if (data.status === 'SUCCESSFUL') {
            return {
                success: true,
                status: 'COMPLETED',
                reference,
                amount: (data.amount ?? 0) / 100,
            };
        }
        if (data.status === 'FAILED') {
            return { success: false, status: 'FAILED', reference, message: 'Payment failed' };
        }
        return { success: false, status: 'PENDING', reference };
    }
    catch (error) {
        return { success: false, status: 'PENDING', message: `Verification failed: ${error}` };
    }
}
export async function retryPaymentConfirmation(paymentId) {
    const payment = await db.payment.findUnique({
        where: { id: paymentId },
        include: { sale: true },
    });
    if (!payment || payment.status === 'COMPLETED') {
        return false;
    }
    if (payment.retryCount >= payment.maxRetries) {
        await db.payment.update({
            where: { id: paymentId },
            data: { status: 'FAILED', errorMessage: 'Max retries exceeded' },
        });
        return false;
    }
    let result;
    if (payment.provider === 'PAYSTACK' && payment.reference) {
        result = await verifyPaystackPayment(payment.reference);
    }
    else if (payment.provider === 'MTN' && payment.reference) {
        result = await verifyMomoPayment(payment.reference, 'MTN');
    }
    else {
        return false;
    }
    if (result.status === 'COMPLETED') {
        await db.payment.update({
            where: { id: paymentId },
            data: {
                status: 'COMPLETED',
                confirmedAt: new Date(),
                callbackData: { success: result.success, status: result.status, reference: result.reference, amount: result.amount, message: result.message },
            },
        });
        await db.sale.update({
            where: { id: payment.saleId },
            data: { status: 'COMPLETED' },
        });
        return true;
    }
    await db.payment.update({
        where: { id: paymentId },
        data: {
            retryCount: { increment: 1 },
            errorMessage: result.message,
        },
    });
    return false;
}
export async function runPaymentReconciliation(organisationId, startDate, endDate) {
    const payments = await db.payment.findMany({
        where: {
            sale: { organisationId },
            createdAt: { gte: startDate, lte: endDate },
        },
        select: {
            id: true,
            amount: true,
            status: true,
            provider: true,
        },
    });
    const totalExpected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalConfirmed = payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPending = payments
        .filter((p) => p.status === 'PENDING')
        .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalFailed = payments
        .filter((p) => p.status === 'FAILED')
        .reduce((sum, p) => sum + Number(p.amount), 0);
    const discrepancy = totalExpected - totalConfirmed;
    const reconciliation = await db.paymentReconciliation.create({
        data: {
            organisationId,
            periodStart: startDate,
            periodEnd: endDate,
            totalExpected,
            totalConfirmed,
            totalPending,
            totalFailed,
            discrepancy,
            status: 'COMPLETED',
            completedAt: new Date(),
        },
    });
    return {
        id: reconciliation.id,
        totalExpected,
        totalConfirmed,
        totalPending,
        totalFailed,
        discrepancy,
    };
}
export async function getPendingPayments(organisationId, provider) {
    const whereClause = provider
        ? { sale: { organisationId }, status: TransactionStatus.PENDING, provider }
        : { sale: { organisationId }, status: TransactionStatus.PENDING };
    const payments = await db.payment.findMany({
        where: whereClause,
        select: {
            id: true,
            reference: true,
            amount: true,
            provider: true,
            retryCount: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
    });
    return payments.map(p => ({
        ...p,
        reference: p.reference ?? '',
        provider: p.provider ?? 'UNKNOWN',
        amount: Number(p.amount),
    }));
}
export async function processScheduledPaymentRetries() {
    const pendingPayments = await db.payment.findMany({
        where: {
            status: 'PENDING',
            retryCount: { lt: 3 },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        take: 100,
    });
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    for (const payment of pendingPayments) {
        processed++;
        const success = await retryPaymentConfirmation(payment.id);
        if (success)
            succeeded++;
        else
            failed++;
    }
    return { processed, succeeded, failed };
}
export function verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = createHmac('sha512', secret)
        .update(payload)
        .digest('hex');
    return signature === expectedSignature;
}
export async function processWebhookDelivery(deliveryId) {
    const delivery = await db.webhookDelivery.findUnique({
        where: { id: deliveryId },
        include: { config: true },
    });
    if (!delivery || delivery.status === 'COMPLETED') {
        return false;
    }
    const config = delivery.config;
    const payload = JSON.stringify(delivery.payload);
    try {
        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': createHmac('sha512', config.secret ?? '')
                    .update(payload)
                    .digest('hex'),
                'X-Webhook-Event': delivery.event,
                ...config.headers,
            },
            body: payload,
        });
        const responseData = await response.json().catch(() => ({}));
        if (response.ok) {
            await db.webhookDelivery.update({
                where: { id: deliveryId },
                data: {
                    status: 'COMPLETED',
                    response: responseData,
                    statusCode: response.status,
                    deliveredAt: new Date(),
                },
            });
            return true;
        }
        throw new Error(`HTTP ${response.status}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const newAttempt = delivery.attempt + 1;
        if (newAttempt >= delivery.maxRetries) {
            await db.webhookDelivery.update({
                where: { id: deliveryId },
                data: {
                    status: 'FAILED',
                    errorMessage,
                    attempt: newAttempt,
                },
            });
        }
        else {
            await db.webhookDelivery.update({
                where: { id: deliveryId },
                data: {
                    status: 'RETRY',
                    errorMessage,
                    attempt: newAttempt,
                },
            });
        }
        return false;
    }
}
export async function triggerWebhook(organisationId, event, payload) {
    const configs = await db.webhookConfig.findMany({
        where: {
            organisationId,
            isActive: true,
            events: { has: event },
        },
    });
    for (const config of configs) {
        await db.webhookDelivery.create({
            data: {
                configId: config.id,
                event,
                payload: payload,
                status: 'PENDING',
                maxRetries: config.retryPolicy?.maxRetries || 3,
            },
        });
    }
}
export async function retryFailedWebhookDeliveries() {
    const failed = await db.webhookDelivery.findMany({
        where: { status: { in: ['FAILED', 'RETRY'] } },
        take: 50,
    });
    let succeeded = 0;
    for (const delivery of failed) {
        const success = await processWebhookDelivery(delivery.id);
        if (success)
            succeeded++;
    }
    return { processed: failed.length, succeeded };
}
//# sourceMappingURL=reconciliation.js.map