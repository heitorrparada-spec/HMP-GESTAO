"use client";

import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { FormError, preHydrationAction, useActionSubmit, type FormAction } from "@/components/ui/ActionForm";

export type TrackerStep = {
  value: string;
  label: string;
  action: FormAction;
  disabled?: boolean;
  disabledReason?: string;
};

/** Fileira de estados clicáveis — cada um é um form com uma server action já vinculada (bind). */
export function StatusTracker({ steps, current }: { steps: TrackerStep[]; current: string }) {
  const currentIndex = steps.findIndex((s) => s.value === current);
  const { error, submit } = useActionSubmit();

  return (
    <div>
      <Card padded={false} className="overflow-x-auto">
        <div className="flex min-w-max items-stretch">
          {steps.map((step, i) => {
            const isCurrent = step.value === current;
            const isPast = currentIndex !== -1 && i < currentIndex;
            const isDisabled = isCurrent || step.disabled;
            return (
              <form
                key={step.value}
                action={preHydrationAction(step.action)}
                onSubmit={submit(step.action)}
                className="flex-1"
              >
                <button
                  type="submit"
                  disabled={isDisabled}
                  className={clsx(
                    "flex w-full flex-col items-center gap-1 border-r border-border px-3 py-3 text-xs font-medium transition-colors last:border-r-0",
                    isCurrent && "bg-brand text-white",
                    !isCurrent && isPast && "bg-emerald-50 text-emerald-700",
                    !isCurrent && isPast && !step.disabled && "hover:bg-emerald-100",
                    !isCurrent && !isPast && !step.disabled && "text-ink-muted hover:bg-slate-50 hover:text-ink",
                    !isCurrent && !isPast && step.disabled && "text-ink-faint/60",
                    !isCurrent && step.disabled && "cursor-not-allowed",
                  )}
                  title={isCurrent ? "Estado atual" : step.disabled ? step.disabledReason : `Mover para ${step.label}`}
                >
                  {step.label}
                </button>
              </form>
            );
          })}
        </div>
      </Card>
      <FormError message={error} />
    </div>
  );
}
