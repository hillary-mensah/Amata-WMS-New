import { Hono } from 'hono';
import cors from 'cors';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';

import { authRouter } from './routes/auth.js';
import { posRouter } from './routes/pos.js';
import { inventoryRouter } from './routes/inventory.js';
import { productRouter } from './routes/products.js';
import { categoryRouter } from './routes/categories.js';
import { salesRouter } from './routes/sales.js';
import { branchRouter } from './routes/branches.js';
import { deviceRouter } from './routes/devices.js';
import { syncRouter } from './routes/sync.js';
import { healthRouter } from './routes/health.js';
import { webhookRouter as webhookApiRouter } from './routes/webhooks.js';
import { hardwareRouter } from './routes/hardware.js';
import { expiryRouter } from './routes/expiry.js';
import { digitalTwinRouter } from './routes/digital-twin.js';
import { anomalyRouter } from './routes/anomaly.js';
import { mlRouter } from './routes/ml.js';
import { printerRouter } from './routes/printers.js';
import { paymentRouter, webhookConfigRouter } from './routes/payments.js';
import { webhookRouter as webhookCallbackRouter } from './routes/webhook-callback.js';
import { governanceRouter, retentionRouter, complianceRouter } from './routes/governance.js';
import { intelligenceRouter } from './routes/intelligence.js';
import { opsRouter } from './routes/ops.js';

const app = new Hono();

app.use('*', timing());
app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

app.route('/auth', authRouter);
app.route('/pos', posRouter);
app.route('/inventory', inventoryRouter);
app.route('/products', productRouter);
app.route('/categories', categoryRouter);
app.route('/sales', salesRouter);
app.route('/branches', branchRouter);
app.route('/devices', deviceRouter);
app.route('/sync', syncRouter);
app.route('/health', healthRouter);
app.route('/webhook', webhookApiRouter);
app.route('/webhook/callback', webhookCallbackRouter);
app.route('/hardware', hardwareRouter);
app.route('/expiry', expiryRouter);
app.route('/digital-twin', digitalTwinRouter);
app.route('/anomaly', anomalyRouter);
app.route('/ml', mlRouter);
app.route('/printers', printerRouter);
app.route('/payments', paymentRouter);
app.route('/webhooks', webhookConfigRouter);
app.route('/governance', governanceRouter);
app.route('/governance/retention', retentionRouter);
app.route('/governance/compliance', complianceRouter);
app.route('/intelligence', intelligenceRouter);
app.route('/ops', opsRouter);

app.notFound((c) => c.json({ success: false, error: 'Not Found' }, 404));

app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({ 
    success: false, 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  }, 500);
});

export default app;