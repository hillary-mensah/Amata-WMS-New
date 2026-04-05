import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, AUDITOR_AND_ABOVE, MANAGER_AND_ABOVE } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';
import {
  predictStockLevels,
  getStockPredictionsForBranch,
  calculateExpiryRiskScores,
  getExpiryInsights,
  detectSalesAnomalies,
  generateIntelligenceReport,
  StockPrediction,
  ExpiryRiskScore,
  SalesAnomalyInsight,
} from '@nexus/intelligence';

const intelligenceRouter = new Hono();

intelligenceRouter.use('*', authMiddleware);

intelligenceRouter.post('/stock/predict', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { productId, branchId, daysToPredict } = body;

    if (!productId || !branchId) {
      return c.json(errorResponse('Validation Error', 'productId and branchId required'), 400);
    }

    const prediction = await predictStockLevels(
      user.organisationId,
      productId,
      branchId,
      daysToPredict || 30
    );

    if (!prediction) {
      return c.json(errorResponse('Not Found', 'Inventory not found'), 404);
    }

    return c.json(successResponse(prediction));
  } catch (error) {
    console.error('Stock prediction error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to predict stock'), 500);
  }
});

intelligenceRouter.get('/stock/branch/:branchId', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const branchId = c.req.param('branchId');

    const predictions = await getStockPredictionsForBranch(user.organisationId, branchId);

    const urgent = predictions.filter((p: StockPrediction) => p.reorderRecommendation === 'URGENT');
    const soon = predictions.filter((p: StockPrediction) => p.reorderRecommendation === 'SOON');

    return c.json(successResponse({
      predictions,
      summary: {
        total: predictions.length,
        urgent: urgent.length,
        reorderSoon: soon.length,
        healthy: predictions.length - urgent.length - soon.length,
      },
    }));
  } catch (error) {
    console.error('Branch stock predictions error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get predictions'), 500);
  }
});

intelligenceRouter.get('/expiry/risks', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const branchId = c.req.query('branchId');

    const risks = await calculateExpiryRiskScores(user.organisationId, branchId);

    const critical = risks.filter((r: ExpiryRiskScore) => r.riskLevel === 'CRITICAL');
    const high = risks.filter((r: ExpiryRiskScore) => r.riskLevel === 'HIGH');
    const medium = risks.filter((r: ExpiryRiskScore) => r.riskLevel === 'MEDIUM');
    const low = risks.filter((r: ExpiryRiskScore) => r.riskLevel === 'LOW');

    return c.json(successResponse({
      risks,
      summary: {
        total: risks.length,
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        low: low.length,
        totalValue: risks.reduce((sum: number, r: ExpiryRiskScore) => sum + r.quantity, 0),
      },
    }));
  } catch (error) {
    console.error('Expiry risks error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get expiry risks'), 500);
  }
});

intelligenceRouter.get('/expiry/insights', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const insights = await getExpiryInsights(user.organisationId);

    return c.json(successResponse(insights));
  } catch (error) {
    console.error('Expiry insights error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get insights'), 500);
  }
});

intelligenceRouter.post('/expiry/apply-discount', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { batchIds, discountPercent } = body;

    if (!batchIds?.length || !discountPercent) {
      return c.json(errorResponse('Validation Error', 'batchIds and discountPercent required'), 400);
    }

    const results = [];

    for (const batchId of batchIds) {
      const batch = await db.productBatch.update({
        where: { id: batchId, organisationId: user.organisationId },
        data: {
          isDiscounted: true,
          discountPercent,
        },
      });
      results.push(batchId);
    }

    return c.json(successResponse({
      updated: results.length,
      batchIds: results,
    }));
  } catch (error) {
    console.error('Apply discount error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to apply discount'), 500);
  }
});

intelligenceRouter.get('/sales/anomalies', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const days = parseInt(c.req.query('days') || '30');

    const anomalies = await detectSalesAnomalies(user.organisationId, days);

    const bySeverity = {
      HIGH: anomalies.filter((a: SalesAnomalyInsight) => a.severity === 'HIGH').length,
      MEDIUM: anomalies.filter((a: SalesAnomalyInsight) => a.severity === 'MEDIUM').length,
      LOW: anomalies.filter((a: SalesAnomalyInsight) => a.severity === 'LOW').length,
    };

    return c.json(successResponse({
      anomalies,
      summary: {
        total: anomalies.length,
        ...bySeverity,
      },
    }));
  } catch (error) {
    console.error('Sales anomalies error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to detect anomalies'), 500);
  }
});

intelligenceRouter.get('/report', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const branchId = c.req.query('branchId');

    const report = await generateIntelligenceReport(user.organisationId, branchId);

    return c.json(successResponse(report));
  } catch (error) {
    console.error('Intelligence report error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to generate report'), 500);
  }
});

intelligenceRouter.get('/dashboard', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const [expiryInsights, salesAnomalies] = await Promise.all([
      getExpiryInsights(user.organisationId),
      detectSalesAnomalies(user.organisationId, 7),
    ]);

    return c.json(successResponse({
      alerts: {
        expiryRisk: expiryInsights.totalAtRisk,
        criticalExpiry: expiryInsights.byRiskLevel.CRITICAL,
        anomalies: salesAnomalies.length,
      },
      recommendations: [
        ...expiryInsights.recommendations,
        ...salesAnomalies.map((a: SalesAnomalyInsight) => a.recommendation),
      ].slice(0, 5),
    }));
  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get dashboard'), 500);
  }
});

export { intelligenceRouter };
