import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ArtifactTypeBadge } from "@/components/ui/StatusBadges";

export default async function ArtifactsPage() {
  const artifacts = await prisma.artifact.findMany({
    include: { feature: { include: { product: true } }, author: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Artifacts"
        description="Documentos, diagramas e referências — sempre com contexto, nunca isolados."
      />

      {artifacts.length === 0 ? (
        <EmptyState icon="artifact" title="Nenhum artefato registrado ainda" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {artifacts.map((a) => (
            <Link key={a.id} href={`/artifacts/${a.id}`}>
              <Card className="h-full transition-colors hover:border-brand/40 hover:bg-brand-soft/20">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-ink">{a.title}</p>
                  <ArtifactTypeBadge type={a.type} />
                </div>
                {a.description && <p className="mt-1.5 text-xs text-ink-muted">{a.description}</p>}
                <p className="mt-3 text-xs text-ink-faint">
                  {a.feature ? `${a.feature.product.name} — ${a.feature.title}` : "Sem Feature vinculada"}
                  {a.author && ` · ${a.author.name}`}
                  {a.version && ` · ${a.version}`}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
