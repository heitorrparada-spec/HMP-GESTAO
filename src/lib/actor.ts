import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ACTOR_COOKIE } from "@/lib/actor-cookie";
import { ActionError } from "@/lib/action-result";

export { ACTOR_COOKIE };

export const ACTOR_REQUIRED =
  'Selecione quem você é em "Selecionar usuário" (canto inferior esquerdo) antes de registrar alterações — o histórico precisa saber quem fez.';

/** Pessoa "atuando como" no momento — convenção de protótipo, não autenticação real. */
export async function getCurrentActor() {
  const store = await cookies();
  const id = store.get(ACTOR_COOKIE)?.value;
  if (!id) return null;
  return prisma.person.findUnique({ where: { id } });
}

export async function getCurrentActorId() {
  const store = await cookies();
  return store.get(ACTOR_COOKIE)?.value ?? null;
}

/** V0.3-A: toda escrita tem autor declarado (declarado, não autenticado — ver spec, DV-16). */
export async function requireActor() {
  const actor = await getCurrentActor();
  if (!actor || !actor.active) throw new ActionError(ACTOR_REQUIRED);
  return actor;
}
