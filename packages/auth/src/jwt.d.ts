import { Role } from '@nexus/types';
export interface TokenPayload {
    userId: string;
    email: string;
    role: Role;
    organisationId: string;
    branchId?: string | null;
    tokenFamily?: string;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export declare function generateAccessToken(payload: TokenPayload): string;
export declare function generateRefreshToken(payload: TokenPayload): string;
export declare function verifyAccessToken(token: string): TokenPayload;
export declare function verifyRefreshToken(token: string): TokenPayload;
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
export declare function createRefreshToken(userId: string): Promise<string>;
export declare function revokeRefreshToken(token: string): Promise<void>;
export declare function validateRefreshToken(token: string): Promise<TokenPayload | null>;
export declare function authenticateUser(email: string, password: string): Promise<({
    organisation: {
        id: string;
        createdAt: Date;
        email: string | null;
        updatedAt: Date;
        name: string;
        tin: string;
        vatNumber: string | null;
        address: string | null;
        phone: string | null;
        logoUrl: string | null;
    };
    branch: {
        id: string;
        createdAt: Date;
        organisationId: string;
        email: string | null;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        address: string | null;
        phone: string | null;
    } | null;
} & {
    id: string;
    createdAt: Date;
    organisationId: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role: import("@prisma/client").$Enums.Role;
    pin: string | null;
    pinSalt: string | null;
    isActive: boolean;
    lastLoginAt: Date | null;
    metadata: import("@prisma/client/runtime/library").JsonValue;
    updatedAt: Date;
    branchId: string | null;
}) | null>;
export declare function setUserPin(userId: string, pin: string): Promise<void>;
export declare function verifyUserPin(userId: string, pin: string): Promise<boolean>;
export declare function generateTokensForUser(user: {
    id: string;
    email: string;
    role: Role;
    organisationId: string;
    branchId?: string | null;
}): AuthTokens;
//# sourceMappingURL=jwt.d.ts.map