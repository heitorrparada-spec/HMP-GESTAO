import Link from "next/link";
import clsx from "clsx";
import { isToday } from "date-fns";
import { getCurrentActor } from "@/lib/actor";
import { getDashboardData, STALE_AFTER_DAYS, type DashboardData } from "@/lib/dashboard";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Card, SectionCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { EntityLink } from "@/components/ui/EntityLink";
import { FeatureStatusBadge, PriorityBadge, TaskStatusBadge } from "@/components/ui/StatusBadges";
import { PersonChip, PersonPlaceholder } from "@/components/ui/PersonChip";
import { FeatureStepper } from "@/components/entities/FeatureStepper";
import { NextStepHint } from "@/components/entities/NextStepHint";
import { ActivityFeed } from "@/components/ActivityFeed";
import { dueLabel, formatDate, formatDateTime, formatRelative, isOverdue } from "@/lib/format";

export default async function DashboardPage() {
  const actor = await getCurrentActor();
  const data = await getDashboardData(actor);
  const { attention } = data;

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Dashboard"
        description="Cockpit operacional — o que precisa da sua atenção agora."
      />

      <PersonalSection actorName={actor?.name ?? null} personal={data.personal} />

      <SectionCard title="Atenção do time" className="mb-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
          <AttentionGroup icon="validation" label="Aguardando validação" count={attention.validation.length} tone="rose">
            {attention.validation.map((f) => (
              <AttentionItem key={f.id} type="feature" href={`/features/${f.id}`} title={f.title}>
                {f.acceptanceCriteria.length === 0
                  ? "sem critérios de aceite"
                  : `${f.passed}/${f.acceptanceCriteria.length} critérios passaram`}
                {f._count.validationRecords > 0 && ` · ${f._count.validationRecords} tentativa(s)`}
              </AttentionItem>
            ))}
          </AttentionGroup>

          <AttentionGroup icon="task" label="Tasks bloqueadas" count={attention.blocked.length} tone="red">
            {attention.blocked.map((t) => (
              <AttentionItem key={t.id} type="task" href={`/tasks/${t.id}`} title={t.title}>
                {t.blockedReason ?? "motivo não registrado"} · {t.assignee?.name ?? "sem responsável"}
              </AttentionItem>
            ))}
          </AttentionGroup>

          <AttentionGroup icon="clock" label="Tasks atrasadas" count={attention.overdue.length} tone="orange">
            {attention.overdue.map((t) => (
              <AttentionItem key={t.id} type="task" href={`/tasks/${t.id}`} title={t.title}>
                {t.dueDate && dueLabel(t.dueDate)} · {t.assignee?.name ?? "sem responsável"}
              </AttentionItem>
            ))}
          </AttentionGroup>

          <AttentionGroup
            icon="decision"
            label="Decisões sem task"
            count={attention.decisionsWithoutTasks.length}
            tone="amber"
          >
            {attention.decisionsWithoutTasks.map((d) => (
              <AttentionItem key={d.id} type="decision" href={`/decisions/${d.id}`} title={d.title}>
                <Link href={`/tasks/new?decisionId=${d.id}`} className="font-medium text-brand hover:underline">
                  + Criar Task
                </Link>
              </AttentionItem>
            ))}
          </AttentionGroup>

          <AttentionGroup
            icon="feature"
            label={`Features paradas (${STALE_AFTER_DAYS}+ dias)`}
            count={attention.stale.length}
            tone="slate"
          >
            {attention.stale.map((f) => (
              <AttentionItem key={f.id} type="feature" href={`/features/${f.id}`} title={f.title}>
                sem atividade há {f.idleDays} dias
              </AttentionItem>
            ))}
          </AttentionGroup>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FeaturesInProgress features={data.features} />
          <UpcomingDeadlines tasks={data.upcomingTasks} />
        </div>

        <div className="space-y-6">
          <MeetingSection meeting={data.meeting} />

          <SectionCard
            title="Decisões recentes"
            action={
              <Link href="/decisions" className="text-xs font-medium text-brand hover:underline">
                Ver todas
              </Link>
            }
          >
            {data.recentDecisions.length === 0 ? (
              <EmptyState icon="decision" title="Nenhuma decisão registrada" />
            ) : (
              <ul className="space-y-3">
                {data.recentDecisions.map((d) => (
                  <li key={d.id}>
                    <EntityLink type="decision" href={`/decisions/${d.id}`}>
                      {d.title}
                    </EntityLink>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {d.author?.name ?? "—"} · {formatRelative(d.decidedAt)}
                      {d.meeting && ` · na reunião "${d.meeting.title}"`}
                    </p>
                    <p className={clsx("mt-0.5 text-xs", d._count.generatedTasks === 0 ? "text-amber-700" : "text-ink-faint")}>
                      {d._count.generatedTasks === 0
                        ? "ainda sem task"
                        : `${d._count.generatedTasks} task${d._count.generatedTasks !== 1 ? "s" : ""} gerada${d._count.generatedTasks !== 1 ? "s" : ""}`}
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
            <ActivityFeed items={data.recentActivity} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function PersonalSection({
  actorName,
  personal,
}: {
  actorName: string | null;
  personal: DashboardData["personal"];
}) {
  if (!actorName || !personal) {
    return (
      <Card className="mb-6 border-dashed">
        <p className="text-sm font-semibold text-ink">Precisa de você</p>
        <p className="mt-1 text-sm text-ink-muted">
          Escolha quem você é em <strong>Selecionar usuário</strong>, no canto inferior esquerdo, para ver as suas tasks e o
          que está aguardando você.
        </p>
      </Card>
    );
  }

  const { openTasks, awaiting } = personal;

  return (
    <SectionCard title={`Precisa de você — ${actorName}`} className="mb-6 border-brand/30">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Suas tasks abertas ({openTasks.length})
          </p>
          {openTasks.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhuma task aberta com você.</p>
          ) : (
            <ul className="divide-y divide-border">
              {openTasks.map((t) => {
                const overdue = t.dueDate ? isOverdue(t.dueDate) : false;
                return (
                  <li key={t.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <EntityLink type="task" href={`/tasks/${t.id}`}>
                        {t.title}
                      </EntityLink>
                      <TaskStatusBadge status={t.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-faint">
                      {t.feature?.title ?? "Task avulsa"}
                      {t.dueDate && (
                        <span className={clsx(overdue && "font-medium text-red-600")}> · {dueLabel(t.dueDate)}</span>
                      )}
                    </p>
                    {t.status === "BLOCKED" && (
                      <p className="mt-0.5 truncate text-xs text-red-600">
                        Bloqueada: {t.blockedReason ?? "motivo não registrado"}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Aguardando você ({awaiting.length})
          </p>
          {awaiting.length === 0 ? (
            <p className="text-sm text-ink-faint">Nada aguardando a sua decisão agora.</p>
          ) : (
            <ul className="divide-y divide-border">
              {awaiting.map((item) => (
                <li key={item.key} className="py-2.5 first:pt-0 last:pb-0">
                  <EntityLink type={item.type} href={item.href}>
                    {item.title}
                  </EntityLink>
                  <p className="mt-0.5 text-xs text-ink-muted">{item.reason}</p>
                  <Link href={item.action.href} className="mt-1 inline-block text-xs font-medium text-brand hover:underline">
                    {item.action.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function FeaturesInProgress({ features }: { features: DashboardData["features"] }) {
  return (
    <SectionCard
      title={`Em andamento (${features.length})`}
      action={
        <Link href="/features" className="text-xs font-medium text-brand hover:underline">
          Ver todas
        </Link>
      }
    >
      {features.length === 0 ? (
        <EmptyState icon="feature" title="Nenhuma Feature em andamento" />
      ) : (
        <div className="space-y-3">
          {features.map((f) => (
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
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <FeatureStepper status={f.status} />
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {f.blocked > 0 && <Badge tone="red">{f.blocked} bloqueada{f.blocked !== 1 ? "s" : ""}</Badge>}
                  {f.overdue > 0 && <Badge tone="orange">{f.overdue} atrasada{f.overdue !== 1 ? "s" : ""}</Badge>}
                  <span className="text-ink-faint">
                    {f.done}/{f.tasks.length} tasks
                  </span>
                </div>
              </div>
              <NextStepHint feature={f} />
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function UpcomingDeadlines({ tasks }: { tasks: DashboardData["upcomingTasks"] }) {
  return (
    <SectionCard title="Próximos prazos">
      {tasks.length === 0 ? (
        <EmptyState icon="clock" title="Nenhuma task com prazo a partir de hoje" />
      ) : (
        <ul className="divide-y divide-border">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <EntityLink type="task" href={`/tasks/${t.id}`}>
                  {t.title}
                </EntityLink>
                <p className="mt-0.5 truncate text-xs text-ink-faint">{t.feature?.title ?? "Task avulsa"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {t.assignee ? <PersonChip name={t.assignee.name} role={t.assignee.role} /> : <PersonPlaceholder />}
                <Badge tone={t.dueDate && isToday(t.dueDate) ? "amber" : "gray"}>
                  {t.dueDate ? `${formatDate(t.dueDate)} · ${dueLabel(t.dueDate)}` : "—"}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function MeetingSection({ meeting }: { meeting: DashboardData["meeting"] }) {
  const { next, last, agenda } = meeting;
  const agendaIsEmpty =
    !agenda || (agenda.decisionsWithoutTask.length + agenda.openFollowUps.length + agenda.changedFeatures.length === 0);

  return (
    <SectionCard
      title="Próxima reunião"
      action={
        <Link href="/meetings" className="text-xs font-medium text-brand hover:underline">
          Ver todas
        </Link>
      }
    >
      {next ? (
        <Link href={`/meetings/${next.id}`} className="block">
          <p className="text-sm font-medium text-ink hover:underline">{next.title}</p>
          <p className="mt-1 text-xs text-ink-faint">
            {formatDateTime(next.date)} · {formatRelative(next.date)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {next.participants.map(({ person }) => (
              <PersonChip key={person.id} name={person.name} role={person.role} />
            ))}
          </div>
        </Link>
      ) : (
        <div>
          <p className="text-sm text-ink-muted">Nenhuma reunião agendada.</p>
          <Link href="/meetings/new" className="mt-1 inline-block text-xs font-medium text-brand hover:underline">
            + Registrar reunião
          </Link>
        </div>
      )}

      {last && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Pauta sugerida</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Desde a última reunião:{" "}
            <Link href={`/meetings/${last.id}`} className="hover:underline">
              {last.title}
            </Link>{" "}
            · {formatDate(last.date)}
          </p>

          {agendaIsEmpty ? (
            <p className="mt-3 text-sm text-ink-faint">Nada pendente desde a última reunião.</p>
          ) : (
            agenda && (
              <div className="mt-3 space-y-3">
                <AgendaGroup label="Decisões da reunião ainda sem task" count={agenda.decisionsWithoutTask.length}>
                  {agenda.decisionsWithoutTask.map((d) => (
                    <li key={d.id}>
                      <EntityLink type="decision" href={`/decisions/${d.id}`}>
                        {d.title}
                      </EntityLink>
                      <Link
                        href={`/tasks/new?decisionId=${d.id}`}
                        className="ml-5 text-xs font-medium text-brand hover:underline"
                      >
                        + Criar Task
                      </Link>
                    </li>
                  ))}
                </AgendaGroup>
                <AgendaGroup label="Tasks decorrentes em aberto" count={agenda.openFollowUps.length}>
                  {agenda.openFollowUps.map((t) => (
                    <li key={t.id}>
                      <div className="flex items-center justify-between gap-2">
                        <EntityLink type="task" href={`/tasks/${t.id}`}>
                          {t.title}
                        </EntityLink>
                        <TaskStatusBadge status={t.status} />
                      </div>
                      <p className="ml-5 text-xs text-ink-faint">{t.assignee?.name ?? "sem responsável"}</p>
                    </li>
                  ))}
                </AgendaGroup>
                <AgendaGroup label="Features que mudaram de estágio" count={agenda.changedFeatures.length}>
                  {agenda.changedFeatures.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2">
                      <EntityLink type="feature" href={`/features/${f.id}`}>
                        {f.title}
                      </EntityLink>
                      <FeatureStatusBadge status={f.status} />
                    </li>
                  ))}
                </AgendaGroup>
              </div>
            )
          )}
        </div>
      )}
    </SectionCard>
  );
}

function AgendaGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-muted">
        {label} ({count})
      </p>
      <ul className="space-y-1.5">{children}</ul>
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
  tone: "rose" | "red" | "amber" | "orange" | "slate";
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={clsx(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            tone === "rose" && "bg-rose-50 text-rose-600",
            tone === "red" && "bg-red-50 text-red-600",
            tone === "amber" && "bg-amber-50 text-amber-700",
            tone === "orange" && "bg-orange-50 text-orange-600",
            tone === "slate" && "bg-slate-100 text-slate-600",
          )}
        >
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-semibold text-ink">{count}</p>
        <p className="text-xs text-ink-muted">{label}</p>
      </div>
      {count === 0 ? <p className="text-xs text-ink-faint">Tudo em dia.</p> : <ul className="space-y-2">{children}</ul>}
    </div>
  );
}

function AttentionItem({
  type,
  href,
  title,
  children,
}: {
  type: "feature" | "task" | "decision";
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="min-w-0">
      <EntityLink type={type} href={href} muted>
        {title}
      </EntityLink>
      <p className="mt-0.5 truncate pl-5 text-xs text-ink-faint">{children}</p>
    </li>
  );
}
