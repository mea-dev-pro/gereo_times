-- =============================================================================
-- GereoTimes — Migration 0008 : acquisition des congés planifiée
--
-- L'acquisition mensuelle n'était déclenchable que depuis l'application : la
-- fonction `accrue_leave` exige un rôle RH ou administrateur, donc un appelant
-- authentifié. Aucune tâche planifiée ne pouvait donc l'appeler — une fonction
-- serveur ne porte pas de rôle dans l'organisation.
--
-- Cette migration sépare le calcul de son autorisation :
--
--   accrue_leave_apply      le calcul, sans contrôle de rôle — non exposé
--   accrue_leave            inchangé vu de l'application : contrôle de rôle,
--                           puis calcul (même signature, mêmes effets)
--   run_scheduled_accrual   le déclenchement planifié : toutes les
--                           organisations, chacune dans son propre fuseau
--
-- Les deux premières fonctions restent réservées : `run_scheduled_accrual`
-- n'est exécutable que par le rôle de service (voir les REVOKE en fin de
-- fichier), donc jamais depuis le navigateur, même avec une session valide.
--
-- Idempotence : la référence déterministe de chaque écriture (md5 de
-- organisation + membre + type + période) et l'index unique
-- `leave_ledger_one_accrual_per_ref_idx` garantissent qu'un appel rejoué
-- n'écrit rien. Un déclenchement quotidien est donc sans risque, ce qui rend
-- l'acquisition insensible à une journée manquée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Le calcul, sans contrôle de rôle
-- -----------------------------------------------------------------------------
-- `p_respecter_frequence` distingue les deux usages :
--   - appel manuel depuis l'application (faux) : la période demandée est
--     créditée telle quelle, à l'appelant de savoir ce qu'il fait ;
--   - appel planifié (vrai) : seules les politiques dont la fréquence tombe
--     juste sur la période sont créditées — sinon une politique trimestrielle
--     de 5 jours serait créditée 5 jours chaque mois.
create or replace function public.accrue_leave_apply(
  p_organization_id    uuid,
  p_period_start       date,
  p_period_end         date,
  p_actor_user_id      uuid,
  p_actor_member_id    uuid,
  p_respecter_frequence boolean default false
) returns integer
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_count int := 0;
  r       record;
  v_ref   uuid;
begin
  for r in
    select m.id as member_id, lp.leave_type_id, lp.accrual_amount
    from public.organization_members m
    join public.leave_policies lp
      on lp.organization_id = m.organization_id
     and lp.accrual_frequency <> 'none'
     and lp.accrual_amount > 0
     and lp.effective_from <= p_period_end
     and (lp.effective_to is null or lp.effective_to >= p_period_start)
     and (
       not p_respecter_frequence
       or case lp.accrual_frequency
            when 'quarterly' then extract(month from p_period_end) in (3, 6, 9, 12)
            when 'yearly'    then extract(month from p_period_end) = 12
            else true
          end
     )
    where m.organization_id = p_organization_id
      and m.status = 'active'
  loop
    -- Référence déterministe : rend l'appel idempotent
    v_ref := md5(
      p_organization_id::text || r.member_id::text || r.leave_type_id::text ||
      p_period_start::text || p_period_end::text
    )::uuid;

    insert into public.leave_ledger
      (organization_id, member_id, leave_type_id, movement, amount,
       effective_date, reference_type, reference_id, note, created_by)
    values
      (p_organization_id, r.member_id, r.leave_type_id, 'accrual', r.accrual_amount,
       p_period_end, 'accrual_period', v_ref,
       'Acquisition ' || to_char(p_period_start, 'MM/YYYY'), p_actor_user_id)
    on conflict do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, after)
  values
    (p_organization_id, p_actor_user_id, p_actor_member_id,
     'leave.accrual_run', 'leave_ledger',
     jsonb_build_object('period_start', p_period_start, 'period_end', p_period_end,
                        'entries', v_count,
                        'source', case when p_respecter_frequence
                                       then 'planifiee' else 'manuelle' end));

  return v_count;
end $$;

comment on function public.accrue_leave_apply(uuid, date, date, uuid, uuid, boolean) is
  'Calcul de l''acquisition pour une période. Sans contrôle de rôle : réservé à accrue_leave et run_scheduled_accrual.';

-- -----------------------------------------------------------------------------
-- 2. accrue_leave — inchangé pour l'application
-- -----------------------------------------------------------------------------
create or replace function public.accrue_leave(
  p_organization_id uuid,
  p_period_start    date,
  p_period_end      date
) returns integer
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if not public.is_hr_or_admin(p_organization_id) then
    raise exception 'Réservé aux RH et administrateurs' using errcode = '42501';
  end if;

  return public.accrue_leave_apply(
    p_organization_id, p_period_start, p_period_end,
    auth.uid(), public.current_member_id(p_organization_id), false
  );
end $$;

-- -----------------------------------------------------------------------------
-- 3. Le déclenchement planifié
-- -----------------------------------------------------------------------------
-- Période créditée : le mois qui vient de s'achever dans le fuseau de chaque
-- organisation (acquisition due au début du mois suivant). L'appel étant
-- idempotent, la tâche peut tourner tous les jours : elle rattrape alors une
-- journée manquée sans jamais créditer deux fois.
--
-- Une organisation dont le fuseau serait invalide n'interrompt pas les autres :
-- son échec est rapporté dans le résultat.
create or replace function public.run_scheduled_accrual(
  p_now timestamptz default now()
) returns jsonb
language plpgsql security definer
set search_path = public, auth
as $$
declare
  r                record;
  v_local          date;
  v_periode_fin    date;
  v_periode_debut  date;
  v_entrees        int;
  v_resultats      jsonb := '[]'::jsonb;
begin
  for r in select id, name, timezone from public.organizations order by name loop
    begin
      v_local := (p_now at time zone coalesce(r.timezone, 'Indian/Antananarivo'))::date;
      v_periode_fin := (date_trunc('month', v_local::timestamp) - interval '1 day')::date;
      v_periode_debut := date_trunc('month', v_periode_fin::timestamp)::date;

      v_entrees := public.accrue_leave_apply(
        r.id, v_periode_debut, v_periode_fin, null, null, true
      );

      v_resultats := v_resultats || jsonb_build_object(
        'organization_id', r.id,
        'organization',    r.name,
        'period_start',    v_periode_debut,
        'period_end',      v_periode_fin,
        'entries',         v_entrees
      );
    exception when others then
      v_resultats := v_resultats || jsonb_build_object(
        'organization_id', r.id,
        'organization',    r.name,
        'error',           sqlerrm
      );
    end;
  end loop;

  return jsonb_build_object('ran_at', p_now, 'organizations', v_resultats);
end $$;

comment on function public.run_scheduled_accrual(timestamptz) is
  'Acquisition du mois écoulé pour toutes les organisations, chacune dans son fuseau. Idempotent : appelable tous les jours.';

-- -----------------------------------------------------------------------------
-- 4. Privilèges : ces deux fonctions ne sortent pas du serveur
-- -----------------------------------------------------------------------------
-- Supabase accorde EXECUTE à anon et authenticated par défaut sur les fonctions
-- de `public` : le REVOKE explicite est la seule façon de fermer l'accès. Le
-- rôle de service reste le seul à pouvoir déclencher l'acquisition, ce qui
-- interdit de la provoquer depuis un navigateur, même authentifié.
revoke all on function public.accrue_leave_apply(uuid, date, date, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.accrue_leave_apply(uuid, date, date, uuid, uuid, boolean)
  to service_role;

revoke all on function public.run_scheduled_accrual(timestamptz)
  from public, anon, authenticated;
grant execute on function public.run_scheduled_accrual(timestamptz)
  to service_role;
