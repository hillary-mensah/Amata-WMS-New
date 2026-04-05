import { PaymentMethod } from '@nexus/types';
import { type SyncConflict } from './conflict-resolution';
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
export declare function syncOfflineSales(organisationId: string, branchId: string, userId: string, offlineSales: OfflineSale[]): Promise<SyncResult>;
export declare function getServerChanges(organisationId: string, since?: Date): Promise<ServerChange[]>;
export declare function generateLocalId(): string;
export { resolveStockConflicts, runReconciliation, ConflictType, ConflictResolution, } from './conflict-resolution';
export { computeInventoryFromEvents, verifyDigitalTwin, getDiscrepancyAlerts, resolveDiscrepancy, reconcileInventory, } from './digital-twin';
export { runAnomalyDetection, createAnomaly, resolveAnomaly, analyzeCashierBehavior, detectExcessRefunds, detectDiscountAbuse, detectSuspiciousVoids, detectHighCashTransaction, detectOffHoursSale, checkNegativeStockSale, } from './anomaly-detection';
export { extractCashierFeatures, buildFeatureMatrix, detectOutliers, updateCashierRiskScores, getCashierRiskProfile, runMLAnomalyDetection, IsolationForest, } from './ml-anomaly';
export { SYNC_VERSION, MIN_COMPATIBLE_VERSION, recordSyncEvent, getEventsForDeltaSync, applyDeltaSync, replaySyncEvents, getSyncVersions, createSyncVersion, getDeviceSyncStatus, resolveSyncConflict, buildDeltaPayload, getSyncConflictSummary, type SyncPayload, type SyncOperation, type DeltaSyncResult, type SyncEvent, type SyncVersion, } from './enhanced-sync';
//# sourceMappingURL=index.d.ts.map