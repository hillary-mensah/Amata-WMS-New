import { db } from '@nexus/db';
import { createHash } from 'crypto';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './jwt.js';
import { encrypt, decrypt } from './crypto.js';
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000;
const MAX_TOKEN_FAMILY_SIZE = 5;
function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}
function generateTokenFamily() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
export async function createRefreshTokenWithRotation(userId, context) {
    const tokenFamily = generateTokenFamily();
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new Error('User not found');
    }
    const refreshToken = generateRefreshToken({
        userId,
        tokenFamily: tokenFamily,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
        branchId: user.branchId
    });
    const hashedToken = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
    await db.refreshToken.create({
        data: {
            token: refreshToken,
            tokenFamily,
            hashedToken,
            userId,
            expiresAt,
            deviceId: context.deviceId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            fingerprint: context.deviceFingerprint,
        },
    });
    const accessToken = generateAccessToken({
        userId,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
        branchId: user.branchId
    });
    return { accessToken, refreshToken, expiresAt };
}
export async function rotateRefreshToken(currentRefreshToken, context) {
    try {
        const payload = verifyRefreshToken(currentRefreshToken);
        const userId = payload.userId;
        const tokenFamily = payload.tokenFamily || payload.userId;
        const existingToken = await db.refreshToken.findFirst({
            where: { token: currentRefreshToken, userId },
        });
        if (!existingToken || existingToken.revokedAt) {
            return null;
        }
        const familyCount = await db.refreshToken.count({
            where: { tokenFamily: existingToken.tokenFamily, revokedAt: null },
        });
        if (familyCount >= MAX_TOKEN_FAMILY_SIZE) {
            await revokeTokenFamily(existingToken.tokenFamily, 'MAX_ROTATION_EXCEEDED');
            return null;
        }
        await db.refreshToken.update({
            where: { id: existingToken.id },
            data: {
                revokedAt: new Date(),
                isRotated: true,
                revokedByToken: currentRefreshToken,
            },
        });
        const newTokenFamily = existingToken.isRotated
            ? existingToken.tokenFamily
            : generateTokenFamily();
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user) {
            return null;
        }
        const newRefreshToken = generateRefreshToken({
            userId,
            tokenFamily: newTokenFamily,
            email: user.email,
            role: user.role,
            organisationId: user.organisationId,
            branchId: user.branchId
        });
        const newHashedToken = hashToken(newRefreshToken);
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
        await db.refreshToken.create({
            data: {
                token: newRefreshToken,
                tokenFamily: newTokenFamily,
                hashedToken: newHashedToken,
                userId,
                expiresAt,
                deviceId: context.deviceId,
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                fingerprint: context.deviceFingerprint,
                isRotated: false,
                rotationCount: existingToken.rotationCount + 1,
            },
        });
        const accessToken = generateAccessToken({
            userId,
            email: user.email,
            role: user.role,
            organisationId: user.organisationId,
            branchId: user.branchId
        });
        return { accessToken, refreshToken: newRefreshToken, expiresAt };
    }
    catch {
        return null;
    }
}
export async function revokeRefreshTokenWithReason(token, reason = 'USER_REVOKED') {
    try {
        const payload = verifyRefreshToken(token);
        const userId = payload.userId;
        const existingToken = await db.refreshToken.findFirst({
            where: { token, userId },
        });
        if (!existingToken)
            return false;
        await db.refreshToken.update({
            where: { id: existingToken.id },
            data: { revokedAt: new Date() },
        });
        await db.tokenRevocation.create({
            data: {
                tokenHash: hashToken(token),
                tokenFamily: existingToken.tokenFamily,
                userId,
                reason,
                expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
            },
        });
        return true;
    }
    catch {
        return false;
    }
}
export async function revokeTokenFamily(tokenFamily, reason) {
    const tokens = await db.refreshToken.findMany({
        where: { tokenFamily, revokedAt: null },
    });
    for (const token of tokens) {
        await db.refreshToken.update({
            where: { id: token.id },
            data: { revokedAt: new Date() },
        });
        await db.tokenRevocation.create({
            data: {
                tokenHash: token.hashedToken,
                tokenFamily,
                userId: token.userId,
                reason,
                expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
            },
        });
    }
    return tokens.length;
}
export async function revokeAllUserTokens(userId, reason = 'ALL_DEVICES_REVOKED') {
    const tokens = await db.refreshToken.findMany({
        where: { userId, revokedAt: null },
    });
    for (const token of tokens) {
        await db.refreshToken.update({
            where: { id: token.id },
            data: { revokedAt: new Date() },
        });
        await db.tokenRevocation.create({
            data: {
                tokenHash: token.hashedToken,
                tokenFamily: token.tokenFamily,
                userId,
                reason,
                expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
            },
        });
    }
    return tokens.length;
}
export async function isTokenRevoked(token) {
    const tokenHash = hashToken(token);
    const revocation = await db.tokenRevocation.findUnique({
        where: { tokenHash },
    });
    if (revocation && revocation.expiresAt > new Date()) {
        return true;
    }
    if (revocation) {
        await db.tokenRevocation.delete({
            where: { id: revocation.id },
        });
    }
    return false;
}
export async function validateDeviceAccess(organisationId, deviceId, fingerprint) {
    const device = await db.device.findFirst({
        where: { id: deviceId, organisationId },
    });
    if (!device) {
        return { valid: false, trusted: false, message: 'Device not registered' };
    }
    if (device.status !== 'ACTIVE') {
        return { valid: false, trusted: false, message: 'Device is not active' };
    }
    if (fingerprint && device.fingerprint) {
        if (fingerprint !== device.fingerprint) {
            const existingMetadata = typeof device.metadata === 'object' && device.metadata !== null
                ? device.metadata
                : {};
            await db.device.update({
                where: { id: deviceId },
                data: {
                    status: 'MAINTENANCE',
                    metadata: { ...existingMetadata, fingerprintMismatch: true, mismatchedAt: new Date().toISOString() },
                },
            });
            return { valid: false, trusted: false, message: 'Device fingerprint changed' };
        }
    }
    return { valid: true, trusted: device.trusted };
}
export async function registerDevice(organisationId, branchId, name, fingerprint, type = 'POS') {
    const existingDevice = await db.device.findFirst({
        where: {
            organisationId,
            fingerprint,
            branchId,
        },
    });
    if (existingDevice) {
        await db.device.update({
            where: { id: existingDevice.id },
            data: {
                lastHeartbeat: new Date(),
                lastLoginAt: new Date(),
            },
        });
        return existingDevice.id;
    }
    const device = await db.device.create({
        data: {
            name,
            type,
            fingerprint,
            organisationId,
            branchId,
            trusted: false,
        },
    });
    return device.id;
}
export async function trustDevice(deviceId, trusted = true) {
    await db.device.update({
        where: { id: deviceId },
        data: { trusted },
    });
}
export function generateDeviceFingerprint(userAgent, ipAddress, deviceId) {
    const data = `${userAgent}|${ipAddress}|${deviceId || 'unknown'}`;
    return createHash('sha256').update(data).digest('hex').slice(0, 32);
}
export async function getActiveSessions(userId) {
    const tokens = await db.refreshToken.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 10,
    });
    const sessions = tokens.map((t, i) => ({
        deviceId: t.deviceId || 'unknown',
        deviceName: 'Unknown Device',
        createdAt: t.createdAt,
        ipAddress: t.ipAddress || 'unknown',
        isCurrent: i === 0,
    }));
    return {
        currentDevice: sessions[0]?.deviceId || null,
        otherSessions: sessions.slice(1),
    };
}
export async function encryptPaymentData(paymentData) {
    const sensitiveFields = ['providerRef', 'details'];
    const encrypted = { ...paymentData };
    for (const field of sensitiveFields) {
        if (encrypted[field]) {
            encrypted[field] = encrypt(encrypted[field]);
        }
    }
    return JSON.stringify(encrypted);
}
export async function decryptPaymentData(encryptedData) {
    try {
        const data = JSON.parse(encryptedData);
        const sensitiveFields = ['providerRef', 'details'];
        const decrypted = { ...data };
        for (const field of sensitiveFields) {
            if (decrypted[field]) {
                try {
                    decrypted[field] = decrypt(decrypted[field]);
                }
                catch {
                }
            }
        }
        return decrypted;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=security.js.map