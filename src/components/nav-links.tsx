"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Clock,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Une entrée de navigation est désignée par une CLÉ, pas par un composant :
 * un composant d'icône n'est pas sérialisable du serveur vers le client.
 * La correspondance clé → icône vit donc ici, côté client.
 */
export type NavKey =
  | "dashboard"
  | "pointage"
  | "conges"
  | "calendrier"
  | "notifications"
  | "validations"
  | "equipe"
  | "rapports"
  | "parametres";

const ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  pointage: Clock,
  conges: CalendarDays,
  calendrier: CalendarRange,
  notifications: Bell,
  validations: ClipboardCheck,
  equipe: Users,
  rapports: BarChart3,
  parametres: Settings,
};

export type NavItem = { key: NavKey; href: string; label: string; badge?: number };
export type NavGroup = { title?: string; items: NavItem[] };

export function NavLinks({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="flex flex-col gap-5 px-3 pb-4"
    >
      {groups.map((group, i) => (
        <div key={group.title ?? `groupe-${i}`}>
          {group.title ? (
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-content-subtle">
              {group.title}
            </p>
          ) : null}

          <div className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = ICONS[item.key];

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-surface text-brand-strong shadow-sm ring-1 ring-border dark:bg-white/10 dark:ring-white/10"
                      : "text-content-muted hover:bg-surface hover:text-content dark:hover:bg-white/5"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-brand" : "text-content-subtle"
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>

                  {item.badge ? (
                    <span
                      className="rounded-full bg-brand-strong px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
                      aria-label={`${item.badge} non lue(s)`}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
