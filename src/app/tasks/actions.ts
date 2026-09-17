"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getCurrentActor } from "@/lib/actor";
import { taskStatusMeta } from "@/lib/labels";
import type { TaskStatus } from "@/generated/prisma/client";

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: { feature: true } });
  if (task.status === status) return;

  const actor = await getCurrentActor();

  await prisma.task.update({
    where: { id: taskId },
    data: { status, blockedReason: status === "BLOCKED" ? task.blockedReason : null },
  });

  await logActivity({
    entityType: "task",
    entityId: taskId,
    eventType: "task.status_changed",
    description: `Task "${task.title}" mudou de ${taskStatusMeta[task.status].label} para ${taskStatusMeta[status].label}`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/activity");
  if (task.featureId) {
    revalidatePath(`/features/${task.featureId}`);
    if (task.feature) revalidatePath(`/products/${task.feature.productId}`);
  }
}
