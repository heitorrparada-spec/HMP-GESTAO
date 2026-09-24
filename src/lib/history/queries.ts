import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { HistoryEvent } from "@/lib/history/types";

export const HISTORY_PAGE_SIZE = 30;

/** Eventos *.baseline são âncoras técnicas da reconstrução — não aparecem nos históricos da UI. */
export const NOT_BASELINE: Prisma.ActivityLogWhereInput = { NOT: { eventType: { endsWith: ".baseline" } } };

/** Quantos eventos mostrar a partir do parâmetro da página (?historico=N), em passos do tamanho da página. */
export function historyLimit(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(n) || n <= HISTORY_PAGE_SIZE) return HISTORY_PAGE_SIZE;
  return Math.min(Math.ceil(n / HISTORY_PAGE_SIZE) * HISTORY_PAGE_SIZE, 2_000);
}

/**
 * Histórico por escopo (agregado): { featureId }, { decisionId }, { meetingId }, { productId }, a entidade
 * ({ entityType, entityId }) ou tudo ({}). Um mesmo evento aparece em todos os escopos a que pertence.
 */
export async function getHistory(
  where: Prisma.ActivityLogWhereInput,
  limit: number = HISTORY_PAGE_SIZE,
): Promise<{ items: HistoryEvent[]; hasMore: boolean }> {
  const rows = await prisma.activityLog.findMany({
    where: { AND: [where, NOT_BASELINE] },
    orderBy: { seq: "desc" },
    take: limit + 1,
    include: { changes: true },
  });
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}
