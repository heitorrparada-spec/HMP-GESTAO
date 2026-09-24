import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { decisionLock } from "@/lib/history/policy";
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

  const lock = decisionLock({
    status: decision.status,
    createdAt: decision.createdAt,
    generatedTaskCount: decision._count.generatedTasks,
  });

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
      <h1 className="mb-6 text-xl font-semibold text-ink">{lock.locked ? "Corrigir título da decisão" : "Editar decisão"}</h1>

      {decision.status !== "ACTIVE" ? (
        <Card>
          <p className="text-sm text-ink-muted" data-lock-message>{lock.message}</p>
        </Card>
      ) : lock.locked ? (
        <Card>
          <p className="mb-4 text-sm text-ink-muted" data-lock-message>
            {lock.message} Só o título admite correção de erro material, com motivo.{" "}
            <Link href={`/decisions/new?supersedes=${decision.id}`} className="font-medium text-brand hover:underline">
              Substituir por nova decisão
            </Link>
          </p>
          <ActionForm action={updateDecision.bind(null, decision.id)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-faint">Título *</label>
              <input
                name="title"
                required
                defaultValue={decision.title}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-faint">Motivo da correção *</label>
              <textarea
                name="changeReason"
                required
                rows={2}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                placeholder="O título anterior fica no histórico junto com este motivo"
              />
            </div>
            <SubmitButton>Corrigir título</SubmitButton>
          </ActionForm>
        </Card>
      ) : (
      <>
      <p className="mb-4 rounded-md bg-slate-50 p-2.5 text-xs text-ink-muted">
        Janela de correção até {formatDateTime(lock.windowEndsAt)} (ou até a decisão gerar a primeira task). Cada
        alteração fica no histórico com a versão anterior.
      </p>
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
        changeReason
      />
      </>
      )}
    </div>
  );
}
