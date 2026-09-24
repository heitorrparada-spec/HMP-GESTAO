"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { command } from "@/lib/history/command";
import { compact, dateOnly, fieldChange } from "@/lib/history/diff";
import { requireReason, taskLocks } from "@/lib/history/policy";
import { taskScopes, taskSnapshot } from "@/lib/history/snapshots";
import { changedFieldsSummary } from "@/lib/history/present";
import { taskStatusMeta, taskStatusOrder } from "@/lib/labels";
import { parseDateInput } from "@/lib/format";
import { formText } from "@/lib/form";
import { ActionError, runAction, type ActionResult } from "@/lib/action-result";
import type { Priority, TaskStatus } from "@/generated/prisma/client";
import type { Db } from "@/lib/history/types";

function revalidateTask(t: { id: string; featureId: string | null; decisionId?: string | null; meetingId?: string | null }) {
  revalidatePath(`/tasks/${t.id}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/activity");
  if (t.featureId) revalidatePath(`/features/${t.featureId}`);
  if (t.decisionId) revalidatePath(`/decisions/${t.decisionId}`);
  if (t.meetingId) revalidatePath(`/meetings/${t.meetingId}`);
}

const TASK_NOT_FOUND = "Esta task não existe mais — ela pode ter sido removida. Volte para a lista de tasks.";
const DEPENDENCY_NOT_FOUND =
  'A task escolhida em "Depende de" não existe mais. Escolha outra ou deixe em branco.';

function readDueDate(formData: FormData): Date | null {
  const raw = String(formData.get("dueDate") ?? "");
  if (!raw) return null;
  const date = parseDateInput(raw);
  if (!date) throw new ActionError("Prazo inválido — informe uma data existente.");
  return date;
}

// Tudo o que um evento de task precisa: origem (para os escopos) e rótulos dos vínculos.
async function loadTask(tx: Db, taskId: string) {
  const task = await tx.task.findUnique({
    where: { id: taskId },
    include: {
      feature: { select: { id: true, title: true, status: true, productId: true } },
      decision: { select: { id: true, title: true, meetingId: true, productId: true } },
      assignee: { select: { id: true, name: true } },
      dependsOn: { include: { dependsOnTask: { select: { id: true, title: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!task) throw new ActionError(TASK_NOT_FOUND);
  return task;
}

type LoadedTask = Awaited<ReturnType<typeof loadTask>>;

function scopesOf(task: LoadedTask) {
  return taskScopes(task, { featureProductId: task.feature?.productId, decision: task.decision });
}

function snapshotOf(task: LoadedTask, overrides: Partial<LoadedTask> = {}) {
  const t = { ...task, ...overrides };
  return taskSnapshot({ ...t, dependsOn: t.dependsOn[0]?.dependsOnTask ?? null });
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const title = formText(formData, "title");
    if (!title) throw new ActionError("Informe o título da task.");

    const decisionId = String(formData.get("decisionId") ?? "") || null;
    const requestedFeatureId = String(formData.get("featureId") ?? "") || null;
    const description = formText(formData, "description") || null;
    const assigneeId = String(formData.get("assigneeId") ?? "") || null;
    const priority = (String(formData.get("priority") ?? "P2") || "P2") as Priority;
    const dueDate = readDueDate(formData);
    const dependsOnId = String(formData.get("dependsOnId") ?? "") || null;

    const created = await command(async ({ tx, actor, record }) => {
      const decision = decisionId
        ? await tx.decision.findUnique({ where: { id: decisionId }, include: { meeting: true } })
        : null;
      if (decisionId && !decision) {
        throw new ActionError("A decisão de origem não foi encontrada. Volte para a decisão e tente criar a task de novo.");
      }
      if (decision && decision.status !== "ACTIVE") {
        throw new ActionError(
          "Esta decisão foi substituída ou revogada — ela não gera mais tasks. Crie a task a partir da decisão vigente.",
        );
      }

      // Task nascida de uma decisão fica no contexto dela: na Feature da decisão ou numa Feature do Product dela.
      let featureId = requestedFeatureId;
      if (decision?.featureId) {
        if (featureId && featureId !== decision.featureId) {
          throw new ActionError("A Task precisa ficar na Feature da decisão de origem.");
        }
        featureId = decision.featureId;
      }
      if (!featureId && !decision) {
        throw new ActionError("Selecione a Feature da task — toda task precisa de uma origem (Feature ou decisão).");
      }

      const [feature, assignee, dependsOn] = await Promise.all([
        featureId ? tx.feature.findUnique({ where: { id: featureId } }) : null,
        assigneeId ? tx.person.findUnique({ where: { id: assigneeId } }) : null,
        dependsOnId ? tx.task.findUnique({ where: { id: dependsOnId } }) : null,
      ]);
      if (featureId && !feature) throw new ActionError("A Feature selecionada não foi encontrada. Recarregue a página.");
      if (feature?.status === "DONE") {
        throw new ActionError("A Feature já está em Done — ela não recebe novas tasks. Para trabalho adicional, registre uma nova Feature.");
      }
      if (feature && decision && !decision.featureId && decision.productId && feature.productId !== decision.productId) {
        throw new ActionError("A Feature da Task precisa ser do mesmo Product da decisão de origem.");
      }
      if (assigneeId && !assignee) throw new ActionError("O responsável selecionado não foi encontrado. Recarregue a página.");
      if (dependsOnId && !dependsOn) throw new ActionError(DEPENDENCY_NOT_FOUND);
      if (dependsOn?.archivedAt) throw new ActionError('A task escolhida em "Depende de" está arquivada. Escolha outra ou deixe em branco.');
      if (dependsOn && dependsOn.featureId !== featureId) {
        throw new ActionError('A task escolhida em "Depende de" é de outra Feature. Escolha uma task da mesma Feature.');
      }

      const task = await tx.task.create({
        data: { title, description, featureId, decisionId, assigneeId, priority, status: "TODO", dueDate, createdById: actor.id },
      });
      if (dependsOn) await tx.taskDependency.create({ data: { taskId: task.id, dependsOnId: dependsOn.id } });

      await record({
        eventType: "task.created",
        entityType: "task",
        entityId: task.id,
        entityLabel: task.title,
        scopes: taskScopes(task, { featureProductId: feature?.productId, decision }),
        description: decision
          ? `Task "${task.title}" criada a partir da decisão "${decision.title}"${decision.meeting ? ` (reunião "${decision.meeting.title}")` : ""}`
          : `Task "${task.title}" criada`,
        snapshot: taskSnapshot({ ...task, assignee, dependsOn }),
        // O contexto da origem fica como estava neste momento, mesmo que a decisão mude depois.
        context: {
          origin: {
            feature: feature ? { id: feature.id, title: feature.title } : null,
            decision: decision ? { id: decision.id, title: decision.title, decision: decision.decision } : null,
            meeting: decision?.meeting
              ? { id: decision.meeting.id, title: decision.meeting.title, date: decision.meeting.date.toISOString() }
              : null,
          },
        },
      });
      return { task, meetingId: decision?.meetingId ?? null };
    });

    revalidateTask({ ...created.task, meetingId: created.meetingId });
    redirect(`/tasks/${created.task.id}`);
  });
}

export async function updateTask(taskId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const title = formText(formData, "title");
    if (!title) throw new ActionError("Informe o título da task.");
    const description = formText(formData, "description") || null;
    const assigneeId = String(formData.get("assigneeId") ?? "") || null;
    const priority = (String(formData.get("priority") ?? "P2") || "P2") as Priority;
    const dueDate = readDueDate(formData);
    const blockedReasonInput = formText(formData, "blockedReason") || null;
    const dependsOnId = String(formData.get("dependsOnId") ?? "") || null;

    const task = await command(async ({ tx, record }) => {
      const task = await loadTask(tx, taskId);
      const locks = taskLocks(task, task.feature?.status);
      if (locks.contentLocked) throw new ActionError(locks.contentMessage!);

      const status = String(formData.get("status") ?? task.status) as TaskStatus;
      if (!taskStatusOrder.includes(status)) throw new ActionError("Status inválido para a task.");
      const blockedReason = status === "BLOCKED" ? blockedReasonInput : null;

      const assignee = assigneeId ? await tx.person.findUnique({ where: { id: assigneeId } }) : null;
      if (assigneeId && !assignee) throw new ActionError("O responsável selecionado não foi encontrado. Recarregue a página.");

      const currentDep = task.dependsOn[0]?.dependsOnTask ?? null;
      let newDep: { id: string; title: string } | null = null;
      if (dependsOnId) {
        if (dependsOnId === task.id) throw new ActionError("Uma task não pode depender de si mesma.");
        const dep = await tx.task.findUnique({ where: { id: dependsOnId } });
        if (!dep) throw new ActionError(DEPENDENCY_NOT_FOUND);
        if (dep.archivedAt && dep.id !== currentDep?.id) {
          throw new ActionError('A task escolhida em "Depende de" está arquivada. Escolha outra ou deixe em branco.');
        }
        if (dep.featureId !== task.featureId) {
          throw new ActionError('A task escolhida em "Depende de" é de outra Feature. Escolha uma task da mesma Feature.');
        }
        newDep = dep;
      }

      const changes = compact([
        fieldChange("title", task.title, title),
        fieldChange("description", task.description, description),
        fieldChange("status", task.status, status),
        fieldChange("priority", task.priority, priority),
        fieldChange("assigneeId", task.assigneeId, assigneeId, { from: task.assignee?.name, to: assignee?.name }),
        fieldChange("dueDate", dateOnly(task.dueDate), dateOnly(dueDate)),
        fieldChange("blockedReason", task.blockedReason, blockedReason),
        fieldChange("dependsOnId", currentDep?.id ?? null, newDep?.id ?? null, { from: currentDep?.title, to: newDep?.title }),
      ]);
      if (changes.length === 0) return task;

      await tx.task.update({
        where: { id: taskId },
        data: { title, description, assigneeId, priority, status, dueDate, blockedReason },
      });
      if (changes.some((c) => c.field === "dependsOnId")) {
        await tx.taskDependency.deleteMany({ where: { taskId } });
        if (newDep) await tx.taskDependency.create({ data: { taskId, dependsOnId: newDep.id } });
      }

      await record({
        eventType: "task.updated",
        entityType: "task",
        entityId: taskId,
        entityLabel: title,
        scopes: scopesOf(task),
        description: `Task "${title}" alterada — ${changedFieldsSummary(changes)}`,
        changes,
      });
      return task;
    });

    revalidateTask(task);
    redirect(`/tasks/${taskId}`);
  });
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, formData?: FormData): Promise<ActionResult> {
  return runAction(async () => {
    if (!taskStatusOrder.includes(status)) throw new ActionError("Status inválido para a task.");
    const task = await command(async ({ tx, record }) => {
      const task = await loadTask(tx, taskId);
      if (task.status === status) return null;
      const locks = taskLocks(task, task.feature?.status);
      if (locks.archived) throw new ActionError(locks.contentMessage!);
      if (!locks.canChangeStatus) {
        throw new ActionError("A Feature desta task está em Done — uma task concluída não pode mais ser reaberta.");
      }
      const reopening = task.status === "DONE";
      const reason = reopening ? requireReason(formData?.get("reason"), "reabrir uma task concluída") : null;
      const blockedReason = status === "BLOCKED" ? task.blockedReason : null;

      await tx.task.update({ where: { id: taskId }, data: { status, blockedReason } });
      const from = taskStatusMeta[task.status].label;
      const to = taskStatusMeta[status].label;
      await record({
        eventType: "task.status_changed",
        entityType: "task",
        entityId: taskId,
        entityLabel: task.title,
        scopes: scopesOf(task),
        description: reopening ? `Task "${task.title}" reaberta: ${from} → ${to}` : `Task "${task.title}" mudou de ${from} para ${to}`,
        reason,
        changes: compact([
          fieldChange("status", task.status, status),
          fieldChange("blockedReason", task.blockedReason, blockedReason),
        ]),
        context: status === "BLOCKED" ? { blockedReason: task.blockedReason } : undefined,
      });
      return task;
    });

    if (task) {
      revalidateTask(task);
      if (task.feature) revalidatePath(`/products/${task.feature.productId}`);
    }
  });
}

/** "Excluir" virou arquivar (V0.3-A): a task continua existindo, some do estado atual e fica no histórico. */
export async function archiveTask(taskId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const task = await command(async ({ tx, actor, record }) => {
      const task = await loadTask(tx, taskId);
      const locks = taskLocks(task, task.feature?.status);
      if (!locks.canArchive) throw new ActionError(locks.archiveBlockedMessage!);
      const reason = requireReason(formData.get("reason"), "arquivar a task");

      const archivedAt = new Date();
      await tx.task.update({ where: { id: taskId }, data: { archivedAt, archivedById: actor.id, archiveReason: reason } });
      await record({
        eventType: "task.archived",
        entityType: "task",
        entityId: taskId,
        entityLabel: task.title,
        scopes: scopesOf(task),
        description: `Task "${task.title}" arquivada`,
        reason,
        changes: compact([fieldChange("archivedAt", null, archivedAt)]),
        snapshot: snapshotOf(task, { archivedAt, archiveReason: reason }),
      });
      return task;
    });

    revalidateTask(task);
    redirect(task.featureId ? `/features/${task.featureId}` : "/tasks");
  });
}

export async function restoreTask(taskId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const task = await command(async ({ tx, record }) => {
      const task = await loadTask(tx, taskId);
      const locks = taskLocks(task, task.feature?.status);
      if (!locks.archived) throw new ActionError("Esta task não está arquivada.");
      if (!locks.canRestore) {
        throw new ActionError("A Feature desta task está em Done — ela não recebe trabalho de volta. Registre uma nova Feature.");
      }
      const reason = requireReason(formData.get("reason"), "restaurar a task");

      await tx.task.update({ where: { id: taskId }, data: { archivedAt: null, archivedById: null, archiveReason: null } });
      await record({
        eventType: "task.restored",
        entityType: "task",
        entityId: taskId,
        entityLabel: task.title,
        scopes: scopesOf(task),
        description: `Task "${task.title}" restaurada`,
        reason,
        changes: compact([fieldChange("archivedAt", task.archivedAt, null)]),
        snapshot: snapshotOf(task, { archivedAt: null, archiveReason: null }),
      });
      return task;
    });

    revalidateTask(task);
    redirect(`/tasks/${taskId}`);
  });
}
