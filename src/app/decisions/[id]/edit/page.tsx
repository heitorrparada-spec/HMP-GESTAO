import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { DecisionForm } from "../../DecisionForm";
import { updateDecision } from "../../actions";

export default async function EditDecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [decision, people, features, products, meetings] = await Promise.all([
    prisma.decision.findUnique({
      where: { id },
      include: {
        participants: true,
        feature: { include: { product: true } },
        product: true,
        _count: { select: { generatedTasks: true } },
      },
    }),
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.feature.findMany({ include: { product: true }, orderBy: { title: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.meeting.findMany({ orderBy: { date: "desc" } }),
  ]);
  if (!decision) notFound();

  const affects = decision.featureId
    ? `feature:${decision.featureId}`
    : decision.productId
      ? `product:${decision.productId}`
      : "";
  const affectsLabel = decision.feature
    ? `${decision.feature.product.name} — ${decision.feature.title}`
    : (decision.product?.name ?? "Nenhum");

  return (
    <div className="max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Decisions", href: "/decisions" },
          { label: decision.title, href: `/decisions/${decision.id}` },
          { label: "Editar" },
        ]}
      />
      <h1 className="mb-6 text-xl font-semibold text-ink">Editar decisão</h1>

      <DecisionForm
        action={updateDecision.bind(null, decision.id)}
        people={people}
        meetings={meetings.map((m) => ({ id: m.id, title: `${m.title} · ${formatDate(m.date)}` }))}
        features={features}
        products={products}
        defaults={{
          title: decision.title,
          context: decision.context,
          decision: decision.decision,
          reason: decision.reason,
          alternatives: decision.alternatives,
          authorId: decision.authorId ?? "",
          decidedAt: decision.decidedAt,
          meetingId: decision.meetingId ?? "",
          affects,
          participantIds: decision.participants.map((p) => p.personId),
        }}
        lockedAffectsLabel={decision._count.generatedTasks > 0 ? affectsLabel : undefined}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
