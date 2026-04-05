import { db } from '@nexus/db';

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

interface TimeSeriesPoint {
  date: Date;
  value: number;
}

function linearRegression(points: TimeSeriesPoint[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  
  const sumX = points.reduce((sum, p, i) => sum + i, 0);
  const sumY = points.reduce((sum, p) => sum + p.value, 0);
  const sumXY = points.reduce((sum, p, i) => sum + i * p.value, 0);
  const sumXX = points.reduce((sum, p, i) => sum + i * i, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

function calculateRSquared(points: TimeSeriesPoint[], slope: number, intercept: number): number {
  const n = points.length;
  if (n === 0) return 0;
  
  const meanY = points.reduce((sum, p) => sum + p.value, 0) / n;
  const ssTot = points.reduce((sum, p) => sum + Math.pow(p.value - meanY, 2), 0);
  const ssRes = points.reduce((sum, p, i) => {
    const predicted = slope * i + intercept;
    return sum + Math.pow(p.value - predicted, 2);
  }, 0);
  
  return ssTot === 0 ? 1 : 1 - ssRes / ssTot;
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

export async function predictStockLevels(
  organisationId: string,
  productId: string,
  branchId: string,
  daysToPredict: number = 30
): Promise<StockPrediction | null> {
  const inventory = await db.inventory.findFirst({
    where: { productId, branchId },
  });

  if (!inventory) return null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const sales = await db.saleItem.findMany({
    where: {
      productId,
      sale: {
        branchId,
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo },
      },
    },
    select: { quantity: true, createdAt: true },
  });

  const dailySales: Record<string, number> = {};
  
  for (const sale of sales) {
    const dateKey = getDateKey(sale.createdAt);
    const existing = dailySales[dateKey];
    dailySales[dateKey] = (existing ?? 0) + sale.quantity;
  }

  const timeSeries: TimeSeriesPoint[] = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
    const dateKey = getDateKey(date);
    const value = dailySales[dateKey];
    timeSeries.push({
      date,
      value: value ?? 0,
    });
  }

  const { slope, intercept } = linearRegression(timeSeries);
  const rSquared = calculateRSquared(timeSeries, slope, intercept);

  const predictedStock: number[] = [];
  let currentPredicted = inventory.quantity;
  
  for (let i = 0; i < daysToPredict; i++) {
    const dailySales = Math.max(0, slope * (30 + i) + intercept);
    currentPredicted -= dailySales;
    predictedStock.push(Math.max(0, Math.round(currentPredicted)));
  }

  const daysUntilStockOut = predictedStock.findIndex(s => s <= 0);
  const daysUntilReorder = predictedStock.findIndex(s => s <= (inventory.reorderLevel ?? 0));

  let reorderRecommendation: StockPrediction['reorderRecommendation'] = 'NONE';
  if (daysUntilStockOut >= 0 && daysUntilStockOut <= 7) {
    reorderRecommendation = 'URGENT';
  } else if (daysUntilReorder >= 0 && daysUntilReorder <= 14) {
    reorderRecommendation = 'SOON';
  }

  return {
    productId,
    branchId,
    currentStock: inventory.quantity,
    predictedStock,
    daysOutOfStock: daysUntilStockOut >= 0 ? daysUntilStockOut : undefined,
    reorderRecommendation,
    confidence: Math.max(0, Math.min(1, rSquared)),
    trend: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
  };
}

export async function getStockPredictionsForBranch(
  organisationId: string,
  branchId: string
): Promise<StockPrediction[]> {
  const inventories = await db.inventory.findMany({
    where: {
      branchId,
      product: { organisationId },
    },
    include: { product: { select: { id: true, name: true, minStock: true } } },
  });

  const predictions: StockPrediction[] = [];

  for (const inv of inventories) {
    const prediction = await predictStockLevels(organisationId, inv.productId, branchId, 30);
    if (prediction) {
      predictions.push(prediction);
    }
  }

  return predictions.sort((a, b) => {
    if (a.reorderRecommendation === 'URGENT' && b.reorderRecommendation !== 'URGENT') return -1;
    if (b.reorderRecommendation === 'URGENT' && a.reorderRecommendation !== 'URGENT') return 1;
    if (a.reorderRecommendation === 'SOON' && b.reorderRecommendation === 'NONE') return -1;
    return 0;
  });
}

export async function calculateExpiryRiskScores(
  organisationId: string,
  branchId?: string
): Promise<ExpiryRiskScore[]> {
  const whereClause: Record<string, unknown> = {
    organisationId,
    expiresAt: { lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    remainingQty: { gt: 0 },
  };

  if (branchId) {
    whereClause.branchId = branchId;
  }

  const batches = await db.productBatch.findMany({
    where: whereClause,
    include: {
      product: { select: { id: true, name: true } },
      inventory: { select: { branchId: true } },
    },
    orderBy: { expiresAt: 'asc' },
  });

  const riskScores: ExpiryRiskScore[] = [];
  const now = new Date();

  for (const batch of batches) {
    const daysUntilExpiry = Math.ceil(
      (batch.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    let riskScore = 0;
    let riskLevel: ExpiryRiskScore['riskLevel'] = 'LOW';
    let recommendedDiscount = 0;
    const suggestedActions: string[] = [];

    if (daysUntilExpiry <= 0) {
      riskScore = 100;
      riskLevel = 'CRITICAL';
      recommendedDiscount = 50;
      suggestedActions.push('Immediate mark-down required');
      suggestedActions.push('Consider donation or disposal');
    } else if (daysUntilExpiry <= 7) {
      riskScore = 90;
      riskLevel = 'CRITICAL';
      recommendedDiscount = 40;
      suggestedActions.push('Apply maximum discount');
      suggestedActions.push('Alert staff to prioritize');
    } else if (daysUntilExpiry <= 14) {
      riskScore = 70;
      riskLevel = 'HIGH';
      recommendedDiscount = 25;
      suggestedActions.push('Apply 25% discount');
      suggestedActions.push('Create special promotion');
    } else if (daysUntilExpiry <= 30) {
      riskScore = 50;
      riskLevel = 'MEDIUM';
      recommendedDiscount = 15;
      suggestedActions.push('Plan promotional sale');
    } else if (daysUntilExpiry <= 60) {
      riskScore = 25;
      riskLevel = 'LOW';
      recommendedDiscount = 5;
      suggestedActions.push('Monitor closely');
    }

    if (batch.isDiscounted) {
      riskScore = Math.min(riskScore * 0.8, 100);
    }

    riskScores.push({
      batchId: batch.id,
      productId: batch.productId,
      productName: batch.product?.name ?? 'Unknown',
      quantity: batch.remainingQty,
      expiresAt: batch.expiresAt,
      daysUntilExpiry,
      riskScore,
      riskLevel,
      recommendedDiscount,
      suggestedActions,
    });
  }

  return riskScores.sort((a, b) => b.riskScore - a.riskScore);
}

export async function getExpiryInsights(organisationId: string): Promise<{
  totalAtRisk: number;
  totalValue: number;
  byRiskLevel: Record<string, number>;
  recommendations: string[];
}> {
  const risks = await calculateExpiryRiskScores(organisationId);

  const totalAtRisk = risks.length;
  const totalValue = risks.reduce((sum, r) => sum + r.riskScore * r.quantity, 0);
  
  const byRiskLevel: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  for (const risk of risks) {
    const level = risk.riskLevel ?? 'LOW';
    byRiskLevel[level] = (byRiskLevel[level] ?? 0) + 1;
  }

  const recommendations: string[] = [];

  const critical = byRiskLevel.CRITICAL ?? 0;
  const high = byRiskLevel.HIGH ?? 0;
  
  if (critical > 0) {
    recommendations.push(`${critical} products require immediate attention (expiring within 7 days)`);
  }
  if (high > 0) {
    recommendations.push(`${high} products at high risk - schedule promotions`);
  }
  if (totalValue > 10000) {
    recommendations.push('Consider implementing dynamic pricing for near-expiry items');
  }

  return { totalAtRisk, totalValue, byRiskLevel, recommendations };
}

export async function detectSalesAnomalies(
  organisationId: string,
  days: number = 30
): Promise<SalesAnomalyInsight[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const sales = await db.sale.findMany({
    where: {
      organisationId,
      status: 'COMPLETED',
      createdAt: { gte: since },
    },
    include: {
      items: { include: { product: true } },
      user: true,
      branch: true,
    },
  });

  const insights: SalesAnomalyInsight[] = [];

  const hourlySales: Record<number, number[]> = {};
  const dailySales: Record<string, number> = {};
  const productSales: Record<string, number> = {};
  const cashierStats: Record<string, { sales: number; total: number; voids: number }> = {};

  for (const sale of sales) {
    const hour = sale.createdAt.getHours();
    if (!hourlySales[hour]) hourlySales[hour] = [];
    hourlySales[hour].push(Number(sale.totalAmount));

    const dayKey = getDateKey(sale.createdAt);
    const existingDaily = dailySales[dayKey];
    dailySales[dayKey] = (existingDaily ?? 0) + Number(sale.totalAmount);

    for (const item of sale.items) {
      const existingProduct = productSales[item.productId];
      productSales[item.productId] = (existingProduct ?? 0) + item.quantity;
    }

    const cashierId = sale.userId;
    if (!cashierStats[cashierId]) {
      cashierStats[cashierId] = { sales: 0, total: 0, voids: 0 };
    }
    cashierStats[cashierId].sales++;
    cashierStats[cashierId].total += Number(sale.totalAmount);
  }

  const dailyValues = Object.values(dailySales);
  const dailyKeys = Object.keys(dailySales);
  const avgDailySales = dailyKeys.length > 0 
    ? dailyValues.reduce((a, b) => a + b, 0) / dailyKeys.length 
    : 0;
  const dailyVariance = dailyKeys.length > 0
    ? dailyValues.reduce((sum, val) => 
        sum + Math.pow(val - avgDailySales, 2), 0) / dailyKeys.length
    : 0;
  const dailyStdDev = Math.sqrt(dailyVariance);

  const anomalousDays = Object.entries(dailySales).filter(([_, val]) => 
    Math.abs(val - avgDailySales) > dailyStdDev * 2
  );

  if (anomalousDays.length > days * 0.2) {
    insights.push({
      type: 'UNUSUAL_DAILY_SALES',
      description: `${anomalousDays.length} days with unusual sales volume (std dev > 2)`,
      severity: 'MEDIUM',
      affectedProducts: [],
      confidence: 0.7,
      recommendation: 'Investigate root cause - possible bulk purchases or system issues',
    });
  }

  const offHoursSales = Object.entries(hourlySales)
    .filter(([hour]) => parseInt(hour) < 6 || parseInt(hour) > 22);

  if (offHoursSales.length > 5) {
    insights.push({
      type: 'OFF_HOURS_SALES',
      description: `${offHoursSales.length} hours with sales outside normal business hours`,
      severity: 'LOW',
      affectedProducts: [],
      confidence: 0.6,
      recommendation: 'Review off-hours sales for potential security concerns',
    });
  }

  const productInsights = await analyzeProductPatterns(organisationId, productSales);
  insights.push(...productInsights);

  return insights;
}

async function analyzeProductPatterns(
  organisationId: string,
  productSales: Record<string, number>
): Promise<SalesAnomalyInsight[]> {
  const insights: SalesAnomalyInsight[] = [];

  const topProducts = Object.entries(productSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topProducts.length > 0) {
    const totalSales = Object.values(productSales).reduce((a, b) => a + b, 0);
    const topProductShare = topProducts.slice(0, 3).reduce((sum, [_, qty]) => sum + qty, 0) / totalSales;

    if (topProductShare > 0.5) {
      insights.push({
        type: 'PRODUCT_CONCENTRATION',
        description: 'Top 3 products account for over 50% of sales',
        severity: 'MEDIUM',
        affectedProducts: topProducts.slice(0, 3).map(([id]) => id),
        confidence: 0.8,
        recommendation: 'Diversify product mix to reduce dependency risk',
      });
    }
  }

  return insights;
}

export async function generateIntelligenceReport(
  organisationId: string,
  branchId?: string
): Promise<{
  stockPredictions: StockPrediction[];
  expiryRisks: ExpiryRiskScore[];
  salesInsights: SalesAnomalyInsight[];
  summary: {
    urgentReorders: number;
    criticalExpiry: number;
    anomaliesDetected: number;
  };
}> {
  const [stockPredictions, expiryRisks, salesInsights] = await Promise.all([
    branchId ? getStockPredictionsForBranch(organisationId, branchId) : Promise.resolve([]),
    calculateExpiryRiskScores(organisationId, branchId),
    detectSalesAnomalies(organisationId),
  ]);

  const urgentReorders = stockPredictions.filter(p => p.reorderRecommendation === 'URGENT').length;
  const criticalExpiry = expiryRisks.filter(e => e.riskLevel === 'CRITICAL').length;

  return {
    stockPredictions: stockPredictions.slice(0, 20),
    expiryRisks: expiryRisks.slice(0, 20),
    salesInsights,
    summary: {
      urgentReorders,
      criticalExpiry,
      anomaliesDetected: salesInsights.length,
    },
  };
}
