"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { command } from "@/lib/history/command";
import { compact, fieldChange } from "@/lib/history/diff";
import {
  FEATURE_NARRATIVE_FIELDS,
  featureLockMessage,
  featureLocks,
  isRegression,
  optionalReason,
  requireReason,
} from "@/lib/history/policy";
import { criteriaSnapshot, featureScopes, featureSnapshot, requirementSnapshot } from "@/lib/history/snapshots";
import { changedFieldsSummary } from "@/lib/history/present";
import { featureStatusMeta, featureStatusOrder } from "@/lib/labels";
import { formText } from "@/lib/form";
import { ActionError, runAction, type ActionResult } from "@/lib/action-result";
import type { Change, Db } from "@/lib/history/types";
import type { CriteriaStatus, FeatureStatus, Priority, RequirementStatus, ValidationResult } from "@/generated/prisma/client";

const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];
const REQUIREMENT_STATUSES: RequirementStatus[] = ["PROPOSED", "APPROVED", "IMPLEMENTED", "TESTED"];

function revalidateFeature(featureId: string, productId: string) {
  revalidatePath(`/features/${featureId}`);
  revalidatePath("/features");
  revalidatePath("/");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/activity");
  revalidatePath("/validations");
}

const FEATURE_NOT_FOUND = "Esta Feature não foi encontrada — ela pode ter sido removida. Recarregue a página.";
const REQUIREMENT_NOT_FOUND = "Este requisito não existe mais nesta Feature. Recarregue a página.";
const CRITERIA_NOT_FOUND = "Este critério de aceite não existe mais nesta Feature. Recarregue a página.";

const PERSON_FIELDS = ["ownerId", "architectId", "techLeadId"] as const;
type PersonField = (typeof PERSON_FIELDS)[number];
const PERSON_RELATION: Record<PersonField, "owner" | "architect" | "techLead"> = {
  ownerId: "owner",
  architectId: "architect",
  techLeadId: "techLead",
};

async function loadFeature(tx: Db, featureId: string) {
  const feature = await tx.feature.findUnique({
    where: { id: featureId },
    include: {
      owner: { select: { id: true, name: true } },
      architect: { select: { id: true, name: true } },
      techLead: { select: { id: true, name: true } },
    },
  });
  if (!feature) throw new ActionError(FEATURE_NOT_FOUND);
  return feature;
}

// Só os campos presentes no formulário: campos travados aparecem como texto, não como input.
function readFeatureInput(formData: FormData) {
  const text = (name: string) => (formData.has(name) ? formText(formData, name) || null : undefined);
  const priorityRaw = formData.has("priority") ? String(formData.get("priority") ?? "") : undefined;
  if (priorityRaw && !PRIORITIES.includes(priorityRaw as Priority)) throw new ActionError("Prioridade inválida.");
  const input = {
    title: text("title"),
    context: text("context"),
    problem: text("problem"),
    userNeed: text("userNeed"),
    objective: text("objective"),
    functionalFlow: text("functionalFlow"),
    architectureNotes: text("architectureNotes"),
    priority: priorityRaw === undefined ? undefined : ((priorityRaw || null) as Priority | null),
    ownerId: formData.has("ownerId") ? String(formData.get("ownerId") ?? "") || null : undefined,
    architectId: formData.has("architectId") ? String(formData.get("architectId") ?? "") || null : undefined,
    techLeadId: formData.has("techLeadId") ? String(formData.get("techLeadId") ?? "") || null : undefined,
  };
  if (formData.has("title") && !input.title) throw new ActionError("Informe o título da Feature.");
  return input;
}

async function resolvePeople(tx: Db, ids: Array<string | null | undefined>) {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  const people = wanted.length ? await tx.person.findMany({ where: { id: { in: wanted } } }) : [];
  if (people.length !== wanted.length) throw new ActionError("Um dos responsáveis selecionados não foi encontrado. Recarregue a página.");
  return new Map(people.map((p) => [p.id, p]));
}

export async function createFeature(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const productId = String(formData.get("productId") ?? "");
    const input = readFeatureInput(formData);
    if (!input.title) throw new ActionError("Informe o título da Feature.");
    if (!productId) throw new ActionError("Selecione o Product da Feature.");

    const created = await command(async ({ tx, record }) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new ActionError("O Product selecionado não foi encontrado. Recarregue a página.");
      const people = await resolvePeople(tx, [input.ownerId, input.architectId, input.techLeadId]);

      const feature = await tx.feature.create({
        data: {
          title: input.title!,
          context: input.context ?? null,
          problem: input.problem ?? null,
          userNeed: input.userNeed ?? null,
          objective: input.objective ?? null,
          functionalFlow: input.functionalFlow ?? null,
          architectureNotes: input.architectureNotes ?? null,
          priority: input.priority ?? null,
          ownerId: input.ownerId ?? null,
          architectId: input.architectId ?? null,
          techLeadId: input.techLeadId ?? null,
          productId,
          status: "BACKLOG",
        },
      });
      await record({
        eventType: "feature.created",
        entityType: "feature",
        entityId: feature.id,
        entityLabel: feature.title,
        scopes: featureScopes(feature),
        description: `Feature "${feature.title}" criada`,
        snapshot: featureSnapshot({
          ...feature,
          owner: feature.ownerId ? people.get(feature.ownerId) : null,
          architect: feature.architectId ? people.get(feature.architectId) : null,
          techLead: feature.techLeadId ? people.get(feature.techLeadId) : null,
        }),
      });
      return feature;
    });

    revalidateFeature(created.id, productId);
    redirect(`/features/${created.id}`);
  });
}

export async function updateFeature(featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const input = readFeatureInput(formData);

    const feature = await command(async ({ tx, record }) => {
      const feature = await loadFeature(tx, featureId);
      const locks = featureLocks(feature.status);
      const people = await resolvePeople(tx, [input.ownerId, input.architectId, input.techLeadId]);

      const narrative = compact(
        FEATURE_NARRATIVE_FIELDS.map((field) =>
          input[field] === undefined ? null : fieldChange(field, feature[field], input[field]),
        ),
      );
      const planning: Change[] = compact([
        input.priority === undefined ? null : fieldChange("priority", feature.priority, input.priority),
        ...PERSON_FIELDS.map((field) =>
          input[field] === undefined
            ? null
            : fieldChange(field, feature[field], input[field], {
                from: feature[PERSON_RELATION[field]]?.name,
                to: input[field] ? people.get(input[field]!)?.name : null,
              }),
        ),
      ]);

      if (narrative.length > 0 && locks.narrative) throw new ActionError(featureLockMessage(feature.status, "narrative"));
      if (planning.length > 0 && locks.planning) throw new ActionError(featureLockMessage(feature.status, "planning"));
      const changes = [...narrative, ...planning];
      if (changes.length === 0) return feature;

      await tx.feature.update({
        where: { id: featureId },
        data: Object.fromEntries(changes.map((c) => [c.field, c.to])),
      });
      await record({
        eventType: "feature.updated",
        entityType: "feature",
        entityId: featureId,
        entityLabel: input.title ?? feature.title,
        scopes: featureScopes(feature),
        description: `Feature "${input.title ?? feature.title}" alterada — ${changedFieldsSummary(changes)}`,
        changes,
        reason: optionalReason(formData.get("reason")),
      });
      return feature;
    });

    revalidateFeature(featureId, feature.productId);
    redirect(`/features/${featureId}`);
  });
}

// Só os gates de Validation/Done são rígidos; estágios antes de Review ficam livres de propósito.
function assertValidManualTransition(current: FeatureStatus, target: FeatureStatus) {
  if (current === "DONE") {
    throw new ActionError("Esta Feature já está em Done — o status não muda mais.");
  }
  if (target === "DONE") {
    throw new ActionError(
      "A Feature só chega a Done sendo aprovada em Validation. Leve-a para Review, depois para Validation, e registre a aprovação.",
    );
  }
  if (target === "VALIDATION" && current !== "REVIEW") {
    throw new ActionError("A Feature não pode avançar para Validation porque precisa passar primeiro por Review.");
  }
}

export async function updateFeatureStatus(featureId: string, status: FeatureStatus, formData?: FormData): Promise<ActionResult> {
  return runAction(async () => {
    if (!featureStatusOrder.includes(status)) throw new ActionError("Status inválido para a Feature.");

    const feature = await command(async ({ tx, record }) => {
      const feature = await loadFeature(tx, featureId);
      if (feature.status === status) return null;
      assertValidManualTransition(feature.status, status);
      const regression = isRegression(feature.status, status);
      const reason = regression ? requireReason(formData?.get("reason"), "voltar o status da Feature") : null;

      // Update condicional: se o status mudou desde a leitura (ex.: aprovada em paralelo), não sobrescreve.
      const { count } = await tx.feature.updateMany({ where: { id: featureId, status: feature.status }, data: { status } });
      if (count === 0) {
        throw new ActionError("O status desta Feature mudou enquanto a página estava aberta — recarregue e tente de novo.");
      }

      await record({
        eventType: "feature.status_changed",
        entityType: "feature",
        entityId: featureId,
        entityLabel: feature.title,
        scopes: featureScopes(feature),
        description: `Feature "${feature.title}" ${regression ? "voltou" : "avançou"} de ${featureStatusMeta[feature.status].label} para ${featureStatusMeta[status].label}`,
        reason,
        changes: compact([fieldChange("status", feature.status, status)]),
      });
      return feature;
    });

    if (feature) revalidateFeature(featureId, feature.productId);
  });
}

function evaluateApprovalGate(criteria: { status: CriteriaStatus }[]): { canApprove: boolean; reason?: string } {
  if (criteria.length === 0) {
    return { canApprove: false, reason: "não há nenhum Acceptance Criteria cadastrado para esta Feature" };
  }
  const failed = criteria.filter((c) => c.status === "FAILED").length;
  const pending = criteria.filter((c) => c.status === "PENDING").length;
  if (failed + pending === 0) return { canApprove: true };

  const parts: string[] = [];
  if (failed > 0) parts.push(`${failed} critério${failed !== 1 ? "s" : ""} reprovado${failed !== 1 ? "s" : ""}`);
  if (pending > 0) parts.push(`${pending} critério${pending !== 1 ? "s" : ""} ainda não avaliado${pending !== 1 ? "s" : ""}`);
  return { canApprove: false, reason: parts.join(" e ") };
}

export async function recordValidation(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const featureId = String(formData.get("featureId"));
    const requestedResult = String(formData.get("overallResult"));
    const notes = formText(formData, "notes");
    const issuesFoundInput = formText(formData, "issuesFound");

    if (requestedResult !== "APPROVED" && requestedResult !== "REJECTED") {
      throw new ActionError("Resultado de validação inválido — use Aprovar ou Reprovar.");
    }

    const feature = await command(async ({ tx, actor, record }) => {
      const feature = await loadFeature(tx, featureId);
      if (feature.status !== "VALIDATION") {
        throw new ActionError(
          "A Feature não está mais em Validation, então a validação não foi registrada. Recarregue a página para ver o estado atual.",
        );
      }

      const criteria = await tx.acceptanceCriteria.findMany({ where: { featureId, archivedAt: null }, orderBy: { createdAt: "asc" } });
      const before = new Map(criteria.map((c) => [c.id, c.status]));
      for (const c of criteria) {
        const result = formData.get(`criteria_${c.id}`);
        if ((result === "PASSED" || result === "FAILED") && result !== c.status) {
          await tx.acceptanceCriteria.update({ where: { id: c.id }, data: { status: result as CriteriaStatus } });
        }
      }

      const [finalCriteria, requirements, tasks, attempts] = await Promise.all([
        tx.acceptanceCriteria.findMany({ where: { featureId, archivedAt: null }, orderBy: { createdAt: "asc" } }),
        tx.requirement.findMany({ where: { featureId, archivedAt: null }, orderBy: { createdAt: "asc" } }),
        tx.task.findMany({
          where: { featureId, archivedAt: null },
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        }),
        tx.validationRecord.count({ where: { featureId } }),
      ]);
      const gate = evaluateApprovalGate(finalCriteria);
      // Aprovar sem o gate satisfeito vira REJECTED: a tentativa fica registrada em vez de descartada.
      const blockedApproval = requestedResult === "APPROVED" && !gate.canApprove;
      const finalResult: ValidationResult = blockedApproval ? "REJECTED" : requestedResult;
      const attemptNumber = attempts + 1;

      // "O que foi aprovado": o que estava em vigor nesta tentativa, mesmo que mude depois.
      const validation = await tx.validationRecord.create({
        data: {
          featureId,
          attemptNumber,
          overallResult: finalResult,
          requestedResult,
          notes: notes || null,
          issuesFound: blockedApproval
            ? `Aprovação bloqueada: ${gate.reason}.${issuesFoundInput ? ` ${issuesFoundInput}` : ""}`
            : issuesFoundInput || null,
          criteriaSnapshot: finalCriteria.map((c) => ({ id: c.id, description: c.description, status: c.status })),
          requirementsSnapshot: requirements.map((r) => ({
            id: r.id,
            description: r.description,
            priority: r.priority,
            status: r.status,
            source: r.source,
          })),
          tasksSnapshot: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            assigneeId: t.assigneeId,
            assigneeName: t.assignee?.name ?? null,
          })),
          featureSnapshot: featureSnapshot(feature),
          validatedById: actor.id,
          validatedByName: actor.name,
          validatedAt: new Date(),
        },
      });

      const nextStatus: FeatureStatus = finalResult === "APPROVED" ? "DONE" : "DEVELOPMENT";
      const { count } = await tx.feature.updateMany({ where: { id: featureId, status: "VALIDATION" }, data: { status: nextStatus } });
      if (count === 0) {
        throw new ActionError("A Feature saiu de Validation enquanto a validação era registrada — recarregue a página.");
      }

      const scopes = featureScopes(feature);
      await record({
        eventType: "validation.recorded",
        entityType: "validation",
        entityId: validation.id,
        entityLabel: `Tentativa ${attemptNumber}`,
        scopes,
        description: blockedApproval
          ? `Tentativa de aprovar a Feature "${feature.title}" (tentativa ${attemptNumber}) foi bloqueada: ${gate.reason}`
          : `Validação da Feature "${feature.title}" (tentativa ${attemptNumber}) ${finalResult === "APPROVED" ? "aprovada" : "reprovada"}`,
        changes: compact([
          fieldChange("result", null, finalResult),
          ...finalCriteria.map((c) =>
            fieldChange(`criteria:${c.id}`, before.get(c.id) ?? null, c.status, { from: c.description, to: c.description }),
          ),
        ]),
        context: { requestedResult, blockedBy: blockedApproval ? gate.reason ?? null : null },
      });
      await record({
        eventType: "feature.status_changed",
        entityType: "feature",
        entityId: featureId,
        entityLabel: feature.title,
        scopes,
        description:
          finalResult === "APPROVED"
            ? `Feature "${feature.title}" aprovada na validação — avançou para Done`
            : `Feature "${feature.title}" reprovada na validação — voltou para Development`,
        changes: compact([fieldChange("status", "VALIDATION", nextStatus)]),
      });
      return feature;
    });

    revalidateFeature(featureId, feature.productId);
  });
}

// ---------- Requirements ----------

async function loadRequirement(tx: Db, requirementId: string, featureId: string) {
  const requirement = await tx.requirement.findUnique({ where: { id: requirementId } });
  if (!requirement || requirement.featureId !== featureId) throw new ActionError(REQUIREMENT_NOT_FOUND);
  return requirement;
}

function assertRequirementsEditable(status: FeatureStatus) {
  if (featureLocks(status).requirements) throw new ActionError(featureLockMessage(status, "requirements"));
}

function revalidateFeaturePage(featureId: string) {
  revalidatePath(`/features/${featureId}`);
  revalidatePath("/activity");
}

export async function createRequirement(featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const description = formText(formData, "description");
    if (!description) throw new ActionError("Informe a descrição do requisito.");
    const priority = (String(formData.get("priority") ?? "P2") || "P2") as Priority;
    if (!PRIORITIES.includes(priority)) throw new ActionError("Prioridade inválida.");
    const source = formText(formData, "source") || null;

    await command(async ({ tx, record }) => {
      const feature = await loadFeature(tx, featureId);
      assertRequirementsEditable(feature.status);
      const requirement = await tx.requirement.create({ data: { featureId, description, priority, source } });
      await record({
        eventType: "requirement.created",
        entityType: "requirement",
        entityId: requirement.id,
        entityLabel: description,
        scopes: featureScopes(feature),
        description: `Requisito adicionado à Feature "${feature.title}": "${description}"`,
        snapshot: requirementSnapshot(requirement),
      });
    });
    revalidateFeaturePage(featureId);
  });
}

export async function updateRequirement(requirementId: string, featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const description = formText(formData, "description");
    if (!description) throw new ActionError("Informe a descrição do requisito.");
    const priority = String(formData.get("priority") ?? "P2") as Priority;
    const status = String(formData.get("status") ?? "PROPOSED") as RequirementStatus;
    if (!PRIORITIES.includes(priority) || !REQUIREMENT_STATUSES.includes(status)) {
      throw new ActionError("Prioridade ou status do requisito inválido.");
    }
    const source = formText(formData, "source") || null;

    await command(async ({ tx, record }) => {
      const feature = await loadFeature(tx, featureId);
      const requirement = await loadRequirement(tx, requirementId, featureId);
      assertRequirementsEditable(feature.status);
      if (requirement.archivedAt) throw new ActionError("Este requisito está arquivado — restaure-o antes de editar.");

      const changes = compact([
        fieldChange("description", requirement.description, description),
        fieldChange("priority", requirement.priority, priority),
        fieldChange("status", requirement.status, status),
        fieldChange("source", requirement.source, source),
      ]);
      if (changes.length === 0) return;

      await tx.requirement.update({ where: { id: requirementId }, data: { description, priority, status, source } });
      await record({
        eventType: "requirement.updated",
        entityType: "requirement",
        entityId: requirementId,
        entityLabel: description,
        scopes: featureScopes(feature),
        description: `Requisito "${description}" da Feature "${feature.title}" alterado — ${changedFieldsSummary(changes)}`,
        changes,
      });
    });
    revalidateFeaturePage(featureId);
  });
}

export async function archiveRequirement(requirementId: string, featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await command(async ({ tx, actor, record }) => {
      const feature = await loadFeature(tx, featureId);
      const requirement = await loadRequirement(tx, requirementId, featureId);
      assertRequirementsEditable(feature.status);
      if (requirement.archivedAt) throw new ActionError("Este requisito já está arquivado.");
      const reason = requireReason(formData.get("reason"), "arquivar o requisito");

      const archivedAt = new Date();
      const archived = await tx.requirement.update({
        where: { id: requirementId },
        data: { archivedAt, archivedById: actor.id, archiveReason: reason },
      });
      await record({
        eventType: "requirement.archived",
        entityType: "requirement",
        entityId: requirementId,
        entityLabel: requirement.description,
        scopes: featureScopes(feature),
        description: `Requisito "${requirement.description}" arquivado na Feature "${feature.title}"`,
        reason,
        changes: compact([fieldChange("archivedAt", null, archivedAt)]),
        snapshot: requirementSnapshot(archived),
      });
    });
    revalidateFeaturePage(featureId);
  });
}

export async function restoreRequirement(requirementId: string, featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await command(async ({ tx, record }) => {
      const feature = await loadFeature(tx, featureId);
      const requirement = await loadRequirement(tx, requirementId, featureId);
      assertRequirementsEditable(feature.status);
      if (!requirement.archivedAt) throw new ActionError("Este requisito não está arquivado.");
      const reason = requireReason(formData.get("reason"), "restaurar o requisito");

      const restored = await tx.requirement.update({
        where: { id: requirementId },
        data: { archivedAt: null, archivedById: null, archiveReason: null },
      });
      await record({
        eventType: "requirement.restored",
        entityType: "requirement",
        entityId: requirementId,
        entityLabel: requirement.description,
        scopes: featureScopes(feature),
        description: `Requisito "${requirement.description}" restaurado na Feature "${feature.title}"`,
        reason,
        changes: compact([fieldChange("archivedAt", requirement.archivedAt, null)]),
        snapshot: requirementSnapshot(restored),
      });
    });
    revalidateFeaturePage(featureId);
  });
}

// ---------- Acceptance Criteria ----------

// Os critérios são o contrato da validação: mudá-los durante ou depois dela burlaria o gate.
function assertCriteriaEditable(status: FeatureStatus) {
  if (featureLocks(status).criteria) throw new ActionError(featureLockMessage(status, "criteria"));
}

async function loadCriteria(tx: Db, criteriaId: string, featureId: string) {
  const criteria = await tx.acceptanceCriteria.findUnique({ where: { id: criteriaId } });
  if (!criteria || criteria.featureId !== featureId) throw new ActionError(CRITERIA_NOT_FOUND);
  return criteria;
}

export async function createAcceptanceCriteria(featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const description = formText(formData, "description");
    if (!description) throw new ActionError("Informe a descrição do critério de aceite.");

    await command(async ({ tx, record }) => {
      const feature = await loadFeature(tx, featureId);
      assertCriteriaEditable(feature.status);
      const criteria = await tx.acceptanceCriteria.create({ data: { featureId, description } });
      await record({
        eventType: "criteria.created",
        entityType: "criteria",
        entityId: criteria.id,
        entityLabel: description,
        scopes: featureScopes(feature),
        description: `Critério de aceite adicionado à Feature "${feature.title}": "${description}"`,
        snapshot: criteriaSnapshot(criteria),
      });
    });
    revalidateFeaturePage(featureId);
  });
}

export async function archiveAcceptanceCriteria(criteriaId: string, featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await command(async ({ tx, actor, record }) => {
      const feature = await loadFeature(tx, featureId);
      const criteria = await loadCriteria(tx, criteriaId, featureId);
      assertCriteriaEditable(feature.status);
      if (criteria.archivedAt) throw new ActionError("Este critério de aceite já está arquivado.");
      const reason = requireReason(formData.get("reason"), "arquivar o critério de aceite");

      const archivedAt = new Date();
      const archived = await tx.acceptanceCriteria.update({
        where: { id: criteriaId },
        data: { archivedAt, archivedById: actor.id, archiveReason: reason },
      });
      await record({
        eventType: "criteria.archived",
        entityType: "criteria",
        entityId: criteriaId,
        entityLabel: criteria.description,
        scopes: featureScopes(feature),
        description: `Critério de aceite "${criteria.description}" arquivado na Feature "${feature.title}"`,
        reason,
        changes: compact([fieldChange("archivedAt", null, archivedAt)]),
        snapshot: criteriaSnapshot(archived),
      });
    });
    revalidateFeaturePage(featureId);
  });
}

export async function restoreAcceptanceCriteria(criteriaId: string, featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await command(async ({ tx, record }) => {
      const feature = await loadFeature(tx, featureId);
      const criteria = await loadCriteria(tx, criteriaId, featureId);
      assertCriteriaEditable(feature.status);
      if (!criteria.archivedAt) throw new ActionError("Este critério de aceite não está arquivado.");
      const reason = requireReason(formData.get("reason"), "restaurar o critério de aceite");

      const restored = await tx.acceptanceCriteria.update({
        where: { id: criteriaId },
        data: { archivedAt: null, archivedById: null, archiveReason: null },
      });
      await record({
        eventType: "criteria.restored",
        entityType: "criteria",
        entityId: criteriaId,
        entityLabel: criteria.description,
        scopes: featureScopes(feature),
        description: `Critério de aceite "${criteria.description}" restaurado na Feature "${feature.title}"`,
        reason,
        changes: compact([fieldChange("archivedAt", criteria.archivedAt, null)]),
        snapshot: criteriaSnapshot(restored),
      });
    });
    revalidateFeaturePage(featureId);
  });
}
