import { v4 as uuidv4 } from 'uuid';
import { db } from '@nexus/db';
import { processSyncWithConflictResolution, } from './conflict-resolution';
export async function syncOfflineSales(organisationId, branchId, userId, offlineSales) {
    const result = {
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
    const syncResult = await processSyncWithConflictResolution(organisationId, branchId, userId, saleData);
    result.success = syncResult.success;
    result.syncedCount = syncResult.synced;
    result.conflicts = syncResult.conflicts;
    return result;
}
export async function getServerChanges(organisationId, since) {
    const changes = [];
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
export function generateLocalId() {
    return uuidv4();
}
export { resolveStockConflicts, runReconciliation, ConflictType, ConflictResolution, } from './conflict-resolution';
export { computeInventoryFromEvents, verifyDigitalTwin, getDiscrepancyAlerts, resolveDiscrepancy, reconcileInventory, } from './digital-twin';
export { runAnomalyDetection, createAnomaly, resolveAnomaly, analyzeCashierBehavior, detectExcessRefunds, detectDiscountAbuse, detectSuspiciousVoids, detectHighCashTransaction, detectOffHoursSale, checkNegativeStockSale, } from './anomaly-detection';
export { extractCashierFeatures, buildFeatureMatrix, detectOutliers, updateCashierRiskScores, getCashierRiskProfile, runMLAnomalyDetection, IsolationForest, } from './ml-anomaly';
export { SYNC_VERSION, MIN_COMPATIBLE_VERSION, recordSyncEvent, getEventsForDeltaSync, applyDeltaSync, replaySyncEvents, getSyncVersions, createSyncVersion, getDeviceSyncStatus, resolveSyncConflict, buildDeltaPayload, getSyncConflictSummary, } from './enhanced-sync';
//# sourceMappingURL=index.js.map