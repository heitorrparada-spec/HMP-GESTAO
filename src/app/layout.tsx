import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "HMP OS",
  description: "Sistema operacional interno da HMP para gestão e execução de produtos.",
};

// Todo o app depende de dados ao vivo (banco + cookie de ator) — nunca há
// valor em pré-renderizar no build, e evita que o build tente uma conexão
// com o banco antes do runtime.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-x-hidden">
            <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
