import { db } from '@nexus/db';
const DEFAULT_ISOLATION_SCORE_THRESHOLD = 0.6;
const FEATURE_NAMES = [
    'avgTransactionValue',
    'avgDiscountPercent',
    'voidRate',
    'refundRate',
    'salesPerHour',
    'peakHourDeviation',
    'itemsPerTransaction',
    'returnCustomerRate',
    'highValueTransactionRate',
    'offHoursSalesRate',
];
function normalizeFeatures(features) {
    const mean = features.reduce((a, b) => a + b, 0) / features.length;
    const std = Math.sqrt(features.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / features.length);
    return std === 0 ? features.map(() => 0) : features.map((f) => (f - mean) / std);
}
function calculateDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}
function buildIsolationTree(data, depth = 0, maxDepth = 10) {
    if (depth >= maxDepth || data.length <= 1) {
        const centroid = data.length > 0
            ? data[0].map((_, i) => data.reduce((sum, row) => sum + row[i], 0) / data.length)
            : [];
        return { type: 'leaf', size: data.length, centroid };
    }
    const numFeatures = data[0].length;
    const randomFeature = Math.floor(Math.random() * numFeatures);
    const featureValues = data.map((row) => row[randomFeature]);
    const min = Math.min(...featureValues);
    const max = Math.max(...featureValues);
    if (min === max) {
        const centroid = data[0].map((_, i) => data.reduce((sum, row) => sum + row[i], 0) / data.length);
        return { type: 'leaf', size: data.length, centroid };
    }
    const splitValue = min + Math.random() * (max - min);
    const left = data.filter((row) => row[randomFeature] < splitValue);
    const right = data.filter((row) => row[randomFeature] >= splitValue);
    return {
        type: 'node',
        feature: randomFeature,
        splitValue,
        left: buildIsolationTree(left, depth + 1, maxDepth),
        right: buildIsolationTree(right, depth + 1, maxDepth),
    };
}
function pathLength(point, node, depth = 0) {
    if (node.type === 'leaf') {
        const c = node.size || 1;
        return depth + 2 * (Math.log(c) / Math.log(2));
    }
    if (!node.feature || !node.splitValue || !node.left || !node.right) {
        return depth;
    }
    if (point[node.feature] < node.splitValue) {
        return pathLength(point, node.left, depth + 1);
    }
    return pathLength(point, node.right, depth + 1);
}
export class IsolationForest {
    trees = [];
    numTrees;
    sampleSize;
    constructor(numTrees = 100, sampleSize = 256) {
        this.numTrees = numTrees;
        this.sampleSize = sampleSize;
    }
    fit(data) {
        this.trees = [];
        const sampleSize = Math.min(this.sampleSize, data.length);
        for (let i = 0; i < this.numTrees; i++) {
            const sampleIndices = Array.from({ length: data.length }, (_, i) => i)
                .sort(() => Math.random() - 0.5)
                .slice(0, sampleSize);
            const sample = sampleIndices.map((i) => data[i]);
            this.trees.push(buildIsolationTree(sample));
        }
    }
    score(point) {
        if (this.trees.length === 0)
            return 0;
        const avgPathLength = this.trees.reduce((sum, tree) => {
            return sum + pathLength(point, tree);
        }, 0) / this.trees.length;
        const c = this.sampleSize;
        return Math.pow(2, -avgPathLength / (2 * Math.log(c) / Math.log(2)));
    }
    predict(point, threshold = DEFAULT_ISOLATION_SCORE_THRESHOLD) {
        return this.score(point) > threshold;
    }
}
export async function extractCashierFeatures(organisationId, userId, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sales = await db.sale.findMany({
        where: {
            organisationId,
            userId,
            status: 'COMPLETED',
            createdAt: { gte: since },
        },
        select: {
            id: true,
            totalAmount: true,
            discountAmount: true,
            createdAt: true,
            paymentMethod: true,
        },
    });
    const voids = await db.sale.count({
        where: {
            organisationId,
            voidedById: userId,
            createdAt: { gte: since },
        },
    });
    const refunds = await db.sale.count({
        where: {
            organisationId,
            userId,
            status: 'REFUNDED',
            createdAt: { gte: since },
        },
    });
    const saleItems = await db.saleItem.findMany({
        where: {
            sale: {
                organisationId,
                userId,
                status: 'COMPLETED',
                createdAt: { gte: since },
            },
        },
        select: { quantity: true },
    });
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const totalDiscount = sales.reduce((sum, s) => sum + Number(s.discountAmount), 0);
    const hourlySales = new Array(24).fill(0);
    sales.forEach((s) => {
        const hour = new Date(s.createdAt).getHours();
        hourlySales[hour]++;
    });
    const peakHour = hourlySales.indexOf(Math.max(...hourlySales));
    const avgSalesPerHour = totalSales / days / 24;
    const paymentMethodCounts = {};
    sales.forEach((s) => {
        paymentMethodCounts[s.paymentMethod] = (paymentMethodCounts[s.paymentMethod] || 0) + 1;
    });
    const preferredPaymentMethod = Object.entries(paymentMethodCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'CASH';
    const highValueCount = sales.filter((s) => Number(s.totalAmount) > 1000).length;
    const offHoursCount = sales.filter((s) => {
        const hour = new Date(s.createdAt).getHours();
        return hour < 6 || hour > 22;
    }).length;
    const anomalyCount = await db.anomaly.count({
        where: {
            userId,
            createdAt: { gte: since },
        },
    });
    const lastAnomaly = await db.anomaly.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
    });
    return {
        userId,
        avgTransactionValue: totalSales > 0 ? totalRevenue / totalSales : 0,
        avgDiscountPercent: totalSales > 0 ? (totalDiscount / totalRevenue) * 100 : 0,
        voidRate: totalSales > 0 ? voids / totalSales : 0,
        refundRate: totalSales > 0 ? refunds / totalSales : 0,
        salesPerHour: hourlySales,
        peakHour,
        preferredPaymentMethod,
        itemsPerTransaction: saleItems.length / Math.max(totalSales, 1),
        returnCustomerRate: 0,
        riskScore: 0,
        anomalyCount30d: anomalyCount,
        lastAnomalyAt: lastAnomaly?.createdAt,
    };
}
export async function buildFeatureMatrix(organisationId, days = 30) {
    const users = await db.user.findMany({
        where: {
            organisationId,
            role: 'CASHIER',
            isActive: true,
        },
        select: { id: true },
    });
    const profiles = [];
    const matrix = [];
    const userIds = [];
    for (const user of users) {
        const profile = await extractCashierFeatures(organisationId, user.id, days);
        profiles.push(profile);
        userIds.push(user.id);
        const features = [
            profile.avgTransactionValue / 10000,
            profile.avgDiscountPercent / 100,
            profile.voidRate * 10,
            profile.refundRate * 10,
            profile.salesPerHour.reduce((a, b) => a + b, 0) / 30,
            Math.abs(profile.peakHour - 12) / 12,
            profile.itemsPerTransaction / 10,
            profile.returnCustomerRate,
            (profile.avgTransactionValue > 1000 ? 1 : 0) * profile.anomalyCount30d,
            profile.anomalyCount30d / 10,
        ];
        matrix.push(normalizeFeatures(features));
    }
    return { profiles, matrix, userIds };
}
export async function detectOutliers(organisationId, days = 30, threshold = DEFAULT_ISOLATION_SCORE_THRESHOLD) {
    const { profiles, matrix, userIds } = await buildFeatureMatrix(organisationId, days);
    if (matrix.length < 10) {
        return [];
    }
    const forest = new IsolationForest(100, Math.min(256, matrix.length));
    forest.fit(matrix);
    const results = [];
    for (let i = 0; i < matrix.length; i++) {
        const score = forest.score(matrix[i]);
        const isAnomaly = score > threshold;
        const profile = profiles[i];
        const contributingFactors = [];
        if (profile.voidRate > 0.1)
            contributingFactors.push('High void rate');
        if (profile.refundRate > 0.1)
            contributingFactors.push('High refund rate');
        if (profile.avgDiscountPercent > 20)
            contributingFactors.push('Excessive discounting');
        if (profile.anomalyCount30d > 5)
            contributingFactors.push('Previous anomalies');
        if (profile.avgTransactionValue > 2000)
            contributingFactors.push('High transaction values');
        if (profile.preferredPaymentMethod === 'CASH' && profile.avgTransactionValue > 1500) {
            contributingFactors.push('Cash-heavy high-value transactions');
        }
        results.push({
            userId: userIds[i],
            anomalyScore: score,
            isAnomaly,
            contributingFactors,
        });
    }
    return results.sort((a, b) => b.anomalyScore - a.anomalyScore);
}
export async function updateCashierRiskScores(organisationId) {
    const { profiles, matrix, userIds } = await buildFeatureMatrix(organisationId, 30);
    if (matrix.length < 10)
        return;
    const forest = new IsolationForest(100, Math.min(256, matrix.length));
    forest.fit(matrix);
    for (let i = 0; i < matrix.length; i++) {
        const score = forest.score(matrix[i]);
        const riskScore = Math.min(score * 100, 100);
        await db.user.update({
            where: { id: userIds[i] },
            data: {
                metadata: {
                    anomalyScore: score,
                    riskScore,
                    lastMLUpdate: new Date().toISOString(),
                }
            },
        }).catch(() => { });
    }
}
export async function getCashierRiskProfile(organisationId, userId) {
    const profile = await extractCashierFeatures(organisationId, userId, 30);
    const { matrix, userIds } = await buildFeatureMatrix(organisationId, 30);
    const userIndex = userIds.indexOf(userId);
    let mlScore = 0;
    let isOutlier = false;
    if (userIndex >= 0 && matrix.length >= 10) {
        const forest = new IsolationForest(100, Math.min(256, matrix.length));
        forest.fit(matrix);
        mlScore = forest.score(matrix[userIndex]);
        isOutlier = mlScore > DEFAULT_ISOLATION_SCORE_THRESHOLD;
    }
    const anomalyFactor = profile.anomalyCount30d * 0.2;
    const voidFactor = profile.voidRate * 0.3;
    const refundFactor = profile.refundRate * 0.2;
    profile.riskScore = Math.min((mlScore * 40 + anomalyFactor * 20 + voidFactor * 20 + refundFactor * 20), 100);
    return { ...profile, mlScore, isOutlier };
}
export async function runMLAnomalyDetection(organisationId) {
    const { userIds } = await buildFeatureMatrix(organisationId, 30);
    await updateCashierRiskScores(organisationId);
    const outliers = await detectOutliers(organisationId, 30);
    for (const outlier of outliers) {
        if (outlier.isAnomaly && outlier.anomalyScore > 0.7) {
            await db.anomaly.upsert({
                where: {
                    id: `ml-${outlier.userId}-${new Date().toISOString().split('T')[0]}`,
                },
                create: {
                    id: `ml-${outlier.userId}-${new Date().toISOString().split('T')[0]}`,
                    organisationId,
                    type: 'UNUSUAL_SALES_PATTERN',
                    severity: outlier.anomalyScore > 0.85 ? 'HIGH' : 'MEDIUM',
                    status: 'DETECTED',
                    title: 'ML-Detected Behavioral Anomaly',
                    description: `Isolation Forest score: ${outlier.anomalyScore.toFixed(2)}. Factors: ${outlier.contributingFactors.join(', ')}`,
                    evidence: {
                        mlScore: outlier.anomalyScore,
                        contributingFactors: outlier.contributingFactors,
                        model: 'isolation_forest',
                        version: '1.0',
                    },
                    riskScore: outlier.anomalyScore,
                    userId: outlier.userId,
                },
                update: {
                    type: 'UNUSUAL_SALES_PATTERN',
                    severity: outlier.anomalyScore > 0.85 ? 'HIGH' : 'MEDIUM',
                    title: 'ML-Detected Behavioral Anomaly',
                    description: `Isolation Forest score: ${outlier.anomalyScore.toFixed(2)}. Factors: ${outlier.contributingFactors.join(', ')}`,
                    evidence: {
                        mlScore: outlier.anomalyScore,
                        contributingFactors: outlier.contributingFactors,
                        model: 'isolation_forest',
                        version: '1.0',
                    },
                    riskScore: outlier.anomalyScore,
                },
            });
        }
    }
    return {
        outliers: outliers.filter((o) => o.isAnomaly),
        profilesUpdated: userIds.length,
    };
}
//# sourceMappingURL=ml-anomaly.js.map