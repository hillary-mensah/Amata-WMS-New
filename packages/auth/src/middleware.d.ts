import type { Context, Next } from 'hono';
import { type TokenPayload } from './jwt.js';
import { Role } from '@nexus/types';
export interface AuthContext {
    user: TokenPayload;
}
export declare function getAuthContext(c: Context): AuthContext;
export declare function authMiddleware(c: Context, next: Next): Promise<void | Response>;
export declare function requireRole(...roles: Role[]): (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
}, 403, "json">)>;
export declare const SUPER_ADMIN_ONLY: (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
}, 403, "json">)>;
export declare const ORG_ADMIN_ONLY: (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
}, 403, "json">)>;
export declare const BRANCH_MANAGER_AND_ABOVE: (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
}, 403, "json">)>;
export declare const MANAGER_AND_ABOVE: (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
}, 403, "json">)>;
export declare const CASHIER_AND_ABOVE: (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
}, 403, "json">)>;
export declare const WAREHOUSE_AND_ABOVE: (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
}, 403, "json">)>;
export declare const AUDITOR_AND_ABOVE: (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
}, 403, "json">)>;
export declare function requireBranch(c: Context, next: Next): Promise<void> | (Response & import("hono").TypedResponse<{
    success: false;
    error: string;
    message: string;
}, 400, "json">);
//# sourceMappingURL=middleware.d.ts.map