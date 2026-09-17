import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const productCount = await prisma.product.count();
  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">HMP OS</h1>
      <p className="mt-2 text-sm text-ink-muted">Produtos no banco: {productCount}</p>
    </div>
  );
}
