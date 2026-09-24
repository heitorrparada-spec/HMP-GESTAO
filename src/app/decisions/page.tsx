import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EntityLink } from "@/components/ui/EntityLink";
import { formatDate } from "@/lib/format";

export default async function DecisionsPage() {
  const decisions = await prisma.decision.findMany({
    include: { author: true, feature: true, product: true, meeting: true },
    orderBy: { decidedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Decisions"
        description="Toda decisão relevante é registrada e vinculada ao que ela afeta."
        actions={
          <Link
            href="/decisions/new"
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
          >
            + Registrar decisão
          </Link>
        }
      />

      {decisions.length === 0 ? (
        <EmptyState icon="decision" title="Nenhuma decisão registrada ainda" />
      ) : (
        <div className="space-y-2">
          {decisions.map((d) => (
            <Card key={d.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <EntityLink type="decision" href={`/decisions/${d.id}`}>
                    {d.title}
                  </EntityLink>
                  {d.status !== "ACTIVE" && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                      {d.status === "SUPERSEDED" ? "Substituída" : "Revogada"}
                    </span>
                  )}
                  <p className="mt-1 text-xs text-ink-faint">
                    {d.author?.name ?? "—"} · {formatDate(d.decidedAt)}
                    {d.meeting && (
                      <>
                        {" · via "}
                        <Link href={`/meetings/${d.meeting.id}`} className="hover:underline">
                          {d.meeting.title}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                {d.feature && (
                  <EntityLink type="feature" href={`/features/${d.feature.id}`} muted>
                    {d.feature.title}
                  </EntityLink>
                )}
                {d.product && !d.feature && (
                  <EntityLink type="product" href={`/products/${d.product.id}`} muted>
                    {d.product.name}
                  </EntityLink>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
