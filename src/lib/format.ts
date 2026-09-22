import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Fuso local, como o formatDate ("2026-09-22" puro seria meia-noite UTC, o dia anterior em UTC-3);
// o round-trip rejeita datas que o Date rolaria ("2026-02-30" viraria 2 de março).
export function parseDateInput(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T12:00:00`);
  return !isNaN(date.getTime()) && format(date, "yyyy-MM-dd") === raw ? date : null;
}

export function parseDateTimeInput(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}:00`);
  return !isNaN(date.getTime()) && format(date, "yyyy-MM-dd'T'HH:mm") === raw ? date : null;
}

export function toDateInputValue(value: Date | null | undefined): string {
  return value ? format(value, "yyyy-MM-dd") : "";
}

export function toDateTimeInputValue(value: Date | null | undefined): string {
  return value ? format(value, "yyyy-MM-dd'T'HH:mm") : "";
}

type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  return typeof value === "string" ? new Date(value) : value;
}

export function formatDate(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatRelative(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

export function isOverdue(value: DateInput): boolean {
  const d = toDate(value);
  if (!d) return false;
  return d.getTime() < Date.now();
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
