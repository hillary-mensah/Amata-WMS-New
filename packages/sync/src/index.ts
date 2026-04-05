import { v4 as uuidv4 } from 'uuid';
import { db } from '@nexus/db';
import { PaymentMethod, SaleStatus } from '@nexus/types';
import {
  processSyncWithConflictResolution,
  resolveStockConflicts,
  runReconciliation,
  ConflictType,
  ConflictResolution,
  type SyncConflict,
} from './conflict-resolution';

export interface OfflineSale {
  localId: string;
  idempotencyKey: string;
  branchId: string;
  userId: string;
  deviceId: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  }[];
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  createdAt: string;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  conflicts: SyncConflict[];
  serverChanges: ServerChange[];
}

export interface ServerChange {
  type: 'PRODUCT' | 'INVENTORY' | 'PRICE';
  entityId: string;
  data: unknown;
}

export async function syncOfflineSales(
  organisationId: string,
  branchId: string,
  userId: string,
  offlineSales: OfflineSale[]
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    syncedCount: 0,
    conflicts: [],
    serverChanges: [],
  };

  const saleData = offlineSales.map((sale) => ({
    localId: sale.localId,
    idempotencyKey: sale.idempotencyKey,
    branchId: sale.branchId,
    userId: sale.userId,
    deviceId: sale.deviceId,
    items: sale.items,
    paymentMethod: sale.paymentMethod,
    paymentReference: sale.paymentReference,
    createdAt: sale.createdAt,
  }));

  const syncResult = await processSyncWithConflictResolution(
    organisationId,
    branchId,
    userId,
    saleData
  );

  result.success = syncResult.success;
  result.syncedCount = syncResult.synced;
  result.conflicts = syncResult.conflicts as unknown as SyncConflict[];

  return result;
}

export async function getServerChanges(
  organisationId: string,
  since?: Date
): Promise<ServerChange[]> {
  const changes: ServerChange[] = [];

  const products = await db.product.findMany({
    where: {
      organisationId,
      updatedAt: since ? { gt: since } : undefined,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      unitPrice: true,
      isActive: true,
    },
  });

  for (const product of products) {
    changes.push({
      type: 'PRODUCT',
      entityId: product.id,
      data: product,
    });
  }

  const inventories = await db.inventory.findMany({
    where: {
      branch: { organisationId },
      updatedAt: since ? { gt: since } : undefined,
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  });

  for (const inv of inventories) {
    changes.push({
      type: 'INVENTORY',
      entityId: inv.id,
      data: {
        productId: inv.productId,
        branchId: inv.branchId,
        quantity: inv.quantity,
      },
    });
  }

  return changes;
}

export function generateLocalId(): string {
  return uuidv4();
}

export {
  resolveStockConflicts,
  runReconciliation,
  ConflictType,
  ConflictResolution,
} from './conflict-resolution';

export {
  computeInventoryFromEvents,
  verifyDigitalTwin,
  getDiscrepancyAlerts,
  resolveDiscrepancy,
  reconcileInventory,
} from './digital-twin';

export {
  runAnomalyDetection,
  createAnomaly,
  resolveAnomaly,
  analyzeCashierBehavior,
  detectExcessRefunds,
  detectDiscountAbuse,
  detectSuspiciousVoids,
  detectHighCashTransaction,
  detectOffHoursSale,
  checkNegativeStockSale,
} from './anomaly-detection';

export {
  extractCashierFeatures,
  buildFeatureMatrix,
  detectOutliers,
  updateCashierRiskScores,
  getCashierRiskProfile,
  runMLAnomalyDetection,
  IsolationForest,
} from './ml-anomaly';

export {
  SYNC_VERSION,
  MIN_COMPATIBLE_VERSION,
  recordSyncEvent,
  getEventsForDeltaSync,
  applyDeltaSync,
  replaySyncEvents,
  getSyncVersions,
  createSyncVersion,
  getDeviceSyncStatus,
  resolveSyncConflict,
  buildDeltaPayload,
  getSyncConflictSummary,
  type SyncPayload,
  type SyncOperation,
  type DeltaSyncResult,
  type SyncEvent,
  type SyncVersion,
} from './enhanced-sync';