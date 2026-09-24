import "dotenv/config";
import { reconstructAt } from "@/lib/history/reconstruct";
import { prisma } from "@/lib/prisma";

async function main() {
  const [entityType, entityId, ...moments] = process.argv.slice(2);
  const states = [];
  for (const at of moments) states.push(await reconstructAt(entityType, entityId, new Date(at)));
  process.stdout.write(JSON.stringify(states));
}

main().finally(() => prisma.$disconnect());
