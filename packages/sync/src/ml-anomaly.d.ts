export interface FeatureVector {
    userId: string;
    date: string;
    features: number[];
}
export interface MLAnomalyResult {
    userId: string;
    anomalyScore: number;
    isAnomaly: boolean;
    contributingFactors: string[];
    cluster?: number;
}
export interface CashierProfile {
    userId: string;
    avgTransactionValue: number;
    avgDiscountPercent: number;
    voidRate: number;
    refundRate: number;
    salesPerHour: number[];
    peakHour: number;
    preferredPaymentMethod: string;
    itemsPerTransaction: number;
    returnCustomerRate: number;
    riskScore: number;
    anomalyCount30d: number;
    lastAnomalyAt?: Date;
}
export declare class IsolationForest {
    private trees;
    private numTrees;
    private sampleSize;
    constructor(numTrees?: number, sampleSize?: number);
    fit(data: number[][]): void;
    score(point: number[]): number;
    predict(point: number[], threshold?: number): boolean;
}
export declare function extractCashierFeatures(organisationId: string, userId: string, days?: number): Promise<CashierProfile>;
export declare function buildFeatureMatrix(organisationId: string, days?: number): Promise<{
    profiles: CashierProfile[];
    matrix: number[][];
    userIds: string[];
}>;
export declare function detectOutliers(organisationId: string, days?: number, threshold?: number): Promise<MLAnomalyResult[]>;
export declare function updateCashierRiskScores(organisationId: string): Promise<void>;
export declare function getCashierRiskProfile(organisationId: string, userId: string): Promise<CashierProfile & {
    mlScore: number;
    isOutlier: boolean;
}>;
export declare function runMLAnomalyDetection(organisationId: string): Promise<{
    outliers: MLAnomalyResult[];
    profilesUpdated: number;
}>;
//# sourceMappingURL=ml-anomaly.d.ts.map