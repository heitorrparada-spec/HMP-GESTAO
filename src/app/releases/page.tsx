import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EntityLink } from "@/components/ui/EntityLink";
import { FeatureStatusBadge, ReleaseStatusBadge } from "@/components/ui/StatusBadges";
import { formatDate } from "@/lib/format";

export default async function ReleasesPage() {
  const releases = await prisma.release.findMany({
    include: { product: true, features: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Releases"
        description={
          'Agrupamento leve e opcional de Features para planejamento — substitui "Project" na hierarquia (ver conceptual-architecture-v0.1.md).'
        }
      />

      {releases.length === 0 ? (
        <EmptyState icon="release" title="Nenhum Release criado ainda" />
      ) : (
        <div className="space-y-4">
          {releases.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {r.product.name} — {r.name}
                  </p>
                  {r.targetDate && (
                    <p className="mt-0.5 text-xs text-ink-faint">Meta: {formatDate(r.targetDate)}</p>
                  )}
                </div>
                <ReleaseStatusBadge status={r.status} />
              </div>
              {r.features.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {r.features.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2">
                      <EntityLink type="feature" href={`/features/${f.id}`} muted>
                        {f.title}
                      </EntityLink>
                      <FeatureStatusBadge status={f.status} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
