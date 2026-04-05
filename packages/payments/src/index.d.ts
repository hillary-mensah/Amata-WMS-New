import { PaymentMethod, TransactionStatus } from '@nexus/types';
export interface PaymentRequest {
    amount: number;
    email: string;
    reference?: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
}
export interface PaymentResponse {
    success: boolean;
    reference: string;
    authorizationUrl?: string;
    status: TransactionStatus;
    message?: string;
}
export declare function initializePayment(request: PaymentRequest): Promise<PaymentResponse>;
export declare function verifyPayment(reference: string): Promise<PaymentResponse>;
export declare function refundPayment(reference: string, amount?: number): Promise<PaymentResponse>;
export interface MoMoPaymentRequest {
    amount: number;
    phone: string;
    reference: string;
    note?: string;
}
export interface MoMoPaymentResponse {
    success: boolean;
    reference: string;
    status: TransactionStatus;
    message?: string;
    providerRef?: string;
}
export declare function requestMoMoPayment(request: MoMoPaymentRequest): Promise<MoMoPaymentResponse>;
export declare function checkMoMoPaymentStatus(reference: string): Promise<MoMoPaymentResponse>;
export * from './reconciliation';
export declare function getPaymentProvider(method: PaymentMethod): string;
//# sourceMappingURL=index.d.ts.map