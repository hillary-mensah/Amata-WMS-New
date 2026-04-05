export declare enum ConflictType {
    DUPLICATE = "DUPLICATE",
    STOCK_MISMATCH = "STOCK_MISMATCH",
    TIMESTAMP_CONFLICT = "TIMESTAMP_CONFLICT",
    NEGATIVE_STOCK = "NEGATIVE_STOCK",
    DATA_CORRUPTION = "DATA_CORRUPTION"
}
export declare enum ConflictResolution {
    IGNORED = "IGNORED",
    SERVER_WINS = "SERVER_WINS",
    LOCAL_WINS = "LOCAL_WINS",
    RECONCILED = "RECONCILED",
    NEEDS_REVIEW = "NEEDS_REVIEW"
}
export interface SyncConflict {
    id: string;
    type: ConflictType;
    entityId: string;
    entityType: 'SALE' | 'INVENTORY' | 'PRODUCT' | 'BATCH';
    localData: Record<string, unknown>;
    serverData: Record<string, unknown>;
    resolution: ConflictResolution;
    resolvedAt?: Date;
    metadata?: Record<string, unknown>;
}
export interface ConflictRule {
    type: ConflictType;
    detect: (local: unknown, server: unknown) => boolean;
    resolve: (local: unknown, server: unknown, context: ConflictContext) => Promise<ConflictResolution>;
}
export interface ConflictContext {
    organisationId: string;
    branchId?: string;
    userId: string;
    timestamp: Date;
}
export declare class DeterministicConflictEngine {
    private rules;
    constructor();
    private registerRules;
    detectConflict(localData: unknown, serverData: unknown, entityType: string): Promise<SyncConflict | null>;
    private rebuildStockFromEvents;
    private createReconciliationJob;
}
export declare function processSyncWithConflictResolution(organisationId: string, branchId: string, userId: string, offlineSales: unknown[]): Promise<{
    success: boolean;
    synced: number;
    conflicts: SyncConflict[];
    errors: string[];
}>;
export declare function resolveStockConflicts(organisationId: string): Promise<{
    resolved: number;
    failed: number;
    negativeStocks: Array<{
        inventoryId: string;
        productId: string;
        currentQty: number;
    }>;
}>;
export declare function runReconciliation(organisationId: string): Promise<{
    stockRebuilt: number;
    conflictsResolved: number;
    timestamp: Date;
}>;
export declare function generateLocalId(): string;
export declare function validateIdempotencyKey(key: string): boolean;
//# sourceMappingURL=conflict-resolution.d.ts.map