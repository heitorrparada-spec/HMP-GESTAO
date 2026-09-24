import { prisma } from "@/lib/prisma";
import { getCurrentActorId } from "@/lib/actor";
import { formatDate } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DecisionForm } from "../DecisionForm";
import { createDecision } from "../actions";

export default async function NewDecisionPage({
  searchParams,
}: {
  searchParams: Promise<{ featureId?: string; productId?: string; meetingId?: string; supersedes?: string }>;
}) {
  const { featureId, productId, meetingId, supersedes } = await searchParams;

  const [people, features, products, meetings, meeting, actorId, previous] = await Promise.all([
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.feature.findMany({ include: { product: true }, orderBy: { title: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.meeting.findMany({ orderBy: { date: "desc" } }),
    meetingId ? prisma.meeting.findUnique({ where: { id: meetingId }, include: { participants: true } }) : null,
    getCurrentActorId(),
    // Substituir: a nova decisão parte do conteúdo da anterior, que continua visível como "Substituída".
    supersedes ? prisma.decision.findUnique({ where: { id: supersedes } }) : null,
  ]);
  const authorId = people.some((p) => p.id === actorId) ? (actorId ?? "") : "";

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
      <h1 className="mb-6 text-xl font-semibold text-ink">{previous ? "Substituir decisão" : "Registrar decisão"}</h1>

      {previous && previous.status !== "ACTIVE" ? (
        <Card>
          <p className="text-sm text-ink-muted" data-lock-message>
            Esta decisão já foi {previous.status === "SUPERSEDED" ? "substituída" : "revogada"} — ela não pode ser substituída de novo.
          </p>
        </Card>
      ) : previous ? (
        <DecisionForm
          action={createDecision}
          people={people}
          meetings={meetings.map((m) => ({ id: m.id, title: `${m.title} · ${formatDate(m.date)}` }))}
          features={features}
          products={products}
          supersede={{ id: previous.id, title: previous.title }}
          defaults={{
            title: previous.title,
            context: previous.context,
            decision: previous.decision,
            reason: previous.reason,
            alternatives: previous.alternatives,
            authorId,
            decidedAt: new Date(),
            meetingId: "",
            affects: previous.featureId ? `feature:${previous.featureId}` : previous.productId ? `product:${previous.productId}` : "",
            participantIds: [],
          }}
          submitLabel="Registrar e substituir"
        />
      ) : (
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
          authorId,
          // Decisão não tem data futura (DV-11): reunião que ainda não aconteceu sugere hoje.
          decidedAt: meeting && meeting.date <= new Date() ? meeting.date : new Date(),
          meetingId: meeting?.id ?? "",
          affects: featureId ? `feature:${featureId}` : productId ? `product:${productId}` : "",
          participantIds: meeting?.participants.map((p) => p.personId) ?? [],
        }}
        submitLabel="Registrar decisão"
      />
      )}
    </div>
  );
}
