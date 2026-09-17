import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { createDecision } from "../actions";

export default async function NewDecisionPage({
  searchParams,
}: {
  searchParams: Promise<{ featureId?: string; productId?: string }>;
}) {
  const { featureId: defaultFeatureId, productId: defaultProductId } = await searchParams;

  const [people, features, products, meetings] = await Promise.all([
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.feature.findMany({ include: { product: true }, orderBy: { title: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.meeting.findMany({ orderBy: { date: "desc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <Breadcrumb items={[{ label: "Decisions", href: "/decisions" }, { label: "Registrar decisão" }]} />
      <h1 className="mb-6 text-xl font-semibold text-ink">Registrar decisão</h1>

      <Card>
        <form action={createDecision} className="space-y-4">
          <Field label="Título" required>
            <input
              name="title"
              required
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder='Ex.: "Plano Alimentar terá cálculo automático de macros"'
            />
          </Field>

          <Field label="Contexto">
            <textarea
              name="context"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="Situação que motivou a decisão"
            />
          </Field>

          <Field label="Decisão" required>
            <textarea
              name="decision"
              required
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="A escolha feita, em uma frase clara"
            />
          </Field>

          <Field label="Motivo">
            <textarea
              name="reason"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="Por que essa escolha"
            />
          </Field>

          <Field label="Alternativas consideradas">
            <textarea
              name="alternatives"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Autor">
              <select name="authorId" className="w-full rounded-md border border-border px-3 py-2 text-sm">
                <option value="">Selecionar…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data">
              <input
                type="date"
                name="decidedAt"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Participantes">
            <div className="flex flex-wrap gap-3">
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="participantIds" value={p.id} />
                  {p.name}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Reunião de origem (opcional)">
            <select name="meetingId" className="w-full rounded-md border border-border px-3 py-2 text-sm">
              <option value="">Nenhuma</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Feature afetada">
              <select
                name="featureId"
                defaultValue={defaultFeatureId ?? ""}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              >
                <option value="">Nenhuma</option>
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.product.name} — {f.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Produto afetado">
              <select
                name="productId"
                defaultValue={defaultProductId ?? ""}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              >
                <option value="">Nenhum</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              Registrar decisão
            </button>
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
