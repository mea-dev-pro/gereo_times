-- =============================================================================
-- GereoTimes — Migration 0007 : envoi des notifications par email
--
-- La table notifications devient une boîte d'envoi : les RPC métier y déposent
-- les messages, un traitement séparé les expédie puis marque leur état. Le
-- journal garde la trace d'un échec, ce qui rend les envois réessayables.
-- =============================================================================

alter table public.notifications
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error   text;

-- File d'attente : les plus anciennes non expédiées d'abord
create index if not exists notifications_outbox_idx
  on public.notifications (created_at)
  where email_sent_at is null;

comment on column public.notifications.email_sent_at is
  'Date d''expédition par email. NULL = encore en file d''attente.';
comment on column public.notifications.email_error is
  'Dernière erreur d''expédition. Renseignée, elle sort la ligne de la file.';

-- Le tableau de bord affiche le compteur de non-lues : on l'allège d'un index
-- déjà présent (notifications_unread_idx) — rien à ajouter ici.
