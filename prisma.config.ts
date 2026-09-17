import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // migrate deploy/dev precisam de uma conexão direta (não pooled): o
    // advisory lock que o Migrate usa não é confiável através do pgbouncer
    // do Neon (endpoint "-pooler"). DIRECT_URL é opcional em dev (cai para
    // DATABASE_URL), mas obrigatório em produção com Neon.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
