import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { EntityLink } from "@/components/ui/EntityLink";
import { PriorityBadge } from "@/components/ui/StatusBadges";
import { PersonChip, PersonPlaceholder } from "@/components/ui/PersonChip";
import { FeatureStepper } from "@/components/entities/FeatureStepper";
import { ActivityFeed } from "@/components/ActivityFeed";
import { formatDate, formatDateTime, formatRelative, isOverdue } from "@/lib/format";

export default async function DashboardPage() {
  const now = new Date();

  const [
    featuresAwaitingValidation,
    blockedTasks,
    overdueTasks,
    activeFeatures,
    upcomingTasks,
    nextMeeting,
    recentDecisions,
    unactionedDecisions,
    recentActivity,
  ] = await Promise.all([
    prisma.feature.findMany({
      where: { status: "VALIDATION" },
      include: { product: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: { status: "BLOCKED" },
      include: { feature: true, assignee: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: { dueDate: { lt: now }, status: { not: "DONE" } },
      include: { feature: true, assignee: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.feature.findMany({
      where: { status: { notIn: ["BACKLOG", "DONE"] } },
      include: { product: true, tasks: true },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.task.findMany({
      where: { dueDate: { not: null }, status: { not: "DONE" } },
      include: { feature: true, assignee: true },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    prisma.meeting.findFirst({
      orderBy: { date: "desc" },
      include: { participants: { include: { person: true } } },
    }),
    prisma.decision.findMany({
      orderBy: { decidedAt: "desc" },
      take: 5,
      include: { feature: true, product: true, author: true },
    }),
    prisma.decision.findMany({
      where: { generatedTasks: { none: {} } },
      orderBy: { decidedAt: "desc" },
      take: 5,
      include: { feature: true, product: true },
    }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Dashboard"
        description="Cockpit operacional — o que precisa da sua atenção agora."
      />

      <SectionCard title="Atenção necessária" className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AttentionGroup
            icon="validation"
            label="Aguardando validação"
            count={featuresAwaitingValidation.length}
            tone="rose"
          >
            {featuresAwaitingValidation.map((f) => (
              <EntityLink key={f.id} type="feature" href={`/features/${f.id}`} muted>
                {f.title}
              </EntityLink>
            ))}
          </AttentionGroup>

          <AttentionGroup icon="task" label="Tasks bloqueadas" count={blockedTasks.length} tone="red">
            {blockedTasks.map((t) => (
              <EntityLink key={t.id} type="task" href={`/tasks/${t.id}`} muted>
                {t.title}
              </EntityLink>
            ))}
          </AttentionGroup>

          <AttentionGroup
            icon="decision"
            label="Decisões sem desdobramento"
            count={unactionedDecisions.length}
            tone="amber"
          >
            {unactionedDecisions.map((d) => (
              <EntityLink key={d.id} type="decision" href={`/decisions/${d.id}`} muted>
                {d.title}
              </EntityLink>
            ))}
          </AttentionGroup>

          <AttentionGroup icon="clock" label="Tasks atrasadas" count={overdueTasks.length} tone="orange">
            {overdueTasks.map((t) => (
              <EntityLink key={t.id} type="task" href={`/tasks/${t.id}`} muted>
                {t.title}
              </EntityLink>
            ))}
          </AttentionGroup>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            title="Em desenvolvimento"
            action={
              <Link href="/features" className="text-xs font-medium text-brand hover:underline">
                Ver todas
              </Link>
            }
          >
            {activeFeatures.length === 0 ? (
              <EmptyState icon="feature" title="Nenhuma Feature ativa no momento" />
            ) : (
              <div className="space-y-3">
                {activeFeatures.map((f) => {
                  const done = f.tasks.filter((t) => t.status === "DONE").length;
                  return (
                    <Link
                      key={f.id}
                      href={`/features/${f.id}`}
                      className="block rounded-lg border border-border p-3 transition-colors hover:border-brand/40 hover:bg-brand-soft/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-ink">
                          {f.product.name} — {f.title}
                        </p>
                        <PriorityBadge priority={f.priority} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <FeatureStepper status={f.status} />
                        {f.tasks.length > 0 && (
                          <span className="shrink-0 text-xs text-ink-faint">
                            {done}/{f.tasks.length} tasks
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Próximas atividades">
            {upcomingTasks.length === 0 ? (
              <EmptyState icon="clock" title="Nenhuma task com prazo definido" />
            ) : (
              <ul className="divide-y divide-border">
                {upcomingTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <EntityLink type="task" href={`/tasks/${t.id}`}>
                        {t.title}
                      </EntityLink>
                      {t.feature && (
                        <p className="mt-0.5 truncate text-xs text-ink-faint">{t.feature.title}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {t.assignee ? (
                        <PersonChip name={t.assignee.name} role={t.assignee.role} />
                      ) : (
                        <PersonPlaceholder />
                      )}
                      <Badge tone={isOverdue(t.dueDate) ? "red" : "gray"}>{formatDate(t.dueDate)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Reuniões"
            action={
              <Link href="/meetings" className="text-xs font-medium text-brand hover:underline">
                Ver todas
              </Link>
            }
          >
            {nextMeeting ? (
              <Link href={`/meetings/${nextMeeting.id}`} className="block">
                <p className="text-sm font-medium text-ink">{nextMeeting.title}</p>
                <p className="mt-1 text-xs text-ink-faint">{formatDateTime(nextMeeting.date)}</p>
                <div className="mt-2 flex -space-x-1.5">
                  {nextMeeting.participants.map(({ person }) => (
                    <PersonChip key={person.id} name={person.name} role={person.role} />
                  ))}
                </div>
              </Link>
            ) : (
              <EmptyState icon="meeting" title="Nenhuma reunião registrada" />
            )}
          </SectionCard>

          <SectionCard
            title="Decisões recentes"
            action={
              <Link href="/decisions" className="text-xs font-medium text-brand hover:underline">
                Ver todas
              </Link>
            }
          >
            {recentDecisions.length === 0 ? (
              <EmptyState icon="decision" title="Nenhuma decisão registrada" />
            ) : (
              <ul className="space-y-3">
                {recentDecisions.map((d) => (
                  <li key={d.id}>
                    <EntityLink type="decision" href={`/decisions/${d.id}`}>
                      {d.title}
                    </EntityLink>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {d.author?.name ?? "—"} · {formatRelative(d.decidedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Atividade recente"
            action={
              <Link href="/activity" className="text-xs font-medium text-brand hover:underline">
                Ver tudo
              </Link>
            }
          >
            <ActivityFeed items={recentActivity} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function AttentionGroup({
  icon,
  label,
  count,
  tone,
  children,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  count: number;
  tone: "rose" | "red" | "amber" | "orange";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={clsx(
            "flex h-6 w-6 items-center justify-center rounded-md",
            tone === "rose" && "bg-rose-50 text-rose-600",
            tone === "red" && "bg-red-50 text-red-600",
            tone === "amber" && "bg-amber-50 text-amber-700",
            tone === "orange" && "bg-orange-50 text-orange-600",
          )}
        >
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-semibold text-ink">{count}</p>
        <p className="text-xs text-ink-muted">{label}</p>
      </div>
      {count === 0 ? (
        <p className="text-xs text-ink-faint">Tudo em dia.</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}
