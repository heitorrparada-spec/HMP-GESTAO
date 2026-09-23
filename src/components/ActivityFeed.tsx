import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatRelative } from "@/lib/format";
import { entityHref } from "@/lib/routes";
import { EmptyState } from "@/components/ui/PageHeader";
import type { ActivityLog } from "@/generated/prisma/client";

// Task excluída não tem mais página: o evento fica no histórico, sem link, marcado como "(excluída)".
function deletedTaskLabel(description: string): string {
  const match = /^(Task ".*")( (?:criada|mudou de|foi editada|foi bloqueada|concluída|excluída)[\s\S]*)$/.exec(description);
  if (!match) return `${description} (task excluída)`;
  const [, subject, rest] = match;
  return rest === " excluída" ? `${subject} (excluída)` : `${subject} (excluída)${rest}`;
}

export async function ActivityFeed({
  items,
  emptyLabel = "Nenhuma atividade registrada ainda.",
}: {
  items: ActivityLog[];
  emptyLabel?: string;
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
    <ol className="space-y-0">
      {items.map((item, idx) => {
        const deletedTask = item.entityType === "task" && !existingTaskIds.has(item.entityId);
        const href = deletedTask ? null : entityHref(item.entityType, item.entityId);
        const description = deletedTask ? deletedTaskLabel(item.description) : item.description;
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
              </p>
              <p className="mt-0.5 text-xs text-ink-faint" title={formatDateTime(item.createdAt)}>
                {item.actorName ? `${item.actorName} · ` : ""}
                {formatRelative(item.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
