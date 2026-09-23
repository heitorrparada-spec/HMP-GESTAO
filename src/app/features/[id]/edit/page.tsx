import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { updateFeature } from "../../actions";

export default async function EditFeaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [feature, people] = await Promise.all([
    prisma.feature.findUnique({ where: { id }, include: { product: true } }),
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!feature) notFound();

  const action = updateFeature.bind(null, feature.id);

  return (
    <div className="max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Products", href: "/products" },
          { label: feature.product.name, href: `/products/${feature.product.id}` },
          { label: feature.title, href: `/features/${feature.id}` },
          { label: "Editar" },
        ]}
      />
      <h1 className="mb-6 text-xl font-semibold text-ink">Editar Feature</h1>

      <Card>
        <ActionForm action={action} className="space-y-4">
          <Field label="Título" required>
            <input
              name="title"
              required
              defaultValue={feature.title}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Contexto">
            <textarea
              name="context"
              rows={2}
              defaultValue={feature.context ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Problema">
            <textarea
              name="problem"
              rows={2}
              defaultValue={feature.problem ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Necessidade do usuário">
            <textarea
              name="userNeed"
              rows={2}
              defaultValue={feature.userNeed ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Objetivo">
            <textarea
              name="objective"
              rows={2}
              defaultValue={feature.objective ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Fluxo funcional">
            <textarea
              name="functionalFlow"
              rows={2}
              defaultValue={feature.functionalFlow ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Notas de arquitetura">
            <textarea
              name="architectureNotes"
              rows={2}
              defaultValue={feature.architectureNotes ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Prioridade">
            <select
              name="priority"
              defaultValue={feature.priority ?? ""}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">Não definida</option>
              <option value="P0">P0 · Urgente</option>
              <option value="P1">P1 · Alta</option>
              <option value="P2">P2 · Média</option>
              <option value="P3">P3 · Baixa</option>
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Responsável (Product)">
              <select
                name="ownerId"
                defaultValue={feature.ownerId ?? ""}
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
            <Field label="Arquiteto">
              <select
                name="architectId"
                defaultValue={feature.architectId ?? ""}
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
            <Field label="Tech Lead">
              <select
                name="techLeadId"
                defaultValue={feature.techLeadId ?? ""}
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
          </div>

          <div className="pt-2">
            <SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton>
          </div>
        </ActionForm>
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
