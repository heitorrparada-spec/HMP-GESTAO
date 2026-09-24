"use client";

import { useState } from "react";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { FormError, preHydrationAction, useActionSubmit, type FormAction } from "@/components/ui/ActionForm";

export type TrackerStep = {
  value: string;
  label: string;
  action: FormAction;
  disabled?: boolean;
  disabledReason?: string;
  /** Transição sensível (voltar/reabrir): pede um motivo antes de enviar — ele fica no histórico. */
  requiresReason?: string;
};

/** Fileira de estados clicáveis — cada um é um form com uma server action já vinculada (bind). */
export function StatusTracker({ steps, current }: { steps: TrackerStep[]; current: string }) {
  const currentIndex = steps.findIndex((s) => s.value === current);
  const { error, submit } = useActionSubmit();
  const [askingFor, setAsking] = useState<TrackerStep | null>(null);
  // Depois que a transição acontece, o estado atual passa a ser o pedido e o painel de motivo some.
  const asking = askingFor && askingFor.value !== current ? askingFor : null;

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
                onSubmit={(e) => {
                  if (step.requiresReason) {
                    e.preventDefault();
                    setAsking(step);
                    return;
                  }
                  submit(step.action)(e);
                }}
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
                    asking?.value === step.value && "ring-2 ring-inset ring-amber-400",
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

      {asking && (
        <form
          key={asking.value}
          action={preHydrationAction(asking.action)}
          onSubmit={submit(asking.action)}
          className="mt-2 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3"
        >
          <label className="block text-xs font-medium text-amber-900">{asking.requiresReason}</label>
          <textarea
            name="reason"
            required
            rows={2}
            autoFocus
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            placeholder="Motivo — fica registrado no histórico"
          />
          <div className="flex items-center gap-2">
            <button type="submit" className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">
              Confirmar: {asking.label}
            </button>
            <button type="button" onClick={() => setAsking(null)} className="text-xs text-ink-muted hover:underline">
              Cancelar
            </button>
          </div>
        </form>
      )}
      <FormError message={error} />
    </div>
  );
}
