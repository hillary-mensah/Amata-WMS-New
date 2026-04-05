import { type Context, type Next } from 'hono';
import { logAuditEvent } from '@nexus/governance';
import { verifyAccessToken } from '@nexus/auth';

const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE', 
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'VOID_SALE',
  'REFUND',
  'ADJUST_INVENTORY',
  'TRANSFER_STOCK',
  'UPDATE_PRICE',
  'UPDATE_SETTINGS',
];

export function auditMiddleware(entityType: string) {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    
    await next();
    
    const responseTime = Date.now() - startTime;
    
    if (responseTime < 0) return;
    
    const status = c.res.status;
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) return;
    
    if (status < 200 || status >= 300) return;
    
    try {
      const token = authHeader.slice(7);
      const user = verifyAccessToken(token);
      
      const method = c.req.method;
      let action = method;
      
      if (method === 'POST') action = 'CREATE';
      else if (method === 'PUT' || method === 'PATCH') action = 'UPDATE';
      else if (method === 'DELETE') action = 'DELETE';
      
      if (!AUDIT_ACTIONS.includes(action)) return;
      
      const entityId = c.req.param('id') || c.get('entityId');
      
      const ipAddress = c.req.header('X-Forwarded-For')?.split(',')[0] 
        || c.req.header('CF-Connecting-IP') 
        || 'unknown';
      const userAgent = c.req.header('User-Agent') || 'unknown';
      
      await logAuditEvent(
        user.organisationId,
        user.userId,
        {
          action,
          entityType,
          entityId,
        },
        undefined,
        ipAddress,
        userAgent
      );
    } catch {
    }
  };
}
