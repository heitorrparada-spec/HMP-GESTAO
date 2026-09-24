"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { command } from "@/lib/history/command";
import { compact, dateOnly, fieldChange, peopleChange } from "@/lib/history/diff";
import { DECISION_MERIT_FIELDS, decisionLock, requireReason, optionalReason } from "@/lib/history/policy";
import { affectsKey, decisionScopes, decisionSnapshot } from "@/lib/history/snapshots";
import { changedFieldsSummary } from "@/lib/history/present";
import { parseDateInput } from "@/lib/format";
import { formText } from "@/lib/form";
import { ActionError, runAction, type ActionResult } from "@/lib/action-result";
import type { Db, PersonRef } from "@/lib/history/types";

const DECISION_NOT_FOUND = "Esta decisão não foi encontrada — ela pode ter sido removida. Recarregue a página.";

// "Afeta" é uma escolha única: uma Feature já implica seu Product, então os dois nunca divergem.
async function resolveAffects(tx: Db, raw: string) {
  if (!raw) return { featureId: null, productId: null, label: null };
  const [kind, id] = raw.split(":");
  if (kind === "feature" && id) {
    const feature = await tx.feature.findUnique({ where: { id } });
    if (!feature) throw new ActionError('A Feature escolhida em "Afeta" não foi encontrada. Recarregue a página.');
    return { featureId: feature.id, productId: feature.productId, label: `Feature "${feature.title}"` };
  }
  if (kind === "product" && id) {
    const product = await tx.product.findUnique({ where: { id } });
    if (!product) throw new ActionError('O Product escolhido em "Afeta" não foi encontrado. Recarregue a página.');
    return { featureId: null, productId: product.id, label: `Product "${product.name}"` };
  }
  throw new ActionError('Vínculo da decisão inválido — escolha em "Afeta" uma Feature, um Product ou Nenhum.');
}

async function readDecisionInput(tx: Db, formData: FormData) {
  const title = formText(formData, "title");
  const decision = formText(formData, "decision");
  if (!title || !decision) throw new ActionError("Informe o título e o texto da decisão.");

  const authorId = String(formData.get("authorId") ?? "");
  if (!authorId) throw new ActionError("Selecione o autor da decisão.");

  const decidedAtRaw = String(formData.get("decidedAt") ?? "");
  const decidedAt = decidedAtRaw ? parseDateInput(decidedAtRaw) : new Date();
  if (!decidedAt) throw new ActionError("Data da decisão inválida — informe uma data existente.");
  if (dateOnly(decidedAt)! > dateOnly(new Date())!) {
    throw new ActionError("A data da decisão não pode ser no futuro — registre a decisão quando ela for tomada.");
  }

  const meetingId = String(formData.get("meetingId") ?? "") || null;
  const participantIds = [...new Set(formData.getAll("participantIds").map(String).filter(Boolean))];

  const [author, meeting, participants, affects] = await Promise.all([
    tx.person.findUnique({ where: { id: authorId } }),
    meetingId ? tx.meeting.findUnique({ where: { id: meetingId } }) : null,
    participantIds.length > 0 ? tx.person.findMany({ where: { id: { in: participantIds } } }) : [],
    resolveAffects(tx, String(formData.get("affects") ?? "")),
  ]);
  if (!author) throw new ActionError("O autor selecionado não foi encontrado. Recarregue a página.");
  if (meetingId && !meeting) throw new ActionError("A reunião de origem selecionada não foi encontrada. Recarregue a página.");
  if (participants.length !== participantIds.length) {
    throw new ActionError("Um dos participantes selecionados não foi encontrado. Recarregue a página e selecione de novo.");
  }

  return {
    data: {
      title,
      decision,
      context: formText(formData, "context") || null,
      reason: formText(formData, "reason") || null,
      alternatives: formText(formData, "alternatives") || null,
      authorId,
      decidedAt,
      meetingId,
      featureId: affects.featureId,
      productId: affects.productId,
    },
    author,
    meeting,
    affectsLabel: affects.label,
    participants: participants.map((p): PersonRef => ({ id: p.id, name: p.name })),
  };
}

async function loadDecision(tx: Db, decisionId: string) {
  const decision = await tx.decision.findUnique({
    where: { id: decisionId },
    include: {
      author: { select: { id: true, name: true } },
      meeting: { select: { id: true, title: true, date: true } },
      feature: { select: { id: true, title: true } },
      product: { select: { id: true, name: true } },
      participants: { include: { person: { select: { id: true, name: true } } } },
      // Tasks arquivadas contam: a decisão continua tendo gerado trabalho.
      _count: { select: { generatedTasks: true } },
    },
  });
  if (!decision) throw new ActionError(DECISION_NOT_FOUND);
  return decision;
}

type LoadedDecision = Awaited<ReturnType<typeof loadDecision>>;

function affectsLabelOf(d: LoadedDecision) {
  return d.feature ? `Feature "${d.feature.title}"` : d.product ? `Product "${d.product.name}"` : null;
}

function lockOf(d: LoadedDecision) {
  return decisionLock({ status: d.status, createdAt: d.createdAt, generatedTaskCount: d._count.generatedTasks });
}

function revalidateDecision(d: { id: string; featureId: string | null; productId: string | null; meetingId: string | null }) {
  revalidatePath(`/decisions/${d.id}`);
  revalidatePath("/decisions");
  revalidatePath("/");
  revalidatePath("/activity");
  if (d.featureId) revalidatePath(`/features/${d.featureId}`);
  if (d.productId) revalidatePath(`/products/${d.productId}`);
  if (d.meetingId) revalidatePath(`/meetings/${d.meetingId}`);
}

/** Registra uma decisão; com `supersedesId`, ela substitui uma decisão vigente (que passa a SUPERSEDED). */
export async function createDecision(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const supersedesId = String(formData.get("supersedesId") ?? "") || null;

    const result = await command(async ({ tx, record }) => {
      const input = await readDecisionInput(tx, formData);
      const previous = supersedesId ? await loadDecision(tx, supersedesId) : null;
      if (previous && previous.status !== "ACTIVE") {
        throw new ActionError("A decisão que seria substituída já foi substituída ou revogada. Recarregue a página.");
      }
      const supersedeReason = previous ? requireReason(formData.get("supersedeReason"), "substituir a decisão anterior") : null;

      const created = await tx.decision.create({
        data: {
          ...input.data,
          supersedesId: previous?.id ?? null,
          participants: { create: input.participants.map((p) => ({ personId: p.id })) },
        },
      });

      await record({
        eventType: "decision.created",
        entityType: "decision",
        entityId: created.id,
        entityLabel: created.title,
        scopes: decisionScopes(created),
        description: `Decisão registrada: "${created.title}"${input.affectsLabel ? ` (afeta ${input.affectsLabel})` : ""}${
          input.meeting ? ` na reunião "${input.meeting.title}"` : ""
        }${previous ? ` — substitui "${previous.title}"` : ""}`,
        snapshot: decisionSnapshot({
          ...created,
          author: input.author,
          meetingTitle: input.meeting?.title,
          affectsLabel: input.affectsLabel,
          participants: input.participants,
        }),
        context: {
          meeting: input.meeting ? { id: input.meeting.id, title: input.meeting.title, date: input.meeting.date.toISOString() } : null,
          supersedes: previous ? { id: previous.id, title: previous.title } : null,
        },
      });

      if (previous) {
        await tx.decision.update({ where: { id: previous.id }, data: { status: "SUPERSEDED" } });
        await record({
          eventType: "decision.superseded",
          entityType: "decision",
          entityId: previous.id,
          entityLabel: previous.title,
          scopes: decisionScopes(previous),
          description: `Decisão "${previous.title}" substituída por "${created.title}"`,
          reason: supersedeReason,
          changes: compact([fieldChange("status", "ACTIVE", "SUPERSEDED")]),
          context: { supersededBy: { id: created.id, title: created.title } },
        });
      }
      return { created, previous };
    });

    revalidateDecision(result.created);
    if (result.previous) revalidateDecision(result.previous);
    redirect(`/decisions/${result.created.id}`);
  });
}

export async function updateDecision(decisionId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const decision = await command(async ({ tx, record }) => {
      const current = await loadDecision(tx, decisionId);
      const lock = lockOf(current);
      if (current.status !== "ACTIVE") throw new ActionError(lock.message!);

      if (lock.locked) {
        // Travada: só o título admite correção (sensível: motivo obrigatório). Mérito muda substituindo.
        const meritInForm = DECISION_MERIT_FIELDS.some((f) => formData.has(f === "participants" ? "participantIds" : f));
        if (meritInForm) throw new ActionError(lock.message!);
        const title = formText(formData, "title");
        if (!title) throw new ActionError("Informe o título da decisão.");
        const changes = compact([fieldChange("title", current.title, title)]);
        if (changes.length === 0) return current;
        const reason = requireReason(formData.get("changeReason"), "corrigir o título de uma decisão travada");

        await tx.decision.update({ where: { id: decisionId }, data: { title } });
        await record({
          eventType: "decision.updated",
          entityType: "decision",
          entityId: decisionId,
          entityLabel: title,
          scopes: decisionScopes(current),
          description: `Título da decisão corrigido: "${current.title}" → "${title}"`,
          reason,
          changes,
        });
        return current;
      }

      const input = await readDecisionInput(tx, formData);
      const currentParticipants = current.participants.map(({ person }) => person);
      const changes = compact([
        fieldChange("title", current.title, input.data.title),
        fieldChange("decision", current.decision, input.data.decision),
        fieldChange("context", current.context, input.data.context),
        fieldChange("reason", current.reason, input.data.reason),
        fieldChange("alternatives", current.alternatives, input.data.alternatives),
        fieldChange("authorId", current.authorId, input.data.authorId, { from: current.author?.name, to: input.author.name }),
        fieldChange("decidedAt", dateOnly(current.decidedAt), dateOnly(input.data.decidedAt)),
        fieldChange("meetingId", current.meetingId, input.data.meetingId, {
          from: current.meeting?.title,
          to: input.meeting?.title,
        }),
        fieldChange("affects", affectsKey(current), affectsKey(input.data), { from: affectsLabelOf(current), to: input.affectsLabel }),
        peopleChange("participants", currentParticipants, input.participants),
      ]);
      if (changes.length === 0) return current;

      await tx.decision.update({ where: { id: decisionId }, data: input.data });
      if (changes.some((c) => c.field === "participants")) {
        await tx.decisionParticipant.deleteMany({ where: { decisionId } });
        await tx.decisionParticipant.createMany({ data: input.participants.map((p) => ({ decisionId, personId: p.id })) });
      }
      await record({
        eventType: "decision.updated",
        entityType: "decision",
        entityId: decisionId,
        entityLabel: input.data.title,
        scopes: decisionScopes({ id: decisionId, ...input.data }),
        description: `Decisão "${input.data.title}" alterada na janela de correção — ${changedFieldsSummary(changes)}`,
        reason: optionalReason(formData.get("changeReason")),
        changes,
      });
      return { ...current, ...input.data };
    });

    revalidateDecision(decision);
    redirect(`/decisions/${decisionId}`);
  });
}

export async function revokeDecision(decisionId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const decision = await command(async ({ tx, actor, record }) => {
      const current = await loadDecision(tx, decisionId);
      if (current.status !== "ACTIVE") throw new ActionError(lockOf(current).message!);
      const reason = requireReason(formData.get("revokeReason"), "revogar a decisão");

      await tx.decision.update({
        where: { id: decisionId },
        data: { status: "REVOKED", revokedAt: new Date(), revokedById: actor.id, revokeReason: reason },
      });
      await record({
        eventType: "decision.revoked",
        entityType: "decision",
        entityId: decisionId,
        entityLabel: current.title,
        scopes: decisionScopes(current),
        description: `Decisão "${current.title}" revogada`,
        reason,
        changes: compact([fieldChange("status", "ACTIVE", "REVOKED")]),
      });
      return current;
    });

    revalidateDecision(decision);
    redirect(`/decisions/${decisionId}`);
  });
}
