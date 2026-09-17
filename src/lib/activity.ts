import { prisma } from "@/lib/prisma";

export type EntityType =
  | "product"
  | "release"
  | "feature"
  | "requirement"
  | "task"
  | "meeting"
  | "decision"
  | "artifact"
  | "validation";

/**
 * Registro append-only de eventos — a base da rastreabilidade do HMP OS.
 * Toda mutação relevante feita pelas server actions passa por aqui.
 */
export async function logActivity(params: {
  entityType: EntityType;
  entityId: string;
  eventType: string;
  description: string;
  actorId?: string | null;
  actorName?: string | null;
}) {
  await prisma.activityLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: params.eventType,
      description: params.description,
      actorId: params.actorId ?? null,
      actorName: params.actorName ?? null,
    },
  });
}
