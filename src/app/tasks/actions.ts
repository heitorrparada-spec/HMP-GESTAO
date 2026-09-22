"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getCurrentActor } from "@/lib/actor";
import { taskStatusMeta } from "@/lib/labels";
import type { Priority, TaskStatus } from "@/generated/prisma/client";

function revalidateTask(taskId: string, featureId: string | null) {
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/activity");
  if (featureId) revalidatePath(`/features/${featureId}`);
}

async function syncDependency(taskId: string, dependsOnId: string | null) {
  await prisma.taskDependency.deleteMany({ where: { taskId } });
  if (dependsOnId) {
    await prisma.taskDependency.create({ data: { taskId, dependsOnId } });
  }
}

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const featureId = String(formData.get("featureId") ?? "") || null;
  if (!title) throw new Error("Título é obrigatório.");

  const description = String(formData.get("description") ?? "").trim() || null;
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const priority = (String(formData.get("priority") ?? "P2") || "P2") as Priority;
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const dependsOnId = String(formData.get("dependsOnId") ?? "") || null;

  const actor = await getCurrentActor();

  const created = await prisma.task.create({
    data: {
      title,
      description,
      featureId,
      assigneeId,
      priority,
      status: "TODO",
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      createdById: actor?.id ?? null,
    },
  });

  if (dependsOnId) await syncDependency(created.id, dependsOnId);

  await logActivity({
    entityType: "task",
    entityId: created.id,
    eventType: "task.created",
    description: `Task "${created.title}" criada`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  revalidateTask(created.id, featureId);
  redirect(`/tasks/${created.id}`);
}

export async function updateTask(taskId: string, formData: FormData) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Título é obrigatório.");

  const description = String(formData.get("description") ?? "").trim() || null;
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const priority = (String(formData.get("priority") ?? "P2") || "P2") as Priority;
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const status = String(formData.get("status") ?? task.status) as TaskStatus;
  const blockedReason = String(formData.get("blockedReason") ?? "").trim() || null;
  const dependsOnId = String(formData.get("dependsOnId") ?? "") || null;

  const actor = await getCurrentActor();
  const statusChanged = status !== task.status;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description,
      assigneeId,
      priority,
      status,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      blockedReason: status === "BLOCKED" ? blockedReason : null,
    },
  });

  await syncDependency(taskId, dependsOnId);

  await logActivity({
    entityType: "task",
    entityId: taskId,
    eventType: "task.updated",
    description: `Task "${title}" foi editada`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  if (statusChanged) {
    await logActivity({
      entityType: "task",
      entityId: taskId,
      eventType: "task.status_changed",
      description: `Task "${title}" mudou de ${taskStatusMeta[task.status].label} para ${taskStatusMeta[status].label}`,
      actorId: actor?.id,
      actorName: actor?.name,
    });
  }

  revalidateTask(taskId, task.featureId);
  redirect(`/tasks/${taskId}`);
}

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

export async function deleteTask(taskId: string, featureId: string | null) {
  const [task, actor] = await Promise.all([
    prisma.task.findUniqueOrThrow({ where: { id: taskId } }),
    getCurrentActor(),
  ]);

  await prisma.taskDependency.deleteMany({ where: { OR: [{ taskId }, { dependsOnId: taskId }] } });
  await prisma.task.updateMany({ where: { parentTaskId: taskId }, data: { parentTaskId: null } });
  await prisma.task.delete({ where: { id: taskId } });

  await logActivity({
    entityType: "task",
    entityId: taskId,
    eventType: "task.deleted",
    description: `Task "${task.title}" excluída`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  revalidateTask(taskId, featureId);
  redirect(featureId ? `/features/${featureId}` : "/tasks");
}
