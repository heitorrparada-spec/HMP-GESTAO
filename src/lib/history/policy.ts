import { featureStatusOrder } from "@/lib/labels";
import { ActionError } from "@/lib/action-result";
import { cleanText } from "@/lib/form";
import type { DecisionStatus, FeatureStatus, TaskStatus } from "@/generated/prisma/client";

/**
 * Fonte única das regras de trava da V0.3-A (spec, seção 4). O backend decide por aqui; a UI só lê para
 * mostrar campos travados e pedir motivo. Três níveis: livre, sensível (motivo obrigatório), congelado.
 */

// ---------- Motivo ----------

export function requireReason(raw: FormDataEntryValue | null | undefined, what: string): string {
  const reason = cleanText(raw);
  if (!reason) throw new ActionError(`Informe o motivo para ${what} — ele fica registrado no histórico.`);
  return reason;
}

export function optionalReason(raw: FormDataEntryValue | null | undefined): string | null {
  return cleanText(raw) || null;
}

// ---------- Feature ----------

export const FEATURE_NARRATIVE_FIELDS = [
  "title",
  "context",
  "problem",
  "userNeed",
  "objective",
  "functionalFlow",
  "architectureNotes",
] as const;
export const FEATURE_PLANNING_FIELDS = ["priority", "ownerId", "architectId", "techLeadId"] as const;

export function featureLocks(status: FeatureStatus) {
  const contract = status === "VALIDATION" || status === "DONE";
  return {
    /** Título e narrativa: congelados em Validation (contrato em avaliação) e em Done. */
    narrative: contract,
    /** Prioridade e responsáveis: livres até Done. */
    planning: status === "DONE",
    requirements: contract,
    criteria: contract,
    done: status === "DONE",
  };
}

export function featureLockMessage(status: FeatureStatus, what: "narrative" | "planning" | "requirements" | "criteria") {
  if (status === "DONE") {
    return {
      narrative: "A Feature está em Done — título e narrativa ficam como foram aprovados.",
      planning: "A Feature está em Done — prioridade e responsáveis ficam como estavam na aprovação.",
      requirements: "A Feature está em Done — os requisitos ficam como foram aprovados e não podem mais mudar.",
      criteria: "A Feature já está em Done — os critérios de aceite ficam travados e não podem mais ser alterados.",
    }[what];
  }
  return {
    narrative: "A Feature está em Validation — título e narrativa ficam travados durante a validação. Para alterá-los, volte a Feature para Review.",
    planning: "",
    requirements: "A Feature está em Validation — os requisitos ficam travados durante a validação. Para alterá-los, volte a Feature para Review.",
    criteria: "Os critérios de aceite ficam travados enquanto a Feature está em Validation. Para alterá-los, volte a Feature para Review.",
  }[what];
}

export function isRegression(from: FeatureStatus, to: FeatureStatus): boolean {
  return featureStatusOrder.indexOf(to) < featureStatusOrder.indexOf(from);
}

// ---------- Task ----------

export function taskLocks(
  task: { status: TaskStatus; archivedAt: Date | null },
  featureStatus: FeatureStatus | null | undefined,
) {
  const archived = task.archivedAt !== null;
  const done = task.status === "DONE";
  const featureDone = featureStatus === "DONE";
  let contentMessage: string | null = null;
  if (archived) contentMessage = "Esta task está arquivada — ela fica como estava e não pode mais ser alterada.";
  else if (featureDone) contentMessage = "A Feature desta task está em Done — o conteúdo da task fica como estava.";
  else if (done) contentMessage = "Esta task está concluída — para editá-la, reabra-a primeiro (com um motivo).";
  return {
    archived,
    /** Título, descrição, prioridade, prazo, responsável e dependência. */
    contentLocked: contentMessage !== null,
    contentMessage,
    canChangeStatus: !archived && !(done && featureDone),
    /** Voltar de Done para outro status: sensível (motivo). */
    reopenRequiresReason: done,
    canArchive: !archived && !done,
    archiveBlockedMessage: archived
      ? "Esta task já está arquivada."
      : done
        ? "Tasks concluídas não podem ser arquivadas — elas são a evidência do trabalho feito."
        : null,
    canRestore: archived && !featureDone,
  };
}

// ---------- Decision ----------

export const DECISION_CORRECTION_WINDOW_HOURS = 24;

/** Mérito: o que foi decidido, por quem, quando, onde e com quem. Depois da trava, só substituindo. */
export const DECISION_MERIT_FIELDS = [
  "decision",
  "context",
  "reason",
  "alternatives",
  "authorId",
  "decidedAt",
  "meetingId",
  "affects",
  "participants",
] as const;

export type DecisionLock = {
  locked: boolean;
  kind: "tasks" | "window" | "superseded" | "revoked" | null;
  windowEndsAt: Date;
  message: string | null;
};

export function decisionLock(
  decision: { status: DecisionStatus; createdAt: Date; generatedTaskCount: number },
  now: Date = new Date(),
): DecisionLock {
  const windowEndsAt = new Date(decision.createdAt.getTime() + DECISION_CORRECTION_WINDOW_HOURS * 3_600_000);
  if (decision.status === "SUPERSEDED") {
    return { locked: true, kind: "superseded", windowEndsAt, message: "Esta decisão foi substituída — ela fica como estava e não pode mais ser alterada." };
  }
  if (decision.status === "REVOKED") {
    return { locked: true, kind: "revoked", windowEndsAt, message: "Esta decisão foi revogada — ela fica como estava e não pode mais ser alterada." };
  }
  if (decision.generatedTaskCount > 0) {
    return {
      locked: true,
      kind: "tasks",
      windowEndsAt,
      message: "Esta decisão já gerou trabalho — o mérito não pode mais ser editado. Registre uma nova decisão que substitui esta, ou revogue-a com um motivo.",
    };
  }
  if (now >= windowEndsAt) {
    return {
      locked: true,
      kind: "window",
      windowEndsAt,
      message: `A janela de correção desta decisão (${DECISION_CORRECTION_WINDOW_HOURS} h após o registro) terminou — o mérito não pode mais ser editado. Registre uma nova decisão que substitui esta, ou revogue-a com um motivo.`,
    };
  }
  return { locked: false, kind: null, windowEndsAt, message: null };
}

// ---------- Meeting ----------

/** Reunião que já aconteceu (ou já tem decisões): remarcar ou mudar participantes exige motivo. */
export function meetingIsSensitive(meeting: { date: Date; decisionCount: number }, now: Date = new Date()): boolean {
  return meeting.date.getTime() <= now.getTime() || meeting.decisionCount > 0;
}
