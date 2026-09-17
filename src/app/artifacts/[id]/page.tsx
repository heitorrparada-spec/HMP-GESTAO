import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { SectionCard, Card } from "@/components/ui/Card";
import { ArtifactTypeBadge } from "@/components/ui/StatusBadges";
import { EntityLink } from "@/components/ui/EntityLink";
import { Icon } from "@/components/ui/Icon";
import { formatDate } from "@/lib/format";

export default async function ArtifactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const artifact = await prisma.artifact.findUnique({
    where: { id },
    include: {
      feature: { include: { product: true } },
      meeting: true,
      decision: true,
      author: true,
    },
  });

  if (!artifact) notFound();

  return (
    <div className="max-w-2xl">
      <Breadcrumb items={[{ label: "Artifacts", href: "/artifacts" }, { label: artifact.title }]} />

      <div className="mb-6 flex items-center gap-2.5">
        <h1 className="text-xl font-semibold text-ink">{artifact.title}</h1>
        <ArtifactTypeBadge type={artifact.type} />
      </div>

      <SectionCard title="Detalhes" className="mb-4">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Descrição</dt>
            <dd className="mt-1 text-ink">
              {artifact.description || <span className="text-ink-faint">Sem descrição.</span>}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs text-ink-faint">Versão</dt>
            <dd className="text-ink">{artifact.version ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs text-ink-faint">Autor</dt>
            <dd className="text-ink">{artifact.author?.name ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs text-ink-faint">Criado em</dt>
            <dd className="text-ink">{formatDate(artifact.createdAt)}</dd>
          </div>
          {artifact.url && (
            <div className="flex items-center justify-between">
              <dt className="text-xs text-ink-faint">Link</dt>
              <dd>
                <a
                  href={artifact.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  <Icon name="link" className="h-3.5 w-3.5" />
                  Abrir referência
                </a>
              </dd>
            </div>
          )}
        </dl>
      </SectionCard>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink">Contexto</h3>
        <div className="space-y-2 text-sm">
          {artifact.feature && (
            <EntityLink type="feature" href={`/features/${artifact.feature.id}`}>
              {artifact.feature.product.name} — {artifact.feature.title}
            </EntityLink>
          )}
          {artifact.meeting && (
            <EntityLink type="meeting" href={`/meetings/${artifact.meeting.id}`}>
              {artifact.meeting.title}
            </EntityLink>
          )}
          {artifact.decision && (
            <EntityLink type="decision" href={`/decisions/${artifact.decision.id}`}>
              {artifact.decision.title}
            </EntityLink>
          )}
          {!artifact.feature && !artifact.meeting && !artifact.decision && (
            <p className="text-ink-faint">Nenhum vínculo registrado.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
