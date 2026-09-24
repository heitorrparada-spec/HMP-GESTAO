import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/lib/actor";
import { recordEvent } from "@/lib/history/record";
import type { Db, EventInput } from "@/lib/history/types";
import type { Person } from "@/generated/prisma/client";

export type CommandContext = {
  tx: Db;
  actor: Person;
  correlationId: string;
  /** Registra um evento na mesma transação, com o autor e a correlação desta ação. */
  record: (event: EventInput) => Promise<void>;
};

/**
 * Executor único do caminho de escrita (V0.3-A): exige autor declarado, abre a transação e entrega
 * `record` para gravar o histórico junto com o estado. redirect()/revalidatePath() ficam FORA daqui —
 * redirect lança exceção e, dentro do callback, desfaria a transação.
 */
export async function command<T>(fn: (ctx: CommandContext) => Promise<T>): Promise<T> {
  const actor = await requireActor();
  const correlationId = randomUUID();
  // Neon pode estar frio: o timeout default (5 s) de transação interativa não basta.
  return prisma.$transaction(
    (tx) =>
      fn({
        tx,
        actor,
        correlationId,
        record: (event) =>
          recordEvent(tx, { actorId: actor.id, actorName: actor.name, correlationId, source: "app" }, event),
      }),
    { maxWait: 10_000, timeout: 20_000 },
  );
}
