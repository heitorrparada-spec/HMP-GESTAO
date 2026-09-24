import type { Change } from "@/lib/history/types";

/** Rótulo legível de cada campo, na ordem em que as mudanças aparecem no histórico. */
export const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  status: "Status",
  result: "Resultado",
  decision: "Decisão",
  description: "Descrição",
  context: "Contexto",
  problem: "Problema",
  userNeed: "Necessidade do usuário",
  objective: "Objetivo",
  functionalFlow: "Fluxo funcional",
  architectureNotes: "Notas de arquitetura",
  reason: "Justificativa",
  alternatives: "Alternativas",
  priority: "Prioridade",
  ownerId: "Owner (Product)",
  architectId: "Architecture",
  techLeadId: "Engineering",
  assigneeId: "Responsável",
  authorId: "Autor",
  dueDate: "Prazo",
  decidedAt: "Data da decisão",
  date: "Data",
  meetingId: "Reunião de origem",
  affects: "Afeta",
  participants: "Participantes",
  agenda: "Pauta",
  notes: "Notas",
  blockedReason: "Motivo do bloqueio",
  dependsOnId: "Depende de",
  source: "Fonte",
  archivedAt: "Arquivamento",
};

const ORDER = Object.keys(FIELD_LABELS);

export function fieldLabel(field: string, fallback?: string | null): string {
  if (field.startsWith("criteria:")) return fallback ? `Critério "${fallback}"` : "Critério";
  return FIELD_LABELS[field] ?? field;
}

export function sortChanges<T extends { field: string }>(changes: T[]): T[] {
  const rank = (f: string) => (f.startsWith("criteria:") ? ORDER.length : ORDER.indexOf(f) === -1 ? ORDER.length + 1 : ORDER.indexOf(f));
  return [...changes].sort((a, b) => rank(a.field) - rank(b.field));
}

/** "Responsável, Prazo" — resumo gravado no texto do evento (o detalhe fica nas linhas de mudança). */
export function changedFieldsSummary(changes: Change[]): string {
  return sortChanges(changes)
    .map((c) => fieldLabel(c.field, c.toLabel ?? c.fromLabel))
    .join(", ");
}
