import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb, EmptyState } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import { EntityLink } from "@/components/ui/EntityLink";
import { PersonChip, PersonPlaceholder } from "@/components/ui/PersonChip";
import { TaskStatusBadge } from "@/components/ui/StatusBadges";
import { ActivityFeed } from "@/components/ActivityFeed";
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
      generatedTasks: { include: { assignee: true }, orderBy: { createdAt: "asc" } },
      artifacts: true,
    },
  });

  if (!decision) notFound();

  const activity = await prisma.activityLog.findMany({
    where: {
      OR: [
        { entityType: "decision", entityId: decision.id },
        { entityType: "task", entityId: { in: decision.generatedTasks.map((t) => t.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const product = decision.feature?.product ?? decision.product ?? null;
  const tasksDone = decision.generatedTasks.filter((t) => t.status === "DONE").length;

  return (
    <div>
      <Breadcrumb items={[{ label: "Decisions", href: "/decisions" }, { label: decision.title }]} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">{decision.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {decision.author?.name ?? "—"} · {formatDate(decision.decidedAt)}
            {decision.meeting && (
              <>
                {" · na reunião "}
                <Link href={`/meetings/${decision.meeting.id}`} className="hover:underline">
                  {decision.meeting.title}
                </Link>
              </>
            )}
          </p>
        </div>
        <Link
          href={`/decisions/${decision.id}/edit`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50"
        >
          Editar
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Decisão">
            <p className="text-sm font-medium text-ink">{decision.decision}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <TextField label="Situação que motivou" value={decision.context} />
              <TextField label="Justificativa" value={decision.reason} />
              <TextField label="Alternativas consideradas" value={decision.alternatives} />
            </dl>
          </SectionCard>

          <SectionCard
            title={`Execução — tasks geradas (${tasksDone}/${decision.generatedTasks.length})`}
            action={
              <Link
                href={`/tasks/new?decisionId=${decision.id}`}
                className="text-xs font-medium text-brand hover:underline"
              >
                + Criar Task
              </Link>
            }
          >
            {decision.generatedTasks.length === 0 ? (
              <EmptyState
                icon="task"
                title="Nenhuma task gerada ainda"
                description="A execução desta decisão é acompanhada pelas tasks que ela gerar."
              />
            ) : (
              <ul className="divide-y divide-border">
                {decision.generatedTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <EntityLink type="task" href={`/tasks/${t.id}`}>
                      {t.title}
                    </EntityLink>
                    <div className="flex shrink-0 items-center gap-3">
                      {t.assignee ? (
                        <PersonChip name={t.assignee.name} role={t.assignee.role} />
                      ) : (
                        <PersonPlaceholder />
                      )}
                      <TaskStatusBadge status={t.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Histórico">
            <ActivityFeed items={activity} />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Contexto">
            <div className="space-y-3 text-sm">
              <ContextRow label="Reunião de origem">
                {decision.meeting ? (
                  <>
                    <EntityLink type="meeting" href={`/meetings/${decision.meeting.id}`}>
                      {decision.meeting.title}
                    </EntityLink>
                    <p className="mt-0.5 text-xs text-ink-faint">{formatDate(decision.meeting.date)}</p>
                  </>
                ) : (
                  <span className="text-ink-faint">Registrada fora de reunião</span>
                )}
              </ContextRow>
              <ContextRow label="Product">
                {product ? (
                  <EntityLink type="product" href={`/products/${product.id}`}>
                    {product.name}
                  </EntityLink>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </ContextRow>
              <ContextRow label="Feature">
                {decision.feature ? (
                  <EntityLink type="feature" href={`/features/${decision.feature.id}`}>
                    {decision.feature.title}
                  </EntityLink>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </ContextRow>
              <ContextRow label="Autor">
                {decision.author ? (
                  <PersonChip name={decision.author.name} role={decision.author.role} />
                ) : (
                  <PersonPlaceholder label="—" />
                )}
              </ContextRow>
              <ContextRow label="Data">{formatDate(decision.decidedAt)}</ContextRow>
            </div>
          </SectionCard>

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

          {decision.artifacts.length > 0 && (
            <SectionCard title="Artefatos">
              <ul className="space-y-2">
                {decision.artifacts.map((a) => (
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

function TextField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-ink">
        {value || <span className="text-ink-faint">Não informado.</span>}
      </dd>
    </div>
  );
}

function ContextRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
