import { db } from '@/db/client';
import { auditEvents } from '@/db/schema';

export interface AuditEventInput {
  projectId: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(input: AuditEventInput): Promise<void> {
  await db.insert(auditEvents).values({
    projectId: input.projectId,
    actor: input.actor,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
  });
}
