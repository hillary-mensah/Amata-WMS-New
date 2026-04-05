import { db } from '@nexus/db';
import { createHash } from 'crypto';

export interface FeatureFlagContext {
  userId: string;
  organisationId: string;
  role: string;
  branchId?: string;
}

export async function isFeatureEnabled(
  key: string,
  context: FeatureFlagContext
): Promise<boolean> {
  const flag = await db.featureFlag.findFirst({
    where: { key, organisationId: context.organisationId },
  });

  if (!flag) return false;
  if (!flag.isEnabled) return false;

  if (flag.expiresAt && flag.expiresAt < new Date()) {
    return false;
  }

  if (flag.rolloutPercent === 100) return true;
  if (flag.rolloutPercent === 0) return false;

  const userHash = createHash('sha256')
    .update(context.userId + key)
    .digest('hex');
  
  const hashValue = parseInt(userHash.slice(0, 8), 16) % 100;
  
  if (hashValue >= flag.rolloutPercent) return false;

  if (flag.targetUsers !== '*') {
    const targetUsers = flag.targetUsers.split(',');
    if (!targetUsers.includes(context.userId)) return false;
  }

  if (flag.targetRoles !== '*') {
    const targetRoles = flag.targetRoles.split(',');
    if (!targetRoles.includes(context.role)) return false;
  }

  if (flag.targetBranches !== '*' && context.branchId) {
    const targetBranches = flag.targetBranches.split(',');
    if (!targetBranches.includes(context.branchId)) return false;
  }

  return true;
}

export async function createFeatureFlag(
  organisationId: string,
  flag: {
    key: string;
    name: string;
    description?: string;
    isEnabled?: boolean;
    rolloutPercent?: number;
    targetUsers?: string;
    targetRoles?: string;
    targetBranches?: string;
    expiresAt?: Date;
  }
): Promise<string> {
  const existing = await db.featureFlag.findFirst({
    where: { key: flag.key, organisationId },
  });

  if (existing) {
    const updated = await db.featureFlag.update({
      where: { id: existing.id },
      data: {
        name: flag.name,
        description: flag.description,
        isEnabled: flag.isEnabled,
        rolloutPercent: flag.rolloutPercent,
        targetUsers: flag.targetUsers,
        targetRoles: flag.targetRoles,
        targetBranches: flag.targetBranches,
        expiresAt: flag.expiresAt,
      },
    });
    return updated.id;
  }

  const created = await db.featureFlag.create({
    data: {
      ...flag,
      organisationId,
    },
  });

  return created.id;
}

export async function getFeatureFlags(organisationId: string) {
  return db.featureFlag.findMany({
    where: { organisationId },
    orderBy: { key: 'asc' },
  });
}

export async function toggleFeatureFlag(
  organisationId: string,
  key: string,
  enabled: boolean
): Promise<boolean> {
  const flag = await db.featureFlag.findFirst({
    where: { key, organisationId },
  });

  if (!flag) return false;

  await db.featureFlag.update({
    where: { id: flag.id },
    data: { isEnabled: enabled },
  });

  return true;
}

export async function deleteFeatureFlag(
  organisationId: string,
  key: string
): Promise<boolean> {
  const flag = await db.featureFlag.findFirst({
    where: { key, organisationId },
  });

  if (!flag) return false;

  await db.featureFlag.delete({
    where: { id: flag.id },
  });

  return true;
}

export interface DeploymentConfig {
  version: string;
  environment: string;
  strategy: 'BLUE_GREEN' | 'CANARY' | 'ROLLING';
  canaryPercent?: number;
  rollbackEnabled?: boolean;
  autoRollbackPercent?: number;
}

export async function createDeployment(
  organisationId: string,
  config: DeploymentConfig
): Promise<string> {
  const deployment = await db.deployment.create({
    data: {
      version: config.version,
      environment: config.environment,
      status: 'PENDING',
      strategy: config.strategy,
      canaryPercent: config.canaryPercent || 0,
      rollbackEnabled: config.rollbackEnabled ?? true,
      autoRollbackPercent: config.autoRollbackPercent || 50,
      organisationId,
    },
  });

  return deployment.id;
}

export async function startDeployment(deploymentId: string): Promise<void> {
  await db.deployment.update({
    where: { id: deploymentId },
    data: {
      status: 'DEPLOYING',
      startedAt: new Date(),
    },
  });
}

export async function completeDeployment(
  deploymentId: string,
  success: boolean
): Promise<void> {
  await db.deployment.update({
    where: { id: deploymentId },
    data: {
      status: success ? 'COMPLETED' : 'FAILED',
      completedAt: new Date(),
    },
  });
}

export async function rollbackDeployment(deploymentId: string): Promise<boolean> {
  const deployment = await db.deployment.findUnique({
    where: { id: deploymentId },
  });

  if (!deployment || !deployment.rollbackEnabled) {
    return false;
  }

  const previousDeployment = await db.deployment.findFirst({
    where: {
      organisationId: deployment.organisationId,
      status: 'COMPLETED',
      createdAt: { lt: deployment.createdAt },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!previousDeployment) {
    return false;
  }

  await db.deployment.update({
    where: { id: deploymentId },
    data: {
      status: 'ROLLED_BACK',
      completedAt: new Date(),
    },
  });

  return true;
}

export async function recordCanaryMetric(
  deploymentId: string,
  metric: {
    metricName: string;
    metricValue: number;
    baselineValue?: number;
    errorRate?: number;
    latencyP95?: number;
    sampleSize?: number;
    tags?: Record<string, string>;
  }
): Promise<void> {
  const deviation = metric.baselineValue
    ? Math.abs(metric.metricValue - metric.baselineValue) / metric.baselineValue * 100
    : null;

  let status = 'OK';
  if (metric.errorRate && metric.errorRate > 5) {
    status = 'ERROR';
  } else if (metric.latencyP95 && metric.latencyP95 > 1000) {
    status = 'SLOW';
  } else if (deviation && deviation > 20) {
    status = 'DEVIATION';
  }

  await db.canaryMetric.create({
    data: {
      deploymentId,
      metricName: metric.metricName,
      metricValue: metric.metricValue,
      baselineValue: metric.baselineValue,
      deviation,
      status,
      errorRate: metric.errorRate || 0,
      latencyP95: metric.latencyP95 || 0,
      sampleSize: metric.sampleSize || 0,
      tags: metric.tags || {},
    },
  });
}

export async function checkAutoRollback(
  deploymentId: string
): Promise<{ shouldRollback: boolean; reason?: string }> {
  const deployment = await db.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      metrics: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  });

  if (!deployment || !deployment.autoRollbackPercent) {
    return { shouldRollback: false };
  }

  const recentMetrics = deployment.metrics.slice(0, 50);
  
  if (recentMetrics.length < 10) {
    return { shouldRollback: false };
  }

  const errorRate = recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length;
  const avgLatency = recentMetrics.reduce((sum, m) => sum + m.latencyP95, 0) / recentMetrics.length;

  const errorThreshold = 100 - deployment.autoRollbackPercent;
  const latencyThreshold = deployment.autoRollbackPercent * 20;

  if (errorRate > errorThreshold) {
    return {
      shouldRollback: true,
      reason: `Error rate ${errorRate.toFixed(1)}% exceeds threshold ${errorThreshold}%`,
    };
  }

  if (avgLatency > latencyThreshold) {
    return {
      shouldRollback: true,
      reason: `Latency ${avgLatency.toFixed(0)}ms exceeds threshold ${latencyThreshold}ms`,
    };
  }

  return { shouldRollback: false };
}

export async function getDeploymentStatus(deploymentId: string) {
  const deployment = await db.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      metrics: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  });

  if (!deployment) return null;

  const summary = {
    total: deployment.metrics.length,
    ok: deployment.metrics.filter(m => m.status === 'OK').length,
    error: deployment.metrics.filter(m => m.status === 'ERROR').length,
    slow: deployment.metrics.filter(m => m.status === 'SLOW').length,
    deviation: deployment.metrics.filter(m => m.status === 'DEVIATION').length,
  };

  const avgErrorRate = deployment.metrics.reduce((sum, m) => sum + m.errorRate, 0) / Math.max(deployment.metrics.length, 1);
  const avgLatency = deployment.metrics.reduce((sum, m) => sum + m.latencyP95, 0) / Math.max(deployment.metrics.length, 1);

  return {
    ...deployment,
    summary,
    avgErrorRate,
    avgLatency,
  };
}

export async function getDeployments(organisationId: string, limit: number = 20) {
  return db.deployment.findMany({
    where: { organisationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
