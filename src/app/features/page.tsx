import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { FeatureStatusBadge, PriorityBadge } from "@/components/ui/StatusBadges";
import { PersonChip, PersonPlaceholder } from "@/components/ui/PersonChip";

export default async function FeaturesPage() {
  const features = await prisma.feature.findMany({
    include: { product: true, owner: true, tasks: { select: { status: true } } },
    orderBy: [{ product: { name: "asc" } }, { createdAt: "asc" }],
  });

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Features"
        description="Unidade central de valor — do problema à produção."
      />

      {features.length === 0 ? (
        <EmptyState icon="feature" title="Nenhuma Feature cadastrada ainda" />
      ) : (
        <div className="space-y-2">
          {features.map((f) => {
            const done = f.tasks.filter((t) => t.status === "DONE").length;
            return (
              <Link key={f.id} href={`/features/${f.id}`}>
                <Card className="flex items-center justify-between gap-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/20">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-faint">{f.product.name}</p>
                    <p className="truncate text-sm font-medium text-ink">{f.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {f.tasks.length > 0 && (
                      <span className="text-xs text-ink-faint">
                        {done}/{f.tasks.length} tasks
                      </span>
                    )}
                    {f.owner ? (
                      <PersonChip name={f.owner.name} role={f.owner.role} />
                    ) : (
                      <PersonPlaceholder />
                    )}
                    <PriorityBadge priority={f.priority} />
                    <FeatureStatusBadge status={f.status} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
