import { dateOnly } from "@/lib/history/diff";
import type { ChangeValue, PersonRef, Scopes } from "@/lib/history/types";
import type { FeatureStatus, Priority, RequirementStatus, CriteriaStatus, TaskStatus, DecisionStatus } from "@/generated/prisma/client";

/**
 * Snapshots: o estado completo de uma entidade num momento (criação, arquivamento, restauração, baseline).
 * As chaves são as mesmas usadas nas linhas de mudança — é o que permite reconstruir o passado aplicando
 * as mudanças sobre o último snapshot (reconstruct.ts).
 */

type Named = { id: string; name: string } | null | undefined;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function featureSnapshot(f: {
  title: string;
  context: string | null;
  problem: string | null;
  userNeed: string | null;
  objective: string | null;
  functionalFlow: string | null;
  architectureNotes: string | null;
  priority: Priority | null;
  status: FeatureStatus;
  productId: string;
  owner?: Named;
  architect?: Named;
  techLead?: Named;
}): Record<string, ChangeValue> {
  return {
    title: f.title,
    context: f.context,
    problem: f.problem,
    userNeed: f.userNeed,
    objective: f.objective,
    functionalFlow: f.functionalFlow,
    architectureNotes: f.architectureNotes,
    priority: f.priority,
    status: f.status,
    productId: f.productId,
    ownerId: f.owner?.id ?? null,
    ownerName: f.owner?.name ?? null,
    architectId: f.architect?.id ?? null,
    architectName: f.architect?.name ?? null,
    techLeadId: f.techLead?.id ?? null,
    techLeadName: f.techLead?.name ?? null,
  };
}

export function requirementSnapshot(r: {
  featureId: string;
  description: string;
  priority: Priority;
  status: RequirementStatus;
  source: string | null;
  archivedAt?: Date | null;
  archiveReason?: string | null;
}): Record<string, ChangeValue> {
  return {
    featureId: r.featureId,
    description: r.description,
    priority: r.priority,
    status: r.status,
    source: r.source,
    archivedAt: iso(r.archivedAt),
    archiveReason: r.archiveReason ?? null,
  };
}

export function criteriaSnapshot(c: {
  featureId: string;
  description: string;
  status: CriteriaStatus;
  archivedAt?: Date | null;
  archiveReason?: string | null;
}): Record<string, ChangeValue> {
  return {
    featureId: c.featureId,
    description: c.description,
    status: c.status,
    archivedAt: iso(c.archivedAt),
    archiveReason: c.archiveReason ?? null,
  };
}

export function taskSnapshot(t: {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  blockedReason: string | null;
  featureId: string | null;
  decisionId: string | null;
  meetingId: string | null;
  createdById: string | null;
  archivedAt?: Date | null;
  archiveReason?: string | null;
  assignee?: Named;
  dependsOn?: { id: string; title: string } | null;
}): Record<string, ChangeValue> {
  return {
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: dateOnly(t.dueDate),
    assigneeId: t.assignee?.id ?? null,
    assigneeName: t.assignee?.name ?? null,
    blockedReason: t.blockedReason,
    featureId: t.featureId,
    decisionId: t.decisionId,
    meetingId: t.meetingId,
    createdById: t.createdById,
    dependsOnId: t.dependsOn?.id ?? null,
    dependsOnTitle: t.dependsOn?.title ?? null,
    archivedAt: iso(t.archivedAt),
    archiveReason: t.archiveReason ?? null,
  };
}

export function affectsKey(d: { featureId: string | null; productId: string | null }): string | null {
  return d.featureId ? `feature:${d.featureId}` : d.productId ? `product:${d.productId}` : null;
}

export function decisionSnapshot(d: {
  title: string;
  decision: string;
  context: string | null;
  reason: string | null;
  alternatives: string | null;
  decidedAt: Date;
  meetingId: string | null;
  featureId: string | null;
  productId: string | null;
  status: DecisionStatus;
  supersedesId?: string | null;
  author?: Named;
  meetingTitle?: string | null;
  affectsLabel?: string | null;
  participants: PersonRef[];
}): Record<string, ChangeValue> {
  return {
    title: d.title,
    decision: d.decision,
    context: d.context,
    reason: d.reason,
    alternatives: d.alternatives,
    authorId: d.author?.id ?? null,
    authorName: d.author?.name ?? null,
    decidedAt: dateOnly(d.decidedAt),
    meetingId: d.meetingId,
    meetingTitle: d.meetingTitle ?? null,
    affects: affectsKey(d),
    affectsLabel: d.affectsLabel ?? null,
    featureId: d.featureId,
    productId: d.productId,
    participants: [...d.participants].sort((a, b) => a.id.localeCompare(b.id)),
    status: d.status,
    supersedesId: d.supersedesId ?? null,
  };
}

export function meetingSnapshot(m: {
  title: string;
  date: Date;
  agenda: string | null;
  notes: string | null;
  participants: PersonRef[];
}): Record<string, ChangeValue> {
  return {
    title: m.title,
    date: m.date.toISOString(),
    agenda: m.agenda,
    notes: m.notes,
    participants: [...m.participants].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

// ---------- Escopos ----------

export function featureScopes(f: { id: string; productId: string }): Scopes {
  return { featureId: f.id, productId: f.productId };
}

export function taskScopes(
  t: { featureId: string | null; decisionId: string | null; meetingId: string | null },
  related: { featureProductId?: string | null; decision?: { meetingId: string | null; productId: string | null } | null },
): Scopes {
  return {
    featureId: t.featureId,
    decisionId: t.decisionId,
    meetingId: t.meetingId ?? related.decision?.meetingId ?? null,
    productId: related.featureProductId ?? related.decision?.productId ?? null,
  };
}

export function decisionScopes(d: { id: string; featureId: string | null; meetingId: string | null; productId: string | null }): Scopes {
  return { decisionId: d.id, featureId: d.featureId, meetingId: d.meetingId, productId: d.productId };
}
