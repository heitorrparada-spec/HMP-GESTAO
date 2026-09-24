import { format } from "date-fns";
import type { Change, ChangeValue, PersonRef } from "@/lib/history/types";

type Input = ChangeValue | Date | undefined;

/** Data de negócio (prazo, data da decisão): um dia, sem hora — no fuso do servidor, como o formulário. */
export function dateOnly(value: Date | null | undefined): string | null {
  return value ? format(value, "yyyy-MM-dd") : null;
}

function normalize(value: Input): ChangeValue {
  if (value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  // Textos gravados antes da normalização podem ter "\r\n": a mesma quebra de linha não é mudança.
  if (typeof value === "string") return value.replace(/\r\n?/g, "\n");
  return value;
}

function sameValue(a: ChangeValue, b: ChangeValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Linha de mudança de um campo, ou null se o valor não mudou. */
export function fieldChange(
  field: string,
  from: Input,
  to: Input,
  labels?: { from?: string | null; to?: string | null },
): Change | null {
  const a = normalize(from);
  const b = normalize(to);
  if (sameValue(a, b)) return null;
  return { field, from: a, to: b, fromLabel: labels?.from ?? null, toLabel: labels?.to ?? null };
}

/** Participantes: compara pelos ids; guarda nomes junto, para o histórico ler "quem entrou / quem saiu". */
export function peopleChange(field: string, from: PersonRef[], to: PersonRef[]): Change | null {
  const sort = (list: PersonRef[]) => [...list].sort((x, y) => x.id.localeCompare(y.id));
  const a = sort(from);
  const b = sort(to);
  if (sameValue(a.map((p) => p.id), b.map((p) => p.id))) return null;
  return {
    field,
    from: a.map((p) => ({ id: p.id, name: p.name })),
    to: b.map((p) => ({ id: p.id, name: p.name })),
    fromLabel: a.map((p) => p.name).join(", ") || null,
    toLabel: b.map((p) => p.name).join(", ") || null,
  };
}

export function compact(items: Array<Change | null>): Change[] {
  return items.filter((c): c is Change => c !== null);
}
