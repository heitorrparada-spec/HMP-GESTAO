import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ActivityFeed } from "@/components/ActivityFeed";

export default async function ActivityPage() {
  const items = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Activity"
        description="Rastreabilidade: cada mudança relevante fica registrada, para sempre poder reconstruir a cadeia."
      />
      <Card>
        <ActivityFeed items={items} />
      </Card>
    </div>
  );
}
