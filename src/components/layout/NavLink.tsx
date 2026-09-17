"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Icon, type IconName } from "@/components/ui/Icon";

export function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
        isActive ? "bg-brand-soft text-brand" : "text-ink-muted hover:bg-slate-100 hover:text-ink",
      )}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0" />
      {children}
    </Link>
  );
}
