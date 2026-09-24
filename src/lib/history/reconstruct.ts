import type { ChangeValue, HistoryEvent } from "@/lib/history/types";

/** Campos de id cujo rótulo (nome/título no momento) acompanha o valor no snapshot. */
const LABEL_KEYS: Record<string, string> = {
  ownerId: "ownerName",
  architectId: "architectName",
  techLeadId: "techLeadName",
  assigneeId: "assigneeName",
  authorId: "authorName",
  meetingId: "meetingTitle",
  dependsOnId: "dependsOnTitle",
  affects: "affectsLabel",
};

const SNAPSHOT_EVENTS = [".created", ".baseline", ".restored", ".archived"];

type State = Record<string, ChangeValue>;

/**
 * Reconstrói o estado de uma entidade num momento: parte do snapshot mais recente (created/baseline/
 * restored/archived) e aplica as linhas de mudança seguintes, em ordem de `seq`. Recebe os eventos da
 * entidade já filtrados até o momento desejado; eventos legados (sem estrutura) são ignorados.
 */
export function reconstructFromEvents(events: HistoryEvent[]): State | null {
  let state: State | null = null;
  const ordered = [...events].sort((a, b) => (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0));
  for (const event of ordered) {
    if (event.schemaVersion < 2) continue;
    if (event.snapshot && SNAPSHOT_EVENTS.some((suffix) => event.eventType.endsWith(suffix))) {
      state = { ...(event.snapshot as State) };
      continue;
    }
    if (!state) continue;
    for (const change of event.changes) {
      state[change.field] = (change.toValue ?? null) as ChangeValue;
      const labelKey = LABEL_KEYS[change.field];
      if (labelKey) state[labelKey] = change.toLabel ?? null;
    }
  }
  return state;
}

/** Estado de uma entidade no momento `at` (inclusive), a partir do histórico estruturado. */
export async function reconstructAt(entityType: string, entityId: string, at: Date): Promise<State | null> {
  const { prisma } = await import("@/lib/prisma");
  const events = await prisma.activityLog.findMany({
    where: { entityType, entityId, schemaVersion: 2, createdAt: { lte: at } },
    orderBy: { seq: "asc" },
    include: { changes: true },
  });
  return reconstructFromEvents(events);
}
