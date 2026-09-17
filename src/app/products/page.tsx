import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProductStatusBadge } from "@/components/ui/StatusBadges";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      features: { select: { id: true, status: true } },
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="HMP OS"
        title="Products"
        description="As vertentes de produto da HMP."
      />

      {products.length === 0 ? (
        <EmptyState icon="product" title="Nenhum produto cadastrado" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((product) => {
            const total = product.features.length;
            const done = product.features.filter((f) => f.status === "DONE").length;
            return (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Card className="h-full transition-colors hover:border-brand/40 hover:bg-brand-soft/20">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-ink">{product.name}</h3>
                    <ProductStatusBadge status={product.status} />
                  </div>
                  <p className="mt-2 text-sm text-ink-muted">{product.description}</p>
                  <p className="mt-4 text-xs text-ink-faint">
                    {total} feature{total !== 1 ? "s" : ""}
                    {total > 0 && ` · ${done} concluída${done !== 1 ? "s" : ""}`}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
