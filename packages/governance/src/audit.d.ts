export interface AuditEntry {
    action: string;
    entityType: string;
    entityId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    changes?: Array<{
        field: string;
        from: unknown;
        to: unknown;
    }>;
}
export declare function logAuditEvent(organisationId: string, userId: string, entry: AuditEntry, sessionId?: string, ipAddress?: string, userAgent?: string): Promise<string>;
export declare function verifyAuditIntegrity(organisationId: string, fromDate?: Date, toDate?: Date): Promise<{
    valid: boolean;
    brokenAt?: Date;
    totalRecords: number;
    firstHash?: string;
    lastHash?: string;
}>;
export declare function replayAuditEvents(organisationId: string, fromDate?: Date, toDate?: Date, onEvent?: (log: Awaited<ReturnType<typeof getAuditLogById>>) => Promise<void>): Promise<{
    replayed: number;
    failed: number;
    errors: string[];
}>;
export declare function getAuditLogById(id: string): Promise<({
    user: {
        email: string;
        firstName: string;
        lastName: string;
    };
} & {
    id: string;
    createdAt: Date;
    userId: string;
    organisationId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    oldValues: import("@prisma/client/runtime/library").JsonValue | null;
    newValues: import("@prisma/client/runtime/library").JsonValue | null;
    changes: import("@prisma/client/runtime/library").JsonValue;
    ipAddress: string | null;
    userAgent: string | null;
    sessionId: string | null;
    hash: string;
    previousHash: string | null;
    version: number;
    isImmutable: boolean;
}) | null>;
export declare function queryAuditLogs(organisationId: string, options: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
}): Promise<{
    logs: ({
        user: {
            email: string;
            firstName: string;
            lastName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        organisationId: string;
        action: string;
        entityType: string;
        entityId: string | null;
        oldValues: import("@prisma/client/runtime/library").JsonValue | null;
        newValues: import("@prisma/client/runtime/library").JsonValue | null;
        changes: import("@prisma/client/runtime/library").JsonValue;
        ipAddress: string | null;
        userAgent: string | null;
        sessionId: string | null;
        hash: string;
        previousHash: string | null;
        version: number;
        isImmutable: boolean;
    })[];
    total: number;
    limit: number;
    offset: number;
}>;
export declare function createRetentionPolicy(organisationId: string, policy: {
    name: string;
    entityType: string;
    retentionDays: number;
    archiveAfterDays?: number;
    deleteAfterDays?: number;
    actionOnExpiry?: 'ARCHIVE' | 'DELETE' | 'NOTIFY';
}): Promise<string>;
export declare function getRetentionPolicies(organisationId: string): Promise<{
    id: string;
    createdAt: Date;
    organisationId: string;
    isActive: boolean;
    updatedAt: Date;
    name: string;
    entityType: string;
    retentionDays: number;
    archiveAfterDays: number;
    deleteAfterDays: number;
    actionOnExpiry: string;
}[]>;
export declare function updateRetentionPolicy(policyId: string, organisationId: string, updates: Partial<{
    name: string;
    retentionDays: number;
    archiveAfterDays: number;
    deleteAfterDays: number;
    actionOnExpiry: string;
    isActive: boolean;
}>): Promise<void>;
export declare function archiveExpiredData(organisationId: string): Promise<{
    archived: number;
    errors: string[];
}>;
export declare function restoreArchivedData(archiveId: string, organisationId: string): Promise<{
    success: boolean;
    message: string;
}>;
export declare function getArchivedData(organisationId: string, entityType?: string, isRestored?: boolean): Promise<{
    id: string;
    organisationId: string;
    entityType: string;
    entityId: string;
    archivedData: import("@prisma/client/runtime/library").JsonValue;
    originalHash: string | null;
    archivedAt: Date;
    restoreHash: string | null;
    isRestored: boolean;
    restoredAt: Date | null;
}[]>;
export declare function deleteExpiredData(organisationId: string): Promise<{
    deleted: number;
    errors: string[];
}>;
export declare function getComplianceReport(organisationId: string, startDate: Date, endDate: Date): Promise<{
    totalAuditEntries: number;
    integrityValid: boolean;
    policiesActive: number;
    recordsArchived: number;
    dataByEntity: Record<string, number>;
}>;
//# sourceMappingURL=audit.d.ts.map