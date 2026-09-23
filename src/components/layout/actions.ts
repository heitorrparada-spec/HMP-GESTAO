"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isDatabaseEmpty, seedDatabase } from "@/lib/seed-data";
import { ActionError, runAction, type ActionResult } from "@/lib/action-result";

// Bootstrap sem token (a rota /api/admin/seed exige SEED_TOKEN e apaga tudo): este só roda com o banco
// totalmente vazio, então nunca apaga dados. Numa transação: se falhar no meio, o banco continua vazio.
export async function loadDemoData(): Promise<ActionResult> {
  return runAction(async () => {
    await prisma.$transaction(
      async (tx) => {
        if (!(await isDatabaseEmpty(tx))) {
          throw new ActionError("O banco já tem dados — a demonstração só é carregada num banco vazio. Recarregue a página.");
        }
        await seedDatabase(tx);
      },
      { maxWait: 10_000, timeout: 120_000 },
    );
    revalidatePath("/", "layout");
  });
}
