import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const syncQueue = new Queue('sync', { connection });
export const printQueue = new Queue('print', { connection });
export const notificationQueue = new Queue('notification', { connection });
export const reportQueue = new Queue('report', { connection });
export const fraudCheckQueue = new Queue('fraud-check', { connection });

export interface SyncJobData {
  organisationId: string;
  deviceId: string;
  sales: unknown[];
}

export interface PrintJobData {
  saleId: string;
  receiptData: unknown;
  printerType: 'bluetooth' | 'network' | 'usb';
  printerTarget: string;
}

export interface NotificationJobData {
  userId: string;
  type: 'SALE' | 'LOW_STOCK' | 'VOID' | 'SYNC';
  title: string;
  message: string;
}

export interface ReportJobData {
  organisationId: string;
  branchId?: string;
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  date: string;
  email?: string;
}

export interface FraudCheckJobData {
  saleId: string;
  amount: number;
  paymentMethod: string;
  userId: string;
  branchId: string;
}

export async function addSyncJob(data: SyncJobData): Promise<Job> {
  return syncQueue.add('process-sync', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
}

export async function addPrintJob(data: PrintJobData): Promise<Job> {
  return printQueue.add('print-receipt', data, {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 2000,
    },
  });
}

export async function addNotificationJob(data: NotificationJobData): Promise<Job> {
  return notificationQueue.add('send-notification', data);
}

export async function addReportJob(data: ReportJobData): Promise<Job> {
  return reportQueue.add('generate-report', data, {
    attempts: 1,
  });
}

export async function addFraudCheckJob(data: FraudCheckJobData): Promise<Job> {
  return fraudCheckQueue.add('check-fraud', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  });
}

export const syncWorker = new Worker<SyncJobData>(
  'sync',
  async (job) => {
    console.log(`Processing sync job ${job.id}`);
    return { processed: true };
  },
  { connection }
);

export const printWorker = new Worker<PrintJobData>(
  'print',
  async (job) => {
    console.log(`Processing print job ${job.id}`);
    return { printed: true };
  },
  { connection }
);

export const notificationWorker = new Worker<NotificationJobData>(
  'notification',
  async (job) => {
    console.log(`Processing notification job ${job.id}`);
    return { sent: true };
  },
  { connection }
);

export const reportWorker = new Worker<ReportJobData>(
  'report',
  async (job) => {
    console.log(`Processing report job ${job.id}`);
    return { generated: true };
  },
  { connection }
);

export const fraudCheckWorker = new Worker<FraudCheckJobData>(
  'fraud-check',
  async (job) => {
    console.log(`Processing fraud check job ${job.id}`);
    return { checked: true };
  },
  { connection }
);

export async function closeQueues() {
  await syncQueue.close();
  await printQueue.close();
  await notificationQueue.close();
  await reportQueue.close();
  await fraudCheckQueue.close();
  await connection.quit();
}