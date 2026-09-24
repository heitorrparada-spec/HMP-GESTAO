import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { entityHref } from "@/lib/routes";
import { EmptyState } from "@/components/ui/PageHeader";
import { fieldLabel, sortChanges } from "@/lib/history/present";
import {
  criteriaStatusMeta,
  featureStatusMeta,
  priorityMeta,
  requirementStatusMeta,
  taskStatusMeta,
} from "@/lib/labels";
import type { ActivityChange, Prisma } from "@/generated/prisma/client";
import type { HistoryEvent } from "@/lib/history/types";

const LONG_TEXT_FIELDS = new Set([
  "description",
  "context",
  "problem",
  "userNeed",
  "objective",
  "functionalFlow",
  "architectureNotes",
  "decision",
  "reason",
  "alternatives",
  "agenda",
  "notes",
]);

const DECISION_STATUS: Record<string, string> = { ACTIVE: "Ativa", SUPERSEDED: "Substituída", REVOKED: "Revogada" };
const VALIDATION_RESULT: Record<string, string> = { APPROVED: "Aprovada", REJECTED: "Reprovada", PENDING: "Pendente" };

type Value = Prisma.JsonValue | null;

function statusLabel(entityType: string, value: string): string {
  if (entityType === "feature") return featureStatusMeta[value as keyof typeof featureStatusMeta]?.label ?? value;
  if (entityType === "task") return taskStatusMeta[value as keyof typeof taskStatusMeta]?.label ?? value;
  if (entityType === "requirement") return requirementStatusMeta[value as keyof typeof requirementStatusMeta]?.label ?? value;
  if (entityType === "decision") return DECISION_STATUS[value] ?? value;
  return value;
}

function formatValue(entityType: string, change: ActivityChange, side: "from" | "to"): string {
  const value: Value = side === "from" ? change.fromValue : change.toValue;
  const label = side === "from" ? change.fromLabel : change.toLabel;
  if (value === null || value === undefined || value === "") return "—";
  const field = change.field;
  if (field.startsWith("criteria:")) return criteriaStatusMeta[value as keyof typeof criteriaStatusMeta]?.label ?? String(value);
  if (field === "status") return statusLabel(entityType, String(value));
  if (field === "result") return VALIDATION_RESULT[String(value)] ?? String(value);
  if (field === "priority") return priorityMeta[value as keyof typeof priorityMeta]?.label ?? String(value);
  if (field === "dueDate" || field === "decidedAt") return formatDate(new Date(`${value}T12:00:00`));
  if (field === "date") return formatDateTime(String(value));
  if (field.endsWith("Id") || field === "affects") return label ?? "—";
  return String(value);
}

function peopleDiff(change: ActivityChange) {
  const list = (v: Value) => (Array.isArray(v) ? (v as Array<{ id: string; name: string }>) : []);
  const from = list(change.fromValue);
  const to = list(change.toValue);
  const added = to.filter((p) => !from.some((q) => q.id === p.id)).map((p) => p.name);
  const removed = from.filter((p) => !to.some((q) => q.id === p.id)).map((p) => p.name);
  return [added.length ? `entraram ${added.join(", ")}` : null, removed.length ? `saíram ${removed.join(", ")}` : null]
    .filter(Boolean)
    .join(" · ");
}

function ChangeLine({ entityType, change }: { entityType: string; change: ActivityChange }) {
  const label = fieldLabel(change.field, change.toLabel ?? change.fromLabel);
  if (change.field === "archivedAt") {
    return <li>{change.toValue ? "Arquivada" : "Restaurada"}</li>;
  }
  if (change.field === "participants") {
    return (
      <li>
        <span className="text-ink-faint">{label}:</span> {peopleDiff(change) || "alterados"}
      </li>
    );
  }
  if (LONG_TEXT_FIELDS.has(change.field)) {
    return (
      <li>
        <details>
          <summary className="cursor-pointer">
            <span className="text-ink-faint">{label}:</span> texto alterado <span className="text-brand">(ver antes e depois)</span>
          </summary>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
            <div className="rounded bg-red-50 p-2">
              <p className="mb-0.5 text-[11px] font-medium uppercase text-red-700">Antes</p>
              <p className="whitespace-pre-wrap text-ink">{formatValue(entityType, change, "from")}</p>
            </div>
            <div className="rounded bg-emerald-50 p-2">
              <p className="mb-0.5 text-[11px] font-medium uppercase text-emerald-700">Depois</p>
              <p className="whitespace-pre-wrap text-ink">{formatValue(entityType, change, "to")}</p>
            </div>
          </div>
        </details>
      </li>
    );
  }
  if (change.field === "result") {
    return (
      <li>
        <span className="text-ink-faint">{label}:</span> {formatValue(entityType, change, "to")}
      </li>
    );
  }
  return (
    <li>
      <span className="text-ink-faint">{label}:</span> {formatValue(entityType, change, "from")} →{" "}
      <span className="text-ink">{formatValue(entityType, change, "to")}</span>
    </li>
  );
}

// Eventos estruturados sabem a Feature dona (escopo); requisito, critério e validação abrem a Feature.
function eventHref(item: HistoryEvent): string | null {
  if (item.schemaVersion >= 2) {
    switch (item.entityType) {
      case "requirement":
      case "criteria":
        return item.featureId ? `/features/${item.featureId}` : null;
      case "validation":
        return item.featureId ? `/features/${item.featureId}#validation` : null;
      case "person":
        return null;
    }
  }
  return entityHref(item.entityType, item.entityId);
}

// Task apagada fisicamente antes da V0.3-A: o evento fica no histórico, sem link, marcado como "(excluída)".
function deletedTaskLabel(description: string): string {
  const match = /^(Task ".*")( (?:criada|mudou de|foi editada|foi bloqueada|concluída|excluída)[\s\S]*)$/.exec(description);
  if (!match) return `${description} (task excluída)`;
  const [, subject, rest] = match;
  return rest === " excluída" ? `${subject} (excluída)` : `${subject} (excluída)${rest}`;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "amber" | "slate" }) {
  return (
    <span
      className={
        tone === "amber"
          ? "ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700"
          : "ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint"
      }
    >
      {children}
    </span>
  );
}

export async function ActivityFeed({
  items,
  emptyLabel = "Nenhuma atividade registrada ainda.",
  moreHref,
}: {
  items: HistoryEvent[];
  emptyLabel?: string;
  /** Link para carregar eventos mais antigos (paginação por parâmetro da página). */
  moreHref?: string | null;
}) {
  if (items.length === 0) {
    return <EmptyState icon="activity" title={emptyLabel} />;
  }

  const taskIds = [...new Set(items.filter((i) => i.entityType === "task").map((i) => i.entityId))];
  const existingTaskIds = new Set(
    taskIds.length > 0
      ? (await prisma.task.findMany({ where: { id: { in: taskIds } }, select: { id: true } })).map((t) => t.id)
      : [],
  );

  return (
    <div data-activity-feed>
      <ol className="space-y-0">
        {items.map((item, idx) => {
          const deletedTask = item.entityType === "task" && !existingTaskIds.has(item.entityId);
          const href = deletedTask ? null : eventHref(item);
          const description = deletedTask ? deletedTaskLabel(item.description) : item.description;
          const changes = item.schemaVersion >= 2 ? sortChanges(item.changes) : [];
          return (
            <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                {idx < items.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-sm text-ink">
                  {href ? (
                    <Link href={href} className="font-medium hover:underline">
                      {description}
                    </Link>
                  ) : (
                    description
                  )}
                  {item.source === "seed" && <Badge tone="amber">demonstração</Badge>}
                  {item.schemaVersion < 2 && item.source !== "seed" && <Badge tone="slate">anterior à V0.3</Badge>}
                </p>
                {changes.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-ink-muted" data-history-changes>
                    {changes.map((change) => (
                      <ChangeLine key={change.id} entityType={item.entityType} change={change} />
                    ))}
                  </ul>
                )}
                {item.reason && (
                  <p className="mt-1 text-xs text-ink-muted" data-history-reason>
                    <span className="text-ink-faint">Motivo:</span> {item.reason}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-ink-faint" title={formatDateTime(item.createdAt)}>
                  {item.actorName ? `${item.actorName} · ` : ""}
                  {formatRelative(item.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {moreHref && (
        <Link href={moreHref} scroll={false} className="mt-3 inline-block text-xs font-medium text-brand hover:underline">
          Mostrar eventos mais antigos
        </Link>
      )}
    </div>
  );
}
