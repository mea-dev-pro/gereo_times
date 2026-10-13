import Link from "next/link";
import { canManage, isHrOrAdmin, requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import {
  NavLinks,
  type NavGroup,
  type NavItem,
} from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
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
  const supabase = await createClient();

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("member_id", session.membership.id)
    .is("read_at", null);

  // Groupes de navigation, filtrés par rôle.
  // Masquer une entrée n'est PAS une protection : chaque page et chaque
  // server action revérifie le rôle côté serveur.
  const groups: NavGroup[] = [
    {
      title: "Mon espace",
      items: [
        { key: "dashboard", href: "/", label: "Tableau de bord" },
        { key: "pointage", href: "/pointage", label: "Pointage" },
        { key: "conges", href: "/conges", label: "Mes congés" },
        { key: "calendrier", href: "/calendrier", label: "Calendrier" },
        {
          key: "notifications",
          href: "/notifications",
          label: "Notifications",
          badge: unreadCount ?? 0,
        },
      ],
    },
  ];

  const management: NavItem[] = [];
  if (canManage(session.membership.role)) {
    management.push({
      key: "validations",
      href: "/validations",
      label: "Validations",
    });
  }
  if (management.length > 0) {
    groups.push({ title: "Management", items: management });
  }

  const administration: NavItem[] = [];
  if (isHrOrAdmin(session.membership.role)) {
    administration.push({ key: "equipe", href: "/equipe", label: "Équipe" });
    administration.push({
      key: "rapports",
      href: "/rapports",
      label: "Rapports RH",
    });
    administration.push({
      key: "parametres",
      href: "/parametres",
      label: "Paramètres RH",
    });
  }
  if (administration.length > 0) {
    groups.push({ title: "Administration", items: administration });
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="no-print border-b border-border bg-surface lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="px-5 pb-2 pt-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-content"
          >
            Gereo<span className="text-brand-strong">Times</span>
          </Link>
          <p className="mt-1 truncate text-xs font-medium text-content-subtle">
            {session.organization.name}
          </p>
        </div>

        <NavLinks groups={groups} />

        <div className="border-t border-border px-4 py-4 lg:mt-auto">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-content">
                {session.profile.full_name ?? session.email}
              </p>
              <p className="text-xs text-content-muted">
                {ROLE_LABELS[session.membership.role] ??
                  session.membership.role}
              </p>
            </div>
            <ThemeToggle />
          </div>

          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Se déconnecter
            </Button>
          </form>
        </div>
      </aside>

        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
    </ToastProvider>
  );
}
