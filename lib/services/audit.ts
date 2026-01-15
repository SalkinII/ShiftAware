import { prisma } from "@/lib/db";
import { AuditAction, EntityType } from "@prisma/client";

export interface AuditLogInput {
  userId?: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ipAddress?: string;
}

export async function createAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before ? (input.before as object) : undefined,
      after: input.after ? (input.after as object) : undefined,
      reason: input.reason,
      ipAddress: input.ipAddress,
    },
  });
}
