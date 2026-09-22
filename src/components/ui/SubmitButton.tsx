"use client";

import { useFormStatus } from "react-dom";
import clsx from "clsx";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
  ...rest
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        "rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-brand hover:bg-brand/90",
        variant === "danger" && "bg-red-600 hover:bg-red-700",
        className,
      )}
      {...rest}
    >
      {pending ? (pendingLabel ?? "Salvando…") : children}
    </button>
  );
}
