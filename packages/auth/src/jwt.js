import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '@nexus/db';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
export function generateAccessToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}
export function generateRefreshToken(payload) {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}
export function verifyAccessToken(token) {
    return jwt.verify(token, JWT_SECRET);
}
export function verifyRefreshToken(token) {
    return jwt.verify(token, JWT_REFRESH_SECRET);
}
export async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
export async function createRefreshToken(userId) {
    const payload = { userId, type: 'refresh' };
    const token = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.refreshToken.create({
        data: {
            token,
            userId,
            expiresAt,
        },
    });
    return token;
}
export async function revokeRefreshToken(token) {
    await db.refreshToken.update({
        where: { token },
        data: { revokedAt: new Date() },
    });
}
export async function validateRefreshToken(token) {
    try {
        const tokenRecord = await db.refreshToken.findUnique({
            where: { token },
        });
        if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
            return null;
        }
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
        return decoded;
    }
    catch {
        return null;
    }
}
export async function authenticateUser(email, password) {
    const user = await db.user.findUnique({
        where: { email },
        include: {
            organisation: true,
            branch: true,
        },
    });
    if (!user || !user.isActive) {
        return null;
    }
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
        return null;
    }
    await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });
    return user;
}
export async function setUserPin(userId, pin) {
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);
    await db.user.update({
        where: { id: userId },
        data: {
            pin: pinHash,
            pinSalt: salt,
        },
    });
}
export async function verifyUserPin(userId, pin) {
    const user = await db.user.findUnique({
        where: { id: userId },
    });
    if (!user || !user.pin) {
        return false;
    }
    return bcrypt.compare(pin, user.pin);
}
export function generateTokensForUser(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
        branchId: user.branchId,
    };
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload),
    };
}
//# sourceMappingURL=jwt.js.map