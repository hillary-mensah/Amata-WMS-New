import { db } from '@nexus/db';
import { createHash } from 'crypto';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changes?: Array<{ field: string; from: unknown; to: unknown }>;
}

function computeHash(data: string, previousHash: string): string {
  return createHash('sha256')
    .update(data + previousHash)
    .digest('hex');
}

function generateHash(data: AuditEntry, userId: string, organisationId: string): string {
  const payload = JSON.stringify({
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    oldValues: data.oldValues,
    newValues: data.newValues,
    userId,
    organisationId,
    timestamp: new Date().toISOString(),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export async function logAuditEvent(
  organisationId: string,
  userId: string,
  entry: AuditEntry,
  sessionId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const lastLog = await db.auditLog.findFirst({
    where: { organisationId },
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  });

  const previousHash = lastLog?.hash || 'genesis';
  const hash = generateHash(entry, userId, organisationId);
  const fullHash = computeHash(hash, previousHash);

  const changes = entry.changes || computeChanges(entry.oldValues, entry.newValues);

  const auditLog = await db.auditLog.create({
    data: {
      organisationId,
      userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValues: entry.oldValues as object | undefined,
      newValues: entry.newValues as object | undefined,
      changes: changes as object,
      ipAddress,
      userAgent,
      sessionId,
      hash: fullHash,
      previousHash,
      version: (lastLog?.hash ? 1 : 1),
      isImmutable: true,
    },
  });

  return auditLog.id;
}

function computeChanges(
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Array<{ field: string; from: unknown; to: unknown }> {
  if (!oldValues || !newValues) return [];

  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, from: oldVal, to: newVal });
    }
  }

  return changes;
}

export async function verifyAuditIntegrity(
  organisationId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<{
  valid: boolean;
  brokenAt?: Date;
  totalRecords: number;
  firstHash?: string;
  lastHash?: string;
}> {
  const logs = await db.auditLog.findMany({
    where: { organisationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, hash: true, previousHash: true, createdAt: true },
  });

  if (logs.length === 0) {
    return { valid: true, totalRecords: 0 };
  }

  let expectedPreviousHash = 'genesis';

  for (const log of logs) {
    if (log.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        brokenAt: log.createdAt,
        totalRecords: logs.length,
        firstHash: logs[0]?.hash,
        lastHash: logs[logs.length - 1]?.hash,
      };
    }

    const computedHash = computeHash(
      log.hash.substring(0, 64),
      log.previousHash || ''
    );
    
    if (computedHash !== log.hash) {
      return {
        valid: false,
        brokenAt: log.createdAt,
        totalRecords: logs.length,
        firstHash: logs[0]?.hash,
        lastHash: log.hash,
      };
    }

    expectedPreviousHash = log.hash;
  }

  return {
    valid: true,
    totalRecords: logs.length,
    firstHash: logs[0]?.hash,
    lastHash: logs[logs.length - 1]?.hash,
  };
}

export async function replayAuditEvents(
  organisationId: string,
  fromDate?: Date,
  toDate?: Date,
  onEvent?: (log: Awaited<ReturnType<typeof getAuditLogById>>) => Promise<void>
): Promise<{
  replayed: number;
  failed: number;
  errors: string[];
}> {
  const logs = await db.auditLog.findMany({
    where: { organisationId },
    orderBy: { createdAt: 'asc' },
  });

  let replayed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const log of logs) {
    try {
      if (onEvent) {
        await onEvent(log as Awaited<ReturnType<typeof getAuditLogById>>);
      }
      replayed++;
    } catch (error) {
      failed++;
      errors.push(`Failed to replay ${log.id}: ${error}`);
    }
  }

  return { replayed, failed, errors };
}

export async function getAuditLogById(id: string) {
  return db.auditLog.findUnique({
    where: { id },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

export async function queryAuditLogs(
  organisationId: string,
  options: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  const {
    userId,
    entityType,
    entityId,
    action,
    fromDate,
    toDate,
    limit = 50,
    offset = 0,
  } = options;

  const whereClause: Record<string, unknown> = { organisationId };

  if (userId) whereClause.userId = userId;
  if (entityType) whereClause.entityType = entityType;
  if (entityId) whereClause.entityId = entityId;
  if (action) whereClause.action = action;

  if (fromDate || toDate) {
    whereClause.createdAt = {};
    if (fromDate) (whereClause.createdAt as Record<string, Date>).gte = fromDate;
    if (toDate) (whereClause.createdAt as Record<string, Date>).lte = toDate;
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where: whereClause as never,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.auditLog.count({ where: whereClause as never }),
  ]);

  return { logs, total, limit, offset };
}

export async function createRetentionPolicy(
  organisationId: string,
  policy: {
    name: string;
    entityType: string;
    retentionDays: number;
    archiveAfterDays?: number;
    deleteAfterDays?: number;
    actionOnExpiry?: 'ARCHIVE' | 'DELETE' | 'NOTIFY';
  }
): Promise<string> {
  const result = await db.dataRetentionPolicy.create({
    data: {
      organisationId,
      name: policy.name,
      entityType: policy.entityType,
      retentionDays: policy.retentionDays,
      archiveAfterDays: policy.archiveAfterDays || policy.retentionDays * 2,
      deleteAfterDays: policy.deleteAfterDays || policy.retentionDays * 7,
      actionOnExpiry: policy.actionOnExpiry || 'ARCHIVE',
    },
  });

  return result.id;
}

export async function getRetentionPolicies(organisationId: string) {
  return db.dataRetentionPolicy.findMany({
    where: { organisationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateRetentionPolicy(
  policyId: string,
  organisationId: string,
  updates: Partial<{
    name: string;
    retentionDays: number;
    archiveAfterDays: number;
    deleteAfterDays: number;
    actionOnExpiry: string;
    isActive: boolean;
  }>
): Promise<void> {
  await db.dataRetentionPolicy.update({
    where: { id: policyId, organisationId },
    data: updates,
  });
}

export async function archiveExpiredData(organisationId: string): Promise<{
  archived: number;
  errors: string[];
}> {
  const policies = await db.dataRetentionPolicy.findMany({
    where: { organisationId, isActive: true },
  });

  const now = new Date();
  let archived = 0;
  const errors: string[] = [];

  for (const policy of policies) {
    const archiveDate = new Date(now.getTime() - policy.archiveAfterDays * 24 * 60 * 60 * 1000);

    try {
      // Use any to bypass complex Prisma typing for dynamic model access
      const dbAny = db as unknown as Record<string, {
        findMany: (args: unknown) => Promise<unknown[]>;
      }>;
      const model = dbAny[policy.entityType];

      if (model && typeof model.findMany === 'function') {
        const records = await model.findMany({
          where: {
            organisationId,
            createdAt: { lte: archiveDate },
          },
          take: 1000,
        });

        for (const record of records) {
          const entityId = (record as { id: string }).id;

          await db.dataArchive.create({
            data: {
              organisationId,
              entityType: policy.entityType,
              entityId,
              archivedData: record as object,
              originalHash: createHash('sha256').update(JSON.stringify(record)).digest('hex'),
            },
          });

          archived++;
        }
      }
    } catch (error) {
      errors.push(`Failed to archive ${policy.entityType}: ${error}`);
    }
  }

  return { archived, errors };
}

export async function restoreArchivedData(
  archiveId: string,
  organisationId: string
): Promise<{ success: boolean; message: string }> {
  const archive = await db.dataArchive.findFirst({
    where: { id: archiveId, organisationId, isRestored: false },
  });

  if (!archive) {
    return { success: false, message: 'Archive not found or already restored' };
  }

  try {
    // Use any to bypass complex Prisma typing for dynamic model access
    const dbAny = db as unknown as Record<string, {
      upsert: (args: unknown) => Promise<unknown>;
    }>;
    const model = dbAny[archive.entityType];

    if (model && typeof model.upsert === 'function') {
      await model.upsert({
        where: { id: archive.entityId },
        update: archive.archivedData as object,
        create: archive.archivedData as object,
      });
    }

    await db.dataArchive.update({
      where: { id: archiveId },
      data: {
        isRestored: true,
        restoredAt: new Date(),
        restoreHash: createHash('sha256')
          .update(JSON.stringify(archive.archivedData))
          .digest('hex'),
      },
    });

    return { success: true, message: 'Data restored successfully' };
  } catch (error) {
    return { success: false, message: `Restore failed: ${error}` };
  }
}

export async function getArchivedData(
  organisationId: string,
  entityType?: string,
  isRestored?: boolean
) {
  const whereClause: Record<string, unknown> = { organisationId };
  
  if (entityType) whereClause.entityType = entityType;
  if (isRestored !== undefined) whereClause.isRestored = isRestored;

  return db.dataArchive.findMany({
    where: whereClause,
    orderBy: { archivedAt: 'desc' },
    take: 100,
  });
}

export async function deleteExpiredData(organisationId: string): Promise<{
  deleted: number;
  errors: string[];
}> {
  const policies = await db.dataRetentionPolicy.findMany({
    where: { organisationId, isActive: true, actionOnExpiry: 'DELETE' },
  });

  const now = new Date();
  let deleted = 0;
  const errors: string[] = [];

  for (const policy of policies) {
    const deleteDate = new Date(now.getTime() - policy.deleteAfterDays * 24 * 60 * 60 * 1000);

    try {
      await db.dataArchive.deleteMany({
        where: {
          organisationId,
          entityType: policy.entityType,
          archivedAt: { lte: deleteDate },
          isRestored: false,
        },
      });

      deleted++;
    } catch (error) {
      errors.push(`Failed to delete ${policy.entityType}: ${error}`);
    }
  }

  return { deleted, errors };
}

export async function getComplianceReport(
  organisationId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalAuditEntries: number;
  integrityValid: boolean;
  policiesActive: number;
  recordsArchived: number;
  dataByEntity: Record<string, number>;
}> {
  const [totalAuditEntries, policies, archives, integrity] = await Promise.all([
    db.auditLog.count({
      where: { organisationId, createdAt: { gte: startDate, lte: endDate } },
    }),
    db.dataRetentionPolicy.count({ where: { organisationId, isActive: true } }),
    db.dataArchive.count({ where: { organisationId, archivedAt: { gte: startDate, lte: endDate } } }),
    verifyAuditIntegrity(organisationId, startDate, endDate),
  ]);

  const entityCounts = await db.auditLog.groupBy({
    by: ['entityType'],
    where: { organisationId, createdAt: { gte: startDate, lte: endDate } },
    _count: { id: true },
  });

  const dataByEntity: Record<string, number> = {};
  entityCounts.forEach((e) => {
    dataByEntity[e.entityType] = e._count.id;
  });

  return {
    totalAuditEntries: totalAuditEntries,
    integrityValid: integrity.valid,
    policiesActive: policies,
    recordsArchived: archives,
    dataByEntity,
  };
}
