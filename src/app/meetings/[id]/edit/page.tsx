import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { MeetingForm } from "../../MeetingForm";
import { updateMeeting } from "../../actions";

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [meeting, people] = await Promise.all([
    prisma.meeting.findUnique({ where: { id }, include: { participants: true } }),
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!meeting) notFound();

  return (
    <div className="max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Meetings", href: "/meetings" },
          { label: meeting.title, href: `/meetings/${meeting.id}` },
          { label: "Editar" },
        ]}
      />
      <h1 className="mb-6 text-xl font-semibold text-ink">Editar reunião</h1>
      <MeetingForm
        action={updateMeeting.bind(null, meeting.id)}
        people={people}
        meeting={{ ...meeting, participantIds: meeting.participants.map((p) => p.personId) }}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
