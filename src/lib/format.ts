import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
