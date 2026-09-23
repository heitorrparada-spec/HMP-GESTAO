"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/PersonChip";
import { roleMeta } from "@/lib/labels";
import { ACTOR_COOKIE } from "@/lib/actor-cookie";
import type { Person, RoleName } from "@/generated/prisma/client";

export function UserSwitcher({
  people,
  currentId,
}: {
  people: Pick<Person, "id" | "name" | "role">[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Mostra a pessoa escolhida na hora: no deploy, o refresh do servidor leva alguns segundos e,
  // sem retorno visual, a troca parecia não ter funcionado.
  const [shownId, setShownId] = useOptimistic(currentId);
  const current = people.find((p) => p.id === shownId) ?? null;

  function select(id: string) {
    document.cookie = `${ACTOR_COOKIE}=${id}; path=/; max-age=31536000`;
    setOpen(false);
    startTransition(() => {
      setShownId(id);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-slate-100"
      >
        {current ? (
          <Avatar name={current.name} role={current.role} />
        ) : (
          <span className="h-7 w-7 rounded-full bg-slate-200" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">
            {current ? current.name : "Selecionar usuário"}
          </span>
          <span className="block truncate text-xs text-ink-faint">
            {isPending ? "Trocando…" : current ? roleMeta[current.role as RoleName].short : "Atuando como…"}
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-lg border border-border bg-surface p-1 shadow-card">
          <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Atuando como
          </p>
          {people.length === 0 && (
            <p className="px-2 pb-1.5 text-sm text-ink-muted">Nenhuma pessoa cadastrada — rode o seed (ver README).</p>
          )}
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              disabled={isPending}
              onClick={() => select(person.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              <Avatar name={person.name} role={person.role} size="sm" />
              <span className="flex-1 truncate">{person.name}</span>
              {person.id === currentId && <span className="text-brand">•</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
