import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/lib/seed-data";

/**
 * Bootstrap de dados de demonstração, para rodar uma vez após o primeiro
 * deploy sem precisar de acesso local ao banco. Protegido por SEED_TOKEN.
 *
 * Uso: GET /api/admin/seed?token=<SEED_TOKEN definido na Vercel>
 *
 * Remova esta rota (ou o SEED_TOKEN) depois do bootstrap inicial — ela
 * apaga e recria todos os dados sempre que chamada.
 */
export async function GET(request: NextRequest) {
  const expectedToken = process.env.SEED_TOKEN;

  if (!expectedToken) {
    return NextResponse.json(
      { error: "SEED_TOKEN não está configurado nas variáveis de ambiente." },
      { status: 501 },
    );
  }

  const providedToken = request.nextUrl.searchParams.get("token");
  if (providedToken !== expectedToken) {
    return NextResponse.json({ error: "Token inválido ou ausente." }, { status: 401 });
  }

  try {
    const summary = await seedDatabase(prisma);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("Erro ao rodar o seed:", error);
    return NextResponse.json(
      { error: "Falha ao rodar o seed.", detail: String(error) },
      { status: 500 },
    );
  }
}
