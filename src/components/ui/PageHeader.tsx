import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="mb-3 flex items-center gap-1.5 text-sm text-ink-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 text-ink-faint" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-ink hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: IconName;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
      {icon && <Icon name={icon} className="h-6 w-6 text-ink-faint" />}
      <p className="text-sm font-medium text-ink-muted">{title}</p>
      {description && <p className="max-w-sm text-xs text-ink-faint">{description}</p>}
    </div>
  );
}
