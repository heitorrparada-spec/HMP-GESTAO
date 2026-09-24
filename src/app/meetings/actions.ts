"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { command } from "@/lib/history/command";
import { compact, fieldChange, peopleChange } from "@/lib/history/diff";
import { meetingIsSensitive, requireReason, optionalReason } from "@/lib/history/policy";
import { meetingSnapshot } from "@/lib/history/snapshots";
import { changedFieldsSummary } from "@/lib/history/present";
import { parseDateTimeInput } from "@/lib/format";
import { formText } from "@/lib/form";
import { ActionError, runAction, type ActionResult } from "@/lib/action-result";
import type { Db, PersonRef } from "@/lib/history/types";

async function readMeetingInput(tx: Db, formData: FormData) {
  const title = formText(formData, "title");
  const date = parseDateTimeInput(String(formData.get("date") ?? ""));
  if (!title) throw new ActionError("Informe o título da reunião.");
  if (!date) throw new ActionError("Informe uma data e hora válidas para a reunião.");

  const participantIds = [...new Set(formData.getAll("participantIds").map(String).filter(Boolean))];
  const participants = participantIds.length > 0 ? await tx.person.findMany({ where: { id: { in: participantIds } } }) : [];
  if (participants.length !== participantIds.length) {
    throw new ActionError("Um dos participantes selecionados não foi encontrado. Recarregue a página e selecione de novo.");
  }

  return {
    title,
    date,
    agenda: formText(formData, "agenda") || null,
    notes: formText(formData, "notes") || null,
    participants: participants.map((p): PersonRef => ({ id: p.id, name: p.name })),
  };
}

function revalidateMeeting(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  revalidatePath("/");
  revalidatePath("/activity");
}

export async function createMeeting(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const meeting = await command(async ({ tx, record }) => {
      const input = await readMeetingInput(tx, formData);
      const meeting = await tx.meeting.create({
        data: {
          title: input.title,
          date: input.date,
          agenda: input.agenda,
          notes: input.notes,
          participants: { create: input.participants.map((p) => ({ personId: p.id })) },
        },
      });
      await record({
        eventType: "meeting.created",
        entityType: "meeting",
        entityId: meeting.id,
        entityLabel: meeting.title,
        scopes: { meetingId: meeting.id },
        description: `Reunião "${meeting.title}" registrada`,
        snapshot: meetingSnapshot(input),
      });
      return meeting;
    });

    revalidateMeeting(meeting.id);
    redirect(`/meetings/${meeting.id}`);
  });
}

export async function updateMeeting(meetingId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await command(async ({ tx, record }) => {
      const current = await tx.meeting.findUnique({
        where: { id: meetingId },
        include: {
          participants: { include: { person: { select: { id: true, name: true } } } },
          _count: { select: { decisions: true } },
        },
      });
      if (!current) throw new ActionError("Esta reunião não foi encontrada — ela pode ter sido removida. Recarregue a página.");
      const input = await readMeetingInput(tx, formData);

      const changes = compact([
        fieldChange("title", current.title, input.title),
        fieldChange("date", current.date, input.date),
        fieldChange("agenda", current.agenda, input.agenda),
        fieldChange("notes", current.notes, input.notes),
        peopleChange("participants", current.participants.map(({ person }) => person), input.participants),
      ]);
      if (changes.length === 0) return;

      // Reunião que já aconteceu (ou já tem decisões): remarcar ou mudar participantes é correção justificada.
      const sensitive = meetingIsSensitive({ date: current.date, decisionCount: current._count.decisions });
      const touchesRecord = changes.some((c) => c.field === "date" || c.field === "participants");
      const reason =
        sensitive && touchesRecord
          ? requireReason(formData.get("changeReason"), "remarcar ou mudar os participantes de uma reunião que já aconteceu")
          : optionalReason(formData.get("changeReason"));

      await tx.meeting.update({
        where: { id: meetingId },
        data: { title: input.title, date: input.date, agenda: input.agenda, notes: input.notes },
      });
      if (changes.some((c) => c.field === "participants")) {
        await tx.meetingParticipant.deleteMany({ where: { meetingId } });
        await tx.meetingParticipant.createMany({ data: input.participants.map((p) => ({ meetingId, personId: p.id })) });
      }
      await record({
        eventType: "meeting.updated",
        entityType: "meeting",
        entityId: meetingId,
        entityLabel: input.title,
        scopes: { meetingId },
        description: `Reunião "${input.title}" alterada — ${changedFieldsSummary(changes)}`,
        reason,
        changes,
      });
    });

    revalidateMeeting(meetingId);
    redirect(`/meetings/${meetingId}`);
  });
}
