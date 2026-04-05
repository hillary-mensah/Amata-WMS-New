import { db } from '@nexus/db';
import { createSocket, Socket } from 'net';
import { EventEmitter } from 'events';
import { buildReceipt, buildLabel, type ReceiptData, type LabelData } from '../printing/src/escpos.js';

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

class PrinterConnection extends EventEmitter {
  private socket: Socket | null = null;
  private host: string;
  private port: number;
  private timeout: number = 5000;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(host: string, port: number) {
    super();
    this.host = host;
    this.port = port;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new Socket();
      this.socket.setTimeout(this.timeout);

      this.socket.on('connect', () => {
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.socket.on('timeout', () => {
        this.emit('timeout');
        this.socket?.destroy();
        reject(new Error('Connection timeout'));
      });

      this.socket.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      this.socket.on('close', () => {
        this.emit('disconnected');
      });

      this.socket.connect(this.port, this.host);
    });
  }

  async print(data: Buffer): Promise<void> {
    if (!this.socket || !this.socket.writable) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.socket!.write(data, (err) => {
        if (err) {
          reject(err);
        } else {
          this.emit('printed');
          resolve();
        }
      });
    });
  }

  async getStatus(): Promise<PrinterStatus> {
    if (!this.socket || !this.socket.writable) {
      try {
        await this.connect();
      } catch {
        return { online: false, paper: 'UNKNOWN', cover: 'UNKNOWN', errors: ['Cannot connect'] };
      }
    }

    const statusCmd = Buffer.from([0x10, 0x04, 0x01]);
    
    return new Promise((resolve) => {
      let response = Buffer.alloc(0);
      
      const timeout = setTimeout(() => {
        this.socket?.destroy();
        resolve({ online: true, paper: 'OK', cover: 'CLOSED', errors: [] });
      }, 2000);

      this.socket!.once('data', (data) => {
        clearTimeout(timeout);
        response = data;
        
        const paper = (data[0] & 0x60) === 0x60 ? 'OUT' : (data[0] & 0x40) === 0x40 ? 'LOW' : 'OK';
        const cover = (data[0] & 0x04) === 0x04 ? 'OPEN' : 'CLOSED';
        
        resolve({ online: true, paper, cover, errors: [] });
      });

      this.socket!.write(statusCmd);
    });
  }

  disconnect(): void {
    this.socket?.destroy();
    this.socket = null;
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.writable;
  }
}

class PrintQueue extends EventEmitter {
  private processing: boolean = false;
  private queue: PrintJobData[] = [];
  private printers: Map<string, PrinterConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private processInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHeartbeat();
    this.startProcessor();
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      const printers = await db.printer.findMany({
        where: { status: { not: 'DISABLED' } },
      });

      for (const printer of printers) {
        if (printer.connectionType === 'NETWORK' && printer.host) {
          const conn = this.getOrCreateConnection(printer.id, printer.host, printer.port);
          
          try {
            const status = await conn.getStatus();
            
            await db.printer.update({
              where: { id: printer.id },
              data: {
                status: status.online ? 'ONLINE' : 'OFFLINE',
                lastHeartbeat: new Date(),
              },
            });
          } catch {
            await db.printer.update({
              where: { id: printer.id },
              data: { status: 'OFFLINE' },
            });
          }
        }
      }
    }, 60000);
  }

  private startProcessor(): void {
    this.processInterval = setInterval(async () => {
      if (!this.processing) {
        await this.processNextJob();
      }
    }, 5000);
  }

  private getOrCreateConnection(printerId: string, host: string, port: number): PrinterConnection {
    if (!this.printers.has(printerId)) {
      this.printers.set(printerId, new PrinterConnection(host, port));
    }
    return this.printers.get(printerId)!;
  }

  async enqueue(job: PrintJobData): Promise<string> {
    const printer = await db.printer.findFirst({
      where: { 
        id: job.payload.printerId,
        status: { not: 'DISABLED' },
      },
    });

    if (!printer) {
      throw new Error('Printer not found or disabled');
    }

    const printJob = await db.printJob.create({
      data: {
        jobType: job.jobType,
        title: job.title,
        payload: job.payload,
        priority: job.priority || 5,
        status: 'PENDING',
        printerId: printer.id,
        saleId: job.payload.saleId,
      },
    });

    this.emit('jobQueued', printJob.id);
    return printJob.id;
  }

  private async processNextJob(): Promise<void> {
    this.processing = true;

    try {
      const job = await db.printJob.findFirst({
        where: { status: 'PENDING' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        include: { printer: true },
      });

      if (!job) {
        return;
      }

      await db.printJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
      });

      const conn = this.getOrCreateConnection(job.printer.id, job.printer.host || '', job.printer.port);

      try {
        await conn.connect();

        let printData: Buffer;
        
        if (job.jobType === 'RECEIPT') {
          printData = buildReceipt(job.payload as ReceiptData);
        } else if (job.jobType === 'LABEL') {
          printData = buildLabel(job.payload as LabelData);
        } else {
          printData = Buffer.from(job.payload as unknown as string);
        }

        await conn.print(printData);

        await db.printer.update({
          where: { id: job.printerId },
          data: { 
            lastPrintAt: new Date(),
            printCount: { increment: 1 },
          },
        });

        await db.printJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        this.emit('jobCompleted', job.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        await db.printer.update({
          where: { id: job.printerId },
          data: { errorCount: { increment: 1 } },
        });

        if (job.attempts >= job.maxRetries) {
          await db.printJob.update({
            where: { id: job.id },
            data: { 
              status: 'FAILED',
              errorMessage,
            },
          });
          this.emit('jobFailed', job.id, errorMessage);
        } else {
          await db.printJob.update({
            where: { id: job.id },
            data: { 
              status: 'RETRY',
              retryCount: { increment: 1 },
              errorMessage,
            },
          });
          this.emit('jobRetrying', job.id);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  async retryJob(jobId: string): Promise<void> {
    await db.printJob.update({
      where: { id: jobId },
      data: { status: 'PENDING', retryCount: 0, errorMessage: null },
    });
  }

  async cancelJob(jobId: string): Promise<void> {
    await db.printJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });
  }

  async getJobStatus(jobId: string) {
    return db.printJob.findUnique({
      where: { id: jobId },
      include: { printer: { select: { name: true, status: true } } },
    });
  }

  async getPrinterStatus(printerId: string) {
    const printer = await db.printer.findUnique({
      where: { id: printerId },
      include: {
        printJobs: {
          where: { status: { in: ['PENDING', 'PROCESSING', 'RETRY'] } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!printer || printer.connectionType !== 'NETWORK') {
      return printer;
    }

    const conn = this.getOrCreateConnection(printer.id, printer.host || '', printer.port);
    let status: PrinterStatus = { online: false, paper: 'UNKNOWN', cover: 'UNKNOWN', errors: [] };

    try {
      status = await conn.getStatus();
    } catch {
      status = { online: false, paper: 'UNKNOWN', cover: 'UNKNOWN', errors: ['Cannot connect'] };
    }

    return { ...printer, ...status };
  }

  async getQueuedJobs(printerId?: string): Promise<{
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
  }> {
    const where = printerId 
      ? { printerId, status: { in: ['PENDING', 'PROCESSING', 'RETRY'] } }
      : { status: { in: ['PENDING', 'PROCESSING', 'RETRY'] } };

    const [pending, processing, failed, jobs] = await Promise.all([
      db.printJob.count({ where: { ...where, status: 'PENDING' } }),
      db.printJob.count({ where: { ...where, status: 'PROCESSING' } }),
      db.printJob.count({ where: { ...where, status: 'FAILED' } }),
      db.printJob.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 20,
        select: {
          id: true,
          title: true,
          jobType: true,
          status: true,
          attempts: true,
          createdAt: true,
        },
      }),
    ]);

    return { pending, processing, failed, jobs };
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }
    for (const conn of this.printers.values()) {
      conn.disconnect();
    }
    this.printers.clear();
  }
}

export const printQueue = new PrintQueue();

export async function queueReceipt(
  saleId: string,
  receiptData: ReceiptData,
  priority: number = 5
): Promise<string> {
  return printQueue.enqueue({
    id: '',
    jobType: 'RECEIPT',
    title: `Receipt for ${receiptData.receiptNumber}`,
    payload: { ...receiptData, saleId },
    priority,
  });
}

export async function queueLabel(
  productId: string,
  labelData: LabelData,
  priority: number = 3
): Promise<string> {
  return printQueue.enqueue({
    id: '',
    jobType: 'LABEL',
    title: `Label for ${labelData.productName}`,
    payload: { ...labelData, productId },
    priority,
  });
}

export async function testPrinter(printerId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const printer = await db.printer.findUnique({
    where: { id: printerId },
  });

  if (!printer) {
    return { success: false, message: 'Printer not found' };
  }

  if (printer.connectionType !== 'NETWORK') {
    return { success: false, message: 'Only network printers supported for testing' };
  }

  const conn = new PrinterConnection(printer.host || '', printer.port);

  try {
    await conn.connect();
    const status = await conn.getStatus();
    conn.disconnect();

    await db.printer.update({
      where: { id: printerId },
      data: { status: status.online ? 'ONLINE' : 'OFFLINE', lastHeartbeat: new Date() },
    });

    return { 
      success: status.online, 
      message: status.online 
        ? `Printer online. Paper: ${status.paper}, Cover: ${status.cover}` 
        : 'Printer is offline' 
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}
