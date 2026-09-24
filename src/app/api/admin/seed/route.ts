import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/lib/seed-data";

/**
 * Reset total para os dados de demonstração (apaga e recria tudo). Protegido por SEED_TOKEN.
 *
 * Uso: GET /api/admin/seed?token=<SEED_TOKEN>
 *
 * V0.3-A: apagar tudo contradiz a auditabilidade, então em produção a rota fica desligada, a menos
 * que ALLOW_DEMO_RESET=true esteja definido. Para um banco vazio, use o botão "Carregar dados de
 * demonstração" (só insere, nunca apaga).
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_RESET !== "true") {
    return NextResponse.json(
      {
        error:
          "Reset da demonstração desativado em produção: ele apagaria o histórico. Defina ALLOW_DEMO_RESET=true só se quiser mesmo recomeçar do zero.",
      },
      { status: 403 },
    );
  }

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
