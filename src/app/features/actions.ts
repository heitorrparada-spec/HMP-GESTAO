"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getCurrentActor } from "@/lib/actor";
import { featureStatusMeta, featureStatusOrder } from "@/lib/labels";
import { ActionError, runAction, type ActionResult } from "@/lib/action-result";
import type { CriteriaStatus, FeatureStatus, Priority, RequirementStatus, ValidationResult } from "@/generated/prisma/client";

function revalidateFeature(featureId: string, productId: string) {
  revalidatePath(`/features/${featureId}`);
  revalidatePath("/features");
  revalidatePath("/");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/activity");
  revalidatePath("/validations");
}

function readFeatureFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "");
  return {
    title,
    context: String(formData.get("context") ?? "").trim() || null,
    problem: String(formData.get("problem") ?? "").trim() || null,
    userNeed: String(formData.get("userNeed") ?? "").trim() || null,
    objective: String(formData.get("objective") ?? "").trim() || null,
    functionalFlow: String(formData.get("functionalFlow") ?? "").trim() || null,
    architectureNotes: String(formData.get("architectureNotes") ?? "").trim() || null,
    priority: (priorityRaw || null) as Priority | null,
    ownerId: String(formData.get("ownerId") ?? "") || null,
    architectId: String(formData.get("architectId") ?? "") || null,
    techLeadId: String(formData.get("techLeadId") ?? "") || null,
  };
}

const FEATURE_NOT_FOUND = "Esta Feature não foi encontrada — ela pode ter sido removida. Recarregue a página.";

export async function createFeature(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const productId = String(formData.get("productId") ?? "");
    const fields = readFeatureFields(formData);

    if (!fields.title) throw new ActionError("Informe o título da Feature.");
    if (!productId) throw new ActionError("Selecione o Product da Feature.");

    const actor = await getCurrentActor();

    const created = await prisma.feature.create({
      data: { ...fields, title: fields.title, productId, status: "BACKLOG" },
    });

    await logActivity({
      entityType: "feature",
      entityId: created.id,
      eventType: "feature.created",
      description: `Feature "${created.title}" criada`,
      actorId: actor?.id,
      actorName: actor?.name,
    });

    revalidateFeature(created.id, productId);
    redirect(`/features/${created.id}`);
  });
}

export async function updateFeature(featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const feature = await prisma.feature.findUnique({ where: { id: featureId } });
    if (!feature) throw new ActionError(FEATURE_NOT_FOUND);
    const fields = readFeatureFields(formData);

    if (!fields.title) throw new ActionError("Informe o título da Feature.");

    const actor = await getCurrentActor();

    await prisma.feature.update({ where: { id: featureId }, data: fields });

    await logActivity({
      entityType: "feature",
      entityId: featureId,
      eventType: "feature.updated",
      description: `Feature "${fields.title}" foi editada`,
      actorId: actor?.id,
      actorName: actor?.name,
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

export async function updateFeatureStatus(featureId: string, status: FeatureStatus): Promise<ActionResult> {
  return runAction(async () => {
    const feature = await prisma.feature.findUnique({ where: { id: featureId } });
    if (!feature) throw new ActionError(FEATURE_NOT_FOUND);
    if (feature.status === status) return;

    assertValidManualTransition(feature.status, status);

    const actor = await getCurrentActor();

    // Update condicional: se o status mudou desde a leitura (ex.: aprovada em paralelo), não sobrescreve.
    const { count } = await prisma.feature.updateMany({
      where: { id: featureId, status: feature.status },
      data: { status },
    });
    if (count === 0) {
      throw new ActionError("O status desta Feature mudou enquanto a página estava aberta — recarregue e tente de novo.");
    }

    const verb = featureStatusOrder.indexOf(status) > featureStatusOrder.indexOf(feature.status) ? "avançou" : "voltou";

    await logActivity({
      entityType: "feature",
      entityId: featureId,
      eventType: "feature.status_changed",
      description: `Feature "${feature.title}" ${verb} de ${featureStatusMeta[feature.status].label} para ${featureStatusMeta[status].label}`,
      actorId: actor?.id,
      actorName: actor?.name,
    });

    if (status === "VALIDATION") {
      await logActivity({
        entityType: "validation",
        entityId: featureId,
        eventType: "validation.started",
        description: `Feature "${feature.title}" entrou em Validation`,
        actorId: actor?.id,
        actorName: actor?.name,
      });
    }

    revalidateFeature(featureId, feature.productId);
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
    const notes = String(formData.get("notes") ?? "").trim();
    const issuesFoundInput = String(formData.get("issuesFound") ?? "").trim();

    if (requestedResult !== "APPROVED" && requestedResult !== "REJECTED") {
      throw new ActionError("Resultado de validação inválido — use Aprovar ou Reprovar.");
    }

    const actor = await getCurrentActor();

    // Neon de produção pode estar frio: o timeout default (5s) de transação interativa não basta.
    const { feature, attemptNumber, finalResult, gate } = await prisma.$transaction(
      async (tx) => {
        const feature = await tx.feature.findUnique({ where: { id: featureId } });
        if (!feature) throw new ActionError(FEATURE_NOT_FOUND);

        if (feature.status !== "VALIDATION") {
          throw new ActionError(
            "A Feature não está mais em Validation, então a validação não foi registrada. Recarregue a página para ver o estado atual.",
          );
        }

        const criteria = await tx.acceptanceCriteria.findMany({ where: { featureId } });

        for (const c of criteria) {
          const result = formData.get(`criteria_${c.id}`);
          if (result !== "PASSED" && result !== "FAILED") continue;
          await tx.acceptanceCriteria.update({ where: { id: c.id }, data: { status: result as CriteriaStatus } });
        }

        const finalCriteria = await tx.acceptanceCriteria.findMany({
          where: { featureId },
          orderBy: { createdAt: "asc" },
        });
        const gate = evaluateApprovalGate(finalCriteria);
        // Aprovar sem o gate satisfeito vira REJECTED: a tentativa fica registrada em vez de descartada.
        const blockedApproval = requestedResult === "APPROVED" && !gate.canApprove;
        const finalResult: ValidationResult = blockedApproval ? "REJECTED" : requestedResult;

        const attemptNumber = (await tx.validationRecord.count({ where: { featureId } })) + 1;

        await tx.validationRecord.create({
          data: {
            featureId,
            attemptNumber,
            overallResult: finalResult,
            notes: notes || null,
            issuesFound: blockedApproval
              ? `Aprovação bloqueada: ${gate.reason}.${issuesFoundInput ? ` ${issuesFoundInput}` : ""}`
              : issuesFoundInput || null,
            criteriaSnapshot: finalCriteria.map((c) => ({ description: c.description, status: c.status })),
            validatedById: actor?.id ?? null,
            validatedAt: new Date(),
          },
        });

        const nextStatus: FeatureStatus = finalResult === "APPROVED" ? "DONE" : "DEVELOPMENT";
        const { count } = await tx.feature.updateMany({
          where: { id: featureId, status: "VALIDATION" },
          data: { status: nextStatus },
        });
        if (count === 0) {
          throw new ActionError("A Feature saiu de Validation enquanto a validação era registrada — recarregue a página.");
        }

        return { feature, attemptNumber, finalResult, gate };
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    const blocked = requestedResult === "APPROVED" && finalResult === "REJECTED";

    await logActivity({
      entityType: "validation",
      entityId: featureId,
      eventType: "validation.completed",
      description: `Validação da Feature "${feature.title}" (tentativa ${attemptNumber}) foi concluída`,
      actorId: actor?.id,
      actorName: actor?.name,
    });

    await logActivity({
      entityType: "validation",
      entityId: featureId,
      eventType: finalResult === "APPROVED" ? "validation.approved" : "validation.rejected",
      description: blocked
        ? `Tentativa de aprovar a Feature "${feature.title}" (tentativa ${attemptNumber}) foi bloqueada: ${gate.reason}`
        : `Validação da Feature "${feature.title}" (tentativa ${attemptNumber}) foi ${
            finalResult === "APPROVED" ? "aprovada — Feature avançou para Done" : "reprovada — Feature retornou para Development"
          }`,
      actorId: actor?.id,
      actorName: actor?.name,
    });

    revalidateFeature(featureId, feature.productId);
  });
}

const REQUIREMENT_NOT_FOUND = "Este requisito não existe mais — ele pode ter sido removido. Recarregue a página.";

export async function createRequirement(featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const description = String(formData.get("description") ?? "").trim();
    if (!description) throw new ActionError("Informe a descrição do requisito.");

    const priority = (String(formData.get("priority") ?? "P2") || "P2") as Priority;
    const source = String(formData.get("source") ?? "").trim() || null;

    const feature = await prisma.feature.findUnique({ where: { id: featureId } });
    if (!feature) throw new ActionError(FEATURE_NOT_FOUND);
    const actor = await getCurrentActor();

    await prisma.requirement.create({
      data: { featureId, description, priority, source },
    });

    await logActivity({
      entityType: "requirement",
      entityId: featureId,
      eventType: "requirement.created",
      description: `Requisito adicionado à Feature "${feature.title}": "${description}"`,
      actorId: actor?.id,
      actorName: actor?.name,
    });

    revalidatePath(`/features/${featureId}`);
    revalidatePath("/activity");
  });
}

export async function updateRequirement(
  requirementId: string,
  featureId: string,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const description = String(formData.get("description") ?? "").trim();
    if (!description) throw new ActionError("Informe a descrição do requisito.");

    const priority = String(formData.get("priority") ?? "P2") as Priority;
    const status = String(formData.get("status") ?? "PROPOSED") as RequirementStatus;
    const source = String(formData.get("source") ?? "").trim() || null;

    const [feature, requirement] = await Promise.all([
      prisma.feature.findUnique({ where: { id: featureId } }),
      prisma.requirement.findUnique({ where: { id: requirementId } }),
    ]);
    if (!feature) throw new ActionError(FEATURE_NOT_FOUND);
    if (requirement?.featureId !== featureId) throw new ActionError(REQUIREMENT_NOT_FOUND);
    const actor = await getCurrentActor();

    await prisma.requirement.update({
      where: { id: requirementId },
      data: { description, priority, status, source },
    });

    await logActivity({
      entityType: "requirement",
      entityId: featureId,
      eventType: "requirement.updated",
      description: `Requisito "${description}" da Feature "${feature.title}" foi editado`,
      actorId: actor?.id,
      actorName: actor?.name,
    });

    revalidatePath(`/features/${featureId}`);
    revalidatePath("/activity");
  });
}

export async function deleteRequirement(requirementId: string, featureId: string): Promise<ActionResult> {
  return runAction(async () => {
    const [feature, requirement, actor] = await Promise.all([
      prisma.feature.findUnique({ where: { id: featureId } }),
      prisma.requirement.findUnique({ where: { id: requirementId } }),
      getCurrentActor(),
    ]);
    if (!feature) throw new ActionError(FEATURE_NOT_FOUND);
    if (!requirement || requirement.featureId !== featureId) throw new ActionError(REQUIREMENT_NOT_FOUND);

    await prisma.requirement.delete({ where: { id: requirementId } });

    await logActivity({
      entityType: "requirement",
      entityId: featureId,
      eventType: "requirement.deleted",
      description: `Requisito "${requirement.description}" removido da Feature "${feature.title}"`,
      actorId: actor?.id,
      actorName: actor?.name,
    });

    revalidatePath(`/features/${featureId}`);
    revalidatePath("/activity");
  });
}

// Os critérios são o contrato da validação: mudá-los durante ou depois dela burlaria o gate.
function assertCriteriaEditable(status: FeatureStatus) {
  if (status === "VALIDATION") {
    throw new ActionError(
      "Os critérios de aceite ficam travados enquanto a Feature está em Validation. Para alterá-los, volte a Feature para Review.",
    );
  }
  if (status === "DONE") {
    throw new ActionError("A Feature já está em Done — os critérios de aceite ficam travados e não podem mais ser alterados.");
  }
}

export async function createAcceptanceCriteria(featureId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const description = String(formData.get("description") ?? "").trim();
    if (!description) throw new ActionError("Informe a descrição do critério de aceite.");

    const feature = await prisma.feature.findUnique({ where: { id: featureId } });
    if (!feature) throw new ActionError(FEATURE_NOT_FOUND);
    assertCriteriaEditable(feature.status);
    const actor = await getCurrentActor();

    await prisma.acceptanceCriteria.create({ data: { featureId, description } });

    await logActivity({
      entityType: "validation",
      entityId: featureId,
      eventType: "acceptance_criteria.created",
      description: `Critério de aceite adicionado à Feature "${feature.title}": "${description}"`,
      actorId: actor?.id,
      actorName: actor?.name,
    });

    revalidatePath(`/features/${featureId}`);
    revalidatePath("/activity");
  });
}

export async function deleteAcceptanceCriteria(criteriaId: string, featureId: string): Promise<ActionResult> {
  return runAction(async () => {
    const [criteria, actor] = await Promise.all([
      prisma.acceptanceCriteria.findUnique({ where: { id: criteriaId }, include: { feature: true } }),
      getCurrentActor(),
    ]);
    if (!criteria) {
      throw new ActionError("Este critério de aceite não existe mais — ele pode ter sido removido. Recarregue a página.");
    }
    if (criteria.featureId !== featureId) {
      throw new ActionError("Critério não pertence a esta Feature.");
    }
    const feature = criteria.feature;
    assertCriteriaEditable(feature.status);

    await prisma.acceptanceCriteria.delete({ where: { id: criteriaId } });

    await logActivity({
      entityType: "validation",
      entityId: featureId,
      eventType: "acceptance_criteria.deleted",
      description: `Critério de aceite "${criteria.description}" removido da Feature "${feature.title}"`,
      actorId: actor?.id,
      actorName: actor?.name,
    });

    revalidatePath(`/features/${featureId}`);
    revalidatePath("/activity");
  });
}
