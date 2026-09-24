import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createTask } from "../actions";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ featureId?: string; decisionId?: string }>;
}) {
  const params = await searchParams;

  const [features, people, decision] = await Promise.all([
    prisma.feature.findMany({ where: { status: { not: "DONE" } }, include: { product: true }, orderBy: { title: "asc" } }),
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    params.decisionId
      ? prisma.decision.findUnique({
          where: { id: params.decisionId },
          include: { meeting: true, feature: { include: { product: true } }, product: true },
        })
      : null,
  ]);

  // Com decisão de origem: a Feature é a da decisão; se ela só afeta um Product, escolhe-se entre as Features dele.
  const fixedFeature = decision?.feature ?? null;
  const featureOptions =
    decision?.productId && !fixedFeature ? features.filter((f) => f.productId === decision.productId) : features;
  const featureRequired = !decision;
  const defaultFeatureId = fixedFeature?.id ?? params.featureId ?? "";
  const feature = features.find((f) => f.id === defaultFeatureId);

  const existingTasks = await prisma.task.findMany({
    where: { archivedAt: null, ...(defaultFeatureId ? { featureId: defaultFeatureId } : {}) },
    include: { feature: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <Breadcrumb
        items={
          decision
            ? [
                { label: "Decisions", href: "/decisions" },
                { label: decision.title, href: `/decisions/${decision.id}` },
                { label: "Nova Task" },
              ]
            : feature
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

      {decision && (
        <div className="mb-4 rounded-lg border border-brand/30 bg-brand-soft/30 p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Origem desta task</p>
          <p className="mt-1.5 text-ink">
            Decisão:{" "}
            <Link href={`/decisions/${decision.id}`} className="font-medium hover:underline">
              {decision.title}
            </Link>
          </p>
          {decision.meeting && (
            <p className="mt-0.5 text-ink">
              Reunião:{" "}
              <Link href={`/meetings/${decision.meeting.id}`} className="font-medium hover:underline">
                {decision.meeting.title}
              </Link>{" "}
              <span className="text-ink-faint">· {formatDate(decision.meeting.date)}</span>
            </p>
          )}
          <p className="mt-2 text-ink-muted">&ldquo;{decision.decision}&rdquo;</p>
        </div>
      )}

      {decision && decision.status !== "ACTIVE" ? (
        <Card>
          <p className="text-sm text-ink-muted" data-lock-message>
            Esta decisão foi {decision.status === "SUPERSEDED" ? "substituída" : "revogada"} — ela não gera mais tasks.
            Crie a task a partir da decisão vigente.
          </p>
        </Card>
      ) : (
      <Card>
        <ActionForm action={createTask} className="space-y-4">
          {decision && <input type="hidden" name="decisionId" value={decision.id} />}

          <Field label="Feature" required={featureRequired}>
            {fixedFeature ? (
              <>
                <input type="hidden" name="featureId" value={fixedFeature.id} />
                <p className="rounded-md border border-border bg-slate-50 px-3 py-2 text-sm text-ink">
                  {fixedFeature.product.name} — {fixedFeature.title}
                </p>
                <p className="mt-1 text-xs text-ink-faint">Herdada da decisão de origem.</p>
              </>
            ) : (
              <select
                name="featureId"
                required={featureRequired}
                defaultValue={defaultFeatureId}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              >
                {featureRequired ? (
                  <option value="" disabled>
                    Selecionar…
                  </option>
                ) : (
                  <option value="">Nenhuma (task avulsa ligada à decisão)</option>
                )}
                {featureOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.product.name} — {f.title}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Título" required>
            <input
              name="title"
              required
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder='Ex.: "Implementar estrutura inicial por refeições"'
            />
          </Field>

          <Field label="Descrição">
            <textarea
              name="description"
              rows={3}
              defaultValue={decision?.decision ?? ""}
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
              <input type="date" name="dueDate" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
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
        </ActionForm>
      </Card>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-faint">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
