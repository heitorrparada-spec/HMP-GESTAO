import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { getCurrentActor } from "@/lib/actor";
import "./globals.css";

export const metadata: Metadata = {
  title: "HMP OS",
  description: "Sistema operacional interno da HMP para gestão e execução de produtos.",
};

// Todo o app depende de dados ao vivo (banco + cookie de ator) — nunca há
// valor em pré-renderizar no build, e evita que o build tente uma conexão
// com o banco antes do runtime.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentActor();
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-x-hidden">
            {!actor?.active && (
              <p role="note" className="border-b border-amber-200 bg-amber-50 px-8 py-2 text-xs text-amber-800">
                Você está navegando sem usuário selecionado. Para registrar alterações, escolha quem você é em{" "}
                <strong>Selecionar usuário</strong> (canto inferior esquerdo) — o histórico registra quem fez cada mudança.
              </p>
            )}
            <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
