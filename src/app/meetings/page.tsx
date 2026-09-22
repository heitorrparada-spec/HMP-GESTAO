import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { PersonChip } from "@/components/ui/PersonChip";
import { formatDate } from "@/lib/format";

export default async function MeetingsPage() {
  const meetings = await prisma.meeting.findMany({
    include: {
      participants: { include: { person: true } },
      decisions: { select: { _count: { select: { generatedTasks: true } } } },
      _count: { select: { followUpTasks: true } },
    },
    orderBy: { date: "desc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Meetings"
        description="Reuniões semanais de acompanhamento e validação da HMP."
        actions={
          <Link
            href="/meetings/new"
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
          >
            + Registrar reunião
          </Link>
        }
      />

      {meetings.length === 0 ? (
        <EmptyState icon="meeting" title="Nenhuma reunião registrada ainda" />
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => {
            const decisionCount = m.decisions.length;
            const taskCount =
              m._count.followUpTasks + m.decisions.reduce((sum, d) => sum + d._count.generatedTasks, 0);
            return (
              <Link key={m.id} href={`/meetings/${m.id}`}>
                <Card className="transition-colors hover:border-brand/40 hover:bg-brand-soft/20">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">{m.title}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">{formatDate(m.date)}</p>
                    </div>
                    <div className="flex -space-x-1.5">
                      {m.participants.map(({ person }) => (
                        <PersonChip key={person.id} name={person.name} role={person.role} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    {decisionCount === 1 ? "1 decisão" : `${decisionCount} decisões`} ·{" "}
                    {taskCount === 1 ? "1 task decorrente" : `${taskCount} tasks decorrentes`}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
