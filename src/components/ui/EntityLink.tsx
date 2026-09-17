import Link from "next/link";
import clsx from "clsx";
import { Icon, type IconName } from "@/components/ui/Icon";

const entityIcon: Record<string, IconName> = {
  product: "product",
  release: "release",
  feature: "feature",
  task: "task",
  meeting: "meeting",
  decision: "decision",
  artifact: "artifact",
  validation: "validation",
};

export function EntityLink({
  type,
  href,
  children,
  muted = false,
  className,
}: {
  type: keyof typeof entityIcon;
  href: string;
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex min-w-0 items-center gap-1.5 text-sm hover:underline",
        muted ? "text-ink-muted" : "font-medium text-ink",
        className,
      )}
    >
      <Icon name={entityIcon[type] ?? "link"} className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
      <span className="truncate">{children}</span>
    </Link>
  );
}
