import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ACTOR_COOKIE } from "@/lib/actor-cookie";

export { ACTOR_COOKIE };

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
