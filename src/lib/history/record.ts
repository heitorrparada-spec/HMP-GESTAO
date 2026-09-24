import { Prisma } from "@/generated/prisma/client";
import type { ChangeValue, Db, EventInput, EventSource } from "@/lib/history/types";

function json(value: ChangeValue | Record<string, ChangeValue> | undefined) {
  return value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

/**
 * Grava um evento estruturado (schemaVersion 2). Sempre dentro da mesma transação da mudança de estado:
 * sem evento não há mudança, e vice-versa. O momento é o do servidor (default do banco).
 */
export async function recordEvent(
  db: Db,
  meta: { actorId: string | null; actorName: string | null; correlationId: string | null; source: EventSource },
  event: EventInput,
) {
  await db.activityLog.create({
    data: {
      entityType: event.entityType,
      entityId: event.entityId,
      eventType: event.eventType,
      description: event.description,
      actorId: meta.actorId,
      actorName: meta.actorName,
      schemaVersion: 2,
      source: meta.source,
      correlationId: meta.correlationId,
      entityLabel: event.entityLabel,
      reason: event.reason?.trim() || null,
      context: json(event.context),
      snapshot: json(event.snapshot),
      featureId: event.scopes.featureId ?? null,
      decisionId: event.scopes.decisionId ?? null,
      meetingId: event.scopes.meetingId ?? null,
      productId: event.scopes.productId ?? null,
      changes: event.changes?.length
        ? {
            create: event.changes.map((c) => ({
              field: c.field,
              fromValue: json(c.from),
              toValue: json(c.to),
              fromLabel: c.fromLabel ?? null,
              toLabel: c.toLabel ?? null,
            })),
          }
        : undefined,
    },
  });
}
