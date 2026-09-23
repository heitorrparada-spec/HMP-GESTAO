"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

export type FormAction = (formData: FormData) => Promise<ActionResult>;

// Envia pelo onSubmit, não pelo action do <form>: o React limpa o form ao fim de toda action, e com erro o
// usuário perderia o que digitou. O pending continua chegando ao useFormStatus (SubmitButton).
export function useActionSubmit() {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function submit(action: FormAction, { resetOnSuccess = false } = {}) {
    return (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form, (event.nativeEvent as SubmitEvent).submitter);
      setError(null);
      startTransition(async () => {
        const result = await action(formData);
        if (result?.error) setError(result.error);
        else if (resetOnSuccess) form.reset();
      });
    };
  }

  return { error, submit };
}

/** Form de Server Action que mostra na própria tela o erro esperado devolvido pela action. */
export function ActionForm({
  action,
  resetOnSuccess,
  className,
  children,
}: {
  action: FormAction;
  resetOnSuccess?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { error, submit } = useActionSubmit();

  return (
    <form action={preHydrationAction(action)} onSubmit={submit(action, { resetOnSuccess })} className={className}>
      {children}
      <FormError message={error} />
    </form>
  );
}

// O action do <form> só é usado se o envio acontecer antes da hidratação; depois, o onSubmit assume.
export function preHydrationAction(action: FormAction) {
  return action as (formData: FormData) => Promise<void>;
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 w-full rounded-md bg-red-50 p-2.5 text-sm text-red-700">
      {message}
    </p>
  );
}
