import Link from "next/link";
import clsx from "clsx";

export type TabItem = {
  key: string;
  label: string;
  count?: number;
};

/**
 * Tabs orientadas por searchParams (?tab=...): navegação sem JS no cliente,
 * a página server component decide o que renderizar a partir do valor ativo.
 */
export function Tabs({
  items,
  active,
  basePath,
}: {
  items: TabItem[];
  active: string;
  basePath: string;
}) {
  return (
    <div className="mb-5 flex gap-1 border-b border-border">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.key === items[0].key ? basePath : `${basePath}?tab=${item.key}`}
            className={clsx(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-brand text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-xs",
                  isActive ? "bg-brand-soft text-brand" : "bg-slate-100 text-ink-faint",
                )}
              >
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
