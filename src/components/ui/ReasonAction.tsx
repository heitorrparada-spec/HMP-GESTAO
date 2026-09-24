"use client";

import clsx from "clsx";
import { ActionForm, type FormAction } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";

/**
 * Ação sensível que exige motivo (arquivar, restaurar, revogar…): abre um campo de motivo e só então envia.
 * <details> funciona sem JavaScript; o motivo vai para o histórico.
 */
export function ReasonAction({
  action,
  label,
  confirmLabel,
  reasonLabel,
  name = "reason",
  tone = "danger",
  className,
}: {
  action: FormAction;
  label: string;
  confirmLabel: string;
  reasonLabel: string;
  name?: string;
  tone?: "danger" | "primary";
  className?: string;
}) {
  return (
    <details className={clsx("group", className)}>
      <summary
        className={clsx(
          "cursor-pointer list-none text-xs font-medium hover:underline",
          tone === "danger" ? "text-red-600" : "text-brand",
        )}
      >
        {label}
      </summary>
      <ActionForm action={action} className="mt-2 space-y-2 rounded-md border border-border bg-slate-50 p-2.5">
        <label className="block text-xs font-medium text-ink-muted">{reasonLabel}</label>
        <textarea
          name={name}
          required
          rows={2}
          className="w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-sm"
          placeholder="Motivo — fica registrado no histórico"
        />
        <SubmitButton variant={tone} pendingLabel="Registrando…" className="px-3 py-1.5 text-xs">
          {confirmLabel}
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
