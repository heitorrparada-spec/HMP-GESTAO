import clsx from "clsx";
import type { Tone } from "@/lib/labels";

const toneClasses: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-600 ring-slate-500/10",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

const dotClasses: Record<Tone, string> = {
  gray: "bg-slate-400",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
  red: "bg-red-500",
  green: "bg-emerald-500",
};

export function Badge({
  tone = "gray",
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className={clsx("h-1.5 w-1.5 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}
