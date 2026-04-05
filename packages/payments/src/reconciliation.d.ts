export interface PaymentProvider {
    name: string;
    initializePayment(amount: number, reference: string, metadata?: Record<string, unknown>): Promise<PaymentInitResponse>;
    verifyPayment(reference: string): Promise<PaymentVerificationResponse>;
    processRefund(reference: string, amount: number): Promise<RefundResponse>;
}
export interface PaymentInitResponse {
    success: boolean;
    reference?: string;
    paymentUrl?: string;
    providerRef?: string;
    message?: string;
}
export interface PaymentVerificationResponse {
    success: boolean;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    reference?: string;
    amount?: number;
    message?: string;
}
export interface RefundResponse {
    success: boolean;
    refundRef?: string;
    message?: string;
}
export declare function initializePaystackPayment(amount: number, reference: string, email: string, metadata?: Record<string, unknown>): Promise<PaymentInitResponse>;
export declare function verifyPaystackPayment(reference: string): Promise<PaymentVerificationResponse>;
export declare function initializeMomoPayment(amount: number, reference: string, phone: string, provider?: 'MTN' | 'VODAFONE' | 'AIRTELTIGO'): Promise<PaymentInitResponse>;
export declare function verifyMomoPayment(reference: string, provider: 'MTN' | 'VODAFONE' | 'AIRTELTIGO'): Promise<PaymentVerificationResponse>;
export declare function retryPaymentConfirmation(paymentId: string): Promise<boolean>;
export declare function runPaymentReconciliation(organisationId: string, startDate: Date, endDate: Date): Promise<{
    id: string;
    totalExpected: number;
    totalConfirmed: number;
    totalPending: number;
    totalFailed: number;
    discrepancy: number;
}>;
export declare function getPendingPayments(organisationId: string, provider?: string): Promise<Array<{
    id: string;
    reference: string;
    amount: number;
    provider: string | null;
    retryCount: number;
    createdAt: Date;
}>>;
export declare function processScheduledPaymentRetries(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
}>;
export declare function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
export declare function processWebhookDelivery(deliveryId: string): Promise<boolean>;
export declare function triggerWebhook(organisationId: string, event: string, payload: Record<string, unknown>): Promise<void>;
export declare function retryFailedWebhookDeliveries(): Promise<{
    processed: number;
    succeeded: number;
}>;
//# sourceMappingURL=reconciliation.d.ts.map