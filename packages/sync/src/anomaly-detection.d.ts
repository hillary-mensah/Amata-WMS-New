import { AnomalyType, AnomalySeverity, AnomalyStatus } from '@nexus/types';
export interface RuleContext {
    organisationId: string;
    branchId?: string;
    userId?: string;
}
export interface AnomalyDetectionResult {
    detected: boolean;
    anomalies: CreatedAnomaly[];
}
export interface CreatedAnomaly {
    type: AnomalyType;
    severity: AnomalySeverity;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    riskScore: number;
    userId?: string;
    saleId?: string;
}
export declare function detectExcessRefunds(organisationId: string, userId: string, hours?: number): Promise<CreatedAnomaly | null>;
export declare function detectDiscountAbuse(organisationId: string, branchId: string, userId: string): Promise<CreatedAnomaly | null>;
export declare function detectSuspiciousVoids(organisationId: string, userId: string): Promise<CreatedAnomaly | null>;
export declare function detectHighCashTransaction(organisationId: string, saleId: string, amount: number, paymentMethod: string): Promise<CreatedAnomaly | null>;
export declare function detectOffHoursSale(organisationId: string, saleId: string, saleTime: Date): Promise<CreatedAnomaly | null>;
export declare function checkNegativeStockSale(organisationId: string, saleId: string): Promise<CreatedAnomaly | null>;
export declare function analyzeCashierBehavior(organisationId: string, userId: string, days?: number): Promise<CreatedAnomaly[]>;
export declare function runAnomalyDetection(organisationId: string, context: RuleContext): Promise<AnomalyDetectionResult>;
export declare function createAnomaly(organisationId: string, anomaly: CreatedAnomaly): Promise<void>;
export declare function resolveAnomaly(anomalyId: string, status: AnomalyStatus, notes?: string): Promise<void>;
//# sourceMappingURL=anomaly-detection.d.ts.map