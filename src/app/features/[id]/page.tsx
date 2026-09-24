import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb, EmptyState } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusTracker } from "@/components/ui/StatusTracker";
import { NextStepHint } from "@/components/entities/NextStepHint";
import { EntityLink } from "@/components/ui/EntityLink";
import {
  FeatureStatusBadge,
  PriorityBadge,
  TaskStatusBadge,
  ValidationResultBadge,
} from "@/components/ui/StatusBadges";
import { PersonChip, PersonPlaceholder } from "@/components/ui/PersonChip";
import { ActivityFeed } from "@/components/ActivityFeed";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ActionForm } from "@/components/ui/ActionForm";
import { ReasonAction } from "@/components/ui/ReasonAction";
import { formatDateTime, formatRelative } from "@/lib/format";
import {
  criteriaStatusMeta,
  featureStatusMeta,
  featureStatusOrder,
  priorityMeta,
  requirementStatusMeta,
  taskStatusMeta,
} from "@/lib/labels";
import { featureLockMessage, featureLocks, isRegression } from "@/lib/history/policy";
import { getHistory, historyLimit, HISTORY_PAGE_SIZE } from "@/lib/history/queries";
import {
  updateFeatureStatus,
  recordValidation,
  createRequirement,
  updateRequirement,
  archiveRequirement,
  restoreRequirement,
  createAcceptanceCriteria,
  archiveAcceptanceCriteria,
  restoreAcceptanceCriteria,
} from "../actions";
import type {
  CriteriaStatus,
  FeatureStatus,
  Priority,
  RequirementStatus,
  TaskStatus,
  ValidationResult,
} from "@/generated/prisma/client";

export default async function FeaturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historico?: string }>;
}) {
  const { id } = await params;
  const limit = historyLimit((await searchParams).historico);

  const feature = await prisma.feature.findUnique({
    where: { id },
    include: {
      product: true,
      release: true,
      owner: true,
      architect: true,
      techLead: true,
      requirements: { include: { archivedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      artifacts: { include: { author: true }, orderBy: { createdAt: "asc" } },
      tasks: { include: { assignee: true }, orderBy: { createdAt: "asc" } },
      acceptanceCriteria: { include: { archivedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      validationRecords: { include: { validatedBy: true }, orderBy: { attemptNumber: "desc" } },
      decisions: { include: { author: true, meeting: true }, orderBy: { decidedAt: "desc" } },
    },
  });

  if (!feature) notFound();

  // Estado atual × arquivados: arquivar não apaga, só tira do trabalho corrente (V0.3-A).
  const requirements = feature.requirements.filter((r) => !r.archivedAt);
  const archivedRequirements = feature.requirements.filter((r) => r.archivedAt);
  const tasks = feature.tasks.filter((t) => !t.archivedAt);
  const archivedTasks = feature.tasks.filter((t) => t.archivedAt);
  const criteria = feature.acceptanceCriteria.filter((c) => !c.archivedAt);
  const archivedCriteria = feature.acceptanceCriteria.filter((c) => c.archivedAt);
  const locks = featureLocks(feature.status);

  // Histórico completo da Feature: tudo com escopo nela (requisitos, critérios, validações, tasks, decisões).
  const history = await getHistory({ featureId: feature.id }, limit);

  const references = feature.artifacts.filter((a) => a.type === "RESEARCH" || a.type === "REFERENCE");
  const architectureArtifacts = feature.artifacts.filter((a) =>
    ["C4", "CLASS_DIAGRAM", "SEQUENCE_DIAGRAM"].includes(a.type),
  );
  const otherArtifacts = feature.artifacts.filter(
    (a) => !references.includes(a) && !architectureArtifacts.includes(a),
  );
  const tasksDone = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Products", href: "/products" },
          { label: feature.product.name, href: `/products/${feature.product.id}` },
          { label: feature.title },
        ]}
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold text-ink">{feature.title}</h1>
            <FeatureStatusBadge status={feature.status} />
            <PriorityBadge priority={feature.priority} />
          </div>
          {feature.release && (
            <p className="mt-1 text-xs text-ink-faint">Release: {feature.release.name}</p>
          )}
        </div>
        {!locks.done && (
          <Link
            href={`/features/${feature.id}/edit`}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50"
          >
            Editar
          </Link>
        )}
      </div>

      <StatusTracker
        current={feature.status}
        steps={featureStatusOrder.map((status) => ({
          value: status,
          label: featureStatusMeta[status].label,
          action: updateFeatureStatus.bind(null, feature.id, status),
          ...disabledReasonFor(feature.status, status),
          requiresReason:
            feature.status !== "DONE" && isRegression(feature.status, status)
              ? `Voltar a Feature para ${featureStatusMeta[status].label} exige um motivo:`
              : undefined,
        }))}
      />
      {feature.status !== "DONE" && <NextStepHint feature={{ ...feature, tasks, acceptanceCriteria: criteria }} />}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Contexto & problema">
            <dl className="space-y-4 text-sm">
              <Field label="Contexto" value={feature.context} />
              <Field label="Problema" value={feature.problem} />
              <Field label="Necessidade do usuário" value={feature.userNeed} />
              <Field label="Objetivo" value={feature.objective} />
            </dl>
          </SectionCard>

          <RequirementsSection
            featureId={feature.id}
            requirements={requirements}
            archived={archivedRequirements}
            lockMessage={locks.requirements ? featureLockMessage(feature.status, "requirements") : null}
          />

          <SectionCard title="Fluxo funcional & arquitetura">
            <dl className="space-y-4 text-sm">
              <Field label="Fluxo funcional" value={feature.functionalFlow} />
              <Field label="Notas de arquitetura" value={feature.architectureNotes} />
            </dl>
            {architectureArtifacts.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Diagramas</p>
                <ArtifactMiniList artifacts={architectureArtifacts} />
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={`Tasks (${tasksDone}/${tasks.length})`}
            action={
              <div className="flex items-center gap-3">
                {!locks.done && (
                  <Link
                    href={`/tasks/new?featureId=${feature.id}`}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    + Nova
                  </Link>
                )}
                <Link href="/tasks" className="text-xs font-medium text-brand hover:underline">
                  Ver todas
                </Link>
              </div>
            }
          >
            {tasks.length === 0 ? (
              <EmptyState icon="task" title="Nenhuma task criada ainda" />
            ) : (
              <ul className="divide-y divide-border">
                {tasks.map((t) => (
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
            {archivedTasks.length > 0 && (
              <ArchivedList
                label={`Tasks arquivadas (${archivedTasks.length})`}
                items={archivedTasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  href: `/tasks/${t.id}`,
                  reason: t.archiveReason,
                  at: t.archivedAt,
                }))}
              />
            )}
          </SectionCard>

          <AcceptanceCriteriaSection
            featureId={feature.id}
            criteria={criteria}
            archived={archivedCriteria}
            lockMessage={locks.criteria ? featureLockMessage(feature.status, "criteria") : null}
          />

          <div id="validation" className="scroll-mt-6">
            <ValidationSection feature={{ ...feature, acceptanceCriteria: criteria }} />
          </div>

          <div id="historico" className="scroll-mt-6">
            <SectionCard title="Histórico">
              <ActivityFeed
                items={history.items}
                moreHref={history.hasMore ? `/features/${feature.id}?historico=${limit + HISTORY_PAGE_SIZE}#historico` : null}
              />
            </SectionCard>
          </div>
        </div>

        <div className="space-y-6">
          <SectionCard title="Responsabilidades">
            <div className="space-y-3 text-sm">
              <ResponsibilityRow label="Product" person={feature.owner} />
              <ResponsibilityRow label="Architecture" person={feature.architect} />
              <ResponsibilityRow label="Engineering" person={feature.techLead} />
            </div>
          </SectionCard>

          <SectionCard title="Referências">
            {references.length === 0 ? (
              <EmptyState title="Nenhuma referência vinculada" />
            ) : (
              <ArtifactMiniList artifacts={references} />
            )}
          </SectionCard>

          <SectionCard
            title={`Decisões (${feature.decisions.length})`}
            action={
              <Link
                href={`/decisions/new?featureId=${feature.id}`}
                className="text-xs font-medium text-brand hover:underline"
              >
                + Nova
              </Link>
            }
          >
            {feature.decisions.length === 0 ? (
              <EmptyState icon="decision" title="Nenhuma decisão registrada" />
            ) : (
              <ul className="space-y-3">
                {feature.decisions.map((d) => (
                  <li key={d.id}>
                    <EntityLink type="decision" href={`/decisions/${d.id}`}>
                      {d.title}
                    </EntityLink>
                    {d.status !== "ACTIVE" && (
                      <Badge tone="gray">{d.status === "SUPERSEDED" ? "Substituída" : "Revogada"}</Badge>
                    )}
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {d.author?.name ?? "—"} · {formatRelative(d.decidedAt)}
                      {d.meeting && ` · na reunião "${d.meeting.title}"`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {otherArtifacts.length > 0 && (
            <SectionCard title="Outros artefatos">
              <ArtifactMiniList artifacts={otherArtifacts} />
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-ink">
        {value || <span className="text-ink-faint">Ainda não preenchido</span>}
      </dd>
    </div>
  );
}

// Só dica visual: espelha assertValidManualTransition (../actions.ts), que é quem aplica a regra.
function disabledReasonFor(
  current: FeatureStatus,
  target: FeatureStatus,
): { disabled?: boolean; disabledReason?: string } {
  if (current === "DONE") {
    return { disabled: true, disabledReason: "Feature concluída — status não muda mais manualmente." };
  }
  if (target === "DONE") {
    return { disabled: true, disabledReason: 'Só se chega aqui aprovando a Feature em "Validation".' };
  }
  if (target === "VALIDATION" && current !== "REVIEW") {
    return { disabled: true, disabledReason: 'Só é possível entrar em "Validation" a partir de "Review".' };
  }
  return {};
}

function ResponsibilityRow({
  label,
  person,
}: {
  label: string;
  person: { name: string; role: import("@/generated/prisma/client").RoleName } | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-faint">{label}</span>
      {person ? <PersonChip name={person.name} role={person.role} /> : <PersonPlaceholder />}
    </div>
  );
}

function ArtifactMiniList({
  artifacts,
}: {
  artifacts: Array<{ id: string; title: string; type: import("@/generated/prisma/client").ArtifactType; url: string | null }>;
}) {
  return (
    <ul className="space-y-2">
      {artifacts.map((a) => (
        <li key={a.id}>
          <Link href={`/artifacts/${a.id}`} className="text-sm font-medium text-ink hover:underline">
            {a.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LockNote({ message }: { message: string }) {
  return <p className="mt-3 border-t border-border pt-3 text-xs text-ink-faint">{message}</p>;
}

function ArchivedList({
  label,
  items,
}: {
  label: string;
  items: Array<{ id: string; title: string; href?: string; reason: string | null; at: Date | null; by?: string | null; restore?: React.ReactNode }>;
}) {
  return (
    <details className="mt-3 border-t border-border pt-3" data-archived-list>
      <summary className="cursor-pointer text-xs font-medium text-ink-muted">{label}</summary>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border border-dashed border-border p-2.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              {item.href ? (
                <Link href={item.href} className="text-ink-muted line-through decoration-ink-faint hover:underline">
                  {item.title}
                </Link>
              ) : (
                <span className="text-ink-muted line-through decoration-ink-faint">{item.title}</span>
              )}
              <Badge tone="gray">Arquivado</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {item.by ? `${item.by} · ` : ""}
              {item.at ? formatDateTime(item.at) : ""}
              {item.reason ? ` — motivo: ${item.reason}` : ""}
            </p>
            {item.restore && <div className="mt-1.5">{item.restore}</div>}
          </li>
        ))}
      </ul>
    </details>
  );
}

const requirementStatusOrder: RequirementStatus[] = ["PROPOSED", "APPROVED", "IMPLEMENTED", "TESTED"];
const priorityOrder: Priority[] = ["P0", "P1", "P2", "P3"];

type RequirementRow = {
  id: string;
  description: string;
  priority: Priority;
  status: RequirementStatus;
  source: string | null;
  archivedAt: Date | null;
  archiveReason: string | null;
  archivedBy: { name: string } | null;
};

function RequirementsSection({
  featureId,
  requirements,
  archived,
  lockMessage,
}: {
  featureId: string;
  requirements: RequirementRow[];
  archived: RequirementRow[];
  lockMessage: string | null;
}) {
  return (
    <SectionCard title={`Requisitos (${requirements.length})`}>
      {requirements.length === 0 ? (
        <EmptyState title="Nenhum requisito registrado ainda" />
      ) : lockMessage ? (
        <ul className="space-y-2">
          {requirements.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-2.5 text-sm">
              <p className="text-ink">{r.description}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {priorityMeta[r.priority].label} · {requirementStatusMeta[r.status].label}
                {r.source ? ` · Fonte: ${r.source}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2">
          {requirements.map((r) => {
            const save = updateRequirement.bind(null, r.id, featureId);
            return (
              <div key={r.id} className="rounded-md border border-border p-2.5" data-requirement={r.id}>
                <ActionForm action={save} className="space-y-2">
                  <input
                    name="description"
                    defaultValue={r.description}
                    required
                    className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      name="priority"
                      defaultValue={r.priority}
                      className="rounded-md border border-border px-2 py-1.5 text-xs"
                    >
                      {priorityOrder.map((p) => (
                        <option key={p} value={p}>
                          {priorityMeta[p].label}
                        </option>
                      ))}
                    </select>
                    <select
                      name="status"
                      defaultValue={r.status}
                      className="rounded-md border border-border px-2 py-1.5 text-xs"
                    >
                      {requirementStatusOrder.map((s) => (
                        <option key={s} value={s}>
                          {requirementStatusMeta[s].label}
                        </option>
                      ))}
                    </select>
                    <input
                      name="source"
                      defaultValue={r.source ?? ""}
                      placeholder="Fonte (opcional)"
                      className="w-40 rounded-md border border-border px-2 py-1.5 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90"
                    >
                      Salvar
                    </button>
                  </div>
                </ActionForm>
                <ReasonAction
                  className="mt-1.5"
                  action={archiveRequirement.bind(null, r.id, featureId)}
                  label="Arquivar"
                  reasonLabel="Por que este requisito sai da Feature?"
                  confirmLabel="Arquivar requisito"
                />
              </div>
            );
          })}
        </div>
      )}
      {archived.length > 0 && (
        <ArchivedList
          label={`Requisitos arquivados (${archived.length})`}
          items={archived.map((r) => ({
            id: r.id,
            title: r.description,
            reason: r.archiveReason,
            at: r.archivedAt,
            by: r.archivedBy?.name,
            restore: lockMessage ? null : (
              <ReasonAction
                action={restoreRequirement.bind(null, r.id, featureId)}
                label="Restaurar"
                reasonLabel="Por que este requisito volta?"
                confirmLabel="Restaurar requisito"
                tone="primary"
              />
            ),
          }))}
        />
      )}
      {lockMessage ? (
        <LockNote message={lockMessage} />
      ) : (
        <ActionForm
          action={createRequirement.bind(null, featureId)}
          resetOnSuccess
          className="mt-3 space-y-2 border-t border-border pt-3"
        >
          <input
            name="description"
            required
            placeholder="Descrição do novo requisito"
            className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select name="priority" defaultValue="P2" className="rounded-md border border-border px-2 py-1.5 text-xs">
              {priorityOrder.map((p) => (
                <option key={p} value={p}>
                  {priorityMeta[p].label}
                </option>
              ))}
            </select>
            <input
              name="source"
              placeholder="Fonte (opcional)"
              className="w-40 rounded-md border border-border px-2 py-1.5 text-xs"
            />
            <SubmitButton pendingLabel="Adicionando…" className="px-3 py-1.5 text-xs">
              + Adicionar
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </SectionCard>
  );
}

type CriteriaRow = {
  id: string;
  description: string;
  status: CriteriaStatus;
  archivedAt: Date | null;
  archiveReason: string | null;
  archivedBy: { name: string } | null;
};

function AcceptanceCriteriaSection({
  featureId,
  criteria,
  archived,
  lockMessage,
}: {
  featureId: string;
  criteria: CriteriaRow[];
  archived: CriteriaRow[];
  lockMessage: string | null;
}) {
  return (
    <SectionCard title={`Testes & critérios de aceite (${criteria.length})`}>
      {criteria.length === 0 ? (
        <EmptyState
          title="Nenhum critério de aceite definido ainda"
          description="Sem critérios, a Feature não pode ser aprovada em Validation."
        />
      ) : (
        <ul className="space-y-2">
          {criteria.map((c) => (
            <li key={c.id} className="rounded-md border border-border p-2.5" data-criteria={c.id}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-ink">{c.description}</span>
                <Badge tone={c.status === "PASSED" ? "green" : c.status === "FAILED" ? "red" : "gray"}>
                  {c.status === "PASSED" ? "Passou" : c.status === "FAILED" ? "Falhou" : "Pendente"}
                </Badge>
              </div>
              {!lockMessage && (
                <ReasonAction
                  className="mt-1.5"
                  action={archiveAcceptanceCriteria.bind(null, c.id, featureId)}
                  label="Arquivar"
                  reasonLabel="Por que este critério sai do contrato de validação?"
                  confirmLabel="Arquivar critério"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <ArchivedList
          label={`Critérios arquivados (${archived.length})`}
          items={archived.map((c) => ({
            id: c.id,
            title: c.description,
            reason: c.archiveReason,
            at: c.archivedAt,
            by: c.archivedBy?.name,
            restore: lockMessage ? null : (
              <ReasonAction
                action={restoreAcceptanceCriteria.bind(null, c.id, featureId)}
                label="Restaurar"
                reasonLabel="Por que este critério volta?"
                confirmLabel="Restaurar critério"
                tone="primary"
              />
            ),
          }))}
        />
      )}
      {lockMessage ? (
        <LockNote message={lockMessage} />
      ) : (
        <ActionForm
          action={createAcceptanceCriteria.bind(null, featureId)}
          resetOnSuccess
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
        >
          <input
            name="description"
            required
            placeholder="Descrição do novo critério de aceite"
            className="min-w-[12rem] flex-1 rounded-md border border-border px-2 py-1.5 text-sm"
          />
          <SubmitButton pendingLabel="Adicionando…" className="px-3 py-1.5 text-xs">
            + Adicionar
          </SubmitButton>
        </ActionForm>
      )}
    </SectionCard>
  );
}

type FeatureWithValidation = {
  id: string;
  status: FeatureStatus;
  acceptanceCriteria: Array<{ id: string; description: string; status: CriteriaStatus }>;
  validationRecords: Array<{
    id: string;
    attemptNumber: number;
    overallResult: ValidationResult;
    requestedResult: ValidationResult | null;
    notes: string | null;
    issuesFound: string | null;
    criteriaSnapshot: unknown;
    requirementsSnapshot: unknown;
    tasksSnapshot: unknown;
    validatedAt: Date | null;
    validatedByName: string | null;
    validatedBy: { name: string } | null;
  }>;
};

type CriteriaSnapshot = Array<{ id?: string; description: string; status: CriteriaStatus }>;
type RequirementsSnapshot = Array<{ id: string; description: string; priority: Priority; status: RequirementStatus }>;
type TasksSnapshot = Array<{ id: string; title: string; status: TaskStatus; assigneeName: string | null }>;

function readList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function ValidationSection({ feature }: { feature: FeatureWithValidation }) {
  return (
    <SectionCard title="Validation">
      {feature.status === "VALIDATION" ? (
        <ActionForm action={recordValidation} className="space-y-4">
          <input type="hidden" name="featureId" value={feature.id} />
          {feature.acceptanceCriteria.length === 0 ? (
            <p className="text-sm text-amber-700">
              Nenhum critério de aceite cadastrado — sem critérios, esta Feature não pode ser aprovada. Volte o
              status para Review para poder cadastrá-los.
            </p>
          ) : (
            <div className="space-y-2">
              {feature.acceptanceCriteria.map((c) => (
                <div key={c.id} className="rounded-md border border-border p-2.5">
                  <p className="mb-1.5 text-sm text-ink">{c.description}</p>
                  <div className="flex gap-4 text-xs">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={`criteria_${c.id}`}
                        value="PASSED"
                        defaultChecked={c.status === "PASSED"}
                      />
                      Passou
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={`criteria_${c.id}`}
                        value="FAILED"
                        defaultChecked={c.status === "FAILED"}
                      />
                      Falhou
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-faint">Observações</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="O que foi observado nesta rodada de validação?"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-faint">
              Problemas encontrados (se houver)
            </label>
            <textarea
              name="issuesFound"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="Descreva o que precisa ser corrigido antes de reenviar para validação"
            />
          </div>
          {feature.acceptanceCriteria.length > 0 && (
            <p className="text-xs text-ink-faint">
              {feature.acceptanceCriteria.filter((c) => c.status === "PASSED").length} de{" "}
              {feature.acceptanceCriteria.length} critérios em &quot;Passou&quot; — todos precisam estar assim para
              poder aprovar.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              name="overallResult"
              value="APPROVED"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Aprovar
            </button>
            <button
              type="submit"
              name="overallResult"
              value="REJECTED"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Reprovar
            </button>
          </div>
          <p className="text-xs text-ink-faint">
            Próximo estágio: aprovar leva a Feature para <strong>Done</strong>; reprovar retorna para{" "}
            <strong>Development</strong>.
          </p>
        </ActionForm>
      ) : (
        <p className="text-sm text-ink-faint">
          A Feature precisa estar em <strong>Validation</strong> para registrar um resultado. Estado atual:{" "}
          {featureStatusMeta[feature.status].label}.
        </p>
      )}
      {feature.validationRecords.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Histórico de tentativas
          </p>
          {feature.validationRecords.map((v) => {
            const criteria = readList<CriteriaSnapshot[number]>(v.criteriaSnapshot);
            const requirements = readList<RequirementsSnapshot[number]>(v.requirementsSnapshot);
            const tasks = readList<TasksSnapshot[number]>(v.tasksSnapshot);
            const structured = v.requirementsSnapshot !== null || v.tasksSnapshot !== null;
            return (
              <div key={v.id} className="rounded-md border border-border p-2.5 text-sm" data-validation-attempt={v.attemptNumber}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">Tentativa {v.attemptNumber}</span>
                  <ValidationResultBadge result={v.overallResult} />
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  {v.validatedByName ?? v.validatedBy?.name ?? "—"} · {formatDateTime(v.validatedAt)}
                  {v.requestedResult === "APPROVED" && v.overallResult === "REJECTED" && " · aprovação pedida, bloqueada pelo gate"}
                </p>
                {criteria.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {criteria.map((c, i) => (
                      <li key={c.id ?? i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-ink-muted">{c.description}</span>
                        <span
                          className={
                            c.status === "PASSED"
                              ? "text-emerald-700"
                              : c.status === "FAILED"
                                ? "text-red-600"
                                : "text-ink-faint"
                          }
                        >
                          {criteriaStatusMeta[c.status].label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {v.notes && <p className="mt-1 text-xs text-ink-muted">{v.notes}</p>}
                {v.issuesFound && (
                  <p className="mt-1 text-xs text-red-600">Problemas: {v.issuesFound}</p>
                )}
                {structured ? (
                  <details className="mt-1.5 text-xs" data-validation-snapshot>
                    <summary className="cursor-pointer font-medium text-brand">
                      {v.overallResult === "APPROVED" ? "O que foi aprovado" : "O que foi avaliado"} nesta tentativa
                    </summary>
                    <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-0.5 font-medium text-ink-faint">Requisitos em vigor ({requirements.length})</p>
                        <ul className="space-y-0.5">
                          {requirements.map((r) => (
                            <li key={r.id} className="text-ink-muted">
                              {r.description} <span className="text-ink-faint">· {requirementStatusMeta[r.status]?.label ?? r.status}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-0.5 font-medium text-ink-faint">Tasks naquele momento ({tasks.length})</p>
                        <ul className="space-y-0.5">
                          {tasks.map((t) => (
                            <li key={t.id} className="text-ink-muted">
                              {t.title}{" "}
                              <span className="text-ink-faint">
                                · {taskStatusMeta[t.status]?.label ?? t.status}
                                {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </details>
                ) : (
                  <p className="mt-1.5 text-xs text-ink-faint">
                    Registrada antes da V0.3 — sem snapshot de requisitos e tasks.
                  </p>
                )}
                <p className="mt-1.5 text-xs text-ink-faint">
                  →{" "}
                  {v.overallResult === "APPROVED"
                    ? "Feature avançou para Done"
                    : v.overallResult === "REJECTED"
                      ? "Feature retornou para Development"
                      : "Aguardando resultado"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
