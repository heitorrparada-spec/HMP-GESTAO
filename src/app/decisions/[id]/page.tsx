import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb, EmptyState } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import { EntityLink } from "@/components/ui/EntityLink";
import { PersonChip, PersonPlaceholder } from "@/components/ui/PersonChip";
import { TaskStatusBadge } from "@/components/ui/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { ReasonAction } from "@/components/ui/ReasonAction";
import { ActivityFeed } from "@/components/ActivityFeed";
import { formatDate, formatDateTime } from "@/lib/format";
import { decisionLock } from "@/lib/history/policy";
import { getHistory, historyLimit, HISTORY_PAGE_SIZE } from "@/lib/history/queries";
import { revokeDecision } from "../actions";

const STATUS_LABEL = { ACTIVE: "Ativa", SUPERSEDED: "Substituída", REVOKED: "Revogada" } as const;

export default async function DecisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historico?: string }>;
}) {
  const { id } = await params;
  const limit = historyLimit((await searchParams).historico);

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
      supersedes: { select: { id: true, title: true } },
      supersededBy: { select: { id: true, title: true } },
      revokedBy: { select: { name: true } },
    },
  });

  if (!decision) notFound();

  const [history, original, corrections, supersededEvent] = await Promise.all([
    getHistory({ decisionId: decision.id }, limit),
    // Versão original: o snapshot do registro (ou do baseline da migração, para decisões anteriores à V0.3 —
    // o "decision.created" delas é só texto, sem snapshot).
    prisma.activityLog.findFirst({
      where: {
        entityType: "decision",
        entityId: decision.id,
        schemaVersion: 2,
        eventType: { in: ["decision.created", "decision.baseline"] },
      },
      orderBy: { seq: "asc" },
    }),
    prisma.activityLog.count({ where: { entityType: "decision", entityId: decision.id, eventType: "decision.updated" } }),
    decision.status === "SUPERSEDED"
      ? prisma.activityLog.findFirst({
          where: { entityType: "decision", entityId: decision.id, eventType: "decision.superseded" },
          orderBy: { seq: "desc" },
        })
      : null,
  ]);

  const product = decision.feature?.product ?? decision.product ?? null;
  // Tasks arquivadas continuam aqui: a decisão gerou trabalho, mesmo que ele tenha saído do quadro.
  const activeTasks = decision.generatedTasks.filter((t) => !t.archivedAt);
  const tasksDone = activeTasks.filter((t) => t.status === "DONE").length;
  const lock = decisionLock({
    status: decision.status,
    createdAt: decision.createdAt,
    generatedTaskCount: decision.generatedTasks.length,
  });
  const active = decision.status === "ACTIVE";
  const originalSnapshot = (original?.snapshot ?? null) as Record<string, string | null> | null;

  return (
    <div>
      <Breadcrumb items={[{ label: "Decisions", href: "/decisions" }, { label: decision.title }]} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold text-ink">{decision.title}</h1>
            <Badge tone={active ? "green" : "gray"}>{STATUS_LABEL[decision.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {decision.author?.name ?? "—"} · decidida em {formatDate(decision.decidedAt)} · registrada em{" "}
            {formatDateTime(decision.createdAt)}
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
        {active && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/decisions/${decision.id}/edit`}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50"
              >
                {lock.locked ? "Corrigir título" : "Editar"}
              </Link>
              {lock.locked && (
                <Link
                  href={`/decisions/new?supersedes=${decision.id}`}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50"
                >
                  Substituir por nova decisão
                </Link>
              )}
            </div>
            <ReasonAction
              action={revokeDecision.bind(null, decision.id)}
              name="revokeReason"
              label="Revogar decisão"
              reasonLabel="Por que esta decisão deixa de valer? (ela continua visível, como revogada)"
              confirmLabel="Revogar"
            />
          </div>
        )}
      </div>

      <div className="mb-6 space-y-2" data-decision-state>
        {active && !lock.locked && (
          <p className="rounded-md bg-slate-50 p-2.5 text-xs text-ink-muted">
            Em janela de correção até {formatDateTime(lock.windowEndsAt)} — até lá (e enquanto não gerar tasks) o
            conteúdo pode ser corrigido, com o histórico guardando cada versão.
          </p>
        )}
        {active && lock.locked && (
          <p className="rounded-md bg-slate-50 p-2.5 text-xs text-ink-muted">
            Decisão travada — {lock.kind === "tasks" ? "ela já gerou trabalho" : "a janela de correção terminou"}. O
            mérito fica como foi decidido; para mudá-lo, registre uma nova decisão que substitui esta.
          </p>
        )}
        {decision.status === "SUPERSEDED" && decision.supersededBy && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900">
            Substituída por{" "}
            <Link href={`/decisions/${decision.supersededBy.id}`} className="font-medium hover:underline">
              {decision.supersededBy.title}
            </Link>
            {supersededEvent && (
              <span className="block text-xs">
                {supersededEvent.actorName ?? "—"} · {formatDateTime(supersededEvent.createdAt)}
                {supersededEvent.reason ? ` — motivo: ${supersededEvent.reason}` : ""}
              </span>
            )}
          </p>
        )}
        {decision.status === "REVOKED" && (
          <p className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
            Revogada
            <span className="block text-xs">
              {decision.revokedBy?.name ?? "—"} · {formatDateTime(decision.revokedAt)}
              {decision.revokeReason ? ` — motivo: ${decision.revokeReason}` : ""}
            </span>
          </p>
        )}
        {decision.supersedes && (
          <p className="text-xs text-ink-muted">
            Substitui a decisão{" "}
            <Link href={`/decisions/${decision.supersedes.id}`} className="font-medium text-ink hover:underline">
              {decision.supersedes.title}
            </Link>
            .
          </p>
        )}
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
            {corrections > 0 && originalSnapshot && (
              <details className="mt-4 border-t border-border pt-3 text-sm" data-original-version>
                <summary className="cursor-pointer text-xs font-medium text-brand">
                  Ver versão original ({original?.eventType === "decision.baseline" ? "no início do histórico completo" : `registrada em ${formatDateTime(original!.createdAt)}`}) — {corrections} correç{corrections === 1 ? "ão" : "ões"} depois
                </summary>
                <dl className="mt-2 space-y-2">
                  <TextField label="Título" value={originalSnapshot.title} />
                  <TextField label="Decisão" value={originalSnapshot.decision} />
                  <TextField label="Situação que motivou" value={originalSnapshot.context} />
                  <TextField label="Justificativa" value={originalSnapshot.reason} />
                  <TextField label="Alternativas consideradas" value={originalSnapshot.alternatives} />
                </dl>
              </details>
            )}
          </SectionCard>

          <SectionCard
            title={`Execução — tasks geradas (${tasksDone}/${activeTasks.length})`}
            action={
              active ? (
                <Link
                  href={`/tasks/new?decisionId=${decision.id}`}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  + Criar Task
                </Link>
              ) : undefined
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
                    <span className={t.archivedAt ? "line-through decoration-ink-faint" : undefined}>
                      <EntityLink type="task" href={`/tasks/${t.id}`}>
                        {t.title}
                      </EntityLink>
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
                      {t.archivedAt && <Badge tone="gray">Arquivada</Badge>}
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
            <ActivityFeed
              items={history.items}
              moreHref={history.hasMore ? `/decisions/${decision.id}?historico=${limit + HISTORY_PAGE_SIZE}` : null}
            />
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
              <ContextRow label="Decidida em">{formatDate(decision.decidedAt)}</ContextRow>
              <ContextRow label="Registrada em">{formatDateTime(decision.createdAt)}</ContextRow>
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
