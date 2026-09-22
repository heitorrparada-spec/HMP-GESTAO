import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb, EmptyState } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusTracker } from "@/components/ui/StatusTracker";
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
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import {
  criteriaStatusMeta,
  featureStatusMeta,
  featureStatusOrder,
  priorityMeta,
  requirementStatusMeta,
} from "@/lib/labels";
import {
  updateFeatureStatus,
  recordValidation,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  createAcceptanceCriteria,
  deleteAcceptanceCriteria,
} from "../actions";
import type {
  CriteriaStatus,
  FeatureStatus,
  Priority,
  RequirementStatus,
  ValidationResult,
} from "@/generated/prisma/client";

export default async function FeaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const feature = await prisma.feature.findUnique({
    where: { id },
    include: {
      product: true,
      release: true,
      owner: true,
      architect: true,
      techLead: true,
      requirements: { orderBy: { createdAt: "asc" } },
      artifacts: { include: { author: true }, orderBy: { createdAt: "asc" } },
      tasks: { include: { assignee: true }, orderBy: { createdAt: "asc" } },
      acceptanceCriteria: { orderBy: { createdAt: "asc" } },
      validationRecords: { include: { validatedBy: true }, orderBy: { attemptNumber: "desc" } },
      decisions: { include: { author: true, meeting: true }, orderBy: { decidedAt: "desc" } },
    },
  });

  if (!feature) notFound();

  const activity = await prisma.activityLog.findMany({
    where: { entityType: { in: ["feature", "task", "validation"] }, entityId: { in: [feature.id, ...feature.tasks.map((t) => t.id)] } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const references = feature.artifacts.filter((a) => a.type === "RESEARCH" || a.type === "REFERENCE");
  const architectureArtifacts = feature.artifacts.filter((a) =>
    ["C4", "CLASS_DIAGRAM", "SEQUENCE_DIAGRAM"].includes(a.type),
  );
  const otherArtifacts = feature.artifacts.filter(
    (a) => !references.includes(a) && !architectureArtifacts.includes(a),
  );
  const tasksDone = feature.tasks.filter((t) => t.status === "DONE").length;

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
        <Link
          href={`/features/${feature.id}/edit`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50"
        >
          Editar
        </Link>
      </div>

      <StatusTracker
        current={feature.status}
        steps={featureStatusOrder.map((status) => ({
          value: status,
          label: featureStatusMeta[status].label,
          action: updateFeatureStatus.bind(null, feature.id, status),
          ...disabledReasonFor(feature.status, status),
        }))}
      />
      {feature.status !== "DONE" && <NextStepHint feature={feature} />}

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

          <RequirementsSection featureId={feature.id} requirements={feature.requirements} />

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
            title={`Tasks (${tasksDone}/${feature.tasks.length})`}
            action={
              <div className="flex items-center gap-3">
                <Link
                  href={`/tasks/new?featureId=${feature.id}`}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  + Nova
                </Link>
                <Link href="/tasks" className="text-xs font-medium text-brand hover:underline">
                  Ver todas
                </Link>
              </div>
            }
          >
            {feature.tasks.length === 0 ? (
              <EmptyState icon="task" title="Nenhuma task criada ainda" />
            ) : (
              <ul className="divide-y divide-border">
                {feature.tasks.map((t) => (
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

          <AcceptanceCriteriaSection
            featureId={feature.id}
            criteria={feature.acceptanceCriteria}
            locked={feature.status === "VALIDATION" || feature.status === "DONE"}
          />

          <ValidationSection feature={feature} />

          <SectionCard title="Histórico">
            <ActivityFeed items={activity} />
          </SectionCard>
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

function NextStepHint({
  feature,
}: {
  feature: {
    status: FeatureStatus;
    tasks: Array<{ status: string }>;
    acceptanceCriteria: Array<{ status: string }>;
  };
}) {
  const openTasks = feature.tasks.filter((t) => t.status !== "DONE").length;
  const blockedTasks = feature.tasks.filter((t) => t.status === "BLOCKED").length;
  const pendingCriteria = feature.acceptanceCriteria.filter((c) => c.status !== "PASSED").length;

  const pendencies: string[] = [];
  if (blockedTasks > 0) {
    pendencies.push(`${blockedTasks} task${blockedTasks !== 1 ? "s" : ""} bloqueada${blockedTasks !== 1 ? "s" : ""}`);
  }
  if (openTasks > 0) {
    pendencies.push(`${openTasks} task${openTasks !== 1 ? "s" : ""} aberta${openTasks !== 1 ? "s" : ""}`);
  }
  if (feature.acceptanceCriteria.length === 0) {
    pendencies.push("nenhum critério de aceite cadastrado");
  } else if (pendingCriteria > 0) {
    pendencies.push(`${pendingCriteria}/${feature.acceptanceCriteria.length} critérios de aceite ainda não passaram`);
  }
  const pendencyText = pendencies.length > 0 ? pendencies.join(" · ") : null;

  if (feature.status === "VALIDATION") {
    return (
      <p className="mt-2 text-xs font-medium text-rose-700">
        Aguardando validação — registre o resultado na seção Validation.
        {pendencyText && <span className="font-normal"> Pendências: {pendencyText}.</span>}
      </p>
    );
  }
  if (feature.status === "REVIEW") {
    return (
      <p className="mt-2 text-xs font-medium text-orange-700">
        Em revisão — próximo passo: Validation.
        {pendencyText && <span className="font-normal"> Pendências: {pendencyText}.</span>}
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-ink-faint">
      {pendencyText ? `Pendências para concluir: ${pendencyText}.` : "Sem pendências conhecidas para concluir."}
    </p>
  );
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

const requirementStatusOrder: RequirementStatus[] = ["PROPOSED", "APPROVED", "IMPLEMENTED", "TESTED"];
const priorityOrder: Priority[] = ["P0", "P1", "P2", "P3"];

function RequirementsSection({
  featureId,
  requirements,
}: {
  featureId: string;
  requirements: Array<{
    id: string;
    description: string;
    priority: Priority;
    status: RequirementStatus;
    source: string | null;
  }>;
}) {
  return (
    <SectionCard title={`Requisitos (${requirements.length})`}>
      {requirements.length === 0 ? (
        <EmptyState title="Nenhum requisito registrado ainda" />
      ) : (
        <div className="space-y-2">
          {requirements.map((r) => {
            const save = updateRequirement.bind(null, r.id, featureId);
            const remove = deleteRequirement.bind(null, r.id, featureId);
            return (
              <div key={r.id} className="rounded-md border border-border p-2.5">
                <form action={save} className="space-y-2">
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
                </form>
                <form action={remove} className="mt-1.5">
                  <ConfirmSubmitButton
                    confirmMessage={`Excluir o requisito "${r.description}"?`}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Excluir
                  </ConfirmSubmitButton>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <form action={createRequirement.bind(null, featureId)} className="mt-3 space-y-2 border-t border-border pt-3">
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
      </form>
    </SectionCard>
  );
}

function AcceptanceCriteriaSection({
  featureId,
  criteria,
  locked,
}: {
  featureId: string;
  criteria: Array<{ id: string; description: string; status: CriteriaStatus }>;
  locked: boolean;
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
            <li key={c.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-2.5">
              <span className="text-sm text-ink">{c.description}</span>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={c.status === "PASSED" ? "green" : c.status === "FAILED" ? "red" : "gray"}>
                  {c.status === "PASSED" ? "Passou" : c.status === "FAILED" ? "Falhou" : "Pendente"}
                </Badge>
                {!locked && (
                  <form action={deleteAcceptanceCriteria.bind(null, c.id, featureId)}>
                    <ConfirmSubmitButton
                      confirmMessage={`Excluir o critério "${c.description}"?`}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Excluir
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {locked ? (
        <p className="mt-3 border-t border-border pt-3 text-xs text-ink-faint">
          Critérios travados em Validation e depois de Done — são o contrato contra o qual a Feature é validada.
        </p>
      ) : (
        <form
          action={createAcceptanceCriteria.bind(null, featureId)}
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
        </form>
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
    notes: string | null;
    issuesFound: string | null;
    criteriaSnapshot: unknown;
    validatedAt: Date | null;
    validatedBy: { name: string } | null;
  }>;
};

type CriteriaSnapshot = Array<{ description: string; status: CriteriaStatus }>;

function readSnapshot(value: unknown): CriteriaSnapshot {
  return Array.isArray(value) ? (value as CriteriaSnapshot) : [];
}

function ValidationSection({ feature }: { feature: FeatureWithValidation }) {
  return (
    <SectionCard title="Validation">
      {feature.status === "VALIDATION" ? (
        <form action={recordValidation} className="space-y-4">
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
        </form>
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
          {feature.validationRecords.map((v) => (
            <div key={v.id} className="rounded-md border border-border p-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">Tentativa {v.attemptNumber}</span>
                <ValidationResultBadge result={v.overallResult} />
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                {v.validatedBy?.name ?? "—"} · {formatDateTime(v.validatedAt)}
              </p>
              {readSnapshot(v.criteriaSnapshot).length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {readSnapshot(v.criteriaSnapshot).map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-xs">
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
              <p className="mt-1.5 text-xs text-ink-faint">
                →{" "}
                {v.overallResult === "APPROVED"
                  ? "Feature avançou para Done"
                  : v.overallResult === "REJECTED"
                    ? "Feature retornou para Development"
                    : "Aguardando resultado"}
              </p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
