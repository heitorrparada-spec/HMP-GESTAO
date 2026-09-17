import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/Card";
import { PersonChip } from "@/components/ui/PersonChip";
import { RoleBadge } from "@/components/ui/StatusBadges";

export default async function SettingsPage() {
  const [company, people] = await Promise.all([
    prisma.company.findFirst({ include: { products: true } }),
    prisma.person.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="HMP OS" title="Settings" description="Configurações do workspace." />

      <SectionCard title="Empresa" className="mb-6">
        <p className="text-sm text-ink">{company?.name ?? "—"}</p>
        <p className="mt-1 text-xs text-ink-faint">
          {company?.products.length ?? 0} produto{(company?.products.length ?? 0) !== 1 ? "s" : ""}
        </p>
      </SectionCard>

      <SectionCard title="Time">
        <ul className="divide-y divide-border">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <PersonChip name={p.name} />
              <RoleBadge role={p.role} />
            </li>
          ))}
        </ul>
      </SectionCard>

      <p className="mt-6 text-xs text-ink-faint">
        Permissões granulares, integrações e automações ficam fora deste protótipo — ver
        conceptual-architecture-v0.1.md, seção 18 (Roadmap futuro).
      </p>
    </div>
  );
}
