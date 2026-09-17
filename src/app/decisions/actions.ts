"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getCurrentActor } from "@/lib/actor";

export async function createDecision(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const context = String(formData.get("context") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const alternatives = String(formData.get("alternatives") ?? "").trim();
  const authorId = String(formData.get("authorId") ?? "") || null;
  const meetingId = String(formData.get("meetingId") ?? "") || null;
  const productId = String(formData.get("productId") ?? "") || null;
  const featureId = String(formData.get("featureId") ?? "") || null;
  const decidedAtRaw = String(formData.get("decidedAt") ?? "");
  const participantIds = formData.getAll("participantIds").map(String);

  if (!title || !decision) {
    throw new Error("Título e decisão são obrigatórios.");
  }

  const actor = await getCurrentActor();

  const created = await prisma.decision.create({
    data: {
      title,
      context: context || null,
      decision,
      reason: reason || null,
      alternatives: alternatives || null,
      authorId,
      meetingId,
      productId,
      featureId,
      decidedAt: decidedAtRaw ? new Date(decidedAtRaw) : new Date(),
      participants: {
        create: participantIds.map((personId) => ({ personId })),
      },
    },
    include: { feature: true, product: true },
  });

  await logActivity({
    entityType: "decision",
    entityId: created.id,
    eventType: "decision.created",
    description: `Decisão registrada: "${created.title}"${
      created.feature ? ` (afeta ${created.feature.title})` : created.product ? ` (afeta ${created.product.name})` : ""
    }`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  revalidatePath("/decisions");
  revalidatePath("/");
  revalidatePath("/activity");
  if (featureId) revalidatePath(`/features/${featureId}`);
  if (productId) revalidatePath(`/products/${productId}`);
  if (meetingId) revalidatePath(`/meetings/${meetingId}`);

  redirect(`/decisions/${created.id}`);
}
