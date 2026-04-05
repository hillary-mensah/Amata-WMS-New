import { v4 as uuidv4 } from 'uuid';
import { db } from '@nexus/db';
export var ConflictType;
(function (ConflictType) {
    ConflictType["DUPLICATE"] = "DUPLICATE";
    ConflictType["STOCK_MISMATCH"] = "STOCK_MISMATCH";
    ConflictType["TIMESTAMP_CONFLICT"] = "TIMESTAMP_CONFLICT";
    ConflictType["NEGATIVE_STOCK"] = "NEGATIVE_STOCK";
    ConflictType["DATA_CORRUPTION"] = "DATA_CORRUPTION";
})(ConflictType || (ConflictType = {}));
export var ConflictResolution;
(function (ConflictResolution) {
    ConflictResolution["IGNORED"] = "IGNORED";
    ConflictResolution["SERVER_WINS"] = "SERVER_WINS";
    ConflictResolution["LOCAL_WINS"] = "LOCAL_WINS";
    ConflictResolution["RECONCILED"] = "RECONCILED";
    ConflictResolution["NEEDS_REVIEW"] = "NEEDS_REVIEW";
})(ConflictResolution || (ConflictResolution = {}));
export class DeterministicConflictEngine {
    rules = [];
    constructor() {
        this.registerRules();
    }
    registerRules() {
        this.rules = [
            {
                type: ConflictType.DUPLICATE,
                detect: (local, server) => {
                    const l = local;
                    const s = server;
                    return !!(l.id && l.id === s?.id) ||
                        !!(l.idempotencyKey && l.idempotencyKey === s?.receiptNumber) ||
                        !!(l.localId && l.localId === s?.id);
                },
                resolve: async () => ConflictResolution.IGNORED,
            },
            {
                type: ConflictType.STOCK_MISMATCH,
                detect: (local, server) => {
                    const l = local;
                    const s = server;
                    const localQty = l.quantity || 0;
                    const serverQty = s.quantity || s.remainingQty || 0;
                    return Math.abs(localQty - serverQty) > 0;
                },
                resolve: async (local, server, context) => {
                    await this.rebuildStockFromEvents(context.organisationId, local.productId || '', context.branchId || '');
                    return ConflictResolution.RECONCILED;
                },
            },
            {
                type: ConflictType.TIMESTAMP_CONFLICT,
                detect: (local, server) => {
                    const l = local;
                    const s = server;
                    if (!l.createdAt || !s.createdAt)
                        return false;
                    const localTime = new Date(l.createdAt).getTime();
                    const serverTime = new Date(s.createdAt).getTime();
                    return Math.abs(localTime - serverTime) < 1000;
                },
                resolve: async () => ConflictResolution.SERVER_WINS,
            },
            {
                type: ConflictType.NEGATIVE_STOCK,
                detect: (local, server) => {
                    const l = local;
                    return (l.quantity || 0) < 0;
                },
                resolve: async (local, server, context) => {
                    await this.createReconciliationJob(context.organisationId);
                    return ConflictResolution.NEEDS_REVIEW;
                },
            },
        ];
    }
    async detectConflict(localData, serverData, entityType) {
        for (const rule of this.rules) {
            if (rule.detect(localData, serverData)) {
                const resolution = await rule.resolve(localData, serverData, {
                    organisationId: '',
                    userId: '',
                    timestamp: new Date(),
                });
                return {
                    id: uuidv4(),
                    type: rule.type,
                    entityId: localData?.id || uuidv4(),
                    entityType: entityType,
                    localData: localData,
                    serverData: serverData,
                    resolution,
                };
            }
        }
        return null;
    }
    async rebuildStockFromEvents(organisationId, productId, branchId) {
        const inventory = await db.inventory.findFirst({
            where: { productId, branchId },
        });
        if (!inventory)
            return;
        const sales = await db.saleItem.findMany({
            where: {
                productId,
                sale: {
                    branchId,
                    status: 'COMPLETED',
                    createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
                },
            },
            include: { sale: { select: { createdAt: true } } },
            orderBy: { sale: { createdAt: 'asc' } },
        });
        const adjustments = await db.inventoryAdjustment.findMany({
            where: { productId, branchId },
            orderBy: { createdAt: 'asc' },
        });
        const transfersOut = await db.inventoryTransferItem.findMany({
            where: {
                productId,
                transfer: { fromBranchId: branchId, status: 'COMPLETED' },
            },
            include: { transfer: { select: { completedAt: true } } },
        });
        const transfersIn = await db.inventoryTransferItem.findMany({
            where: {
                productId,
                transfer: { toBranchId: branchId, status: 'COMPLETED' },
            },
            include: { transfer: { select: { completedAt: true } } },
        });
        const initialStock = adjustments.reduce((sum, adj) => sum + adj.quantity, 0);
        const salesQty = sales.reduce((sum, s) => sum + s.quantity, 0);
        const transferOutQty = transfersOut.reduce((sum, t) => sum + t.quantity, 0);
        const transferInQty = transfersIn.reduce((sum, t) => sum + t.quantity, 0);
        const calculatedQty = initialStock - salesQty - transferOutQty + transferInQty;
        await db.inventory.update({
            where: { id: inventory.id },
            data: { quantity: Math.max(0, calculatedQty) },
        });
    }
    async createReconciliationJob(organisationId) {
        await db.syncConflict.create({
            data: {
                organisationId,
                type: ConflictType.NEGATIVE_STOCK,
                entityId: 'system',
                entityType: 'INVENTORY',
                localData: {},
                serverData: {},
                resolution: 'PENDING',
            },
        });
    }
}
export async function processSyncWithConflictResolution(organisationId, branchId, userId, offlineSales) {
    const engine = new DeterministicConflictEngine();
    const conflicts = [];
    const errors = [];
    let synced = 0;
    for (const offlineSale of offlineSales) {
        try {
            const existingSale = await db.sale.findFirst({
                where: {
                    organisationId,
                    OR: [
                        { id: offlineSale.localId },
                        { receiptNumber: offlineSale.idempotencyKey },
                    ],
                },
            });
            if (existingSale) {
                const conflict = await engine.detectConflict({ ...offlineSale, id: offlineSale.localId }, existingSale, 'SALE');
                if (conflict) {
                    conflict.organisationId = organisationId;
                    conflict.branchId = branchId;
                    conflict.userId = userId;
                    conflict.timestamp = new Date();
                    conflicts.push(conflict);
                    if (conflict.resolution === ConflictResolution.IGNORED) {
                        continue;
                    }
                }
            }
            for (const item of offlineSale.items) {
                const inventory = await db.inventory.findFirst({
                    where: {
                        productId: item.productId,
                        branchId,
                    },
                });
                if (!inventory) {
                    errors.push(`Inventory not found for product ${item.productId}`);
                    continue;
                }
                const currentQty = inventory.quantity;
                const conflict = await engine.detectConflict({ quantity: currentQty - item.quantity }, { quantity: currentQty }, 'INVENTORY');
                if (conflict && conflict.resolution === ConflictResolution.NEEDS_REVIEW) {
                    conflict.organisationId = organisationId;
                    conflict.entityId = inventory.id;
                    conflicts.push(conflict);
                }
                await db.inventory.update({
                    where: { id: inventory.id },
                    data: { quantity: { decrement: item.quantity } },
                });
            }
            const totalAmount = offlineSale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
            await db.sale.create({
                data: {
                    id: offlineSale.localId,
                    receiptNumber: offlineSale.idempotencyKey,
                    totalAmount,
                    taxAmount: totalAmount * 0.2,
                    status: 'COMPLETED',
                    paymentMethod: 'CASH',
                    userId,
                    organisationId,
                    branchId,
                },
            });
            synced++;
        }
        catch (error) {
            errors.push(`Failed to sync ${offlineSale.localId}: ${error}`);
        }
    }
    return {
        success: errors.length === 0,
        synced,
        conflicts,
        errors,
    };
}
export async function resolveStockConflicts(organisationId) {
    const negativeInventories = await db.$queryRaw < Array `
    SELECT i.id, i.product_id, i.quantity 
    FROM "Inventory" i
    WHERE i.quantity < 0
  `;
    let resolved = 0;
    let failed = 0;
    const negativeStocks = [];
    for (const inv of negativeInventories) {
        try {
            const sales = await db.saleItem.groupBy({
                by: ['productId'],
                where: {
                    productId: inv.product_id,
                    sale: {
                        organisationId,
                        status: 'COMPLETED',
                    },
                },
                _sum: { quantity: true },
            });
            const totalSold = sales.reduce((sum, s) => sum + (s._sum.quantity || 0), 0);
            const adjustments = await db.inventoryAdjustment.groupBy({
                by: ['productId'],
                where: {
                    productId: inv.product_id,
                },
                _sum: { quantity: true },
            });
            const totalAdjusted = adjustments.reduce((sum, a) => sum + (a._sum.quantity || 0), 0);
            const calculatedQty = totalAdjusted - totalSold;
            await db.inventory.update({
                where: { id: inv.id },
                data: { quantity: Math.max(0, calculatedQty) },
            });
            resolved++;
        }
        catch (error) {
            failed++;
            negativeStocks.push({
                inventoryId: inv.id,
                productId: inv.product_id,
                currentQty: Number(inv.quantity),
            });
        }
    }
    return { resolved, failed, negativeStocks };
}
export async function runReconciliation(organisationId) {
    const inventories = await db.inventory.findMany({
        where: { branch: { organisationId } },
    });
    let stockRebuilt = 0;
    for (const inv of inventories) {
        const result = await resolveStockConflicts(organisationId);
        stockRebuilt += result.resolved;
    }
    return {
        stockRebuilt,
        conflictsResolved: stockRebuilt,
        timestamp: new Date(),
    };
}
export function generateLocalId() {
    return uuidv4();
}
export function validateIdempotencyKey(key) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(key);
}
//# sourceMappingURL=conflict-resolution.js.map