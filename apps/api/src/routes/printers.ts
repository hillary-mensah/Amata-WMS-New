import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, MANAGER_AND_ABOVE } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';
import {
  printQueue,
  queueReceipt,
  queueLabel,
  testPrinter,
} from '@nexus/printing';

const printerRouter = new Hono();

printerRouter.use('*', authMiddleware);

printerRouter.post('/', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, type, connectionType, host, port, macAddress, serialNumber, branchId } = body;

    if (!name) {
      return c.json(errorResponse('Validation Error', 'name is required'), 400);
    }

    const existingDefault = await db.printer.findFirst({
      where: { organisationId: user.organisationId, isDefault: true },
    });

    const printer = await db.printer.create({
      data: {
        name,
        type: type || 'RECEIPT',
        connectionType: connectionType || 'NETWORK',
        host,
        port: port || 9100,
        macAddress,
        serialNumber,
        organisationId: user.organisationId,
        branchId: branchId || user.branchId,
        isDefault: !existingDefault,
      },
    });

    return c.json(successResponse(printer));
  } catch (error) {
    console.error('Create printer error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to create printer'), 500);
  }
});

printerRouter.get('/', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const branchId = c.req.query('branchId');

    const printers = await db.printer.findMany({
      where: {
        organisationId: user.organisationId,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return c.json(successResponse(printers));
  } catch (error) {
    console.error('Get printers error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get printers'), 500);
  }
});

printerRouter.get('/:printerId', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const printerId = c.req.param('printerId');

    const printer = await printQueue.getPrinterStatus(printerId);

    if (!printer || printer.organisationId !== user.organisationId) {
      return c.json(errorResponse('Not Found', 'Printer not found'), 404);
    }

    return c.json(successResponse(printer));
  } catch (error) {
    console.error('Get printer error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get printer'), 500);
  }
});

printerRouter.put('/:printerId', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const printerId = c.req.param('printerId');
    const body = await c.req.json();

    const printer = await db.printer.update({
      where: { id: printerId, organisationId: user.organisationId },
      data: body,
    });

    return c.json(successResponse(printer));
  } catch (error) {
    console.error('Update printer error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to update printer'), 500);
  }
});

printerRouter.delete('/:printerId', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const printerId = c.req.param('printerId');

    await db.printer.delete({
      where: { id: printerId, organisationId: user.organisationId },
    });

    return c.json(successResponse({ message: 'Printer deleted' }));
  } catch (error) {
    console.error('Delete printer error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to delete printer'), 500);
  }
});

printerRouter.post('/:printerId/test', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const printerId = c.req.param('printerId');

    const printer = await db.printer.findFirst({
      where: { id: printerId, organisationId: user.organisationId },
    });

    if (!printer) {
      return c.json(errorResponse('Not Found', 'Printer not found'), 404);
    }

    const result = await testPrinter(printerId ?? '');

    return c.json(successResponse(result));
  } catch (error) {
    console.error('Test printer error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to test printer'), 500);
  }
});

printerRouter.post('/:printerId/set-default', MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const printerId = c.req.param('printerId');

    await db.printer.updateMany({
      where: { organisationId: user.organisationId },
      data: { isDefault: false },
    });

    await db.printer.update({
      where: { id: printerId },
      data: { isDefault: true },
    });

    return c.json(successResponse({ message: 'Default printer updated' }));
  } catch (error) {
    console.error('Set default printer error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to set default printer'), 500);
  }
});

printerRouter.get('/queue/status', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const printerId = c.req.query('printerId');

    const result = await printQueue.getQueuedJobs(printerId);

    return c.json(successResponse(result));
  } catch (error) {
    console.error('Get queue status error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get queue status'), 500);
  }
});

printerRouter.post('/queue/:jobId/retry', MANAGER_AND_ABOVE, async (c) => {
  try {
    const jobId = c.req.param('jobId');

    await printQueue.retryJob(jobId ?? '');

    return c.json(successResponse({ message: 'Job requeued' }));
  } catch (error) {
    console.error('Retry job error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to retry job'), 500);
  }
});

printerRouter.post('/queue/:jobId/cancel', MANAGER_AND_ABOVE, async (c) => {
  try {
    const jobId = c.req.param('jobId');

    await printQueue.cancelJob(jobId ?? '');

    return c.json(successResponse({ message: 'Job cancelled' }));
  } catch (error) {
    console.error('Cancel job error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to cancel job'), 500);
  }
});

printerRouter.get('/queue/:jobId', async (c) => {
  try {
    const jobId = c.req.param('jobId');

    const job = await printQueue.getJobStatus(jobId);

    if (!job) {
      return c.json(errorResponse('Not Found', 'Job not found'), 404);
    }

    return c.json(successResponse(job));
  } catch (error) {
    console.error('Get job status error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get job status'), 500);
  }
});

export { printerRouter };
