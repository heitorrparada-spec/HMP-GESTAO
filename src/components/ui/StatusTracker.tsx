import clsx from "clsx";
import { Card } from "@/components/ui/Card";

export type TrackerStep = {
  value: string;
  label: string;
  action: () => Promise<void>;
};

/** Fileira de estados clicáveis — cada um é um form com uma server action já vinculada (bind). */
export function StatusTracker({ steps, current }: { steps: TrackerStep[]; current: string }) {
  const currentIndex = steps.findIndex((s) => s.value === current);

  return (
    <Card padded={false} className="overflow-x-auto">
      <div className="flex min-w-max items-stretch">
        {steps.map((step, i) => {
          const isCurrent = step.value === current;
          const isPast = currentIndex !== -1 && i < currentIndex;
          return (
            <form key={step.value} action={step.action} className="flex-1">
              <button
                type="submit"
                disabled={isCurrent}
                className={clsx(
                  "flex w-full flex-col items-center gap-1 border-r border-border px-3 py-3 text-xs font-medium transition-colors last:border-r-0",
                  isCurrent && "bg-brand text-white",
                  !isCurrent && isPast && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                  !isCurrent && !isPast && "text-ink-muted hover:bg-slate-50 hover:text-ink",
                )}
                title={isCurrent ? "Estado atual" : `Mover para ${step.label}`}
              >
                {step.label}
              </button>
            </form>
          );
        })}
      </div>
    </Card>
  );
}
