import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { daysSince, isOverdue } from "@/lib/format";
import type { FeatureStatus, Person, Priority } from "@/generated/prisma/client";

/** Uma Feature ativa sem nenhum evento no histórico há esse tanto de dias aparece como "parada". */
export const STALE_AFTER_DAYS = 7;

const ACTIVE_STATUSES: FeatureStatus[] = ["DISCOVERY", "SPECIFICATION", "ARCHITECTURE", "DEVELOPMENT", "REVIEW", "VALIDATION"];
const STAGE_RANK: Record<FeatureStatus, number> = {
  VALIDATION: 0,
  REVIEW: 1,
  DEVELOPMENT: 2,
  ARCHITECTURE: 3,
  SPECIFICATION: 4,
  DISCOVERY: 5,
  BACKLOG: 6,
  DONE: 7,
};
const PRIORITY_RANK: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export type AwaitingItem = {
  key: string;
  type: "feature" | "decision";
  href: string;
  title: string;
  reason: string;
  action: { label: string; href: string };
};

const dueTime = (d: Date | null) => d?.getTime() ?? Number.MAX_SAFE_INTEGER;

// Bloqueada primeiro, depois atrasada, depois por prazo; sem prazo por último.
function urgency(t: { status: string; dueDate: Date | null }) {
  if (t.status === "BLOCKED") return 0;
  if (t.dueDate && isOverdue(t.dueDate)) return 1;
  return t.dueDate ? 2 : 3;
}

async function getPersonalQueue(actor: Person) {
  const [tasks, features, decisions] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: actor.id, status: { not: "DONE" } },
      include: { feature: true },
    }),
    // Ações por papel (docs/hmp-os/conceptual-architecture-v0.1.md, §9): Product valida, Architecture co-revisa,
    // Engineering leva para Review quando as tasks fecham.
    prisma.feature.findMany({
      where: {
        OR: [
          { status: "VALIDATION", ownerId: actor.id },
          { status: "REVIEW", OR: [{ ownerId: actor.id }, { architectId: actor.id }] },
          { status: "DEVELOPMENT", techLeadId: actor.id },
        ],
      },
      include: { product: true, tasks: { select: { status: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.decision.findMany({
      where: { authorId: actor.id, generatedTasks: { none: {} } },
      orderBy: { decidedAt: "desc" },
    }),
  ]);

  const openTasks = tasks.sort((a, b) => urgency(a) - urgency(b) || dueTime(a.dueDate) - dueTime(b.dueDate));

  const awaiting: AwaitingItem[] = [];
  for (const f of features) {
    const href = `/features/${f.id}`;
    const title = `${f.product.name} — ${f.title}`;
    if (f.status === "VALIDATION") {
      awaiting.push({
        key: f.id,
        type: "feature",
        href,
        title,
        reason: "Em Validation — aguardando a sua validação.",
        action: { label: "Registrar validação", href: `${href}#validation` },
      });
    } else if (f.status === "REVIEW") {
      awaiting.push({
        key: f.id,
        type: "feature",
        href,
        title,
        reason: "Em Review — revise e, se estiver pronta, leve para Validation.",
        action: { label: "Abrir Feature", href },
      });
    } else if (f.tasks.length > 0 && f.tasks.every((t) => t.status === "DONE")) {
      awaiting.push({
        key: f.id,
        type: "feature",
        href,
        title,
        reason: "Todas as tasks estão concluídas — leve a Feature para Review.",
        action: { label: "Abrir Feature", href },
      });
    }
  }
  for (const d of decisions) {
    awaiting.push({
      key: d.id,
      type: "decision",
      href: `/decisions/${d.id}`,
      title: d.title,
      reason: "Decisão sua que ainda não virou nenhuma task.",
      action: { label: "+ Criar Task", href: `/tasks/new?decisionId=${d.id}` },
    });
  }

  return { openTasks, awaiting };
}

// Última atividade = evento mais recente no histórico da Feature ou de qualquer task dela.
async function lastActivityByFeature(features: Array<{ id: string; createdAt: Date; tasks: Array<{ id: string }> }>) {
  const taskToFeature = new Map(features.flatMap((f) => f.tasks.map((t) => [t.id, f.id] as const)));
  const [featureEvents, taskEvents] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ["entityId"],
      where: { entityType: { in: ["feature", "validation", "requirement"] }, entityId: { in: features.map((f) => f.id) } },
      _max: { createdAt: true },
    }),
    prisma.activityLog.groupBy({
      by: ["entityId"],
      where: { entityType: "task", entityId: { in: [...taskToFeature.keys()] } },
      _max: { createdAt: true },
    }),
  ]);

  const last = new Map(features.map((f) => [f.id, f.createdAt]));
  const bump = (featureId: string | undefined, at: Date | null) => {
    if (!featureId || !at) return;
    const current = last.get(featureId);
    if (!current || at > current) last.set(featureId, at);
  };
  for (const e of featureEvents) bump(e.entityId, e._max.createdAt);
  for (const e of taskEvents) bump(taskToFeature.get(e.entityId), e._max.createdAt);
  return last;
}

async function getMeetingAgenda(lastMeeting: { id: string; date: Date; decisions: Array<{ id: string; title: string; _count: { generatedTasks: number } }> }) {
  const [openFollowUps, stageEvents] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: "DONE" }, OR: [{ decision: { meetingId: lastMeeting.id } }, { meetingId: lastMeeting.id }] },
      include: { assignee: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activityLog.findMany({
      where: {
        createdAt: { gte: lastMeeting.date },
        OR: [
          { entityType: "feature", eventType: "feature.status_changed" },
          { entityType: "validation", eventType: { in: ["validation.approved", "validation.rejected"] } },
        ],
      },
      select: { entityId: true },
    }),
  ]);
  const changedFeatures = await prisma.feature.findMany({
    where: { id: { in: [...new Set(stageEvents.map((e) => e.entityId))] } },
    include: { product: true },
    orderBy: { updatedAt: "desc" },
  });

  return {
    decisionsWithoutTask: lastMeeting.decisions.filter((d) => d._count.generatedTasks === 0),
    openFollowUps,
    changedFeatures,
  };
}

export async function getDashboardData(actor: Person | null) {
  const now = new Date();
  const today = startOfDay(now);

  const [
    personal,
    featuresInValidation,
    blockedTasks,
    overdueTasks,
    decisionsWithoutTasks,
    activeFeatures,
    upcomingTasks,
    nextMeeting,
    lastMeeting,
    recentDecisions,
    recentActivity,
  ] = await Promise.all([
    actor ? getPersonalQueue(actor) : null,
    prisma.feature.findMany({
      where: { status: "VALIDATION" },
      include: {
        product: true,
        owner: true,
        acceptanceCriteria: { select: { status: true } },
        _count: { select: { validationRecords: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: { status: "BLOCKED" },
      include: { feature: true, assignee: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: { status: { not: "DONE" }, dueDate: { lt: today } },
      include: { feature: true, assignee: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.decision.findMany({
      where: { generatedTasks: { none: {} } },
      include: { author: true },
      orderBy: { decidedAt: "desc" },
    }),
    prisma.feature.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      include: {
        product: true,
        tasks: { select: { id: true, status: true, dueDate: true } },
        acceptanceCriteria: { select: { status: true } },
      },
    }),
    prisma.task.findMany({
      where: { status: { not: "DONE" }, dueDate: { gte: today } },
      include: { feature: true, assignee: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.meeting.findFirst({
      where: { date: { gte: now } },
      orderBy: { date: "asc" },
      include: { participants: { include: { person: true } } },
    }),
    prisma.meeting.findFirst({
      where: { date: { lt: now } },
      orderBy: { date: "desc" },
      include: { decisions: { include: { _count: { select: { generatedTasks: true } } } } },
    }),
    prisma.decision.findMany({
      orderBy: { decidedAt: "desc" },
      take: 5,
      include: { author: true, meeting: true, _count: { select: { generatedTasks: true } } },
    }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const [lastActivity, agenda] = await Promise.all([
    lastActivityByFeature(activeFeatures),
    lastMeeting ? getMeetingAgenda(lastMeeting) : null,
  ]);

  const features = activeFeatures
    .map((f) => ({
      ...f,
      done: f.tasks.filter((t) => t.status === "DONE").length,
      blocked: f.tasks.filter((t) => t.status === "BLOCKED").length,
      overdue: f.tasks.filter((t) => t.status !== "DONE" && t.dueDate && isOverdue(t.dueDate)).length,
      idleDays: daysSince(lastActivity.get(f.id) ?? f.createdAt),
    }))
    .sort(
      (a, b) =>
        (a.priority ? PRIORITY_RANK[a.priority] : 9) - (b.priority ? PRIORITY_RANK[b.priority] : 9) ||
        STAGE_RANK[a.status] - STAGE_RANK[b.status] ||
        a.title.localeCompare(b.title),
    );

  return {
    personal,
    attention: {
      validation: featuresInValidation.map((f) => ({
        ...f,
        passed: f.acceptanceCriteria.filter((c) => c.status === "PASSED").length,
      })),
      blocked: blockedTasks,
      overdue: overdueTasks,
      decisionsWithoutTasks,
      stale: features.filter((f) => f.idleDays >= STALE_AFTER_DAYS).sort((a, b) => b.idleDays - a.idleDays),
    },
    features,
    upcomingTasks,
    meeting: { next: nextMeeting, last: lastMeeting, agenda },
    recentDecisions,
    recentActivity,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
