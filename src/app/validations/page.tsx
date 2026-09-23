import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Card, SectionCard } from "@/components/ui/Card";
import { EntityLink } from "@/components/ui/EntityLink";
import { FeatureStatusBadge, ValidationResultBadge } from "@/components/ui/StatusBadges";
import { formatDateTime } from "@/lib/format";

export default async function ValidationsPage() {
  const [awaitingValidation, records] = await Promise.all([
    prisma.feature.findMany({
      where: { status: "VALIDATION" },
      include: { product: true, acceptanceCriteria: true },
    }),
    prisma.validationRecord.findMany({
      include: { feature: { include: { product: true } }, validatedBy: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Validations"
        description="Uma Feature não vai direto para Done — ela precisa ser validada, com histórico completo."
      />

      <SectionCard title={`Aguardando validação (${awaitingValidation.length})`} className="mb-6">
        {awaitingValidation.length === 0 ? (
          <EmptyState icon="validation" title="Nenhuma Feature aguardando validação agora" />
        ) : (
          <div className="space-y-2">
            {awaitingValidation.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <EntityLink type="feature" href={`/features/${f.id}`}>
                    {f.product.name} — {f.title}
                  </EntityLink>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {f.acceptanceCriteria.length} critério{f.acceptanceCriteria.length !== 1 ? "s" : ""} de aceite
                  </p>
                </div>
                <FeatureStatusBadge status={f.status} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Histórico de validações">
        {records.length === 0 ? (
          <EmptyState title="Nenhuma validação registrada ainda" />
        ) : (
          <div className="space-y-2">
            {records.map((v) => (
              <Card key={v.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <EntityLink type="feature" href={`/features/${v.feature.id}`}>
                      {v.feature.product.name} — {v.feature.title}
                    </EntityLink>
                    <p className="mt-1 text-xs text-ink-faint">
                      Tentativa {v.attemptNumber} · {v.validatedBy?.name ?? "—"} ·{" "}
                      {formatDateTime(v.validatedAt ?? v.createdAt)}
                      {criteriaSummary(v.criteriaSnapshot)}
                    </p>
                    {v.issuesFound && (
                      <p className="mt-1 text-xs text-red-600">Problemas: {v.issuesFound}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-faint">
                      →{" "}
                      {v.overallResult === "APPROVED"
                        ? "Feature avançou para Done"
                        : v.overallResult === "REJECTED"
                          ? "Feature retornou para Development"
                          : "Aguardando resultado"}
                    </p>
                  </div>
                  <ValidationResultBadge result={v.overallResult} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function criteriaSummary(snapshot: unknown): string {
  if (!Array.isArray(snapshot) || snapshot.length === 0) return "";
  const passed = snapshot.filter((c: { status?: string }) => c.status === "PASSED").length;
  return ` · ${passed}/${snapshot.length} critérios passaram`;
}
