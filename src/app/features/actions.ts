"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getCurrentActor } from "@/lib/actor";
import { featureStatusMeta } from "@/lib/labels";
import type { CriteriaStatus, FeatureStatus, ValidationResult } from "@/generated/prisma/client";

function revalidateFeature(featureId: string, productId: string) {
  revalidatePath(`/features/${featureId}`);
  revalidatePath("/features");
  revalidatePath("/");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/activity");
  revalidatePath("/validations");
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
