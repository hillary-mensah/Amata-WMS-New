import { db } from '@nexus/db';
import { createHash } from 'crypto';
import { processSyncWithConflictResolution } from './conflict-resolution.js';
export const SYNC_VERSION = 3;
export const MIN_COMPATIBLE_VERSION = 1;
function hashData(data) {
    return createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex')
        .slice(0, 16);
}
function computeChecksum(operations) {
    const combined = operations
        .map((op) => op.checksum)
        .sort()
        .join('|');
    return hashData(combined);
}
export async function recordSyncEvent(organisationId, userId, eventType, entityType, entityId, data, previousData, deviceId, branchId) {
    const eventHash = hashData({
        organisationId,
        entityType,
        entityId,
        data,
        timestamp: new Date().toISOString(),
    });
    const latestEvent = await db.syncEvent.findFirst({
        where: { entityType, entityId, organisationId },
        orderBy: { version: 'desc' },
    });
    const version = (latestEvent?.version || 0) + 1;
    const event = await db.syncEvent.create({
        data: {
            organisationId,
            userId,
            eventType,
            entityType,
            entityId,
            eventData: data,
            previousData,
            deviceId,
            branchId,
            version,
            eventHash,
        },
    });
    return event.id;
}
export async function getEventsForDeltaSync(organisationId, entityTypes, sinceVersion, limit = 1000) {
    const events = await db.syncEvent.findMany({
        where: {
            organisationId,
            entityType: { in: entityTypes },
            version: { gt: sinceVersion },
            isReplayed: false,
        },
        orderBy: { timestamp: 'asc' },
        take: limit,
    });
    return events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        entityType: e.entityType,
        entityId: e.entityId,
        eventData: e.eventData,
        previousData: e.previousData,
        userId: e.userId,
        deviceId: e.deviceId || undefined,
        branchId: e.branchId || undefined,
        organisationId: e.organisationId,
        timestamp: e.timestamp,
        version: e.version,
        eventHash: e.eventHash,
    }));
}
export async function applyDeltaSync(organisationId, branchId, userId, deviceId, payload) {
    const { version, baseVersion, operations, checksum } = payload;
    if (version < MIN_COMPATIBLE_VERSION) {
        return {
            success: false,
            synced: 0,
            conflicts: [],
            serverChanges: [],
            newVersion: version,
            checksum: '',
        };
    }
    const clientChecksum = computeChecksum(operations);
    if (clientChecksum !== checksum) {
        return {
            success: false,
            synced: 0,
            conflicts: [],
            serverChanges: [],
            newVersion: version,
            checksum: '',
        };
    }
    const salesToSync = operations
        .filter((op) => op.entityType === 'SALE' && (op.type === 'CREATE' || op.type === 'UPDATE'))
        .map((op) => ({
        localId: op.entityId,
        idempotencyKey: op.data.receiptNumber || op.entityId,
        items: op.data.items || [],
        paymentMethod: op.data.paymentMethod || 'CASH',
        createdAt: op.timestamp,
    }));
    const syncResult = await processSyncWithConflictResolution(organisationId, branchId, userId, salesToSync);
    for (const op of operations) {
        try {
            await recordSyncEvent(organisationId, userId, op.type, op.entityType, op.entityId, op.data, undefined, deviceId, branchId);
        }
        catch (error) {
            console.error('Failed to record sync event:', error);
        }
    }
    const entityTypes = ['SALE', 'INVENTORY', 'PRODUCT'];
    const serverChanges = await getEventsForDeltaSync(organisationId, entityTypes, baseVersion || 0, 500);
    const newVersion = version + 1;
    const newChecksum = computeChecksum(serverChanges.map((e) => ({
        id: e.id,
        checksum: e.eventHash,
    })));
    return {
        success: syncResult.success,
        synced: syncResult.synced,
        conflicts: syncResult.conflicts,
        serverChanges,
        newVersion,
        checksum: newChecksum,
    };
}
export async function replaySyncEvents(organisationId, eventIds, dryRun = false) {
    let replayed = 0;
    let failed = 0;
    const errors = [];
    for (const eventId of eventIds) {
        try {
            const event = await db.syncEvent.findUnique({
                where: { id: eventId },
            });
            if (!event) {
                errors.push(`Event ${eventId} not found`);
                failed++;
                continue;
            }
            if (event.isReplayed) {
                continue;
            }
            if (!dryRun) {
                await db.syncEvent.update({
                    where: { id: eventId },
                    data: { isReplayed: true, replayedAt: new Date() },
                });
            }
            replayed++;
        }
        catch (error) {
            errors.push(`Failed to replay ${eventId}: ${error}`);
            failed++;
        }
    }
    return { replayed, failed, errors };
}
export async function getSyncVersions() {
    const versions = await db.syncVersion.findMany({
        where: { isActive: true },
        orderBy: { version: 'desc' },
    });
    return versions.map((v) => ({
        version: v.version,
        minAppVersion: v.minAppVersion,
        changes: v.changes,
    }));
}
export async function createSyncVersion(version, minAppVersion, changes) {
    await db.syncVersion.create({
        data: {
            version,
            minAppVersion,
            changes,
        },
    });
}
export async function getDeviceSyncStatus(deviceId) {
    const syncLog = await db.syncLog.findFirst({
        where: { deviceId },
        orderBy: { createdAt: 'desc' },
    });
    const pendingConflicts = await db.syncConflict.count({
        where: { resolution: 'PENDING' },
    });
    const pendingEvents = await db.syncEvent.count({
        where: { isReplayed: false },
    });
    return {
        lastSyncAt: syncLog?.completedAt || null,
        syncVersion: syncLog?.syncVersion || 1,
        pendingConflicts,
        pendingEvents,
    };
}
export async function resolveSyncConflict(conflictId, resolution, userId) {
    const conflict = await db.syncConflict.findUnique({
        where: { id: conflictId },
    });
    if (!conflict)
        return;
    if (resolution === 'IGNORE') {
        await db.syncConflict.update({
            where: { id: conflictId },
            data: { resolution: 'IGNORED', resolvedAt: new Date() },
        });
        return;
    }
    if (resolution === 'SERVER_WINS') {
        await db.syncConflict.update({
            where: { id: conflictId },
            data: { resolution: 'SERVER_WINS', resolvedAt: new Date() },
        });
    }
    if (resolution === 'LOCAL_WINS') {
        const serverData = conflict.serverData;
        const localData = conflict.localData;
        const merged = { ...serverData, ...localData };
        await db.syncConflict.update({
            where: { id: conflictId },
            data: { resolution: 'LOCAL_WINS', resolvedAt: new Date() },
        });
        if (conflict.entityType === 'SALE') {
            await db.sale.update({
                where: { id: conflict.entityId },
                data: merged,
            });
        }
    }
}
export async function buildDeltaPayload(organisationId, baseVersion, deviceId) {
    const entityTypes = ['SALE', 'INVENTORY', 'PRODUCT', 'PRODUCT_BATCH'];
    const events = await getEventsForDeltaSync(organisationId, entityTypes, baseVersion);
    const operations = events.map((event) => ({
        id: event.id,
        type: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        data: event.eventData,
        timestamp: event.timestamp.toISOString(),
        version: event.version,
        checksum: event.eventHash,
    }));
    const checksum = computeChecksum(operations);
    return {
        version: SYNC_VERSION,
        baseVersion,
        deviceId,
        operations,
        timestamp: new Date().toISOString(),
        checksum,
    };
}
export async function getSyncConflictSummary(organisationId) {
    const conflicts = await db.syncConflict.findMany({
        where: { organisationId },
    });
    const byType = {};
    const byStatus = {};
    const byResolution = {};
    for (const conflict of conflicts) {
        byType[conflict.type] = (byType[conflict.type] || 0) + 1;
        byStatus['PENDING'] = (byStatus['PENDING'] || 0) + (conflict.resolution === 'PENDING' ? 1 : 0);
        byResolution[conflict.resolution] = (byResolution[conflict.resolution] || 0) + 1;
    }
    return {
        total: conflicts.length,
        byType,
        byStatus,
        byResolution,
    };
}
//# sourceMappingURL=enhanced-sync.js.map