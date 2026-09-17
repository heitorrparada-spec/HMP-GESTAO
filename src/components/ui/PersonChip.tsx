import clsx from "clsx";
import { initials } from "@/lib/format";
import { roleMeta } from "@/lib/labels";
import type { RoleName } from "@/generated/prisma/client";

const roleRing: Record<RoleName, string> = {
  PRODUCT: "ring-blue-300 bg-blue-50 text-blue-700",
  ARCHITECTURE: "ring-violet-300 bg-violet-50 text-violet-700",
  ENGINEERING: "ring-amber-300 bg-amber-50 text-amber-800",
};

export function Avatar({
  name,
  role,
  size = "md",
}: {
  name: string;
  role?: RoleName;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1",
        size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs",
        role ? roleRing[role] : "bg-slate-100 text-slate-600 ring-slate-300",
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function PersonChip({
  name,
  role,
  subtitle,
}: {
  name: string;
  role?: RoleName;
  subtitle?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar name={name} role={role} size="sm" />
      <span className="text-sm text-ink">{name}</span>
      {role && !subtitle && (
        <span className="text-xs text-ink-faint">· {roleMeta[role].short}</span>
      )}
      {subtitle && <span className="text-xs text-ink-faint">· {subtitle}</span>}
    </span>
  );
}

export function PersonPlaceholder({ label = "Não atribuído" }: { label?: string }) {
  return <span className="text-sm text-ink-faint">{label}</span>;
}
