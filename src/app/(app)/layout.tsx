import Link from "next/link";
import { canManage, isHrOrAdmin, requireSession } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/utils";

// Les pages de l'application dépendent de la session et de l'heure courante :
// rendu à la requête (voir requireSession, qui appelle `connection()`).
export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  const items: NavItem[] = [
    { href: "/", label: "Tableau de bord" },
    { href: "/pointage", label: "Pointage" },
    { href: "/conges", label: "Mes congés" },
    { href: "/calendrier", label: "Calendrier" },
  ];
  if (canManage(session.membership.role)) {
    items.push({ href: "/validations", label: "Validations" });
  }
  if (isHrOrAdmin(session.membership.role)) {
    items.push({ href: "/equipe", label: "Équipe" });
    items.push({ href: "/parametres", label: "Paramètres RH" });
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="no-print border-b border-slate-200 bg-white lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="px-4 py-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            Gereo<span className="text-blue-600">Times</span>
          </Link>
        </div>

        <div className="px-3 pb-4">
          <p className="mb-2 truncate px-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            {session.organization.name}
          </p>
          <NavLinks items={items} />
        </div>

        <div className="border-t border-slate-100 px-4 py-4 lg:mt-auto">
          <p className="truncate text-sm font-medium text-slate-900">
            {session.profile.full_name ?? session.email}
          </p>
          <p className="text-xs text-slate-500">
            {ROLE_LABELS[session.membership.role] ?? session.membership.role}
          </p>
          <form action={signOut} className="mt-3">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Se déconnecter
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
