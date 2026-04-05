import { z } from "zod";

export const VAT_RATE = 0.15;
export const NHIL_RATE = 0.025;
export const GETFUND_RATE = 0.025;
export const TOTAL_TAX_RATE = VAT_RATE + NHIL_RATE + GETFUND_RATE;

export const GhanaTaxBreakdownSchema = z.object({
  subtotal: z.number(),
  vat: z.number(),
  nhil: z.number(),
  getfund: z.number(),
  total: z.number(),
});

export type GhanaTaxBreakdown = z.infer<typeof GhanaTaxBreakdownSchema>;

export function calculateGhanaTax(subtotal: number): GhanaTaxBreakdown {
  const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
  const nhil = Math.round(subtotal * NHIL_RATE * 100) / 100;
  const getfund = Math.round(subtotal * GETFUND_RATE * 100) / 100;

  return {
    subtotal,
    vat,
    nhil,
    getfund,
    total: Math.round((subtotal + vat + nhil + getfund) * 100) / 100,
  };
}

export const RoleSchema = z.enum([
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "BRANCH_MANAGER",
  "CASHIER",
  "WAREHOUSE",
  "AUDITOR",
]);
export type Role = z.infer<typeof RoleSchema>;

export const DeviceStatusSchema = z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]);
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

export const SaleStatusSchema = z.enum(["COMPLETED", "VOIDED", "REFUNDED"]);
export type SaleStatus = z.infer<typeof SaleStatusSchema>;
export const SaleStatus = SaleStatusSchema.enum;

export const PaymentMethodSchema = z.enum(["CASH", "CARD", "MOMO", "MIXED"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export const PaymentMethod = PaymentMethodSchema.enum;

export const TransactionStatusSchema = z.enum([
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
]);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;
export const TransactionStatus = TransactionStatusSchema.enum;

export const DiscrepancyTypeSchema = z.enum([
  "THEFT",
  "DAMAGE",
  "EXPIRY",
  "SPOILAGE",
  "SYNC_ERROR",
  "MANUAL_ADJUSTMENT",
  "UNKNOWN",
]);
export type DiscrepancyType = z.infer<typeof DiscrepancyTypeSchema>;
export const DiscrepancyType = DiscrepancyTypeSchema.enum;

export const DiscrepancyStatusSchema = z.enum([
  "PENDING",
  "INVESTIGATING",
  "RESOLVED",
  "WRITE_OFF",
]);
export type DiscrepancyStatus = z.infer<typeof DiscrepancyStatusSchema>;
export const DiscrepancyStatus = DiscrepancyStatusSchema.enum;

export const AnomalyTypeSchema = z.enum([
  "EXCESS_REFUNDS",
  "DISCOUNT_ABUSE",
  "SUSPICIOUS_VOID",
  "UNUSUAL_SALES_PATTERN",
  "NEGATIVE_STOCK_SALE",
  "MULTIPLE_Voids_SAME_ITEM",
  "HIGH_CASH_TRANSACTION",
  "OFF_HOURS_SALE",
]);
export type AnomalyType = z.infer<typeof AnomalyTypeSchema>;
export const AnomalyType = AnomalyTypeSchema.enum;

export const AnomalySeveritySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);
export type AnomalySeverity = z.infer<typeof AnomalySeveritySchema>;

export const AnomalyStatusSchema = z.enum([
  "DETECTED",
  "INVESTIGATING",
  "CONFIRMED_FRAUD",
  "FALSE_POSITIVE",
  "RESOLVED",
]);
export type AnomalyStatus = z.infer<typeof AnomalyStatusSchema>;
export const AnomalyStatus = AnomalyStatusSchema.enum;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  deviceType: z.string().optional(),
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const SetPinRequestSchema = z.object({
  pin: z.string().length(6),
});

export const VerifyPinRequestSchema = z.object({
  pin: z.string().length(6),
});

export const SaleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  discount: z.number().min(0).default(0),
});

export const CreateSaleRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  branchId: z.string().uuid(),
  items: z.array(SaleItemSchema).min(1),
  paymentMethod: PaymentMethodSchema.default("CASH"),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
  deviceId: z.string().uuid().optional(),
});

export const VoidSaleRequestSchema = z.object({
  reason: z.string().min(1),
});

export const InventoryAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid(),
  quantity: z.number().int(),
  reason: z.string().min(1),
  reference: z.string().optional(),
});

export const InventoryTransferSchema = z.object({
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    }),
  ),
  notes: z.string().optional(),
});

export const DeviceHeartbeatSchema = z.object({
  status: DeviceStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const SyncRequestSchema = z.object({
  deviceId: z.string().uuid(),
  lastSyncAt: z.string().datetime().optional(),
  sales: z
    .array(
      z.object({
        localId: z.string().uuid(),
        idempotencyKey: z.string().uuid(),
        branchId: z.string().uuid(),
        userId: z.string().uuid(),
        deviceId: z.string().uuid(),
        items: z.array(SaleItemSchema),
        paymentMethod: PaymentMethodSchema,
        createdAt: z.string().datetime(),
      }),
    )
    .optional(),
});

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

export function successResponse<T>(data: T, message?: string) {
  return { success: true as const, data, message };
}

export function errorResponse(error: string, message?: string) {
  return { success: false as const, error, message };
}
