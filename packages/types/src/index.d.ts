import { z } from 'zod';
export declare const VAT_RATE = 0.15;
export declare const NHIL_RATE = 0.025;
export declare const GETFUND_RATE = 0.025;
export declare const TOTAL_TAX_RATE: number;
export declare const GhanaTaxBreakdownSchema: z.ZodObject<{
    subtotal: z.ZodNumber;
    vat: z.ZodNumber;
    nhil: z.ZodNumber;
    getfund: z.ZodNumber;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    subtotal: number;
    vat: number;
    nhil: number;
    getfund: number;
}, {
    total: number;
    subtotal: number;
    vat: number;
    nhil: number;
    getfund: number;
}>;
export type GhanaTaxBreakdown = z.infer<typeof GhanaTaxBreakdownSchema>;
export declare function calculateGhanaTax(subtotal: number): GhanaTaxBreakdown;
export declare const RoleSchema: z.ZodEnum<["SUPER_ADMIN", "ORG_ADMIN", "BRANCH_MANAGER", "CASHIER", "WAREHOUSE", "AUDITOR"]>;
export type Role = z.infer<typeof RoleSchema>;
export declare const DeviceStatusSchema: z.ZodEnum<["ACTIVE", "INACTIVE", "MAINTENANCE"]>;
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;
export declare const SaleStatusSchema: z.ZodEnum<["COMPLETED", "VOIDED", "REFUNDED"]>;
export type SaleStatus = z.infer<typeof SaleStatusSchema>;
export declare const SaleStatus: z.Values<["COMPLETED", "VOIDED", "REFUNDED"]>;
export declare const PaymentMethodSchema: z.ZodEnum<["CASH", "CARD", "MOMO", "MIXED"]>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export declare const PaymentMethod: z.Values<["CASH", "CARD", "MOMO", "MIXED"]>;
export declare const TransactionStatusSchema: z.ZodEnum<["PENDING", "COMPLETED", "FAILED", "REFUNDED"]>;
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;
export declare const TransactionStatus: z.Values<["PENDING", "COMPLETED", "FAILED", "REFUNDED"]>;
export declare const DiscrepancyTypeSchema: z.ZodEnum<["THEFT", "DAMAGE", "EXPIRY", "SPOILAGE", "SYNC_ERROR", "MANUAL_ADJUSTMENT", "UNKNOWN"]>;
export type DiscrepancyType = z.infer<typeof DiscrepancyTypeSchema>;
export declare const DiscrepancyType: z.Values<["THEFT", "DAMAGE", "EXPIRY", "SPOILAGE", "SYNC_ERROR", "MANUAL_ADJUSTMENT", "UNKNOWN"]>;
export declare const DiscrepancyStatusSchema: z.ZodEnum<["PENDING", "INVESTIGATING", "RESOLVED", "WRITE_OFF"]>;
export type DiscrepancyStatus = z.infer<typeof DiscrepancyStatusSchema>;
export declare const AnomalyTypeSchema: z.ZodEnum<["EXCESS_REFUNDS", "DISCOUNT_ABUSE", "SUSPICIOUS_VOID", "UNUSUAL_SALES_PATTERN", "NEGATIVE_STOCK_SALE", "MULTIPLE_Voids_SAME_ITEM", "HIGH_CASH_TRANSACTION", "OFF_HOURS_SALE"]>;
export type AnomalyType = z.infer<typeof AnomalyTypeSchema>;
export declare const AnomalyType: z.Values<["EXCESS_REFUNDS", "DISCOUNT_ABUSE", "SUSPICIOUS_VOID", "UNUSUAL_SALES_PATTERN", "NEGATIVE_STOCK_SALE", "MULTIPLE_Voids_SAME_ITEM", "HIGH_CASH_TRANSACTION", "OFF_HOURS_SALE"]>;
export declare const AnomalySeveritySchema: z.ZodEnum<["LOW", "MEDIUM", "HIGH", "CRITICAL"]>;
export type AnomalySeverity = z.infer<typeof AnomalySeveritySchema>;
export declare const AnomalyStatusSchema: z.ZodEnum<["DETECTED", "INVESTIGATING", "CONFIRMED_FRAUD", "FALSE_POSITIVE", "RESOLVED"]>;
export type AnomalyStatus = z.infer<typeof AnomalyStatusSchema>;
export declare const AnomalyStatus: z.Values<["DETECTED", "INVESTIGATING", "CONFIRMED_FRAUD", "FALSE_POSITIVE", "RESOLVED"]>;
export declare const LoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    deviceId: z.ZodOptional<z.ZodString>;
    deviceName: z.ZodOptional<z.ZodString>;
    deviceType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    deviceType?: string | undefined;
}, {
    email: string;
    password: string;
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    deviceType?: string | undefined;
}>;
export declare const RefreshTokenRequestSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const SetPinRequestSchema: z.ZodObject<{
    pin: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pin: string;
}, {
    pin: string;
}>;
export declare const VerifyPinRequestSchema: z.ZodObject<{
    pin: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pin: string;
}, {
    pin: string;
}>;
export declare const SaleItemSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    discount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
}, {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number | undefined;
}>;
export declare const CreateSaleRequestSchema: z.ZodObject<{
    idempotencyKey: z.ZodString;
    branchId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        discount: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
        unitPrice: number;
        discount: number;
    }, {
        productId: string;
        quantity: number;
        unitPrice: number;
        discount?: number | undefined;
    }>, "many">;
    paymentMethod: z.ZodDefault<z.ZodEnum<["CASH", "CARD", "MOMO", "MIXED"]>>;
    paymentReference: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    idempotencyKey: string;
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
        discount: number;
    }[];
    paymentMethod: "CASH" | "CARD" | "MOMO" | "MIXED";
    deviceId?: string | undefined;
    paymentReference?: string | undefined;
    notes?: string | undefined;
}, {
    branchId: string;
    idempotencyKey: string;
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
        discount?: number | undefined;
    }[];
    deviceId?: string | undefined;
    paymentMethod?: "CASH" | "CARD" | "MOMO" | "MIXED" | undefined;
    paymentReference?: string | undefined;
    notes?: string | undefined;
}>;
export declare const VoidSaleRequestSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const InventoryAdjustmentSchema: z.ZodObject<{
    productId: z.ZodString;
    branchId: z.ZodString;
    quantity: z.ZodNumber;
    reason: z.ZodString;
    reference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    productId: string;
    quantity: number;
    reason: string;
    reference?: string | undefined;
}, {
    branchId: string;
    productId: string;
    quantity: number;
    reason: string;
    reference?: string | undefined;
}>;
export declare const InventoryTransferSchema: z.ZodObject<{
    fromBranchId: z.ZodString;
    toBranchId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
    }, {
        productId: string;
        quantity: number;
    }>, "many">;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        productId: string;
        quantity: number;
    }[];
    fromBranchId: string;
    toBranchId: string;
    notes?: string | undefined;
}, {
    items: {
        productId: string;
        quantity: number;
    }[];
    fromBranchId: string;
    toBranchId: string;
    notes?: string | undefined;
}>;
export declare const DeviceHeartbeatSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["ACTIVE", "INACTIVE", "MAINTENANCE"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    metadata?: Record<string, unknown> | undefined;
    status?: "ACTIVE" | "INACTIVE" | "MAINTENANCE" | undefined;
}, {
    metadata?: Record<string, unknown> | undefined;
    status?: "ACTIVE" | "INACTIVE" | "MAINTENANCE" | undefined;
}>;
export declare const SyncRequestSchema: z.ZodObject<{
    deviceId: z.ZodString;
    lastSyncAt: z.ZodOptional<z.ZodString>;
    sales: z.ZodOptional<z.ZodArray<z.ZodObject<{
        localId: z.ZodString;
        idempotencyKey: z.ZodString;
        branchId: z.ZodString;
        userId: z.ZodString;
        deviceId: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            productId: z.ZodString;
            quantity: z.ZodNumber;
            unitPrice: z.ZodNumber;
            discount: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            productId: string;
            quantity: number;
            unitPrice: number;
            discount: number;
        }, {
            productId: string;
            quantity: number;
            unitPrice: number;
            discount?: number | undefined;
        }>, "many">;
        paymentMethod: z.ZodEnum<["CASH", "CARD", "MOMO", "MIXED"]>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        createdAt: string;
        userId: string;
        branchId: string;
        deviceId: string;
        idempotencyKey: string;
        items: {
            productId: string;
            quantity: number;
            unitPrice: number;
            discount: number;
        }[];
        paymentMethod: "CASH" | "CARD" | "MOMO" | "MIXED";
        localId: string;
    }, {
        createdAt: string;
        userId: string;
        branchId: string;
        deviceId: string;
        idempotencyKey: string;
        items: {
            productId: string;
            quantity: number;
            unitPrice: number;
            discount?: number | undefined;
        }[];
        paymentMethod: "CASH" | "CARD" | "MOMO" | "MIXED";
        localId: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    sales?: {
        createdAt: string;
        userId: string;
        branchId: string;
        deviceId: string;
        idempotencyKey: string;
        items: {
            productId: string;
            quantity: number;
            unitPrice: number;
            discount: number;
        }[];
        paymentMethod: "CASH" | "CARD" | "MOMO" | "MIXED";
        localId: string;
    }[] | undefined;
    lastSyncAt?: string | undefined;
}, {
    deviceId: string;
    sales?: {
        createdAt: string;
        userId: string;
        branchId: string;
        deviceId: string;
        idempotencyKey: string;
        items: {
            productId: string;
            quantity: number;
            unitPrice: number;
            discount?: number | undefined;
        }[];
        paymentMethod: "CASH" | "CARD" | "MOMO" | "MIXED";
        localId: string;
    }[] | undefined;
    lastSyncAt?: string | undefined;
}>;
export declare const ApiResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    error?: string | undefined;
    data?: unknown;
    message?: string | undefined;
}, {
    success: boolean;
    error?: string | undefined;
    data?: unknown;
    message?: string | undefined;
}>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export declare function successResponse<T>(data: T, message?: string): {
    success: true;
    data: T;
    message: string | undefined;
};
export declare function errorResponse(error: string, message?: string): {
    success: false;
    error: string;
    message: string | undefined;
};
//# sourceMappingURL=index.d.ts.map