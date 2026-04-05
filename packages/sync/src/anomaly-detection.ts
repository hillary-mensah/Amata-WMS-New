import { db } from '@nexus/db';
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

const EXCESS_REFUNDS_PER_HOUR = 3;
const EXCESS_VOIDS_PER_HOUR = 5;
const MAX_DISCOUNT_PERCENT = 25;
const HIGH_CASH_THRESHOLD = 5000;

export async function detectExcessRefunds(
  organisationId: string,
  userId: string,
  hours: number = 1
): Promise<CreatedAnomaly | null> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const refundCount = await db.sale.count({
    where: {
      organisationId,
      userId,
      status: 'REFUNDED',
      createdAt: { gte: since },
    },
  });

  if (refundCount >= EXCESS_REFUNDS_PER_HOUR) {
    return {
      type: AnomalyType.EXCESS_REFUNDS,
      severity: refundCount >= EXCESS_REFUNDS_PER_HOUR * 2 ? 'HIGH' : 'MEDIUM',
      title: 'Excessive Refunds Detected',
      description: `Cashier processed ${refundCount} refunds in the last ${hours} hour(s)`,
      evidence: { refundCount, hours, threshold: EXCESS_REFUNDS_PER_HOUR },
      riskScore: Math.min(refundCount / EXCESS_REFUNDS_PER_HOUR, 1),
      userId,
    };
  }
  return null;
}

export async function detectDiscountAbuse(
  organisationId: string,
  branchId: string,
  userId: string
): Promise<CreatedAnomaly | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const highDiscountSales = await db.sale.findMany({
    where: {
      organisationId,
      branchId,
      userId,
      discountAmount: { gt: 0 },
      createdAt: { gte: oneHourAgo },
    },
    select: { totalAmount: true, discountAmount: true },
  });

  let totalDiscountPercent = 0;
  let count = 0;

  for (const sale of highDiscountSales) {
    const percent = Number(sale.discountAmount) / Number(sale.totalAmount) * 100;
    if (percent > MAX_DISCOUNT_PERCENT) {
      totalDiscountPercent += percent;
      count++;
    }
  }

  if (count >= 3) {
    const avgDiscount = totalDiscountPercent / count;
    return {
      type: AnomalyType.DISCOUNT_ABUSE,
      severity: avgDiscount > 40 ? 'HIGH' : 'MEDIUM',
      title: 'Potential Discount Abuse',
      description: `Cashier applied ${count} high-discount sales (avg ${avgDiscount.toFixed(1)}%) in the last hour`,
      evidence: { count, avgDiscount, threshold: MAX_DISCOUNT_PERCENT },
      riskScore: Math.min(avgDiscount / 100, 1),
      userId,
    };
  }
  return null;
}

export async function detectSuspiciousVoids(
  organisationId: string,
  userId: string
): Promise<CreatedAnomaly | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const voidedSales = await db.sale.findMany({
    where: {
      organisationId,
      voidedById: userId,
      status: 'VOIDED',
      createdAt: { gte: oneHourAgo },
    },
    include: {
      items: { select: { productId: true, quantity: true, totalPrice: true } },
    },
  });

  if (voidedSales.length >= EXCESS_VOIDS_PER_HOUR) {
    const totalVoided = voidedSales.reduce(
      (sum, s) => sum + Number(s.totalAmount),
      0
    );

    const sameItemVoids = await db.$queryRaw<[{ product_id: string; count: bigint }]>`
      SELECT product_id, COUNT(*) as count
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."organisationId" = ${organisationId}
        AND s."voidedById" = ${userId}
        AND s.status = 'VOIDED'
        AND s."createdAt" >= ${oneHourAgo}
      GROUP BY product_id
      HAVING COUNT(*) >= 2
    `;

    const hasSameItemPattern = sameItemVoids.length > 0;

    return {
      type: hasSameItemPattern ? AnomalyType.MULTIPLE_Voids_SAME_ITEM : AnomalyType.SUSPICIOUS_VOID,
      severity: voidedSales.length >= EXCESS_VOIDS_PER_HOUR * 2 ? 'HIGH' : 'MEDIUM',
      title: 'Suspicious Void Activity',
      description: `Cashier voided ${voidedSales.length} sales worth ₵${totalVoided.toFixed(2)} in the last hour`,
      evidence: { 
        voidCount: voidedSales.length, 
        totalVoided,
        sameItemPatterns: sameItemVoids.length,
      },
      riskScore: Math.min(voidedSales.length / EXCESS_VOIDS_PER_HOUR, 1),
      userId,
    };
  }
  return null;
}

export async function detectHighCashTransaction(
  organisationId: string,
  saleId: string,
  amount: number,
  paymentMethod: string
): Promise<CreatedAnomaly | null> {
  if (paymentMethod === 'CASH' && amount >= HIGH_CASH_THRESHOLD) {
    return {
      type: AnomalyType.HIGH_CASH_TRANSACTION,
      severity: amount >= HIGH_CASH_THRESHOLD * 2 ? 'HIGH' : 'MEDIUM',
      title: 'High Cash Transaction',
      description: `Cash sale of ₵${amount} exceeds ₵${HIGH_CASH_THRESHOLD} threshold`,
      evidence: { amount, threshold: HIGH_CASH_THRESHOLD },
      riskScore: Math.min(amount / (HIGH_CASH_THRESHOLD * 2), 1),
      saleId,
    };
  }
  return null;
}

export async function detectOffHoursSale(
  organisationId: string,
  saleId: string,
  saleTime: Date
): Promise<CreatedAnomaly | null> {
  const hour = saleTime.getHours();
  const isOffHours = hour < 6 || hour > 22;

  if (isOffHours) {
    return {
      type: AnomalyType.OFF_HOURS_SALE,
      severity: 'LOW',
      title: 'Off-Hours Sale',
      description: `Sale completed at ${saleTime.toLocaleTimeString()} (outside normal hours)`,
      evidence: { hour, saleTime: saleTime.toISOString() },
      riskScore: 0.2,
      saleId,
    };
  }
  return null;
}

export async function checkNegativeStockSale(
  organisationId: string,
  saleId: string
): Promise<CreatedAnomaly | null> {
  const saleItems = await db.saleItem.findMany({
    where: { saleId },
    include: {
      product: { select: { name: true } },
    },
  });

  const negativeStockItems = [];

  for (const item of saleItems) {
    const inventory = await db.inventory.findFirst({
      where: {
        productId: item.productId,
        branch: { organisationId },
      },
    });

    if (inventory && inventory.quantity < 0) {
      negativeStockItems.push({
        product: item.product.name,
        quantity: item.quantity,
        currentStock: inventory.quantity,
      });
    }
  }

  if (negativeStockItems.length > 0) {
    return {
      type: AnomalyType.NEGATIVE_STOCK_SALE,
      severity: 'CRITICAL',
      title: 'Sale with Negative Stock',
      description: `Sale includes ${negativeStockItems.length} item(s) with negative stock`,
      evidence: { items: negativeStockItems },
      riskScore: 1,
      saleId,
    };
  }
  return null;
}

export async function analyzeCashierBehavior(
  organisationId: string,
  userId: string,
  days: number = 7
): Promise<CreatedAnomaly[]> {
  const anomalies: CreatedAnomaly[] = [];
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
    },
  });

  if (sales.length === 0) return anomalies;

  const hourlySales: Record<number, number> = {};
  let totalDiscount = 0;
  let voidCount = 0;

  for (const sale of sales) {
    const hour = sale.createdAt.getHours();
    hourlySales[hour] = (hourlySales[hour] || 0) + 1;
    totalDiscount += Number(sale.discountAmount);
  }

  const voided = await db.sale.count({
    where: {
      organisationId,
      voidedById: userId,
      createdAt: { gte: since },
    },
  });
  voidCount = voided;

  const unusualHours = Object.entries(hourlySales).filter(([h]) => {
    const hour = parseInt(h);
    return hour < 6 || hour > 22;
  });

  if (unusualHours.length > 0) {
    const unusualHourSales = unusualHours.reduce((sum, [, count]) => sum + count, 0);
    if (unusualHourSales / sales.length > 0.3) {
      anomalies.push({
        type: AnomalyType.UNUSUAL_SALES_PATTERN,
        severity: 'MEDIUM',
        title: 'Unusual Sales Hours',
        description: `Cashier has ${((unusualHourSales / sales.length) * 100).toFixed(0)}% of sales outside normal hours`,
        evidence: { unusualHourSales, totalSales: sales.length, hourlyDistribution: hourlySales },
        riskScore: unusualHourSales / sales.length,
        userId,
      });
    }
  }

  const avgDiscountPercent = (totalDiscount / sales.reduce((sum, s) => sum + Number(s.totalAmount), 0)) * 100;
  if (avgDiscountPercent > 15) {
    anomalies.push({
      type: AnomalyType.DISCOUNT_ABUSE,
      severity: avgDiscountPercent > 25 ? 'HIGH' : 'MEDIUM',
      title: 'High Average Discount Rate',
      description: `Cashier averages ${avgDiscountPercent.toFixed(1)}% discount (threshold: 15%)`,
      evidence: { avgDiscountPercent, totalDiscount, salesCount: sales.length },
      riskScore: avgDiscountPercent / 100,
      userId,
    });
  }

  if (voidCount > sales.length * 0.1) {
    anomalies.push({
      type: AnomalyType.SUSPICIOUS_VOID,
      severity: voidCount > sales.length * 0.2 ? 'HIGH' : 'MEDIUM',
      title: 'High Void Rate',
      description: `Cashier voided ${((voidCount / sales.length) * 100).toFixed(0)}% of sales (threshold: 10%)`,
      evidence: { voidCount, salesCount: sales.length },
      riskScore: voidCount / sales.length,
      userId,
    });
  }

  return anomalies;
}

export async function runAnomalyDetection(
  organisationId: string,
  context: RuleContext
): Promise<AnomalyDetectionResult> {
  const anomalies: CreatedAnomaly[] = [];

  if (context.userId) {
    const refundAnomaly = await detectExcessRefunds(organisationId, context.userId);
    if (refundAnomaly) anomalies.push(refundAnomaly);

    const voidAnomaly = await detectSuspiciousVoids(organisationId, context.userId);
    if (voidAnomaly) anomalies.push(voidAnomaly);

    if (context.branchId) {
      const discountAnomaly = await detectDiscountAbuse(
        organisationId,
        context.branchId,
        context.userId
      );
      if (discountAnomaly) anomalies.push(discountAnomaly);
    }
  }

  const behaviorAnomalies = await analyzeCashierBehavior(organisationId, context.userId!);
  anomalies.push(...behaviorAnomalies);

  return {
    detected: anomalies.length > 0,
    anomalies,
  };
}

export async function createAnomaly(
  organisationId: string,
  anomaly: CreatedAnomaly
): Promise<void> {
  await db.anomaly.create({
    data: {
      organisationId,
      type: anomaly.type,
      severity: anomaly.severity,
      status: AnomalyStatus.DETECTED,
      title: anomaly.title,
      description: anomaly.description,
      evidence: anomaly.evidence as object,
      riskScore: anomaly.riskScore,
      userId: anomaly.userId,
      saleId: anomaly.saleId,
    },
  });
}

export async function resolveAnomaly(
  anomalyId: string,
  status: AnomalyStatus,
  notes?: string
): Promise<void> {
  await db.anomaly.update({
    where: { id: anomalyId },
    data: {
      status,
      resolvedAt: new Date(),
      resolutionNotes: notes,
    },
  });
}
