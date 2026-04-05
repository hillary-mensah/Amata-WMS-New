import { db } from '@nexus/db';
import { DiscrepancyType } from '@nexus/types';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
export async function computeInventoryFromEvents(inventoryId, productId, branchId) {
    const adjustments = await db.inventoryAdjustment.findMany({
        where: { productId, branchId, createdAt: { gte: new Date(Date.now() - THIRTY_DAYS) } },
        select: { quantity: true },
    });
    const sales = await db.saleItem.findMany({
        where: {
            productId,
            sale: {
                branchId,
                status: 'COMPLETED',
                createdAt: { gte: new Date(Date.now() - THIRTY_DAYS) },
            },
        },
        select: { quantity: true },
    });
    const transfersOut = await db.inventoryTransferItem.findMany({
        where: {
            productId,
            transfer: { fromBranchId: branchId, status: 'COMPLETED', completedAt: { gte: new Date(Date.now() - THIRTY_DAYS) } },
        },
        select: { quantity: true },
    });
    const transfersIn = await db.inventoryTransferItem.findMany({
        where: {
            productId,
            transfer: { toBranchId: branchId, status: 'COMPLETED', completedAt: { gte: new Date(Date.now() - THIRTY_DAYS) } },
        },
        select: { quantity: true },
    });
    const initialStock = 0;
    const adjustmentQty = adjustments.reduce((sum, a) => sum + a.quantity, 0);
    const salesQty = sales.reduce((sum, s) => sum + s.quantity, 0);
    const transferOutQty = transfersOut.reduce((sum, t) => sum + t.quantity, 0);
    const transferInQty = transfersIn.reduce((sum, t) => sum + t.quantity, 0);
    return initialStock + adjustmentQty - salesQty - transferOutQty + transferInQty;
}
export async function verifyDigitalTwin(organisationId, branchId) {
    const whereClause = branchId
        ? { branch: { organisationId, id: branchId } }
        : { branch: { organisationId } };
    const inventories = await db.inventory.findMany({
        where: whereClause,
        include: { product: { select: { name: true } } },
    });
    const results = [];
    for (const inv of inventories) {
        const computedQty = await computeInventoryFromEvents(inv.id, inv.productId, inv.branchId);
        const difference = inv.quantity - computedQty;
        const isBalanced = difference === 0;
        if (!isBalanced) {
            await db.inventoryDiscrepancy.create({
                data: {
                    inventoryId: inv.id,
                    type: DiscrepancyType.SYNC_ERROR,
                    actualQuantity: inv.quantity,
                    expectedQuantity: computedQty,
                    difference,
                    status: DiscrepancyStatus.PENDING,
                },
            });
        }
        await db.inventory.update({
            where: { id: inv.id },
            data: { computedQuantity: computedQty, lastComputedAt: new Date() },
        });
        results.push({
            inventoryId: inv.id,
            productId: inv.productId,
            branchId: inv.branchId,
            actualQuantity: inv.quantity,
            computedQuantity: computedQty,
            difference,
            isBalanced,
        });
    }
    return results;
}
export async function getDiscrepancyAlerts(organisationId, status) {
    const whereClause = {
        inventory: { branch: { organisationId } },
    };
    if (status) {
        whereClause.status = status;
    }
    const discrepancies = await db.inventoryDiscrepancy.findMany({
        where: whereClause,
        include: {
            inventory: {
                include: { product: { select: { name: true } }, branch: { select: { name: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    return discrepancies.map((d) => ({
        inventoryId: d.inventoryId,
        productId: d.inventory.productId,
        branchId: d.inventory.branchId,
        productName: d.inventory.product.name,
        actualQuantity: d.actualQuantity,
        computedQuantity: d.expectedQuantity,
        difference: d.difference,
        type: d.type,
    }));
}
export async function resolveDiscrepancy(discrepancyId, resolution, resolvedById, notes) {
    await db.inventoryDiscrepancy.update({
        where: { id: discrepancyId },
        data: { status: resolution, resolvedAt: new Date(), resolvedById, notes },
    });
}
export async function reconcileInventory(inventoryId, actualQuantity, resolvedById, type, notes) {
    const inventory = await db.inventory.findUnique({ where: { id: inventoryId } });
    if (!inventory)
        throw new Error('Inventory not found');
    const computedQty = await computeInventoryFromEvents(inventoryId, inventory.productId, inventory.branchId);
    const difference = actualQuantity - computedQty;
    await db.inventoryDiscrepancy.create({
        data: {
            inventoryId,
            type,
            actualQuantity,
            expectedQuantity: computedQty,
            difference,
            status: DiscrepancyStatus.RESOLVED,
            resolvedAt: new Date(),
            resolvedById,
            notes: notes || `Reconciled to ${actualQuantity}`,
        },
    });
    await db.inventory.update({
        where: { id: inventoryId },
        data: { quantity: actualQuantity, computedQuantity: computedQty, lastComputedAt: new Date() },
    });
}
//# sourceMappingURL=digital-twin.js.map