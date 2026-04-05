import { Hono } from 'hono';
import { db } from '@nexus/db';
import { redis } from '@nexus/cache';

export const healthRouter = new Hono();

healthRouter.get('/', async (c) => {
  const checks: Record<string, string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (error) {
    checks.database = 'error';
    checks.status = 'degraded';
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch (error) {
    checks.redis = 'error';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return c.json(checks, statusCode);
});

healthRouter.get('/ready', async (c) => {
  return c.json({ ready: true });
});

healthRouter.get('/live', async (c) => {
  return c.json({ alive: true });
});