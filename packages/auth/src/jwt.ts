import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '@nexus/db';
import { Role } from '@nexus/types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

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

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createRefreshToken(userId: string): Promise<string> {
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

export async function revokeRefreshToken(token: string): Promise<void> {
  await db.refreshToken.update({
    where: { token },
    data: { revokedAt: new Date() },
  });
}

export async function validateRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const tokenRecord = await db.refreshToken.findUnique({
      where: { token },
    });
    
    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      return null;
    }
    
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function authenticateUser(email: string, password: string) {
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

export async function setUserPin(userId: string, pin: string): Promise<void> {
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

export async function verifyUserPin(userId: string, pin: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
  });
  
  if (!user || !user.pin) {
    return false;
  }
  
  return bcrypt.compare(pin, user.pin);
}

export function generateTokensForUser(user: {
  id: string;
  email: string;
  role: Role;
  organisationId: string;
  branchId?: string | null;
}): AuthTokens {
  const payload: TokenPayload = {
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
