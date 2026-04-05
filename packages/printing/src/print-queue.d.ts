import { EventEmitter } from 'events';
import { type ReceiptData, type LabelData } from '../printing/src/escpos';
export interface PrintJobData {
    id: string;
    jobType: 'RECEIPT' | 'LABEL' | 'REPORT';
    title: string;
    payload: ReceiptData | LabelData;
    priority: number;
}
export interface PrinterStatus {
    online: boolean;
    paper: 'OK' | 'LOW' | 'OUT';
    cover: 'CLOSED' | 'OPEN';
    errors: string[];
}
declare class PrintQueue extends EventEmitter {
    private processing;
    private queue;
    private printers;
    private heartbeatInterval;
    private processInterval;
    constructor();
    private startHeartbeat;
    private startProcessor;
    private getOrCreateConnection;
    enqueue(job: PrintJobData): Promise<string>;
    private processNextJob;
    retryJob(jobId: string): Promise<void>;
    cancelJob(jobId: string): Promise<void>;
    getJobStatus(jobId: string): Promise<({
        printer: {
            status: string;
            name: string;
        };
    } & {
        status: string;
        id: string;
        title: string;
        createdAt: Date;
        saleId: string | null;
        printerId: string;
        completedAt: Date | null;
        startedAt: Date | null;
        retryCount: number;
        maxRetries: number;
        errorMessage: string | null;
        payload: import("@prisma/client/runtime/library").JsonValue;
        jobType: string;
        priority: number;
        attempts: number;
        createdById: string | null;
    }) | null>;
    getPrinterStatus(printerId: string): Promise<({
        printJobs: {
            status: string;
            id: string;
            title: string;
            createdAt: Date;
            saleId: string | null;
            printerId: string;
            completedAt: Date | null;
            startedAt: Date | null;
            retryCount: number;
            maxRetries: number;
            errorMessage: string | null;
            payload: import("@prisma/client/runtime/library").JsonValue;
            jobType: string;
            priority: number;
            attempts: number;
            createdById: string | null;
        }[];
    } & {
        status: string;
        id: string;
        type: string;
        createdAt: Date;
        organisationId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue;
        updatedAt: Date;
        branchId: string | null;
        name: string;
        serialNumber: string | null;
        lastHeartbeat: Date | null;
        port: number;
        host: string | null;
        connectionType: string;
        macAddress: string | null;
        capabilities: import("@prisma/client/runtime/library").JsonValue;
        isDefault: boolean;
        lastPrintAt: Date | null;
        printCount: number;
        errorCount: number;
    }) | null>;
    getQueuedJobs(printerId?: string): Promise<{
        pending: number;
        processing: number;
        failed: number;
        jobs: Array<{
            id: string;
            title: string;
            jobType: string;
            status: string;
            attempts: number;
            createdAt: Date;
        }>;
    }>;
    destroy(): void;
}
export declare const printQueue: PrintQueue;
export declare function queueReceipt(saleId: string, receiptData: ReceiptData, priority?: number): Promise<string>;
export declare function queueLabel(productId: string, labelData: LabelData, priority?: number): Promise<string>;
export declare function testPrinter(printerId: string): Promise<{
    success: boolean;
    message: string;
}>;
export {};
//# sourceMappingURL=print-queue.d.ts.map