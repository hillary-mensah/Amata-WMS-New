import { Queue, Worker, Job } from 'bullmq';
export declare const syncQueue: Queue<any, any, string, any, any, string>;
export declare const printQueue: Queue<any, any, string, any, any, string>;
export declare const notificationQueue: Queue<any, any, string, any, any, string>;
export declare const reportQueue: Queue<any, any, string, any, any, string>;
export declare const fraudCheckQueue: Queue<any, any, string, any, any, string>;
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
export declare function addSyncJob(data: SyncJobData): Promise<Job>;
export declare function addPrintJob(data: PrintJobData): Promise<Job>;
export declare function addNotificationJob(data: NotificationJobData): Promise<Job>;
export declare function addReportJob(data: ReportJobData): Promise<Job>;
export declare function addFraudCheckJob(data: FraudCheckJobData): Promise<Job>;
export declare const syncWorker: Worker<SyncJobData, any, string>;
export declare const printWorker: Worker<PrintJobData, any, string>;
export declare const notificationWorker: Worker<NotificationJobData, any, string>;
export declare const reportWorker: Worker<ReportJobData, any, string>;
export declare const fraudCheckWorker: Worker<FraudCheckJobData, any, string>;
export declare function closeQueues(): Promise<void>;
//# sourceMappingURL=index.d.ts.map