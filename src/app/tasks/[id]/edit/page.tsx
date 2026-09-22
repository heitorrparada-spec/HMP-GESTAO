import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { taskStatusOrder, taskStatusMeta } from "@/lib/labels";
import { toDateInputValue } from "@/lib/format";
import { updateTask, deleteTask } from "../../actions";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { feature: true, dependsOn: true },
  });
  if (!task) notFound();

  const [people, siblingTasks] = await Promise.all([
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    task.featureId
      ? prisma.task.findMany({
          where: { featureId: task.featureId, id: { not: task.id } },
          orderBy: { title: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const currentDependsOnId = task.dependsOn[0]?.dependsOnId ?? "";
  const action = updateTask.bind(null, task.id);
  const removeAction = deleteTask.bind(null, task.id, task.featureId);

  return (
    <div className="max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Tasks", href: "/tasks" },
          ...(task.feature ? [{ label: task.feature.title, href: `/features/${task.feature.id}` }] : []),
          { label: task.title, href: `/tasks/${task.id}` },
          { label: "Editar" },
        ]}
      />
      <h1 className="mb-6 text-xl font-semibold text-ink">Editar Task</h1>

      <Card>
        <form action={action} className="space-y-4">
          <Field label="Título" required>
            <input
              name="title"
              required
              defaultValue={task.title}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Descrição">
            <textarea
              name="description"
              rows={3}
              defaultValue={task.description ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsável">
              <select
                name="assigneeId"
                defaultValue={task.assigneeId ?? ""}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioridade">
              <select
                name="priority"
                defaultValue={task.priority}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              >
                <option value="P0">P0 · Urgente</option>
                <option value="P1">P1 · Alta</option>
                <option value="P2">P2 · Média</option>
                <option value="P3">P3 · Baixa</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select
                name="status"
                defaultValue={task.status}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              >
                {taskStatusOrder.map((s) => (
                  <option key={s} value={s}>
                    {taskStatusMeta[s].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prazo">
              <input
                type="date"
                name="dueDate"
                defaultValue={toDateInputValue(task.dueDate)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Motivo do bloqueio (se o status for Blocked)">
            <input
              name="blockedReason"
              defaultValue={task.blockedReason ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="Ex.: aguardando endpoints do backend"
            />
          </Field>

          {siblingTasks.length > 0 && (
            <Field label="Depende de (opcional)">
              <select
                name="dependsOnId"
                defaultValue={currentDependsOnId}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              >
                <option value="">Nenhuma</option>
                {siblingTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="flex items-center justify-between pt-2">
            <SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton>
          </div>
        </form>

        <form action={removeAction} className="mt-6 border-t border-border pt-4">
          <ConfirmSubmitButton
            confirmMessage={`Excluir a task "${task.title}"? Essa ação não pode ser desfeita.`}
            className="text-sm font-medium text-red-600 hover:underline"
          >
            Excluir esta task
          </ConfirmSubmitButton>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-faint">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
