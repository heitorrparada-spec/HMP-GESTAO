import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createTask } from "../actions";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ featureId?: string }>;
}) {
  const { featureId: defaultFeatureId } = await searchParams;

  const [features, people, existingTasks] = await Promise.all([
    prisma.feature.findMany({ include: { product: true }, orderBy: { title: "asc" } }),
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    defaultFeatureId
      ? prisma.task.findMany({
          where: { featureId: defaultFeatureId },
          include: { feature: true },
          orderBy: { title: "asc" },
        })
      : prisma.task.findMany({ include: { feature: true }, orderBy: { title: "asc" } }),
  ]);

  const feature = defaultFeatureId
    ? features.find((f) => f.id === defaultFeatureId)
    : undefined;

  return (
    <div className="max-w-2xl">
      <Breadcrumb
        items={
          feature
            ? [
                { label: "Products", href: "/products" },
                { label: feature.product.name, href: `/products/${feature.product.id}` },
                { label: feature.title, href: `/features/${feature.id}` },
                { label: "Nova Task" },
              ]
            : [{ label: "Tasks", href: "/tasks" }, { label: "Nova Task" }]
        }
      />
      <h1 className="mb-6 text-xl font-semibold text-ink">Criar Task</h1>

      <Card>
        <form action={createTask} className="space-y-4">
          <Field label="Feature" required>
            <select
              name="featureId"
              required
              defaultValue={defaultFeatureId ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecionar…
              </option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.product.name} — {f.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Título" required>
            <input
              name="title"
              required
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder='Ex.: "Implementar endpoint de cálculo"'
            />
          </Field>

          <Field label="Descrição">
            <textarea
              name="description"
              rows={3}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsável">
              <select name="assigneeId" defaultValue="" className="w-full rounded-md border border-border px-3 py-2 text-sm">
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioridade">
              <select name="priority" defaultValue="P2" className="w-full rounded-md border border-border px-3 py-2 text-sm">
                <option value="P0">P0 · Urgente</option>
                <option value="P1">P1 · Alta</option>
                <option value="P2">P2 · Média</option>
                <option value="P3">P3 · Baixa</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Prazo">
              <input
                type="date"
                name="dueDate"
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Depende de (opcional)">
              <select name="dependsOnId" defaultValue="" className="w-full rounded-md border border-border px-3 py-2 text-sm">
                <option value="">Nenhuma</option>
                {existingTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.feature ? `${t.feature.title} — ${t.title}` : t.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <p className="text-xs text-ink-faint">A Task é criada em estado To do.</p>

          <div className="pt-2">
            <SubmitButton pendingLabel="Criando…">Criar Task</SubmitButton>
          </div>
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
