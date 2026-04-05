import Redis from 'ioredis';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
});
redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});
redis.on('connect', () => {
    console.log('Redis connected');
});
export async function connectRedis() {
    if (redis.status === 'wait') {
        await redis.connect();
    }
}
export async function disconnectRedis() {
    await redis.quit();
}
export async function checkRateLimit(key, maxRequests = 100, windowMs = 60000) {
    const now = Date.now();
    const windowKey = `rate_limit:${key}:${Math.floor(now / windowMs)}`;
    const current = await redis.incr(windowKey);
    if (current === 1) {
        await redis.pexpire(windowKey, windowMs);
    }
    const ttl = await redis.pttl(windowKey);
    const resetAt = now + ttl;
    return {
        allowed: current <= maxRequests,
        remaining: Math.max(0, maxRequests - current),
        resetAt,
    };
}
export async function rateLimitMiddleware(key, maxRequests = 100, windowMs = 60000) {
    const result = await checkRateLimit(key, maxRequests, windowMs);
    return result;
}
export async function cacheGet(key) {
    const data = await redis.get(key);
    if (!data)
        return null;
    return JSON.parse(data);
}
export async function cacheSet(key, value, ttlSeconds = 300) {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
}
export async function cacheDelete(key) {
    await redis.del(key);
}
export async function cacheDeletePattern(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length === 0)
        return 0;
    return redis.del(...keys);
}
export async function incrementCounter(name) {
    return redis.incr(`counter:${name}`);
}
export async function getCounter(name) {
    const value = await redis.get(`counter:${name}`);
    return value ? parseInt(value, 10) : 0;
}
export async function resetCounter(name) {
    await redis.del(`counter:${name}`);
}
//# sourceMappingURL=index.js.map