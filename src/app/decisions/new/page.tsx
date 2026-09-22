import { prisma } from "@/lib/prisma";
import { getCurrentActorId } from "@/lib/actor";
import { formatDate } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { DecisionForm } from "../DecisionForm";
import { createDecision } from "../actions";

export default async function NewDecisionPage({
  searchParams,
}: {
  searchParams: Promise<{ featureId?: string; productId?: string; meetingId?: string }>;
}) {
  const { featureId, productId, meetingId } = await searchParams;

  const [people, features, products, meetings, meeting, actorId] = await Promise.all([
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.feature.findMany({ include: { product: true }, orderBy: { title: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.meeting.findMany({ orderBy: { date: "desc" } }),
    meetingId ? prisma.meeting.findUnique({ where: { id: meetingId }, include: { participants: true } }) : null,
    getCurrentActorId(),
  ]);

  return (
    <div className="max-w-2xl">
      <Breadcrumb
        items={
          meeting
            ? [
                { label: "Meetings", href: "/meetings" },
                { label: meeting.title, href: `/meetings/${meeting.id}` },
                { label: "Registrar decisão" },
              ]
            : [{ label: "Decisions", href: "/decisions" }, { label: "Registrar decisão" }]
        }
      />
      <h1 className="mb-6 text-xl font-semibold text-ink">Registrar decisão</h1>

      <DecisionForm
        action={createDecision}
        people={people}
        meetings={meetings.map((m) => ({ id: m.id, title: `${m.title} · ${formatDate(m.date)}` }))}
        features={features}
        products={products}
        defaults={{
          title: "",
          context: null,
          decision: "",
          reason: null,
          alternatives: null,
          authorId: people.some((p) => p.id === actorId) ? (actorId ?? "") : "",
          decidedAt: meeting?.date ?? new Date(),
          meetingId: meeting?.id ?? "",
          affects: featureId ? `feature:${featureId}` : productId ? `product:${productId}` : "",
          participantIds: meeting?.participants.map((p) => p.personId) ?? [],
        }}
        submitLabel="Registrar decisão"
      />
    </div>
  );
}
