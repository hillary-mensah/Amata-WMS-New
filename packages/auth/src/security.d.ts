export interface DeviceAuthContext {
    deviceId?: string;
    deviceFingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
}
export declare function createRefreshTokenWithRotation(userId: string, context: DeviceAuthContext): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}>;
export declare function rotateRefreshToken(currentRefreshToken: string, context: DeviceAuthContext): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
} | null>;
export declare function revokeRefreshTokenWithReason(token: string, reason?: string): Promise<boolean>;
export declare function revokeTokenFamily(tokenFamily: string, reason: string): Promise<number>;
export declare function revokeAllUserTokens(userId: string, reason?: string): Promise<number>;
export declare function isTokenRevoked(token: string): Promise<boolean>;
export declare function validateDeviceAccess(organisationId: string, deviceId: string, fingerprint?: string): Promise<{
    valid: boolean;
    trusted: boolean;
    message?: string;
}>;
export declare function registerDevice(organisationId: string, branchId: string, name: string, fingerprint: string, type?: string): Promise<string>;
export declare function trustDevice(deviceId: string, trusted?: boolean): Promise<void>;
export declare function generateDeviceFingerprint(userAgent: string, ipAddress: string, deviceId?: string): string;
export declare function getActiveSessions(userId: string): Promise<{
    currentDevice: string | null;
    otherSessions: Array<{
        deviceId: string;
        deviceName: string;
        createdAt: Date;
        ipAddress: string;
        isCurrent: boolean;
    }>;
}>;
export declare function encryptPaymentData(paymentData: {
    providerRef?: string;
    method?: string;
    details?: string;
}): Promise<string>;
export declare function decryptPaymentData(encryptedData: string): Promise<{
    providerRef?: string;
    method?: string;
    details?: string;
} | null>;
//# sourceMappingURL=security.d.ts.map