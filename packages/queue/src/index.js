import { Queue, Worker } from 'bullmq';
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
export async function addSyncJob(data) {
    return syncQueue.add('process-sync', data, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
    });
}
export async function addPrintJob(data) {
    return printQueue.add('print-receipt', data, {
        attempts: 2,
        backoff: {
            type: 'fixed',
            delay: 2000,
        },
    });
}
export async function addNotificationJob(data) {
    return notificationQueue.add('send-notification', data);
}
export async function addReportJob(data) {
    return reportQueue.add('generate-report', data, {
        attempts: 1,
    });
}
export async function addFraudCheckJob(data) {
    return fraudCheckQueue.add('check-fraud', data, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 3000,
        },
    });
}
export const syncWorker = new Worker('sync', async (job) => {
    console.log(`Processing sync job ${job.id}`);
    return { processed: true };
}, { connection });
export const printWorker = new Worker('print', async (job) => {
    console.log(`Processing print job ${job.id}`);
    return { printed: true };
}, { connection });
export const notificationWorker = new Worker('notification', async (job) => {
    console.log(`Processing notification job ${job.id}`);
    return { sent: true };
}, { connection });
export const reportWorker = new Worker('report', async (job) => {
    console.log(`Processing report job ${job.id}`);
    return { generated: true };
}, { connection });
export const fraudCheckWorker = new Worker('fraud-check', async (job) => {
    console.log(`Processing fraud check job ${job.id}`);
    return { checked: true };
}, { connection });
export async function closeQueues() {
    await syncQueue.close();
    await printQueue.close();
    await notificationQueue.close();
    await reportQueue.close();
    await fraudCheckQueue.close();
    await connection.quit();
}
//# sourceMappingURL=index.js.map