-- =============================================================================
-- GereoTimes — Migration 0006 : calendrier d'équipe
--
-- Les congés approuvés doivent être visibles par l'équipe (disponibilités),
-- mais un employé ne peut pas lire la table leave_requests de ses collègues —
-- et ne doit surtout pas voir les motifs ni les justificatifs.
--
-- On expose donc une projection dédiée : identité, dates et type de congé,
-- JAMAIS le motif. La vue s'exécute avec les droits de son propriétaire (donc
-- hors RLS) mais filtre explicitement sur les organisations de l'appelant.
-- =============================================================================

create or replace view public.team_absences
with (security_invoker = off) as
select
  lr.organization_id,
  lr.member_id,
  coalesce(p.full_name, p.email) as member_name,
  lr.leave_type_id,
  lt.name                        as leave_type_name,
  lt.color                       as leave_type_color,
  lr.start_date,
  lr.end_date,
  lr.start_half,
  lr.end_half,
  lr.total_days
from public.leave_requests lr
join public.organization_members om on om.id = lr.member_id
join public.profiles p            on p.id = om.user_id
join public.leave_types lt        on lt.id = lr.leave_type_id
where lr.status = 'approved'
  -- Garde-fou : même hors RLS, on ne sort jamais de l'organisation de l'appelant.
  and public.is_org_member(lr.organization_id);

comment on view public.team_absences is
  'Absences approuvées visibles par l''équipe. Projette délibérément un sous-ensemble : le motif (leave_requests.reason) n''est jamais exposé.';

-- Le motif ne doit être atteignable par aucun chemin depuis cette vue.
revoke all on public.team_absences from anon;
grant select on public.team_absences to authenticated, service_role;
