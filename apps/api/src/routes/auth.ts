import { Hono } from 'hono';
import { db } from '@nexus/db';
import { 
  authenticateUser, 
  generateTokensForUser, 
  createRefreshToken, 
  validateRefreshToken,
  setUserPin,
  verifyUserPin,
  revokeRefreshToken,
  createRefreshTokenWithRotation,
  rotateRefreshToken,
  revokeRefreshTokenWithReason,
  revokeAllUserTokens,
  validateDeviceAccess,
  registerDevice,
  trustDevice,
  getActiveSessions,
  generateDeviceFingerprint,
  isTokenRevoked,
} from '@nexus/auth';
import { TokenPayload } from '@nexus/auth';
import { LoginRequestSchema, SetPinRequestSchema, VerifyPinRequestSchema } from '@nexus/types';
import type { Context, Next } from 'hono';

export const authRouter = new Hono();

const getTokenFromCookie = (c: Context): string | null => {
  const cookie = c.req.header('Cookie');
  if (!cookie) return null;
  const match = cookie.match(/refreshToken=([^;]+)/);
  if (!match || !match[1]) return null;
  return match[1];
};

authRouter.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = LoginRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ 
        success: false, 
        error: 'Validation Error',
        message: parsed.error.errors 
      }, 400);
    }

    const { email, password, deviceId, deviceName, deviceType } = parsed.data;
    const userAgent = c.req.header('User-Agent') || 'unknown';
    const ipAddress = c.req.header('X-Forwarded-For')?.split(',')[0] || c.req.header('CF-Connecting-IP') || 'unknown';
    
    const fingerprint = generateDeviceFingerprint(userAgent, ipAddress, deviceId);

    if (deviceId) {
      const deviceValidation = await validateDeviceAccess('', deviceId, fingerprint);
      if (!deviceValidation.valid) {
        return c.json({ 
          success: false, 
          error: 'Device Error',
          message: deviceValidation.message 
        }, 403);
      }
    }

    const user = await authenticateUser(email, password);

    if (!user) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized',
        message: 'Invalid email or password' 
      }, 401);
    }

    const context = {
      deviceId: deviceId || undefined,
      deviceFingerprint: fingerprint,
      ipAddress,
      userAgent,
    };

    const tokens = await createRefreshTokenWithRotation(user.id, context);

    if (deviceId && deviceName) {
      await registerDevice(user.organisationId, user.branchId || '', deviceName, fingerprint, deviceType);
    }

    c.header('Set-Cookie', `refreshToken=${tokens.refreshToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`);

    return c.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organisationId: user.organisationId,
          branchId: user.branchId,
          organisationName: user.organisation.name,
          branchName: user.branch?.name,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal Server Error' 
    }, 500);
  }
});

authRouter.post('/refresh', async (c) => {
  try {
    const body = await c.req.json();
    const refreshToken = body.refreshToken;

    if (!refreshToken) {
      return c.json({ 
        success: false, 
        error: 'Bad Request',
        message: 'Refresh token required' 
      }, 400);
    }

    const isRevoked = await isTokenRevoked(refreshToken);
    if (isRevoked) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized',
        message: 'Token has been revoked' 
      }, 401);
    }

    const userAgent = c.req.header('User-Agent') || 'unknown';
    const ipAddress = c.req.header('X-Forwarded-For')?.split(',')[0] || c.req.header('CF-Connecting-IP') || 'unknown';
    const fingerprint = generateDeviceFingerprint(userAgent, ipAddress);

    const rotated = await rotateRefreshToken(refreshToken, {
      deviceFingerprint: fingerprint,
      ipAddress,
      userAgent,
    });

    if (!rotated) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token' 
      }, 401);
    }

    c.header('Set-Cookie', `refreshToken=${rotated.refreshToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`);

    return c.json({
      success: true,
      data: {
        accessToken: rotated.accessToken,
        expiresAt: rotated.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal Server Error' 
    }, 500);
  }
});

authRouter.post('/logout', async (c) => {
  try {
    const cookie = c.req.header('Cookie');
    const match = cookie?.match(/refreshToken=([^;]+)/);
    
    if (match && match[1]) {
      await revokeRefreshTokenWithReason(match[1], 'USER_LOGOUT');
    }

    c.header('Set-Cookie', 'refreshToken=; HttpOnly; Path=/; Max-Age=0');

    return c.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal Server Error' 
    }, 500);
  }
});

authRouter.post('/logout-all', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { verifyAccessToken } = await import('@nexus/auth');
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    const revoked = await revokeAllUserTokens(payload.userId, 'ALL_DEVICES_REVOKED');

    c.header('Set-Cookie', 'refreshToken=; HttpOnly; Path=/; Max-Age=0');

    return c.json({ 
      success: true, 
      message: `Logged out from ${revoked} devices` 
    });
  } catch (error) {
    console.error('Logout all error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

authRouter.get('/sessions', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { verifyAccessToken } = await import('@nexus/auth');
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    const sessions = await getActiveSessions(payload.userId);

    return c.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Sessions error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

authRouter.post('/device/trust', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { verifyAccessToken } = await import('@nexus/auth');
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    const body = await c.req.json();
    const { deviceId, trust } = body;

    if (!deviceId) {
      return c.json({ success: false, error: 'Bad Request', message: 'deviceId required' }, 400);
    }

    await trustDevice(deviceId, trust ?? true);

    return c.json({ success: true, message: `Device ${trust ? 'trusted' : 'untrusted'}` });
  } catch (error) {
    console.error('Trust device error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

authRouter.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, 401);
    }

    const { verifyAccessToken } = await import('@nexus/auth');
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: { 
        organisation: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return c.json({ 
        success: false, 
        error: 'Not Found',
        message: 'User not found' 
      }, 404);
    }

    return c.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organisationId: user.organisationId,
        branchId: user.branchId,
        organisationName: user.organisation.name,
        branchName: user.branch?.name,
        hasPin: !!user.pin,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal Server Error' 
    }, 500);
  }
});

authRouter.post('/pin/set', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, 401);
    }

    const { verifyAccessToken } = await import('@nexus/auth');
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    const body = await c.req.json();
    const parsed = SetPinRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ 
        success: false, 
        error: 'Validation Error',
        message: parsed.error.errors 
      }, 400);
    }

    await setUserPin(payload.userId, parsed.data.pin);

    return c.json({
      success: true,
      message: 'PIN set successfully',
    });
  } catch (error) {
    console.error('Set PIN error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal Server Error' 
    }, 500);
  }
});

authRouter.post('/pin/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, 401);
    }

    const { verifyAccessToken } = await import('@nexus/auth');
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    const body = await c.req.json();
    const parsed = VerifyPinRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ 
        success: false, 
        error: 'Validation Error',
        message: parsed.error.errors 
      }, 400);
    }

    const isValid = await verifyUserPin(payload.userId, parsed.data.pin);

    if (!isValid) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized',
        message: 'Invalid PIN' 
      }, 401);
    }

    return c.json({
      success: true,
      message: 'PIN verified successfully',
    });
  } catch (error) {
    console.error('Verify PIN error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal Server Error' 
    }, 500);
  }
});