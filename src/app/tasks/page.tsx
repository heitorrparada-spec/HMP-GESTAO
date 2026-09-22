import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { PriorityBadge } from "@/components/ui/StatusBadges";
import { PersonChip, PersonPlaceholder } from "@/components/ui/PersonChip";
import { taskStatusMeta, taskStatusOrder } from "@/lib/labels";
import { formatDate, isOverdue } from "@/lib/format";
import type { TaskStatus } from "@/generated/prisma/client";

export default async function TasksPage() {
  const tasks = await prisma.task.findMany({
    include: { feature: true, assignee: true },
    orderBy: { createdAt: "asc" },
  });

  const columns = taskStatusOrder.map((status) => ({
    status,
    items: tasks.filter((t) => t.status === status),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Tasks"
        description="Unidade de execução técnica — vinculada a uma Feature ou avulsa."
        actions={
          <Link
            href="/tasks/new"
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90"
          >
            + Nova Task
          </Link>
        }
      />

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((col) => (
          <div key={col.status} className="w-72 shrink-0">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: statusDotColor(col.status) }}
              />
              <p className="text-sm font-semibold text-ink">{taskStatusMeta[col.status].label}</p>
              <span className="text-xs text-ink-faint">{col.items.length}</span>
            </div>
            <div className="space-y-2">
              {col.items.map((t) => (
                <Link
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  className="block rounded-lg border border-border bg-surface p-3 shadow-card transition-colors hover:border-brand/40"
                >
                  <p className="text-sm font-medium text-ink">{t.title}</p>
                  {t.feature && <p className="mt-1 truncate text-xs text-ink-faint">{t.feature.title}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {t.assignee ? (
                      <PersonChip name={t.assignee.name} role={t.assignee.role} />
                    ) : (
                      <PersonPlaceholder />
                    )}
                    <PriorityBadge priority={t.priority} />
                  </div>
                  {t.dueDate && (
                    <p className={`mt-1.5 text-xs ${isOverdue(t.dueDate) && t.status !== "DONE" ? "text-red-600" : "text-ink-faint"}`}>
                      Prazo: {formatDate(t.dueDate)}
                    </p>
                  )}
                </Link>
              ))}
              {col.items.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-ink-faint">
                  Vazio
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusDotColor(status: TaskStatus): string {
  switch (status) {
    case "TODO":
      return "#94a3b8";
    case "IN_PROGRESS":
      return "#3b82f6";
    case "BLOCKED":
      return "#ef4444";
    case "REVIEW":
      return "#f59e0b";
    case "DONE":
      return "#10b981";
  }
}
