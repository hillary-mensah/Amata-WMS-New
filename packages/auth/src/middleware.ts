import type { Context, Next } from 'hono';
import { verifyAccessToken, type TokenPayload } from './jwt.js';
import { Role } from '@nexus/types';

export interface AuthContext {
  user: TokenPayload;
}

export function getAuthContext(c: Context): AuthContext {
  return c.get('user');
}

export function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return Promise.resolve(c.json({ success: false, error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401));
  }
  
  const token = authHeader.slice(7);
  
  try {
    const payload = verifyAccessToken(token);
    c.set('user', payload);
    return next();
  } catch {
    return Promise.resolve(c.json({ success: false, error: 'Unauthorized', message: 'Invalid or expired token' }, 401));
  }
}

export function requireRole(...roles: Role[]) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const user = c.get('user') as TokenPayload;
    
    if (!roles.includes(user.role)) {
      return c.json({ 
        success: false, 
        error: 'Forbidden', 
        message: `This action requires one of the following roles: ${roles.join(', ')}` 
      }, 403);
    }
    
    return next();
  };
}

export const SUPER_ADMIN_ONLY = requireRole('SUPER_ADMIN');
export const ORG_ADMIN_ONLY = requireRole('SUPER_ADMIN', 'ORG_ADMIN');
export const BRANCH_MANAGER_AND_ABOVE = requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_MANAGER');
export const MANAGER_AND_ABOVE = requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_MANAGER');
export const CASHIER_AND_ABOVE = requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_MANAGER', 'CASHIER');
export const WAREHOUSE_AND_ABOVE = requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_MANAGER', 'WAREHOUSE');
export const AUDITOR_AND_ABOVE = requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'WAREHOUSE', 'AUDITOR');

export function requireBranch(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user') as TokenPayload;
  
  if (!user.branchId) {
    return Promise.resolve(c.json({ 
      success: false, 
      error: 'Bad Request', 
      message: 'User must be assigned to a branch' 
    }, 400));
  }
  
  return next();
}
