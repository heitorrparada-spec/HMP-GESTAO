import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isDatabaseEmpty } from "@/lib/seed-data";
import { getCurrentActorId } from "@/lib/actor";
import { NavLink } from "@/components/layout/NavLink";
import { UserSwitcher } from "@/components/layout/UserSwitcher";
import { Icon } from "@/components/ui/Icon";

const navItems = [
  { href: "/", icon: "dashboard" as const, label: "Dashboard" },
  { href: "/products", icon: "product" as const, label: "Products" },
  { href: "/releases", icon: "release" as const, label: "Releases" },
  { href: "/features", icon: "feature" as const, label: "Features" },
  { href: "/tasks", icon: "task" as const, label: "Tasks" },
  { href: "/meetings", icon: "meeting" as const, label: "Meetings" },
  { href: "/decisions", icon: "decision" as const, label: "Decisions" },
  { href: "/artifacts", icon: "artifact" as const, label: "Artifacts" },
  { href: "/validations", icon: "validation" as const, label: "Validations" },
  { href: "/activity", icon: "activity" as const, label: "Activity" },
];

export async function Sidebar() {
  const [people, currentId] = await Promise.all([
    prisma.person.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    getCurrentActorId(),
  ]);
  const canLoadDemo = people.length === 0 && (await isDatabaseEmpty(prisma));

  return (
    // sticky + dvh: o seletor de usuário fica sempre visível. Com h-screen (100vh), no celular a base da
    // barra ficava por baixo da barra do navegador, e em páginas longas ela rolava para fora da tela.
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">
          H
        </span>
        <div>
          <p className="text-sm font-semibold leading-none text-ink">HMP OS</p>
          <p className="mt-0.5 text-[11px] leading-none text-ink-faint">Protótipo v0.1</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Workspace
          </p>
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <div className="space-y-1 border-t border-border px-3 py-3">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
        >
          <Icon name="settings" className="h-4 w-4" />
          Settings
        </Link>
        <UserSwitcher people={people} currentId={currentId} canLoadDemo={canLoadDemo} />
      </div>
    </aside>
  );
}
