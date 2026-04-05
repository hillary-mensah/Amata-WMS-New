/// <reference types="node" />
import type { Context, Next } from 'hono';
import { type TokenPayload } from './jwt';
import { Role } from '@nexus/types';
export interface AuthContext {
    user: TokenPayload;
}
export declare function getAuthContext(c: Context): AuthContext;
export declare function authMiddleware(c: Context, next: Next): Promise<Response | void>;
export declare function requireRole(...roles: Role[]): (c: Context, next: Next) => Promise<Response | void>;
export declare const SUPER_ADMIN_ONLY: (c: Context, next: Next) => Promise<Response | void>;
export declare const ORG_ADMIN_ONLY: (c: Context, next: Next) => Promise<Response | void>;
export declare const BRANCH_MANAGER_AND_ABOVE: (c: Context, next: Next) => Promise<Response | void>;
export declare const MANAGER_AND_ABOVE: (c: Context, next: Next) => Promise<Response | void>;
export declare const CASHIER_AND_ABOVE: (c: Context, next: Next) => Promise<Response | void>;
export declare const WAREHOUSE_AND_ABOVE: (c: Context, next: Next) => Promise<Response | void>;
export declare const AUDITOR_AND_ABOVE: (c: Context, next: Next) => Promise<Response | void>;
export declare function requireBranch(c: Context, next: Next): Promise<Response | void>;
//# sourceMappingURL=middleware.d.ts.map