import { Hono } from 'hono';
import * as ops from '@nexus/ops';
import { authMiddleware, ORG_ADMIN_ONLY, verifyAccessToken } from '@nexus/auth';

export const opsRouter = new Hono();

opsRouter.use('/*', authMiddleware);

opsRouter.get('/flags', ORG_ADMIN_ONLY, async (c) => {
  const token = c.req.header('Authorization')!.slice(7);
  const user = verifyAccessToken(token);
  const flags = await ops.getFeatureFlags(user.organisationId);
  return c.json({ success: true, data: flags });
});

opsRouter.post('/flags', ORG_ADMIN_ONLY, async (c) => {
  const token = c.req.header('Authorization')!.slice(7);
  const user = verifyAccessToken(token);
  const body = await c.req.json();
  
  const flagId = await ops.createFeatureFlag(user.organisationId, {
    key: body.key,
    name: body.name,
    description: body.description,
    isEnabled: body.isEnabled,
    rolloutPercent: body.rolloutPercent,
    targetUsers: body.targetUsers,
    targetRoles: body.targetRoles,
    targetBranches: body.targetBranches,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
  });
  
  return c.json({ success: true, data: { id: flagId } });
});

opsRouter.patch('/flags/:key', ORG_ADMIN_ONLY, async (c) => {
  const token = c.req.header('Authorization')!.slice(7);
  const user = verifyAccessToken(token);
  const key = c.req.param('key');
  const body = await c.req.json();
  
  if (body.isEnabled !== undefined) {
    await ops.toggleFeatureFlag(user.organisationId, key, body.isEnabled);
  }
  
  return c.json({ success: true });
});

opsRouter.delete('/flags/:key', ORG_ADMIN_ONLY, async (c) => {
  const token = c.req.header('Authorization')!.slice(7);
  const user = verifyAccessToken(token);
  const key = c.req.param('key');
  
  await ops.deleteFeatureFlag(user.organisationId, key);
  return c.json({ success: true });
});

opsRouter.post('/flags/check', async (c) => {
  const body = await c.req.json();
  
  const enabled = await ops.isFeatureEnabled(body.key, {
    userId: body.userId,
    organisationId: body.organisationId,
    role: body.role,
    branchId: body.branchId,
  });
  
  return c.json({ success: true, data: { enabled } });
});

opsRouter.get('/deployments', ORG_ADMIN_ONLY, async (c) => {
  const token = c.req.header('Authorization')!.slice(7);
  const user = verifyAccessToken(token);
  const deployments = await ops.getDeployments(user.organisationId);
  return c.json({ success: true, data: deployments });
});

opsRouter.get('/deployments/:id', ORG_ADMIN_ONLY, async (c) => {
  const id = c.req.param('id');
  const status = await ops.getDeploymentStatus(id);
  
  if (!status) {
    return c.json({ success: false, error: 'Deployment not found' }, 404);
  }
  
  return c.json({ success: true, data: status });
});

opsRouter.post('/deployments', ORG_ADMIN_ONLY, async (c) => {
  const token = c.req.header('Authorization')!.slice(7);
  const user = verifyAccessToken(token);
  const body = await c.req.json();
  
  const deploymentId = await ops.createDeployment(user.organisationId, {
    version: body.version,
    environment: body.environment,
    strategy: body.strategy,
    canaryPercent: body.canaryPercent,
    rollbackEnabled: body.rollbackEnabled,
    autoRollbackPercent: body.autoRollbackPercent,
  });
  
  return c.json({ success: true, data: { id: deploymentId } });
});

opsRouter.post('/deployments/:id/start', ORG_ADMIN_ONLY, async (c) => {
  const id = c.req.param('id');
  await ops.startDeployment(id);
  return c.json({ success: true });
});

opsRouter.post('/deployments/:id/complete', ORG_ADMIN_ONLY, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  await ops.completeDeployment(id, body.success);
  return c.json({ success: true });
});

opsRouter.post('/deployments/:id/rollback', ORG_ADMIN_ONLY, async (c) => {
  const id = c.req.param('id');
  
  const result = await ops.rollbackDeployment(id);
  return c.json({ success: result });
});

opsRouter.post('/deployments/:id/metrics', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  await ops.recordCanaryMetric(id, {
    metricName: body.metricName,
    metricValue: body.metricValue,
    baselineValue: body.baselineValue,
    errorRate: body.errorRate,
    latencyP95: body.latencyP95,
    sampleSize: body.sampleSize,
    tags: body.tags,
  });
  
  const rollback = await ops.checkAutoRollback(id);
  
  if (rollback.shouldRollback) {
    await ops.rollbackDeployment(id);
  }
  
  return c.json({ success: true, data: { rollback: rollback.shouldRollback, reason: rollback.reason } });
});

export default opsRouter;
