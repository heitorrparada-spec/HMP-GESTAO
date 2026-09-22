"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getCurrentActor } from "@/lib/actor";
import { featureStatusMeta } from "@/lib/labels";
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

export async function createFeature(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const fields = readFeatureFields(formData);

  if (!fields.title || !productId) {
    throw new Error("Título e Product são obrigatórios.");
  }

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
}

export async function updateFeature(featureId: string, formData: FormData) {
  const feature = await prisma.feature.findUniqueOrThrow({ where: { id: featureId } });
  const fields = readFeatureFields(formData);

  if (!fields.title) {
    throw new Error("Título é obrigatório.");
  }

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
}

export async function updateFeatureStatus(featureId: string, status: FeatureStatus) {
  const feature = await prisma.feature.findUniqueOrThrow({ where: { id: featureId } });
  if (feature.status === status) return;

  const actor = await getCurrentActor();

  await prisma.feature.update({ where: { id: featureId }, data: { status } });

  await logActivity({
    entityType: "feature",
    entityId: featureId,
    eventType: "feature.status_changed",
    description: `Feature "${feature.title}" avançou de ${featureStatusMeta[feature.status].label} para ${featureStatusMeta[status].label}`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  revalidateFeature(featureId, feature.productId);
}

export async function recordValidation(formData: FormData) {
  const featureId = String(formData.get("featureId"));
  const overallResult = String(formData.get("overallResult")) as ValidationResult;
  const notes = String(formData.get("notes") ?? "").trim();
  const issuesFound = String(formData.get("issuesFound") ?? "").trim();

  const [feature, criteria, actor, previousAttempts] = await Promise.all([
    prisma.feature.findUniqueOrThrow({ where: { id: featureId } }),
    prisma.acceptanceCriteria.findMany({ where: { featureId } }),
    getCurrentActor(),
    prisma.validationRecord.count({ where: { featureId } }),
  ]);

  await Promise.all(
    criteria.map((c) => {
      const result = formData.get(`criteria_${c.id}`);
      if (result !== "PASSED" && result !== "FAILED") return null;
      return prisma.acceptanceCriteria.update({
        where: { id: c.id },
        data: { status: result as CriteriaStatus },
      });
    }),
  );

  const attemptNumber = previousAttempts + 1;

  await prisma.validationRecord.create({
    data: {
      featureId,
      attemptNumber,
      overallResult,
      notes: notes || null,
      issuesFound: issuesFound || null,
      validatedById: actor?.id ?? null,
      validatedAt: new Date(),
    },
  });

  const nextStatus: FeatureStatus = overallResult === "APPROVED" ? "DONE" : "DEVELOPMENT";
  await prisma.feature.update({ where: { id: featureId }, data: { status: nextStatus } });

  await logActivity({
    entityType: "validation",
    entityId: featureId,
    eventType: overallResult === "APPROVED" ? "validation.approved" : "validation.rejected",
    description: `Validação da Feature "${feature.title}" (tentativa ${attemptNumber}) foi ${
      overallResult === "APPROVED" ? "aprovada" : "reprovada"
    }`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  revalidateFeature(featureId, feature.productId);
}

export async function createRequirement(featureId: string, formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("Descrição do requisito é obrigatória.");

  const priority = (String(formData.get("priority") ?? "P2") || "P2") as Priority;
  const source = String(formData.get("source") ?? "").trim() || null;

  const feature = await prisma.feature.findUniqueOrThrow({ where: { id: featureId } });
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
}

export async function updateRequirement(requirementId: string, featureId: string, formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("Descrição do requisito é obrigatória.");

  const priority = String(formData.get("priority") ?? "P2") as Priority;
  const status = String(formData.get("status") ?? "PROPOSED") as RequirementStatus;
  const source = String(formData.get("source") ?? "").trim() || null;

  const feature = await prisma.feature.findUniqueOrThrow({ where: { id: featureId } });
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
}

export async function deleteRequirement(requirementId: string, featureId: string) {
  const [feature, requirement, actor] = await Promise.all([
    prisma.feature.findUniqueOrThrow({ where: { id: featureId } }),
    prisma.requirement.findUniqueOrThrow({ where: { id: requirementId } }),
    getCurrentActor(),
  ]);

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
}
