import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/alert";
import { cn, formatDateTime } from "@/lib/utils";
import { MarkAllReadButton, MarkReadButton } from "./actions-ui";

export const metadata: Metadata = { title: "Notifications" };

// Page bloquante : elle lit la session à chaque requête.
export const instant = false;

const KIND_LABELS: Record<string, string> = {
  "leave.requested": "Demande à valider",
  "leave.approved": "Demande approuvée",
  "leave.rejected": "Demande refusée",
  "adjustment.approved": "Correction acceptée",
  "adjustment.rejected": "Correction refusée",
  "member.joined": "Nouveau collaborateur",
};

const KIND_TONES: Record<string, "brand" | "success" | "danger" | "warning" | "info"> =
  {
    "leave.requested": "warning",
    "leave.approved": "success",
    "leave.rejected": "danger",
    "adjustment.approved": "success",
    "adjustment.rejected": "danger",
    "member.joined": "info",
  };

export default async function NotificationsPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("member_id", session.membership.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const list = notifications ?? [];
  const unread = list.filter((n) => n.read_at === null).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-content-muted">
            {unread > 0
              ? `${unread} non lue(s) sur ${list.length}`
              : `${list.length} notification(s), toutes lues`}
          </p>
        </div>
        <MarkAllReadButton count={unread} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Fil d&apos;activité</CardTitle>
          <CardDescription>
            Demandes de congé, décisions et corrections de pointage qui vous
            concernent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {list.length === 0 ? (
            <EmptyState
              title="Aucune notification"
              description="Vous serez averti ici des demandes et décisions qui vous concernent."
            />
          ) : (
            list.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-lg border px-3 py-3",
                  n.read_at === null
                    ? "border-blue-200 bg-blue-50/40"
                    : "border-transparent"
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND_TONES[n.kind] ?? "neutral"}>
                      {KIND_LABELS[n.kind] ?? n.kind}
                    </Badge>
                    {n.read_at === null && (
                      <span className="text-xs font-medium text-blue-700">
                        non lue
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-content">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="mt-0.5 text-sm text-content-muted">{n.body}</p>
                  )}
                  <p className="mt-1 text-xs text-content-subtle">
                    {formatDateTime(n.created_at)}
                  </p>
                </div>

                {n.read_at === null ? (
                  <MarkReadButton id={n.id} link={n.link} />
                ) : (
                  n.link && (
                    <Link
                      href={n.link}
                      className="shrink-0 text-xs font-medium text-content-muted hover:text-content hover:underline"
                    >
                      Ouvrir
                    </Link>
                  )
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
