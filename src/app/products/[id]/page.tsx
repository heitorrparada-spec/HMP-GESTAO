import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb, EmptyState } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { EntityLink } from "@/components/ui/EntityLink";
import {
  ArtifactTypeBadge,
  FeatureStatusBadge,
  ProductStatusBadge,
  TaskStatusBadge,
} from "@/components/ui/StatusBadges";
import { PersonChip, PersonPlaceholder } from "@/components/ui/PersonChip";
import { ActivityFeed } from "@/components/ActivityFeed";
import { formatDate, formatRelative } from "@/lib/format";
import { getHistory, historyLimit, HISTORY_PAGE_SIZE } from "@/lib/history/queries";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "features", label: "Features" },
  { key: "tasks", label: "Tasks" },
  { key: "decisions", label: "Decisions" },
  { key: "meetings", label: "Meetings" },
  { key: "documents", label: "Documents" },
  { key: "activity", label: "Activity" },
];

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; historico?: string }>;
}) {
  const { id } = await params;
  const { tab = "overview", historico } = await searchParams;
  const limit = historyLimit(historico);

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      features: {
        include: { owner: true, architect: true, techLead: true, tasks: { where: { archivedAt: null } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!product) notFound();

  const featureIds = product.features.map((f) => f.id);

  const [tasks, decisions, meetings, artifacts, history] = await Promise.all([
    prisma.task.findMany({
      where: { featureId: { in: featureIds }, archivedAt: null },
      include: { feature: true, assignee: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.decision.findMany({
      where: { OR: [{ productId: id }, { featureId: { in: featureIds } }] },
      include: { feature: true, author: true },
      orderBy: { decidedAt: "desc" },
    }),
    prisma.meeting.findMany({
      where: {
        OR: [
          { decisions: { some: { OR: [{ productId: id }, { featureId: { in: featureIds } }] } } },
          { followUpTasks: { some: { featureId: { in: featureIds } } } },
        ],
      },
      orderBy: { date: "desc" },
    }),
    prisma.artifact.findMany({
      where: { featureId: { in: featureIds } },
      include: { feature: true, author: true },
      orderBy: { createdAt: "desc" },
    }),
    // Histórico por escopo: tudo que pertence ao Product (Features, tasks, decisões, requisitos, validações).
    getHistory({ productId: id }, limit),
  ]);
  const activity = history.items;

  const tabCounts: Record<string, number> = {
    features: product.features.length,
    tasks: tasks.length,
    decisions: decisions.length,
    meetings: meetings.length,
    documents: artifacts.length,
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Products", href: "/products" }, { label: product.name }]} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-ink">{product.name}</h1>
            <ProductStatusBadge status={product.status} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{product.description}</p>
        </div>
      </div>

      <Tabs
        items={TABS.map((t) => ({ ...t, count: tabCounts[t.key] }))}
        active={tab}
        basePath={`/products/${id}`}
      />

      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Features" value={product.features.length} />
          <StatTile
            label="Em desenvolvimento"
            value={product.features.filter((f) => f.status === "DEVELOPMENT").length}
          />
          <StatTile label="Tasks" value={tasks.length} />
          <StatTile label="Decisions" value={decisions.length} />
        </div>
      )}

      {tab === "overview" && (
        <Card className="mt-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Atividade recente</h3>
          <ActivityFeed items={activity.slice(0, 6)} />
        </Card>
      )}

      {tab === "features" && (
        <FeatureListSection productId={product.id} features={product.features} />
      )}

      {tab === "tasks" && <TaskListSection tasks={tasks} />}

      {tab === "decisions" && <DecisionListSection decisions={decisions} />}

      {tab === "meetings" && <MeetingListSection meetings={meetings} />}

      {tab === "documents" && <DocumentListSection artifacts={artifacts} />}

      {tab === "activity" && (
        <Card>
          <ActivityFeed
            items={activity}
            moreHref={history.hasMore ? `/products/${product.id}?tab=activity&historico=${limit + HISTORY_PAGE_SIZE}` : null}
          />
        </Card>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </Card>
  );
}

function FeatureListSection({
  productId,
  features,
}: {
  productId: string;
  features: Array<{
    id: string;
    title: string;
    status: import("@/generated/prisma/client").FeatureStatus;
    priority: import("@/generated/prisma/client").Priority | null;
    owner: { name: string; role: import("@/generated/prisma/client").RoleName } | null;
    architect: { name: string; role: import("@/generated/prisma/client").RoleName } | null;
    tasks: Array<{ status: string }>;
  }>;
}) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Link
          href={`/features/new?productId=${productId}`}
          className="text-xs font-medium text-brand hover:underline"
        >
          + Nova Feature
        </Link>
      </div>
      {features.length === 0 ? (
        <EmptyState icon="feature" title="Nenhuma Feature ainda" />
      ) : (
        <div className="space-y-2">
          {features.map((f) => {
        const done = f.tasks.filter((t) => t.status === "DONE").length;
        return (
          <Link
            key={f.id}
            href={`/features/${f.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:border-brand/40 hover:bg-brand-soft/20"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{f.title}</p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {f.owner ? f.owner.name : "Sem responsável"}
                {f.tasks.length > 0 && ` · ${done}/${f.tasks.length} tasks`}
              </p>
            </div>
            <FeatureStatusBadge status={f.status} />
          </Link>
        );
          })}
        </div>
      )}
    </div>
  );
}

function TaskListSection({
  tasks,
}: {
  tasks: Array<{
    id: string;
    title: string;
    status: import("@/generated/prisma/client").TaskStatus;
    feature: { title: string } | null;
    assignee: { name: string; role: import("@/generated/prisma/client").RoleName } | null;
  }>;
}) {
  if (tasks.length === 0) return <EmptyState icon="task" title="Nenhuma task ainda" />;
  return (
    <Card padded={false}>
      <ul className="divide-y divide-border">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <EntityLink type="task" href={`/tasks/${t.id}`}>
                {t.title}
              </EntityLink>
              {t.feature && <p className="mt-0.5 truncate text-xs text-ink-faint">{t.feature.title}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {t.assignee ? <PersonChip name={t.assignee.name} role={t.assignee.role} /> : <PersonPlaceholder />}
              <TaskStatusBadge status={t.status} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DecisionListSection({
  decisions,
}: {
  decisions: Array<{
    id: string;
    title: string;
    decidedAt: Date;
    author: { name: string } | null;
    feature: { title: string } | null;
  }>;
}) {
  if (decisions.length === 0) return <EmptyState icon="decision" title="Nenhuma decisão registrada" />;
  return (
    <div className="space-y-2">
      {decisions.map((d) => (
        <Card key={d.id}>
          <EntityLink type="decision" href={`/decisions/${d.id}`}>
            {d.title}
          </EntityLink>
          <p className="mt-1 text-xs text-ink-faint">
            {d.author?.name ?? "—"} · {formatRelative(d.decidedAt)}
            {d.feature && (
              <>
                {" · "}
                {d.feature.title}
              </>
            )}
          </p>
        </Card>
      ))}
    </div>
  );
}

function MeetingListSection({
  meetings,
}: {
  meetings: Array<{ id: string; title: string; date: Date }>;
}) {
  if (meetings.length === 0) return <EmptyState icon="meeting" title="Nenhuma reunião relacionada" />;
  return (
    <div className="space-y-2">
      {meetings.map((m) => (
        <Card key={m.id}>
          <EntityLink type="meeting" href={`/meetings/${m.id}`}>
            {m.title}
          </EntityLink>
          <p className="mt-1 text-xs text-ink-faint">{formatDate(m.date)}</p>
        </Card>
      ))}
    </div>
  );
}

function DocumentListSection({
  artifacts,
}: {
  artifacts: Array<{
    id: string;
    title: string;
    type: import("@/generated/prisma/client").ArtifactType;
    feature: { title: string } | null;
    author: { name: string } | null;
  }>;
}) {
  if (artifacts.length === 0) return <EmptyState icon="artifact" title="Nenhum artefato relacionado" />;
  return (
    <div className="space-y-2">
      {artifacts.map((a) => (
        <Link key={a.id} href={`/artifacts/${a.id}`} className="block">
          <Card className="hover:border-brand/40 hover:bg-brand-soft/20">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">{a.title}</p>
              <ArtifactTypeBadge type={a.type} />
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {a.feature?.title} {a.author && `· ${a.author.name}`}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
