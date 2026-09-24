import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb, EmptyState } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import { EntityLink } from "@/components/ui/EntityLink";
import { Icon } from "@/components/ui/Icon";
import { TaskStatusBadge } from "@/components/ui/StatusBadges";
import { PersonChip, PersonPlaceholder } from "@/components/ui/PersonChip";
import { ActivityFeed } from "@/components/ActivityFeed";
import { formatDateTime } from "@/lib/format";
import { getHistory, historyLimit, HISTORY_PAGE_SIZE } from "@/lib/history/queries";

export default async function MeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historico?: string }>;
}) {
  const { id } = await params;
  const limit = historyLimit((await searchParams).historico);

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      participants: { include: { person: true } },
      decisions: {
        include: { feature: true, product: true, _count: { select: { generatedTasks: true } } },
        orderBy: { decidedAt: "asc" },
      },
      artifacts: true,
    },
  });

  if (!meeting) notFound();

  // Tasks decorrentes: geradas pelas decisões da reunião ou registradas como follow-up direto dela.
  const tasks = await prisma.task.findMany({
    where: { OR: [{ decision: { meetingId: meeting.id } }, { meetingId: meeting.id }] },
    include: { assignee: true, decision: true },
    orderBy: { createdAt: "asc" },
  });

  // Histórico por escopo: a reunião, as decisões dela e as tasks decorrentes (inclusive arquivadas).
  const history = await getHistory({ meetingId: meeting.id }, limit);

  return (
    <div>
      <Breadcrumb items={[{ label: "Meetings", href: "/meetings" }, { label: meeting.title }]} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">{meeting.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{formatDateTime(meeting.date)}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {meeting.participants.length === 0 ? (
              <PersonPlaceholder label="Sem participantes registrados" />
            ) : (
              meeting.participants.map(({ person }) => (
                <PersonChip key={person.id} name={person.name} role={person.role} />
              ))
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/meetings/${meeting.id}/edit`}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50"
          >
            Editar
          </Link>
          <Link
            href={`/decisions/new?meetingId=${meeting.id}`}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90"
          >
            + Registrar decisão
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Pauta">
            <p className="whitespace-pre-wrap text-sm text-ink">
              {meeting.agenda || <span className="text-ink-faint">Sem pauta registrada.</span>}
            </p>
          </SectionCard>

          <SectionCard title="Notas">
            <p className="whitespace-pre-wrap text-sm text-ink">
              {meeting.notes || <span className="text-ink-faint">Sem notas registradas.</span>}
            </p>
          </SectionCard>

          <SectionCard title={`Decisões tomadas (${meeting.decisions.length})`}>
            {meeting.decisions.length === 0 ? (
              <EmptyState
                icon="decision"
                title="Nenhuma decisão registrada"
                description="Registre aqui o que foi decidido nesta reunião para que vire execução rastreável."
              />
            ) : (
              <ul className="divide-y divide-border">
                {meeting.decisions.map((d) => (
                  <li key={d.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <EntityLink type="decision" href={`/decisions/${d.id}`}>
                        {d.title}
                      </EntityLink>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {d._count.generatedTasks} task{d._count.generatedTasks !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{d.decision}</p>
                    {(d.feature || d.product) && (
                      <p className="mt-1 text-xs text-ink-faint">
                        Afeta:{" "}
                        {d.feature ? (
                          <Link href={`/features/${d.feature.id}`} className="hover:underline">
                            {d.feature.title}
                          </Link>
                        ) : (
                          d.product && (
                            <Link href={`/products/${d.product.id}`} className="hover:underline">
                              {d.product.name}
                            </Link>
                          )
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Histórico">
            <ActivityFeed
              items={history.items}
              moreHref={history.hasMore ? `/meetings/${meeting.id}?historico=${limit + HISTORY_PAGE_SIZE}` : null}
            />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title={`Tasks decorrentes (${tasks.length})`}>
            {tasks.length === 0 ? (
              <EmptyState icon="task" title="Nenhuma task decorrente ainda" />
            ) : (
              <ul className="space-y-4">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/tasks/${t.id}`}
                      className="flex items-start gap-1.5 text-sm font-medium text-ink hover:underline"
                    >
                      <Icon name="task" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                      <span className={t.archivedAt ? "line-clamp-2 line-through decoration-ink-faint" : "line-clamp-2"}>
                        {t.title}
                      </span>
                      {t.archivedAt && <span className="shrink-0 text-xs font-normal text-ink-faint">(arquivada)</span>}
                    </Link>
                    <div className="mt-1.5 flex items-center gap-2 pl-5">
                      <TaskStatusBadge status={t.status} />
                      <span className="truncate text-xs text-ink-muted">{t.assignee?.name ?? "Sem responsável"}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 pl-5 text-xs text-ink-faint">
                      {t.decision ? `via decisão "${t.decision.title}"` : "Follow-up direto da reunião"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {meeting.artifacts.length > 0 && (
            <SectionCard title="Artefatos">
              <ul className="space-y-2">
                {meeting.artifacts.map((a) => (
                  <li key={a.id}>
                    <EntityLink type="artifact" href={`/artifacts/${a.id}`}>
                      {a.title}
                    </EntityLink>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
