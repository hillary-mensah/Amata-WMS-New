import Redis from 'ioredis';
export declare const redis: Redis;
export declare function connectRedis(): Promise<void>;
export declare function disconnectRedis(): Promise<void>;
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}
export declare function checkRateLimit(key: string, maxRequests?: number, windowMs?: number): Promise<RateLimitResult>;
export declare function rateLimitMiddleware(key: string, maxRequests?: number, windowMs?: number): Promise<RateLimitResult>;
export declare function cacheGet<T>(key: string): Promise<T | null>;
export declare function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
export declare function cacheDelete(key: string): Promise<void>;
export declare function cacheDeletePattern(pattern: string): Promise<number>;
export declare function incrementCounter(name: string): Promise<number>;
export declare function getCounter(name: string): Promise<number>;
export declare function resetCounter(name: string): Promise<void>;
//# sourceMappingURL=index.d.ts.map