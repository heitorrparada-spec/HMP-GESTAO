import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb, EmptyState } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import { EntityLink } from "@/components/ui/EntityLink";
import { PersonChip } from "@/components/ui/PersonChip";
import { TaskStatusBadge } from "@/components/ui/StatusBadges";
import { formatDate } from "@/lib/format";

export default async function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const decision = await prisma.decision.findUnique({
    where: { id },
    include: {
      author: true,
      meeting: true,
      feature: { include: { product: true } },
      product: true,
      participants: { include: { person: true } },
      generatedTasks: { include: { assignee: true } },
      artifacts: true,
    },
  });

  if (!decision) notFound();

  return (
    <div>
      <Breadcrumb items={[{ label: "Decisions", href: "/decisions" }, { label: decision.title }]} />

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">{decision.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {decision.author?.name ?? "—"} · {formatDate(decision.decidedAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Decisão">
            <p className="text-sm font-medium text-ink">{decision.decision}</p>
          </SectionCard>

          <SectionCard title="Contexto">
            <p className="whitespace-pre-wrap text-sm text-ink">
              {decision.context || <span className="text-ink-faint">Não informado.</span>}
            </p>
          </SectionCard>

          <SectionCard title="Motivo">
            <p className="whitespace-pre-wrap text-sm text-ink">
              {decision.reason || <span className="text-ink-faint">Não informado.</span>}
            </p>
          </SectionCard>

          {decision.alternatives && (
            <SectionCard title="Alternativas consideradas">
              <p className="whitespace-pre-wrap text-sm text-ink">{decision.alternatives}</p>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard title="Entidades afetadas">
            <div className="space-y-2">
              {decision.feature && (
                <EntityLink type="feature" href={`/features/${decision.feature.id}`}>
                  {decision.feature.title}
                </EntityLink>
              )}
              {decision.product && (
                <EntityLink type="product" href={`/products/${decision.product.id}`}>
                  {decision.product.name}
                </EntityLink>
              )}
              {!decision.feature && !decision.product && (
                <p className="text-sm text-ink-faint">Nenhuma entidade vinculada.</p>
              )}
            </div>
          </SectionCard>

          {decision.meeting && (
            <SectionCard title="Origem">
              <EntityLink type="meeting" href={`/meetings/${decision.meeting.id}`}>
                {decision.meeting.title}
              </EntityLink>
            </SectionCard>
          )}

          <SectionCard title="Participantes">
            {decision.participants.length === 0 ? (
              <p className="text-sm text-ink-faint">Nenhum participante registrado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {decision.participants.map(({ person }) => (
                  <PersonChip key={person.id} name={person.name} role={person.role} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={`Tasks geradas (${decision.generatedTasks.length})`}>
            {decision.generatedTasks.length === 0 ? (
              <EmptyState icon="task" title="Nenhuma task gerada ainda" />
            ) : (
              <ul className="space-y-2">
                {decision.generatedTasks.map((t) => (
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
        </div>
      </div>
    </div>
  );
}
