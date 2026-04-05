import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, AUDITOR_AND_ABOVE } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';
import {
  detectOutliers,
  updateCashierRiskScores,
  getCashierRiskProfile,
  buildFeatureMatrix,
  extractCashierFeatures,
  runMLAnomalyDetection,
} from '@nexus/sync';

const mlRouter = new Hono();

mlRouter.use('*', authMiddleware);

mlRouter.post('/detect-outliers', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { days = 30, threshold = 0.6 } = body;

    const outliers = await detectOutliers(user.organisationId, days, threshold);

    const userDetails = await Promise.all(
      outliers.slice(0, 10).map(async (o) => {
        const u = await db.user.findUnique({
          where: { id: o.userId },
          select: { firstName: true, lastName: true, email: true },
        });
        return { ...o, user: u };
      })
    );

    return c.json(successResponse({
      totalAnalyzed: outliers.length,
      outliersFound: outliers.filter((o) => o.isAnomaly).length,
      results: userDetails,
    }));
  } catch (error) {
    console.error('Outlier detection error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to detect outliers'), 500);
  }
});

mlRouter.get('/cashier-profile/:userId', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const userId = c.req.param('userId');

    const profile = await getCashierRiskProfile(user.organisationId ?? '', userId ?? '');

    const userDetails = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true, role: true, branch: { select: { name: true } } },
    });

    return c.json(successResponse({
      ...profile,
      user: userDetails,
    }));
  } catch (error) {
    console.error('Get cashier profile error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get profile'), 500);
  }
});

mlRouter.post('/update-risk-scores', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    await updateCashierRiskScores(user.organisationId);

    const users = await db.user.findMany({
      where: {
        organisationId: user.organisationId,
        role: 'CASHIER',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    return c.json(successResponse({
      updated: users.length,
      message: 'Risk scores updated for all cashiers',
    }));
  } catch (error) {
    console.error('Update risk scores error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to update scores'), 500);
  }
});

mlRouter.post('/run-ml-detection', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const result = await runMLAnomalyDetection(user.organisationId);

    return c.json(successResponse({
      outliersDetected: result.outliers.length,
      profilesUpdated: result.profilesUpdated,
      topOutliers: result.outliers.slice(0, 5).map((o) => ({
        userId: o.userId,
        score: o.anomalyScore,
        factors: o.contributingFactors,
      })),
    }));
  } catch (error) {
    console.error('ML detection error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to run ML detection'), 500);
  }
});

mlRouter.get('/feature-matrix', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const { profiles, userIds } = await buildFeatureMatrix(user.organisationId, 30);

    const enriched = await Promise.all(
      profiles.map(async (p, i) => {
        const u = await db.user.findUnique({
          where: { id: userIds[i] },
          select: { firstName: true, lastName: true },
        });
        return { ...p, user: u };
      })
    );

    return c.json(successResponse({
      cashiersAnalyzed: profiles.length,
      profiles: enriched,
    }));
  } catch (error) {
    console.error('Feature matrix error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to build matrix'), 500);
  }
});

mlRouter.get('/cashier-features/:userId', AUDITOR_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const userId = c.req.param('userId');
    const days = parseInt(c.req.query('days') || '30');

    const features = await extractCashierFeatures(user.organisationId, userId ?? '', days);

    return c.json(successResponse(features));
  } catch (error) {
    console.error('Extract features error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to extract features'), 500);
  }
});

export { mlRouter };
