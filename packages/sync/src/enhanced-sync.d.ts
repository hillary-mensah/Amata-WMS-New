import { type SyncConflict } from './conflict-resolution';
export declare const SYNC_VERSION = 3;
export declare const MIN_COMPATIBLE_VERSION = 1;
export interface SyncPayload {
    version: number;
    baseVersion?: number;
    deviceId: string;
    operations: SyncOperation[];
    timestamp: string;
    checksum: string;
}
export interface SyncOperation {
    id: string;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    entityType: 'SALE' | 'INVENTORY' | 'PRODUCT' | 'PRODUCT_BATCH' | 'INVENTORY_ADJUSTMENT';
    entityId: string;
    data: Record<string, unknown>;
    timestamp: string;
    version: number;
    checksum: string;
}
export interface DeltaSyncResult {
    success: boolean;
    synced: number;
    conflicts: SyncConflict[];
    serverChanges: SyncEvent[];
    newVersion: number;
    checksum: string;
}
export interface SyncEvent {
    id: string;
    eventType: string;
    entityType: string;
    entityId: string;
    eventData: Record<string, unknown>;
    previousData?: Record<string, unknown>;
    userId: string;
    deviceId?: string;
    branchId?: string;
    organisationId: string;
    timestamp: Date;
    version: number;
    eventHash: string;
}
export interface SyncVersion {
    version: number;
    minAppVersion: string;
    changes: string[];
}
export declare function recordSyncEvent(organisationId: string, userId: string, eventType: string, entityType: string, entityId: string, data: Record<string, unknown>, previousData?: Record<string, unknown>, deviceId?: string, branchId?: string): Promise<string>;
export declare function getEventsForDeltaSync(organisationId: string, entityTypes: string[], sinceVersion: number, limit?: number): Promise<SyncEvent[]>;
export declare function applyDeltaSync(organisationId: string, branchId: string, userId: string, deviceId: string, payload: SyncPayload): Promise<DeltaSyncResult>;
export declare function replaySyncEvents(organisationId: string, eventIds: string[], dryRun?: boolean): Promise<{
    replayed: number;
    failed: number;
    errors: string[];
}>;
export declare function getSyncVersions(): Promise<SyncVersion[]>;
export declare function createSyncVersion(version: number, minAppVersion: string, changes: string[]): Promise<void>;
export declare function getDeviceSyncStatus(deviceId: string): Promise<{
    lastSyncAt: Date | null;
    syncVersion: number;
    pendingConflicts: number;
    pendingEvents: number;
}>;
export declare function resolveSyncConflict(conflictId: string, resolution: 'SERVER_WINS' | 'LOCAL_WINS' | 'IGNORE', userId: string): Promise<void>;
export declare function buildDeltaPayload(organisationId: string, baseVersion: number, deviceId: string): Promise<SyncPayload>;
export declare function getSyncConflictSummary(organisationId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byResolution: Record<string, number>;
}>;
//# sourceMappingURL=enhanced-sync.d.ts.map