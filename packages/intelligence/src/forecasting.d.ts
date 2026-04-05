export interface StockPrediction {
    productId: string;
    branchId: string;
    currentStock: number;
    predictedStock: number[];
    daysOutOfStock?: number;
    reorderRecommendation: 'NONE' | 'SOON' | 'URGENT';
    confidence: number;
    trend: 'increasing' | 'stable' | 'decreasing';
}
export interface ExpiryRiskScore {
    batchId: string;
    productId: string;
    productName: string;
    quantity: number;
    expiresAt: Date;
    daysUntilExpiry: number;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommendedDiscount: number;
    suggestedActions: string[];
}
export interface SalesAnomalyInsight {
    type: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    affectedProducts: string[];
    confidence: number;
    recommendation: string;
}
export declare function predictStockLevels(organisationId: string, productId: string, branchId: string, daysToPredict?: number): Promise<StockPrediction | null>;
export declare function getStockPredictionsForBranch(organisationId: string, branchId: string): Promise<StockPrediction[]>;
export declare function calculateExpiryRiskScores(organisationId: string, branchId?: string): Promise<ExpiryRiskScore[]>;
export declare function getExpiryInsights(organisationId: string): Promise<{
    totalAtRisk: number;
    totalValue: number;
    byRiskLevel: Record<string, number>;
    recommendations: string[];
}>;
export declare function detectSalesAnomalies(organisationId: string, days?: number): Promise<SalesAnomalyInsight[]>;
export declare function generateIntelligenceReport(organisationId: string, branchId?: string): Promise<{
    stockPredictions: StockPrediction[];
    expiryRisks: ExpiryRiskScore[];
    salesInsights: SalesAnomalyInsight[];
    summary: {
        urgentReorders: number;
        criticalExpiry: number;
        anomaliesDetected: number;
    };
}>;
//# sourceMappingURL=forecasting.d.ts.map