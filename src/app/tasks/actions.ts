"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getCurrentActor } from "@/lib/actor";
import { taskStatusMeta } from "@/lib/labels";
import { parseDateInput } from "@/lib/format";
import { ActionError, runAction, type ActionResult } from "@/lib/action-result";
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

const TASK_NOT_FOUND = "Esta task não existe mais — ela pode ter sido excluída. Volte para a lista de tasks.";
const DEPENDENCY_NOT_FOUND =
  'A task escolhida em "Depende de" não existe mais — ela pode ter sido excluída. Escolha outra ou deixe em branco.';

function readDueDate(formData: FormData): Date | null {
  const raw = String(formData.get("dueDate") ?? "");
  if (!raw) return null;
  const date = parseDateInput(raw);
  if (!date) throw new ActionError("Prazo inválido — informe uma data existente.");
  return date;
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) throw new ActionError("Informe o título da task.");

    const decisionId = String(formData.get("decisionId") ?? "") || null;
    let featureId = String(formData.get("featureId") ?? "") || null;
    const description = String(formData.get("description") ?? "").trim() || null;
    const assigneeId = String(formData.get("assigneeId") ?? "") || null;
    const priority = (String(formData.get("priority") ?? "P2") || "P2") as Priority;
    const dueDate = readDueDate(formData);
    const dependsOnId = String(formData.get("dependsOnId") ?? "") || null;

    const decision = decisionId
      ? await prisma.decision.findUnique({ where: { id: decisionId }, include: { meeting: true } })
      : null;
    if (decisionId && !decision) {
      throw new ActionError("A decisão de origem não foi encontrada. Volte para a decisão e tente criar a task de novo.");
    }

    // Task nascida de uma decisão fica no contexto dela: na Feature da decisão ou numa Feature do Product dela.
    if (decision?.featureId) {
      if (featureId && featureId !== decision.featureId) {
        throw new ActionError("A Task precisa ficar na Feature da decisão de origem.");
      }
      featureId = decision.featureId;
    }

    const [feature, assignee, dependsOn] = await Promise.all([
      featureId ? prisma.feature.findUnique({ where: { id: featureId } }) : null,
      assigneeId ? prisma.person.findUnique({ where: { id: assigneeId } }) : null,
      dependsOnId ? prisma.task.findUnique({ where: { id: dependsOnId } }) : null,
    ]);
    if (featureId && !feature) throw new ActionError("A Feature selecionada não foi encontrada. Recarregue a página.");
    if (feature && decision && !decision.featureId && decision.productId && feature.productId !== decision.productId) {
      throw new ActionError("A Feature da Task precisa ser do mesmo Product da decisão de origem.");
    }
    if (assigneeId && !assignee) throw new ActionError("O responsável selecionado não foi encontrado. Recarregue a página.");
    if (dependsOnId && !dependsOn) throw new ActionError(DEPENDENCY_NOT_FOUND);

    const actor = await getCurrentActor();

    const created = await prisma.task.create({
      data: {
        title,
        description,
        featureId,
        decisionId,
        assigneeId,
        priority,
        status: "TODO",
        dueDate,
        createdById: actor?.id ?? null,
      },
    });

    if (dependsOnId) await syncDependency(created.id, dependsOnId);

    await logActivity(
      decision
        ? {
            entityType: "task",
            entityId: created.id,
            eventType: "task.created_from_decision",
            description: `Task "${created.title}" criada a partir da decisão "${decision.title}"${
              decision.meeting ? ` (reunião "${decision.meeting.title}")` : ""
            }`,
            actorId: actor?.id,
            actorName: actor?.name,
          }
        : {
            entityType: "task",
            entityId: created.id,
            eventType: "task.created",
            description: `Task "${created.title}" criada`,
            actorId: actor?.id,
            actorName: actor?.name,
          },
    );

    revalidateTask(created.id, featureId);
    if (decision) {
      revalidatePath(`/decisions/${decision.id}`);
      if (decision.meetingId) revalidatePath(`/meetings/${decision.meetingId}`);
    }
    redirect(`/tasks/${created.id}`);
  });
}

export async function updateTask(taskId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new ActionError(TASK_NOT_FOUND);
    const title = String(formData.get("title") ?? "").trim();
    if (!title) throw new ActionError("Informe o título da task.");

    const description = String(formData.get("description") ?? "").trim() || null;
    const assigneeId = String(formData.get("assigneeId") ?? "") || null;
    const priority = (String(formData.get("priority") ?? "P2") || "P2") as Priority;
    const dueDate = readDueDate(formData);
    const status = String(formData.get("status") ?? task.status) as TaskStatus;
    const blockedReason = String(formData.get("blockedReason") ?? "").trim() || null;
    const dependsOnId = String(formData.get("dependsOnId") ?? "") || null;
    if (dependsOnId && !(await prisma.task.findUnique({ where: { id: dependsOnId } }))) {
      throw new ActionError(DEPENDENCY_NOT_FOUND);
    }

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
        dueDate,
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
  });
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<ActionResult> {
  return runAction(async () => {
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { feature: true } });
    if (!task) throw new ActionError(TASK_NOT_FOUND);
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
  });
}

export async function deleteTask(taskId: string, featureId: string | null): Promise<ActionResult> {
  return runAction(async () => {
    const [task, actor] = await Promise.all([prisma.task.findUnique({ where: { id: taskId } }), getCurrentActor()]);
    if (!task) throw new ActionError(TASK_NOT_FOUND);

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
  });
}
