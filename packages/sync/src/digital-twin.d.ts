import { DiscrepancyType, DiscrepancyStatus } from '@nexus/types';
export interface DigitalTwinResult {
    inventoryId: string;
    productId: string;
    branchId: string;
    actualQuantity: number;
    computedQuantity: number;
    difference: number;
    isBalanced: boolean;
}
export interface DiscrepancyAlert {
    inventoryId: string;
    productId: string;
    branchId: string;
    productName: string;
    actualQuantity: number;
    computedQuantity: number;
    difference: number;
    type: DiscrepancyType;
}
export declare function computeInventoryFromEvents(inventoryId: string, productId: string, branchId: string): Promise<number>;
export declare function verifyDigitalTwin(organisationId: string, branchId?: string): Promise<DigitalTwinResult[]>;
export declare function getDiscrepancyAlerts(organisationId: string, status?: DiscrepancyStatus): Promise<DiscrepancyAlert[]>;
export declare function resolveDiscrepancy(discrepancyId: string, resolution: DiscrepancyStatus, resolvedById: string, notes?: string): Promise<void>;
export declare function reconcileInventory(inventoryId: string, actualQuantity: number, resolvedById: string, type: DiscrepancyType, notes?: string): Promise<void>;
//# sourceMappingURL=digital-twin.d.ts.map