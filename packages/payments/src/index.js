import axios from 'axios';
import { PaymentMethod, TransactionStatus } from '@nexus/types';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
export async function initializePayment(request) {
    if (!PAYSTACK_SECRET_KEY) {
        throw new Error('Paystack secret key not configured');
    }
    try {
        const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            amount: Math.round(request.amount * 100),
            email: request.email,
            reference: request.reference,
            callback_url: request.callbackUrl,
            metadata: request.metadata,
        }, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        return {
            success: true,
            reference: response.data.data.reference,
            authorizationUrl: response.data.data.authorization_url,
            status: TransactionStatus.PENDING,
            message: 'Payment initialized',
        };
    }
    catch (error) {
        const axiosError = error;
        return {
            success: false,
            reference: request.reference || '',
            status: TransactionStatus.FAILED,
            message: axiosError.response?.data?.message || 'Payment initialization failed',
        };
    }
}
export async function verifyPayment(reference) {
    if (!PAYSTACK_SECRET_KEY) {
        throw new Error('Paystack secret key not configured');
    }
    try {
        const response = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
        });
        const data = response.data.data;
        const isSuccessful = data.status === 'success';
        return {
            success: isSuccessful,
            reference: data.reference,
            status: isSuccessful ? TransactionStatus.COMPLETED : TransactionStatus.FAILED,
            message: data.status,
        };
    }
    catch (error) {
        const axiosError = error;
        return {
            success: false,
            reference,
            status: TransactionStatus.FAILED,
            message: axiosError.response?.data?.message || 'Payment verification failed',
        };
    }
}
export async function refundPayment(reference, amount) {
    if (!PAYSTACK_SECRET_KEY) {
        throw new Error('Paystack secret key not configured');
    }
    try {
        const payload = {};
        if (amount) {
            payload.amount = Math.round(amount * 100);
        }
        const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/refund`, {
            transaction: reference,
            ...payload,
        }, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        return {
            success: true,
            reference,
            status: TransactionStatus.REFUNDED,
            message: 'Refund processed',
        };
    }
    catch (error) {
        const axiosError = error;
        return {
            success: false,
            reference,
            status: TransactionStatus.FAILED,
            message: axiosError.response?.data?.message || 'Refund failed',
        };
    }
}
const MTN_MOMO_API_KEY = process.env.MTN_MOMO_API_KEY;
const MTN_MOMO_API_SECRET = process.env.MTN_MOMO_API_SECRET;
const MTN_MOMO_COLLECTION_ID = process.env.MTN_MOMO_COLLECTION_ID;
const MTN_MOMO_ENVIRONMENT = process.env.MTN_MOMO_ENVIRONMENT || 'sandbox';
const MTN_BASE_URL = MTN_MOMO_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox.momodeveloper.mtn.com'
    : 'https://api.momodeveloper.mtn.com';
async function getMoMoToken() {
    if (!MTN_MOMO_API_KEY || !MTN_MOMO_API_SECRET) {
        throw new Error('MTN MoMo credentials not configured');
    }
    const credentials = Buffer.from(`${MTN_MOMO_API_KEY}:${MTN_MOMO_API_SECRET}`).toString('base64');
    const response = await axios.post(`${MTN_BASE_URL}/collection/v1/token`, {}, {
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
        },
    });
    return response.data.access_token;
}
export async function requestMoMoPayment(request) {
    try {
        const token = await getMoMoToken();
        const reference = `MOMO-${request.reference}`;
        const response = await axios.post(`${MTN_BASE_URL}/collection/v1/payment`, {
            amount: request.amount.toString(),
            currency: 'GHS',
            externalId: reference,
            payer: {
                partyIdType: 'MSISDN',
                partyId: request.phone,
            },
            payerMessage: request.note || 'Payment for order',
            payeeNote: request.note || 'Thank you for your payment',
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'X-Reference-Id': reference,
                'X-Target-Environment': MTN_MOMO_ENVIRONMENT,
                'Content-Type': 'application/json',
            },
        });
        return {
            success: true,
            reference,
            status: TransactionStatus.PENDING,
            message: 'MoMo payment request sent',
            providerRef: reference,
        };
    }
    catch (error) {
        const axiosError = error;
        return {
            success: false,
            reference: request.reference,
            status: TransactionStatus.FAILED,
            message: axiosError.response?.data?.message || 'MoMo payment request failed',
        };
    }
}
export async function checkMoMoPaymentStatus(reference) {
    try {
        const token = await getMoMoToken();
        const response = await axios.get(`${MTN_BASE_URL}/collection/v1/payment/${reference}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'X-Target-Environment': MTN_MOMO_ENVIRONMENT,
            },
        });
        const status = response.data.status;
        const isCompleted = status === 'SUCCESSFUL';
        const isFailed = status === 'FAILED';
        return {
            success: isCompleted,
            reference,
            status: isCompleted
                ? TransactionStatus.COMPLETED
                : isFailed
                    ? TransactionStatus.FAILED
                    : TransactionStatus.PENDING,
            message: status,
        };
    }
    catch (error) {
        const axiosError = error;
        return {
            success: false,
            reference,
            status: TransactionStatus.FAILED,
            message: axiosError.response?.data?.message || 'Failed to check MoMo payment status',
        };
    }
}
export * from './reconciliation';
export function getPaymentProvider(method) {
    switch (method) {
        case PaymentMethod.CARD:
            return 'PAYSTACK';
        case PaymentMethod.MOMO:
            return 'MTN_MOMO';
        default:
            return 'INTERNAL';
    }
}
//# sourceMappingURL=index.js.map