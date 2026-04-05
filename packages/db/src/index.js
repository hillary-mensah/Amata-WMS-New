import { PrismaClient } from '@prisma/client';
export const db = globalThis.__prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = db;
}
export default db;
//# sourceMappingURL=index.js.map