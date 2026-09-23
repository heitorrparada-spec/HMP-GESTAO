import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/ui/PageHeader";
import { MeetingForm } from "../MeetingForm";
import { createMeeting } from "../actions";

export default async function NewMeetingPage() {
  const people = await prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl">
      <Breadcrumb items={[{ label: "Meetings", href: "/meetings" }, { label: "Nova reunião" }]} />
      <h1 className="mb-6 text-xl font-semibold text-ink">Registrar reunião</h1>
      <MeetingForm action={createMeeting} people={people} submitLabel="Registrar reunião" />
    </div>
  );
}
