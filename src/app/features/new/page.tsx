import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createFeature } from "../actions";

export default async function NewFeaturePage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const { productId: defaultProductId } = await searchParams;

  const [products, people] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <Breadcrumb items={[{ label: "Features", href: "/features" }, { label: "Nova Feature" }]} />
      <h1 className="mb-6 text-xl font-semibold text-ink">Criar Feature</h1>

      <Card>
        <form action={createFeature} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Título" required>
              <input
                name="title"
                required
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                placeholder='Ex.: "Exportar plano em PDF"'
              />
            </Field>
            <Field label="Product" required>
              <select
                name="productId"
                required
                defaultValue={defaultProductId ?? ""}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Selecionar…
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Contexto">
            <textarea
              name="context"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="Situação atual que motiva esta Feature"
            />
          </Field>

          <Field label="Problema">
            <textarea
              name="problem"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Necessidade do usuário">
            <textarea
              name="userNeed"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder='"Como [papel], preciso [ação] para [benefício]."'
            />
          </Field>

          <Field label="Objetivo">
            <textarea
              name="objective"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Fluxo funcional">
            <textarea
              name="functionalFlow"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Notas de arquitetura">
            <textarea
              name="architectureNotes"
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Prioridade">
            <select name="priority" defaultValue="" className="w-full rounded-md border border-border px-3 py-2 text-sm">
              <option value="">Não definida</option>
              <option value="P0">P0 · Urgente</option>
              <option value="P1">P1 · Alta</option>
              <option value="P2">P2 · Média</option>
              <option value="P3">P3 · Baixa</option>
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Responsável (Product)">
              <select name="ownerId" defaultValue="" className="w-full rounded-md border border-border px-3 py-2 text-sm">
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Arquiteto">
              <select name="architectId" defaultValue="" className="w-full rounded-md border border-border px-3 py-2 text-sm">
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tech Lead">
              <select name="techLeadId" defaultValue="" className="w-full rounded-md border border-border px-3 py-2 text-sm">
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <p className="text-xs text-ink-faint">A Feature é criada em estado Backlog.</p>

          <div className="pt-2">
            <SubmitButton pendingLabel="Criando…">Criar Feature</SubmitButton>
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
