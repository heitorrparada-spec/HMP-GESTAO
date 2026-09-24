import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ActivityFeed } from "@/components/ActivityFeed";
import { getHistory, historyLimit, HISTORY_PAGE_SIZE } from "@/lib/history/queries";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ historico?: string }> }) {
  const limit = historyLimit((await searchParams).historico);
  const { items, hasMore } = await getHistory({}, limit);

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Activity"
        description="Rastreabilidade: cada mudança fica registrada com quem fez, quando, o que mudou e por quê."
      />
      <Card>
        <ActivityFeed items={items} moreHref={hasMore ? `/activity?historico=${limit + HISTORY_PAGE_SIZE}` : null} />
      </Card>
    </div>
  );
}
