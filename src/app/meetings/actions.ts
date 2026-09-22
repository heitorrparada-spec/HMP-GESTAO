"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getCurrentActor } from "@/lib/actor";
import { parseDateTimeInput } from "@/lib/format";

async function readMeetingInput(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const date = parseDateTimeInput(String(formData.get("date") ?? ""));
  if (!title) throw new Error("Título da reunião é obrigatório.");
  if (!date) throw new Error("Data da reunião inválida.");

  const participantIds = [...new Set(formData.getAll("participantIds").map(String).filter(Boolean))];
  if (participantIds.length > 0) {
    const found = await prisma.person.count({ where: { id: { in: participantIds } } });
    if (found !== participantIds.length) throw new Error("Participante inexistente.");
  }

  return {
    title,
    date,
    agenda: String(formData.get("agenda") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    participantIds,
  };
}

function revalidateMeeting(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  revalidatePath("/");
  revalidatePath("/activity");
}

export async function createMeeting(formData: FormData) {
  const { participantIds, ...data } = await readMeetingInput(formData);
  const actor = await getCurrentActor();

  const meeting = await prisma.meeting.create({
    data: { ...data, participants: { create: participantIds.map((personId) => ({ personId })) } },
  });

  await logActivity({
    entityType: "meeting",
    entityId: meeting.id,
    eventType: "meeting.created",
    description: `Reunião "${meeting.title}" registrada`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  revalidateMeeting(meeting.id);
  redirect(`/meetings/${meeting.id}`);
}

export async function updateMeeting(meetingId: string, formData: FormData) {
  await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  const { participantIds, ...data } = await readMeetingInput(formData);
  const actor = await getCurrentActor();

  await prisma.$transaction([
    prisma.meetingParticipant.deleteMany({ where: { meetingId } }),
    prisma.meeting.update({
      where: { id: meetingId },
      data: { ...data, participants: { create: participantIds.map((personId) => ({ personId })) } },
    }),
  ]);

  await logActivity({
    entityType: "meeting",
    entityId: meetingId,
    eventType: "meeting.updated",
    description: `Reunião "${data.title}" foi editada`,
    actorId: actor?.id,
    actorName: actor?.name,
  });

  revalidateMeeting(meetingId);
  redirect(`/meetings/${meetingId}`);
}
