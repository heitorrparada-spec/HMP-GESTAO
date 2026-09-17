import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb, EmptyState } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import { EntityLink } from "@/components/ui/EntityLink";
import { TaskStatusBadge } from "@/components/ui/StatusBadges";
import { PersonChip } from "@/components/ui/PersonChip";
import { formatDateTime, formatRelative } from "@/lib/format";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      participants: { include: { person: true } },
      decisions: { include: { feature: true, product: true } },
      followUpTasks: { include: { feature: true, assignee: true } },
      artifacts: true,
    },
  });

  if (!meeting) notFound();

  return (
    <div>
      <Breadcrumb items={[{ label: "Meetings", href: "/meetings" }, { label: meeting.title }]} />

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">{meeting.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{formatDateTime(meeting.date)}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {meeting.participants.map(({ person }) => (
            <PersonChip key={person.id} name={person.name} role={person.role} />
          ))}
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
        </div>

        <div className="space-y-6">
          <SectionCard title={`Decisões geradas (${meeting.decisions.length})`}>
            {meeting.decisions.length === 0 ? (
              <EmptyState icon="decision" title="Nenhuma decisão gerada" />
            ) : (
              <ul className="space-y-3">
                {meeting.decisions.map((d) => (
                  <li key={d.id}>
                    <EntityLink type="decision" href={`/decisions/${d.id}`}>
                      {d.title}
                    </EntityLink>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {formatRelative(d.decidedAt)}
                      {d.feature && ` · ${d.feature.title}`}
                      {d.product && !d.feature && ` · ${d.product.name}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title={`Tasks geradas (${meeting.followUpTasks.length})`}>
            {meeting.followUpTasks.length === 0 ? (
              <EmptyState icon="task" title="Nenhuma task gerada diretamente" />
            ) : (
              <ul className="space-y-2">
                {meeting.followUpTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <EntityLink type="task" href={`/tasks/${t.id}`} muted>
                      {t.title}
                    </EntityLink>
                    <TaskStatusBadge status={t.status} />
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
