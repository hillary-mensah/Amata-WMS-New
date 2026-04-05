export interface FeatureFlagContext {
    userId: string;
    organisationId: string;
    role: string;
    branchId?: string;
}
export declare function isFeatureEnabled(key: string, context: FeatureFlagContext): Promise<boolean>;
export declare function createFeatureFlag(organisationId: string, flag: {
    key: string;
    name: string;
    description?: string;
    isEnabled?: boolean;
    rolloutPercent?: number;
    targetUsers?: string;
    targetRoles?: string;
    targetBranches?: string;
    expiresAt?: Date;
}): Promise<string>;
export declare function getFeatureFlags(organisationId: string): Promise<{
    id: string;
    description: string | null;
    createdAt: Date;
    organisationId: string;
    metadata: import("@prisma/client/runtime/library").JsonValue;
    updatedAt: Date;
    name: string;
    expiresAt: Date | null;
    key: string;
    isEnabled: boolean;
    rolloutPercent: number;
    targetUsers: string;
    targetRoles: string;
    targetBranches: string;
}[]>;
export declare function toggleFeatureFlag(organisationId: string, key: string, enabled: boolean): Promise<boolean>;
export declare function deleteFeatureFlag(organisationId: string, key: string): Promise<boolean>;
export interface DeploymentConfig {
    version: string;
    environment: string;
    strategy: 'BLUE_GREEN' | 'CANARY' | 'ROLLING';
    canaryPercent?: number;
    rollbackEnabled?: boolean;
    autoRollbackPercent?: number;
}
export declare function createDeployment(organisationId: string, config: DeploymentConfig): Promise<string>;
export declare function startDeployment(deploymentId: string): Promise<void>;
export declare function completeDeployment(deploymentId: string, success: boolean): Promise<void>;
export declare function rollbackDeployment(deploymentId: string): Promise<boolean>;
export declare function recordCanaryMetric(deploymentId: string, metric: {
    metricName: string;
    metricValue: number;
    baselineValue?: number;
    errorRate?: number;
    latencyP95?: number;
    sampleSize?: number;
    tags?: Record<string, string>;
}): Promise<void>;
export declare function checkAutoRollback(deploymentId: string): Promise<{
    shouldRollback: boolean;
    reason?: string;
}>;
export declare function getDeploymentStatus(deploymentId: string): Promise<{
    summary: {
        total: number;
        ok: number;
        error: number;
        slow: number;
        deviation: number;
    };
    avgErrorRate: number;
    avgLatency: number;
    metrics: {
        status: string;
        id: string;
        createdAt: Date;
        metricName: string;
        metricValue: number;
        baselineValue: number | null;
        deviation: number | null;
        errorRate: number;
        latencyP95: number;
        sampleSize: number;
        tags: import("@prisma/client/runtime/library").JsonValue;
        deploymentId: string;
    }[];
    status: string;
    id: string;
    createdAt: Date;
    organisationId: string;
    notes: string | null;
    version: string;
    completedAt: Date | null;
    environment: string;
    strategy: string;
    canaryPercent: number;
    rollbackEnabled: boolean;
    autoRollbackPercent: number;
    startedAt: Date | null;
} | null>;
export declare function getDeployments(organisationId: string, limit?: number): Promise<{
    status: string;
    id: string;
    createdAt: Date;
    organisationId: string;
    notes: string | null;
    version: string;
    completedAt: Date | null;
    environment: string;
    strategy: string;
    canaryPercent: number;
    rollbackEnabled: boolean;
    autoRollbackPercent: number;
    startedAt: Date | null;
}[]>;
//# sourceMappingURL=index.d.ts.map