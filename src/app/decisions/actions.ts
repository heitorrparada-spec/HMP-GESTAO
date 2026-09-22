"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getCurrentActor } from "@/lib/actor";
import { parseDateInput } from "@/lib/format";

// "Afeta" é uma escolha única: uma Feature já implica seu Product, então os dois nunca divergem.
async function resolveAffects(raw: string): Promise<{ featureId: string | null; productId: string | null }> {
  if (!raw) return { featureId: null, productId: null };
  const [kind, id] = raw.split(":");
  if (kind === "feature" && id) {
    const feature = await prisma.feature.findUnique({ where: { id } });
    if (!feature) throw new Error("Feature inexistente.");
    return { featureId: feature.id, productId: feature.productId };
  }
  if (kind === "product" && id) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new Error("Product inexistente.");
    return { featureId: null, productId: product.id };
  }
  throw new Error("Vínculo da decisão inválido.");
}

function affectsKey(d: { featureId: string | null; productId: string | null }) {
  return d.featureId ? `feature:${d.featureId}` : d.productId ? `product:${d.productId}` : "";
}

async function readDecisionInput(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  if (!title || !decision) throw new Error("Título e decisão são obrigatórios.");

  const authorId = String(formData.get("authorId") ?? "");
  if (!authorId) throw new Error("Autor da decisão é obrigatório.");

  const decidedAtRaw = String(formData.get("decidedAt") ?? "");
  const decidedAt = decidedAtRaw ? parseDateInput(decidedAtRaw) : new Date();
  if (!decidedAt) throw new Error("Data da decisão inválida.");

  const meetingId = String(formData.get("meetingId") ?? "") || null;
  const participantIds = [...new Set(formData.getAll("participantIds").map(String).filter(Boolean))];

  const [author, meeting, participantCount, affects] = await Promise.all([
    prisma.person.findUnique({ where: { id: authorId } }),
    meetingId ? prisma.meeting.findUnique({ where: { id: meetingId } }) : null,
    participantIds.length > 0 ? prisma.person.count({ where: { id: { in: participantIds } } }) : 0,
    resolveAffects(String(formData.get("affects") ?? "")),
  ]);
  if (!author) throw new Error("Autor inexistente.");
  if (meetingId && !meeting) throw new Error("Reunião inexistente.");
  if (participantCount !== participantIds.length) throw new Error("Participante inexistente.");

  return {
    data: {
      title,
      decision,
      context: String(formData.get("context") ?? "").trim() || null,
      reason: String(formData.get("reason") ?? "").trim() || null,
      alternatives: String(formData.get("alternatives") ?? "").trim() || null,
      authorId,
      decidedAt,
      meetingId,
      ...affects,
    },
    participantIds,
    meetingTitle: meeting?.title ?? null,
  };
}

function revalidateDecision(
  decisionId: string,
  d: { featureId: string | null; productId: string | null; meetingId: string | null },
) {
  revalidatePath(`/decisions/${decisionId}`);
  revalidatePath("/decisions");
  revalidatePath("/");
  revalidatePath("/activity");
  if (d.featureId) revalidatePath(`/features/${d.featureId}`);
  if (d.productId) revalidatePath(`/products/${d.productId}`);
  if (d.meetingId) revalidatePath(`/meetings/${d.meetingId}`);
}

export async function createDecision(formData: FormData) {
  const { data, participantIds, meetingTitle } = await readDecisionInput(formData);
  const actor = await getCurrentActor();

  const created = await prisma.decision.create({
    data: { ...data, participants: { create: participantIds.map((personId) => ({ personId })) } },
    include: { feature: true, product: true },
  });

  const affected = created.feature?.title ?? created.product?.name;
  await logActivity({
    entityType: "decision",
    entityId: created.id,
    eventType: "decision.created",
    description: `Decisão registrada: "${created.title}"${affected ? ` (afeta ${affected})` : ""}${
      meetingTitle ? ` na reunião "${meetingTitle}"` : ""
    }`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  revalidateDecision(created.id, data);
  redirect(`/decisions/${created.id}`);
}

export async function updateDecision(decisionId: string, formData: FormData) {
  const current = await prisma.decision.findUniqueOrThrow({
    where: { id: decisionId },
    include: { _count: { select: { generatedTasks: true } } },
  });
  const { data, participantIds } = await readDecisionInput(formData);

  // As tasks geradas herdaram a Feature da decisão; mudá-la agora deixaria as duas pontas incoerentes.
  if (current._count.generatedTasks > 0 && affectsKey(data) !== affectsKey(current)) {
    throw new Error("Esta decisão já gerou tasks — o Product/Feature afetado não pode mais mudar.");
  }

  const actor = await getCurrentActor();

  await prisma.$transaction([
    prisma.decisionParticipant.deleteMany({ where: { decisionId } }),
    prisma.decision.update({
      where: { id: decisionId },
      data: { ...data, participants: { create: participantIds.map((personId) => ({ personId })) } },
    }),
  ]);

  await logActivity({
    entityType: "decision",
    entityId: decisionId,
    eventType: "decision.updated",
    description: `Decisão "${data.title}" foi editada`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  revalidateDecision(decisionId, data);
  redirect(`/decisions/${decisionId}`);
}
