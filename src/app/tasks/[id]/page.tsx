import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import { StatusTracker } from "@/components/ui/StatusTracker";
import { EntityLink } from "@/components/ui/EntityLink";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/StatusBadges";
import { PersonChip, PersonPlaceholder } from "@/components/ui/PersonChip";
import { ActivityFeed } from "@/components/ActivityFeed";
import { formatDate } from "@/lib/format";
import { taskStatusMeta, taskStatusOrder } from "@/lib/labels";
import { updateTaskStatus } from "../actions";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      feature: { include: { product: true } },
      assignee: true,
      createdBy: true,
      reviewer: true,
      parentTask: true,
      subtasks: true,
      decision: { include: { meeting: true, product: true } },
      meeting: true,
      dependsOn: { include: { dependsOnTask: true } },
      blocks: { include: { task: true } },
    },
  });

  if (!task) notFound();

  const activity = await prisma.activityLog.findMany({
    where: { entityType: "task", entityId: task.id },
    orderBy: { createdAt: "desc" },
  });

  // Task nascida de decisão não guarda meetingId: a reunião vem pela decisão. meetingId é só para follow-up direto.
  const originMeeting = task.decision?.meeting ?? task.meeting ?? null;
  const product = task.feature?.product ?? task.decision?.product ?? null;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Tasks", href: "/tasks" },
          ...(task.feature
            ? [
                { label: task.feature.product.name, href: `/products/${task.feature.product.id}` },
                { label: task.feature.title, href: `/features/${task.feature.id}` },
              ]
            : []),
          { label: task.title },
        ]}
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold text-ink">{task.title}</h1>
            <PriorityBadge priority={task.priority} />
          </div>
          {task.decision ? (
            <p className="mt-1 text-sm text-ink-muted">
              Criada a partir da decisão{" "}
              <Link href={`/decisions/${task.decision.id}`} className="font-medium text-ink hover:underline">
                {task.decision.title}
              </Link>
              {originMeeting && (
                <>
                  , registrada na reunião{" "}
                  <Link href={`/meetings/${originMeeting.id}`} className="font-medium text-ink hover:underline">
                    {originMeeting.title}
                  </Link>
                </>
              )}
              .
            </p>
          ) : (
            originMeeting && (
              <p className="mt-1 text-sm text-ink-muted">
                Follow-up da reunião{" "}
                <Link href={`/meetings/${originMeeting.id}`} className="font-medium text-ink hover:underline">
                  {originMeeting.title}
                </Link>
                .
              </p>
            )
          )}
        </div>
        <Link
          href={`/tasks/${task.id}/edit`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50"
        >
          Editar
        </Link>
      </div>

      <StatusTracker
        current={task.status}
        steps={taskStatusOrder.map((status) => ({
          value: status,
          label: taskStatusMeta[status].label,
          action: updateTaskStatus.bind(null, task.id, status),
        }))}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Descrição">
            <p className="whitespace-pre-wrap text-sm text-ink">
              {task.description || <span className="text-ink-faint">Sem descrição.</span>}
            </p>
            {task.status === "BLOCKED" && task.blockedReason && (
              <p className="mt-3 rounded-md bg-red-50 p-2.5 text-sm text-red-700">
                Motivo do bloqueio: {task.blockedReason}
              </p>
            )}
          </SectionCard>

          {task.feature && (task.feature.problem || task.feature.objective) && (
            <SectionCard title="Contexto da Feature">
              {task.feature.problem && (
                <p className="text-sm text-ink">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Problema: </span>
                  {task.feature.problem}
                </p>
              )}
              {task.feature.objective && (
                <p className="mt-2 text-sm text-ink">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Objetivo: </span>
                  {task.feature.objective}
                </p>
              )}
            </SectionCard>
          )}

          {(task.dependsOn.length > 0 || task.blocks.length > 0) && (
            <SectionCard title="Dependências">
              {task.dependsOn.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                    Depende de
                  </p>
                  <div className="space-y-1">
                    {task.dependsOn.map((d) => (
                      <div key={d.id} className="flex items-center gap-2">
                        <EntityLink type="task" href={`/tasks/${d.dependsOnTask.id}`}>
                          {d.dependsOnTask.title}
                        </EntityLink>
                        <TaskStatusBadge status={d.dependsOnTask.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {task.blocks.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                    Bloqueia
                  </p>
                  <div className="space-y-1">
                    {task.blocks.map((d) => (
                      <div key={d.id}>
                        <EntityLink type="task" href={`/tasks/${d.task.id}`}>
                          {d.task.title}
                        </EntityLink>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {task.subtasks.length > 0 && (
            <SectionCard title={`Subtasks (${task.subtasks.length})`}>
              <ul className="divide-y divide-border">
                {task.subtasks.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <EntityLink type="task" href={`/tasks/${s.id}`}>
                      {s.title}
                    </EntityLink>
                    <TaskStatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          <SectionCard title="Histórico">
            <ActivityFeed items={activity} />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Origem">
            <div className="space-y-3 text-sm">
              <OriginRow label="Decisão">
                {task.decision ? (
                  <>
                    <EntityLink type="decision" href={`/decisions/${task.decision.id}`}>
                      {task.decision.title}
                    </EntityLink>
                    <p className="mt-1 line-clamp-3 text-xs text-ink-muted">&ldquo;{task.decision.decision}&rdquo;</p>
                  </>
                ) : (
                  <span className="text-ink-faint">Nenhuma — criada manualmente</span>
                )}
              </OriginRow>
              <OriginRow label="Reunião">
                {originMeeting ? (
                  <>
                    <EntityLink type="meeting" href={`/meetings/${originMeeting.id}`}>
                      {originMeeting.title}
                    </EntityLink>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {formatDate(originMeeting.date)} · {task.decision ? "via decisão" : "follow-up direto"}
                    </p>
                  </>
                ) : (
                  <span className="text-ink-faint">{task.decision ? "Decisão registrada fora de reunião" : "—"}</span>
                )}
              </OriginRow>
              <OriginRow label="Feature">
                {task.feature ? (
                  <EntityLink type="feature" href={`/features/${task.feature.id}`}>
                    {task.feature.title}
                  </EntityLink>
                ) : (
                  <span className="text-ink-faint">Task avulsa (sem Feature)</span>
                )}
              </OriginRow>
              <OriginRow label="Product">
                {product ? (
                  <EntityLink type="product" href={`/products/${product.id}`}>
                    {product.name}
                  </EntityLink>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </OriginRow>
            </div>
          </SectionCard>

          <SectionCard title="Detalhes">
            <div className="space-y-3 text-sm">
              <DetailRow label="Responsável">
                {task.assignee ? (
                  <PersonChip name={task.assignee.name} role={task.assignee.role} />
                ) : (
                  <PersonPlaceholder />
                )}
              </DetailRow>
              <DetailRow label="Criada por">
                {task.createdBy ? (
                  <PersonChip name={task.createdBy.name} role={task.createdBy.role} />
                ) : (
                  <PersonPlaceholder label="—" />
                )}
              </DetailRow>
              <DetailRow label="Revisor">
                {task.reviewer ? (
                  <PersonChip name={task.reviewer.name} role={task.reviewer.role} />
                ) : (
                  <PersonPlaceholder label="Sem revisor" />
                )}
              </DetailRow>
              <DetailRow label="Prazo">
                {task.dueDate ? formatDate(task.dueDate) : <span className="text-ink-faint">Sem prazo</span>}
              </DetailRow>
              {task.parentTask && (
                <DetailRow label="Subtask de">
                  <EntityLink type="task" href={`/tasks/${task.parentTask.id}`}>
                    {task.parentTask.title}
                  </EntityLink>
                </DetailRow>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function OriginRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-ink-faint">{label}</span>
      {children}
    </div>
  );
}
