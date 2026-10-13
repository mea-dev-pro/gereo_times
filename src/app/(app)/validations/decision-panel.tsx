"use client";

import { useRef, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { decideLeaveRequest } from "@/lib/actions/leave";
import { decideAdjustment } from "@/lib/actions/time";
import type { ActionState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogPanel } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

/**
 * Décision sur une demande en attente.
 *
 * Le refus passe par une confirmation : il est motivé par un commentaire et
 * difficile à défaire, contrairement à l'approbation qui suit le cours normal.
 * Les deux boutons sont désactivés pendant le traitement, ce qui empêche une
 * double soumission si l'on clique deux fois.
 */
export function DecisionPanel({
  id,
  kind,
}: {
  id: string;
  kind: "leave" | "adjustment";
}) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const confirmation = useRef<HTMLDialogElement>(null);
  const { notifier } = useToast();

  function decide(approuver: boolean) {
    startTransition(async () => {
      const res: ActionState =
        kind === "leave"
          ? await decideLeaveRequest(id, approuver, comment)
          : await decideAdjustment(id, approuver, comment);

      if (res?.error) {
        setErreur(res.error);
        notifier({ titre: res.error, ton: "danger" });
      } else if (res?.success) {
        setErreur(null);
        // Le rechargement retire la ligne de la liste : la notification est ce
        // qui reste visible une fois qu'elle a disparu.
        notifier({
          titre: res.success,
          description: approuver ? "La demande est traitée." : "La demande est refusée.",
          ton: approuver ? "success" : "info",
        });
      }
    });
  }

  const motifManquant = comment.trim().length === 0;

  return (
    <div className="space-y-2">
      {erreur && <Alert variant="danger">{erreur}</Alert>}

      <Input
        placeholder="Commentaire (obligatoire en cas de refus)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={300}
        disabled={pending}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          size="sm"
          disabled={pending}
          onClick={() => decide(true)}
        >
          <Check className="size-3.5" aria-hidden="true" />
          {pending ? "…" : "Approuver"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={pending || motifManquant}
          onClick={() => confirmation.current?.showModal()}
          title={motifManquant ? "Un motif de refus est requis" : undefined}
        >
          <X className="size-3.5" aria-hidden="true" />
          Refuser
        </Button>
      </div>

      <DialogPanel
        ref={confirmation}
        title="Confirmer le refus"
        description="Le motif sera transmis au collaborateur."
      >
        <div className="space-y-4">
          <p className="rounded-control bg-surface-muted px-4 py-3 text-sm italic text-content">
            « {comment} »
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => confirmation.current?.close()}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              className="w-full sm:w-auto"
              onClick={() => {
                confirmation.current?.close();
                decide(false);
              }}
            >
              Confirmer le refus
            </Button>
          </div>
        </div>
      </DialogPanel>
    </div>
  );
}
