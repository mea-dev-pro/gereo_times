-- =============================================================================
-- GereoTimes — Migration 0003 : logique métier (RPC transactionnelles)
-- Toutes les écritures sensibles passent par ces fonctions SECURITY DEFINER,
-- jamais par le client.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Index d'idempotence : une seule écriture d'acquisition par période
-- -----------------------------------------------------------------------------
create unique index if not exists leave_ledger_one_accrual_per_ref_idx
  on public.leave_ledger (reference_type, reference_id)
  where movement = 'accrual';

-- =============================================================================
-- 1. CALENDRIER ET JOURS OUVRÉS
-- =============================================================================

-- Un jour est ouvré s'il figure au calendrier de travail du membre
-- et n'est pas un jour férié de l'organisation.
create or replace function public.is_working_day(
  p_organization_id uuid,
  p_member_id       uuid,
  p_date            date
) returns boolean
language plpgsql stable security definer
set search_path = public, auth
as $$
declare
  v_pattern jsonb;
  v_dows    text[] := array['sun','mon','tue','wed','thu','fri','sat'];
  v_key     text;
begin
  select coalesce(ws.weekly_pattern, '{}'::jsonb)
    into v_pattern
  from public.organization_members m
  left join public.work_schedules ws on ws.id = m.work_schedule_id
  where m.id = p_member_id
    and m.organization_id = p_organization_id;

  -- Aucun calendrier défini : semaine standard lundi-vendredi
  if v_pattern is null or v_pattern = '{}'::jsonb then
    v_pattern := '{"mon":{},"tue":{},"wed":{},"thu":{},"fri":{}}'::jsonb;
  end if;

  v_key := v_dows[extract(dow from p_date)::int + 1];

  if not (v_pattern ? v_key) or (v_pattern -> v_key) = 'null'::jsonb then
    return false;
  end if;

  return not exists (
    select 1 from public.holidays h
    where h.organization_id = p_organization_id
      and h.holiday_date = p_date
  );
end $$;

-- Nombre de jours ouvrés sur une période, demi-journées comprises.
create or replace function public.compute_leave_days(
  p_organization_id uuid,
  p_member_id       uuid,
  p_start           date,
  p_end             date,
  p_start_half      half_day default null,
  p_end_half        half_day default null
) returns numeric
language plpgsql stable security definer
set search_path = public, auth
as $$
declare
  v_day   date;
  v_total numeric := 0;
begin
  if p_end < p_start then
    raise exception 'La date de fin doit être postérieure ou égale à la date de début'
      using errcode = '23514';
  end if;

  v_day := p_start;
  while v_day <= p_end loop
    if public.is_working_day(p_organization_id, p_member_id, v_day) then
      if v_day = p_start and p_start_half is not null then
        v_total := v_total + 0.5;
      elsif v_day = p_end and p_end_half is not null then
        v_total := v_total + 0.5;
      else
        v_total := v_total + 1;
      end if;
    end if;
    v_day := v_day + 1;
  end loop;

  return v_total;
end $$;

-- Solde disponible = somme signée du journal des mouvements.
create or replace function public.leave_available_days(
  p_organization_id uuid,
  p_member_id       uuid,
  p_leave_type_id   uuid
) returns numeric
language sql stable security definer
set search_path = public, auth
as $$
  select coalesce(sum(amount), 0)::numeric
  from public.leave_ledger
  where organization_id = p_organization_id
    and member_id       = p_member_id
    and leave_type_id   = p_leave_type_id
$$;

-- =============================================================================
-- 2. AMORÇAGE : création d'une organisation et de son administrateur
-- =============================================================================
create or replace function public.create_organization(
  p_name         text,
  p_slug         text,
  p_country_code char(2) default 'MG',
  p_timezone     text    default 'Indian/Antananarivo',
  p_locale       text    default 'fr'
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_user        uuid := auth.uid();
  v_org_id      uuid;
  v_schedule_id uuid;
  v_member_id   uuid;
  v_show_name   text;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Profil introuvable — complétez votre inscription' using errcode = 'P0002';
  end if;

  insert into public.organizations (name, slug, country_code, timezone, locale)
  values (btrim(p_name), lower(btrim(p_slug)), p_country_code, p_timezone, p_locale)
  returning id into v_org_id;

  insert into public.work_schedules
    (organization_id, name, timezone, weekly_pattern, daily_hours, break_minutes, is_default)
  values (
    v_org_id, 'Standard 40h', p_timezone,
    '{"mon":{"start":"08:00","end":"17:00","break_minutes":60},
      "tue":{"start":"08:00","end":"17:00","break_minutes":60},
      "wed":{"start":"08:00","end":"17:00","break_minutes":60},
      "thu":{"start":"08:00","end":"17:00","break_minutes":60},
      "fri":{"start":"08:00","end":"17:00","break_minutes":60}}'::jsonb,
    8.00, 60, true
  )
  returning id into v_schedule_id;

  insert into public.organization_members
    (organization_id, user_id, role, status, work_schedule_id, timezone)
  values (v_org_id, v_user, 'admin', 'active', v_schedule_id, p_timezone)
  returning id into v_member_id;

  -- Types de congés par défaut
  insert into public.leave_types
    (organization_id, code, name, is_paid, requires_justification, color)
  values
    (v_org_id, 'ANNUAL',   'Congé annuel',       true,  false, '#2563eb'),
    (v_org_id, 'SICK',     'Congé maladie',      true,  true,  '#dc2626'),
    (v_org_id, 'UNPAID',   'Congé sans solde',   false, false, '#6b7280'),
    (v_org_id, 'SPECIAL',  'Congé exceptionnel', true,  true,  '#7c3aed'),
    (v_org_id, 'PARENTAL', 'Congé parental',     true,  true,  '#059669');

  -- Politiques par défaut : 2,5 j/mois pour l'annuel (30 j/an), 0 pour les autres
  insert into public.leave_policies
    (organization_id, leave_type_id, name, accrual_frequency, accrual_amount, approval_levels)
  select
    v_org_id,
    lt.id,
    'Politique par défaut',
    'monthly',
    case when lt.code = 'ANNUAL' then 2.5 else 0 end,
    1
  from public.leave_types lt
  where lt.organization_id = v_org_id;

  -- Jours fériés courants (Madagascar) — ajustables par les RH
  insert into public.holidays (organization_id, name, holiday_date, is_recurring, country_code)
  values
    (v_org_id, 'Nouvel An',              make_date(extract(year from current_date)::int, 1, 1),  true,  p_country_code),
    (v_org_id, 'Fête du Travail',        make_date(extract(year from current_date)::int, 5, 1),  true,  p_country_code),
    (v_org_id, 'Fête de l''Indépendance',make_date(extract(year from current_date)::int, 6, 26), true,  p_country_code),
    (v_org_id, 'Assomption',             make_date(extract(year from current_date)::int, 8, 15), true,  p_country_code),
    (v_org_id, 'Noël',                   make_date(extract(year from current_date)::int, 12, 25),true,  p_country_code);

  select coalesce(full_name, email) into v_show_name from public.profiles where id = v_user;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, entity_id, after)
  values
    (v_org_id, v_user, v_member_id, 'organization.created', 'organization', v_org_id,
     jsonb_build_object('name', p_name, 'slug', p_slug, 'created_by', v_show_name));

  return v_org_id;
end $$;

-- =============================================================================
-- 3. POINTAGE
-- =============================================================================

create or replace function public.clock_in(p_organization_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_member uuid := public.current_member_id(p_organization_id);
  v_tz     text;
  v_now    timestamptz := now();
  v_id     uuid;
begin
  if v_member is null then
    raise exception 'Accès refusé à cette organisation' using errcode = '42501';
  end if;

  if exists (select 1 from public.time_entries
             where member_id = v_member and clock_out is null) then
    raise exception 'Une session de pointage est déjà ouverte'
      using errcode = '23505';
  end if;

  select coalesce(m.timezone, o.timezone) into v_tz
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.id = v_member;

  insert into public.time_entries
    (organization_id, member_id, work_date, clock_in, status, source)
  values
    (p_organization_id, v_member, (v_now at time zone v_tz)::date, v_now, 'open', 'clock')
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.clock_out(
  p_organization_id uuid,
  p_note            text default null
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_member  uuid := public.current_member_id(p_organization_id);
  v_entry   public.time_entries;
  v_now     timestamptz := now();
  v_break   int := 0;
  v_worked  int;
  v_planned int;
begin
  if v_member is null then
    raise exception 'Accès refusé à cette organisation' using errcode = '42501';
  end if;

  select * into v_entry
  from public.time_entries
  where member_id = v_member and clock_out is null
  for update;

  if v_entry.id is null then
    raise exception 'Aucune session de pointage ouverte' using errcode = 'P0002';
  end if;

  -- Clôture automatique d'une pause restée ouverte
  update public.break_entries
     set ended_at = v_now,
         minutes  = greatest(0, floor(extract(epoch from (v_now - started_at)) / 60)::int)
   where time_entry_id = v_entry.id
     and ended_at is null;

  select coalesce(sum(minutes), 0) into v_break
  from public.break_entries
  where time_entry_id = v_entry.id;

  v_worked := greatest(
    0,
    floor(extract(epoch from (v_now - v_entry.clock_in)) / 60)::int - v_break
  );

  select round(coalesce(ws.daily_hours, 8) * 60)::int into v_planned
  from public.organization_members m
  left join public.work_schedules ws on ws.id = m.work_schedule_id
  where m.id = v_member;

  update public.time_entries
     set clock_out         = v_now,
         break_minutes     = v_break,
         worked_minutes    = v_worked,
         effective_minutes = v_worked,
         planned_minutes   = v_planned,
         variance_minutes  = v_worked - coalesce(v_planned, 0),
         status            = 'closed',
         notes             = coalesce(p_note, notes)
   where id = v_entry.id;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, entity_id, after)
  values
    (p_organization_id, auth.uid(), v_member, 'time_entry.closed', 'time_entry', v_entry.id,
     jsonb_build_object('worked_minutes', v_worked, 'break_minutes', v_break));

  return v_entry.id;
end $$;

create or replace function public.start_break(
  p_organization_id uuid,
  p_kind            break_kind default 'unpaid'
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_member uuid := public.current_member_id(p_organization_id);
  v_entry  uuid;
  v_id     uuid;
begin
  if v_member is null then
    raise exception 'Accès refusé à cette organisation' using errcode = '42501';
  end if;

  select id into v_entry from public.time_entries
  where member_id = v_member and clock_out is null;

  if v_entry is null then
    raise exception 'Aucune session de pointage ouverte' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.break_entries
             where time_entry_id = v_entry and ended_at is null) then
    raise exception 'Une pause est déjà en cours' using errcode = '23505';
  end if;

  insert into public.break_entries (organization_id, time_entry_id, started_at, kind)
  values (p_organization_id, v_entry, now(), p_kind)
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.end_break(p_organization_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_member uuid := public.current_member_id(p_organization_id);
  v_id     uuid;
begin
  if v_member is null then
    raise exception 'Accès refusé à cette organisation' using errcode = '42501';
  end if;

  update public.break_entries b
     set ended_at = now(),
         minutes  = greatest(0, floor(extract(epoch from (now() - b.started_at)) / 60)::int)
   where b.ended_at is null
     and b.time_entry_id in (
       select te.id from public.time_entries te
       where te.member_id = v_member and te.clock_out is null
     )
  returning b.id into v_id;

  if v_id is null then
    raise exception 'Aucune pause en cours' using errcode = 'P0002';
  end if;

  return v_id;
end $$;

-- Recalcul des minutes d'une session (utilisé après une correction)
create or replace function public.recalc_time_entry(p_entry_id uuid)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_entry   public.time_entries;
  v_break   int := 0;
  v_worked  int;
  v_planned int;
begin
  select * into v_entry from public.time_entries where id = p_entry_id;
  if v_entry.id is null then
    raise exception 'Session introuvable' using errcode = 'P0002';
  end if;

  select coalesce(sum(minutes), 0) into v_break
  from public.break_entries where time_entry_id = p_entry_id;

  if v_entry.clock_out is null then
    update public.time_entries
       set break_minutes = v_break,
           worked_minutes = null,
           effective_minutes = null,
           status = 'open'
     where id = p_entry_id;
    return;
  end if;

  v_worked := greatest(
    0,
    floor(extract(epoch from (v_entry.clock_out - v_entry.clock_in)) / 60)::int - v_break
  );

  select round(coalesce(ws.daily_hours, 8) * 60)::int into v_planned
  from public.organization_members m
  left join public.work_schedules ws on ws.id = m.work_schedule_id
  where m.id = v_entry.member_id;

  update public.time_entries
     set break_minutes     = v_break,
         worked_minutes    = v_worked,
         effective_minutes = v_worked,
         planned_minutes   = v_planned,
         variance_minutes  = v_worked - coalesce(v_planned, 0),
         status            = (case when status = 'open' then 'corrected' else status::text end)::time_entry_status
   where id = p_entry_id;
end $$;

-- =============================================================================
-- 4. CORRECTIONS DE POINTAGE
-- =============================================================================

create or replace function public.request_time_adjustment(
  p_organization_id uuid,
  p_time_entry_id   uuid,
  p_new_in          timestamptz,
  p_new_out         timestamptz,
  p_reason          text
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_member uuid := public.current_member_id(p_organization_id);
  v_entry  public.time_entries;
  v_id     uuid;
begin
  if v_member is null then
    raise exception 'Accès refusé à cette organisation' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Un motif de correction est obligatoire' using errcode = '23514';
  end if;

  select * into v_entry from public.time_entries
  where id = p_time_entry_id and member_id = v_member;

  if v_entry.id is null then
    raise exception 'Session introuvable' using errcode = 'P0002';
  end if;

  insert into public.time_adjustments
    (organization_id, time_entry_id, member_id, requested_by, reason,
     original_in, original_out, new_in, new_out, status)
  values
    (p_organization_id, p_time_entry_id, v_member, auth.uid(), btrim(p_reason),
     v_entry.clock_in, v_entry.clock_out,
     coalesce(p_new_in, v_entry.clock_in), coalesce(p_new_out, v_entry.clock_out), 'pending')
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.decide_time_adjustment(
  p_adjustment_id uuid,
  p_approve       boolean,
  p_comment       text default null
) returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_adj        public.time_adjustments;
  v_me         uuid;
  v_tz         text;
begin
  select * into v_adj from public.time_adjustments where id = p_adjustment_id for update;

  if v_adj.id is null then
    raise exception 'Demande de correction introuvable' using errcode = 'P0002';
  end if;

  v_me := public.current_member_id(v_adj.organization_id);

  if v_me is null or not public.manages_member(v_adj.member_id) then
    raise exception 'Vous n''êtes pas autorisé à statuer sur cette correction'
      using errcode = '42501';
  end if;

  if v_adj.status <> 'pending' then
    raise exception 'Correction déjà traitée (statut : %)', v_adj.status using errcode = '23514';
  end if;

  if p_approve and v_adj.time_entry_id is not null then
    select coalesce(m.timezone, o.timezone) into v_tz
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.id = v_adj.member_id;

    update public.time_entries
       set clock_in   = coalesce(v_adj.new_in, clock_in),
           clock_out  = coalesce(v_adj.new_out, clock_out),
           status     = 'corrected',
           work_date  = coalesce((v_adj.new_in at time zone v_tz)::date, work_date)
     where id = v_adj.time_entry_id;

    perform public.recalc_time_entry(v_adj.time_entry_id);
  end if;

  update public.time_adjustments
     set status           = (case when p_approve then 'approved' else 'rejected' end)::adjustment_status,
         decided_by       = v_me,
         decided_at       = now(),
         decision_comment = p_comment
   where id = p_adjustment_id;

  insert into public.notifications
    (organization_id, member_id, kind, title, body, link, payload)
  values
    (v_adj.organization_id, v_adj.member_id,
     case when p_approve then 'adjustment.approved' else 'adjustment.rejected' end,
     case when p_approve then 'Correction de pointage acceptée' else 'Correction de pointage refusée' end,
     coalesce(p_comment, ''), '/pointage',
     jsonb_build_object('adjustment_id', p_adjustment_id, 'approved', p_approve));

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, entity_id, after)
  values
    (v_adj.organization_id, auth.uid(), v_me,
     case when p_approve then 'time_adjustment.approved' else 'time_adjustment.rejected' end,
     'time_adjustment', p_adjustment_id,
     jsonb_build_object('comment', p_comment));
end $$;

-- =============================================================================
-- 5. CONGÉS
-- =============================================================================

create or replace function public.submit_leave_request(
  p_organization_id uuid,
  p_leave_type_id   uuid,
  p_start_date      date,
  p_end_date        date,
  p_start_half      half_day default null,
  p_end_half        half_day default null,
  p_reason          text     default null
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_member    uuid := public.current_member_id(p_organization_id);
  v_policy    public.leave_policies;
  v_days      numeric;
  v_available numeric;
  v_id        uuid;
  v_level     int;
  v_manager   uuid;
begin
  if v_member is null then
    raise exception 'Accès refusé à cette organisation' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.leave_types
    where id = p_leave_type_id and organization_id = p_organization_id and active
  ) then
    raise exception 'Type de congé invalide ou inactif' using errcode = '23514';
  end if;

  select * into v_policy
  from public.leave_policies
  where organization_id = p_organization_id
    and leave_type_id   = p_leave_type_id
    and effective_from <= p_start_date
    and (effective_to is null or effective_to >= p_start_date)
  order by effective_from desc
  limit 1;

  if v_policy.id is null then
    raise exception 'Aucune politique de congé applicable à cette date' using errcode = 'P0002';
  end if;

  if v_policy.allow_half_days = false
     and (p_start_half is not null or p_end_half is not null) then
    raise exception 'Les demi-journées ne sont pas autorisées pour ce type de congé'
      using errcode = '23514';
  end if;

  v_days := public.compute_leave_days(
    p_organization_id, v_member, p_start_date, p_end_date, p_start_half, p_end_half
  );

  if v_days <= 0 then
    raise exception 'La période ne contient aucun jour ouvré' using errcode = '23514';
  end if;

  if v_policy.min_notice_days > 0
     and (p_start_date - current_date) < v_policy.min_notice_days then
    raise exception 'Préavis minimum de % jour(s) requis', v_policy.min_notice_days
      using errcode = '23514';
  end if;

  if v_policy.max_consecutive_days is not null
     and (p_end_date - p_start_date + 1) > v_policy.max_consecutive_days then
    raise exception 'Durée maximale de % jour(s) dépassée', v_policy.max_consecutive_days
      using errcode = '23514';
  end if;

  v_available := public.leave_available_days(p_organization_id, v_member, p_leave_type_id);

  if v_policy.allow_negative_balance = false and v_days > v_available then
    raise exception 'Solde insuffisant : % jour(s) demandé(s), % disponible(s)', v_days, v_available
      using errcode = '23514';
  end if;

  insert into public.leave_requests
    (organization_id, member_id, leave_type_id, start_date, end_date,
     start_half, end_half, total_days, business_days, reason, status, submitted_at, created_by)
  values
    (p_organization_id, v_member, p_leave_type_id, p_start_date, p_end_date,
     p_start_half, p_end_half, v_days, v_days, p_reason, 'pending', now(), auth.uid())
  returning id into v_id;

  -- Réservation du solde. Le chevauchement est bloqué par la contrainte
  -- d'exclusion de leave_requests, la double déduction par l'index unique
  -- sur leave_ledger (reference_type, reference_id, leave_type_id).
  insert into public.leave_ledger
    (organization_id, member_id, leave_type_id, movement, amount,
     effective_date, reference_type, reference_id, note, created_by)
  values
    (p_organization_id, v_member, p_leave_type_id, 'reservation', -v_days,
     p_start_date, 'leave_request', v_id, 'Réservation à la soumission', auth.uid());

  select m.manager_id into v_manager
  from public.organization_members m where m.id = v_member;

  for v_level in 1..v_policy.approval_levels loop
    insert into public.leave_approvals
      (organization_id, leave_request_id, level, approver_member_id, status)
    values
      (p_organization_id, v_id, v_level,
       case when v_level = 1 then v_manager else null end, 'pending');
  end loop;

  if v_manager is not null then
    insert into public.notifications
      (organization_id, member_id, kind, title, body, link, payload)
    values
      (p_organization_id, v_manager, 'leave.requested',
       'Nouvelle demande de congé',
       v_days || ' jour(s) du ' || to_char(p_start_date, 'DD/MM/YYYY')
                || ' au ' || to_char(p_end_date, 'DD/MM/YYYY'),
       '/conges/' || v_id,
       jsonb_build_object('leave_request_id', v_id));
  end if;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, entity_id, after)
  values
    (p_organization_id, auth.uid(), v_member, 'leave_request.submitted', 'leave_request', v_id,
     jsonb_build_object('days', v_days, 'start_date', p_start_date, 'end_date', p_end_date));

  return v_id;
end $$;

-- Décision d'un manager. Le verrou FOR UPDATE sur la demande sérialise les
-- validations concurrentes : la seconde voit un statut déjà décidé et échoue.
create or replace function public.decide_leave_request(
  p_request_id uuid,
  p_approve    boolean,
  p_comment    text default null
) returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_req     public.leave_requests;
  v_me      uuid;
  v_level   smallint;
  v_pending int;
begin
  select * into v_req
  from public.leave_requests
  where id = p_request_id
  for update;

  if v_req.id is null then
    raise exception 'Demande introuvable' using errcode = 'P0002';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée (statut : %)', v_req.status
      using errcode = '23514';
  end if;

  v_me := public.current_member_id(v_req.organization_id);

  if v_me is null or not public.manages_member(v_req.member_id) then
    raise exception 'Vous n''êtes pas autorisé à statuer sur cette demande'
      using errcode = '42501';
  end if;

  select min(level) into v_level
  from public.leave_approvals
  where leave_request_id = p_request_id and status = 'pending';

  if v_level is null then
    raise exception 'Aucune étape de validation en attente' using errcode = 'P0002';
  end if;

  update public.leave_approvals
     set status             = (case when p_approve then 'approved' else 'rejected' end)::approval_status,
         approver_member_id = v_me,
         comment            = p_comment,
         decided_at         = now()
   where leave_request_id = p_request_id
     and level            = v_level;

  if not p_approve then
    -- Refus : clôture de la réservation par une écriture inverse (ajout seul)
    if not exists (
      select 1 from public.leave_ledger
      where reference_type = 'leave_request' and reference_id = p_request_id
        and movement = 'reservation'
    ) then
      raise exception 'Réservation introuvable pour cette demande' using errcode = 'P0002';
    end if;

    insert into public.leave_ledger
      (organization_id, member_id, leave_type_id, movement, amount,
       effective_date, reference_type, reference_id, note, created_by)
    select l.organization_id, l.member_id, l.leave_type_id,
           'release', -l.amount, v_req.start_date, 'leave_request', v_req.id,
           concat_ws(' ', 'Libération après refus.', p_comment), auth.uid()
    from public.leave_ledger l
    where l.reference_type = 'leave_request'
      and l.reference_id   = p_request_id
      and l.movement       = 'reservation';

    update public.leave_approvals
       set status = 'skipped'
     where leave_request_id = p_request_id and status = 'pending';

    update public.leave_requests
       set status = 'rejected', decided_at = now()
     where id = p_request_id;

  else
    select count(*) into v_pending
    from public.leave_approvals
    where leave_request_id = p_request_id and status = 'pending';

    if v_pending = 0 then
      -- La réservation est clôturée et la consommation enregistrée, par deux
      -- écritures nouvelles : le journal n'est jamais réécrit.
      if not exists (
        select 1 from public.leave_ledger
        where reference_type = 'leave_request' and reference_id = p_request_id
          and movement = 'reservation'
      ) then
        raise exception 'Réservation introuvable pour cette demande' using errcode = 'P0002';
      end if;

      insert into public.leave_ledger
        (organization_id, member_id, leave_type_id, movement, amount,
         effective_date, reference_type, reference_id, note, created_by)
      select l.organization_id, l.member_id, l.leave_type_id,
             'release', -l.amount, v_req.start_date, 'leave_request', v_req.id,
             'Réservation clôturée par approbation', auth.uid()
      from public.leave_ledger l
      where l.reference_type = 'leave_request'
        and l.reference_id   = p_request_id
        and l.movement       = 'reservation';

      insert into public.leave_ledger
        (organization_id, member_id, leave_type_id, movement, amount,
         effective_date, reference_type, reference_id, note, created_by)
      values
        (v_req.organization_id, v_req.member_id, v_req.leave_type_id,
         'consumption', -v_req.total_days, v_req.start_date, 'leave_request', v_req.id,
         'Consommation après approbation finale', auth.uid());

      update public.leave_requests
         set status = 'approved', decided_at = now()
       where id = p_request_id;
    end if;
  end if;

  insert into public.notifications
    (organization_id, member_id, kind, title, body, link, payload)
  values
    (v_req.organization_id, v_req.member_id,
     case when p_approve then 'leave.approved' else 'leave.rejected' end,
     case when p_approve then 'Demande de congé approuvée' else 'Demande de congé refusée' end,
     coalesce(p_comment, ''), '/conges/' || p_request_id,
     jsonb_build_object('leave_request_id', p_request_id, 'approved', p_approve));

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, entity_id, after)
  values
    (v_req.organization_id, auth.uid(), v_me,
     case when p_approve then 'leave_request.approved' else 'leave_request.rejected' end,
     'leave_request', p_request_id,
     jsonb_build_object('level', v_level, 'comment', p_comment));
end $$;

create or replace function public.cancel_leave_request(
  p_request_id uuid,
  p_reason     text default null
) returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_req public.leave_requests;
  v_me  uuid;
begin
  select * into v_req from public.leave_requests where id = p_request_id for update;

  if v_req.id is null then
    raise exception 'Demande introuvable' using errcode = 'P0002';
  end if;

  if v_req.status in ('cancelled', 'rejected') then
    raise exception 'Demande déjà %', v_req.status using errcode = '23514';
  end if;

  v_me := public.current_member_id(v_req.organization_id);

  if v_me is distinct from v_req.member_id
     and not public.is_hr_or_admin(v_req.organization_id) then
    raise exception 'Non autorisé à annuler cette demande' using errcode = '42501';
  end if;

  if v_me = v_req.member_id
     and not public.is_hr_or_admin(v_req.organization_id)
     and v_req.start_date <= current_date then
    raise exception 'Un congé déjà commencé doit être annulé par un RH ou un administrateur'
      using errcode = '42501';
  end if;

  -- Restitution des droits par une écriture inverse, jamais par réécriture :
  --  - demande approuvée  → on annule la consommation  (restitution, positif)
  --  - demande en attente → on clôt la réservation     (release, positif)
  if v_req.status = 'approved' then
    if not exists (
      select 1 from public.leave_ledger
      where reference_type = 'leave_request' and reference_id = p_request_id
        and movement = 'consumption'
    ) then
      raise exception 'Consommation introuvable pour cette demande' using errcode = 'P0002';
    end if;

    insert into public.leave_ledger
      (organization_id, member_id, leave_type_id, movement, amount,
       effective_date, reference_type, reference_id, note, created_by)
    select l.organization_id, l.member_id, l.leave_type_id,
           'restitution', -l.amount, v_req.start_date, 'leave_request', v_req.id,
           concat_ws(' ', 'Restitution après annulation d''un congé approuvé.', p_reason),
           auth.uid()
    from public.leave_ledger l
    where l.reference_type = 'leave_request'
      and l.reference_id   = p_request_id
      and l.movement       = 'consumption';
  else
    insert into public.leave_ledger
      (organization_id, member_id, leave_type_id, movement, amount,
       effective_date, reference_type, reference_id, note, created_by)
    select l.organization_id, l.member_id, l.leave_type_id,
           'release', -l.amount, v_req.start_date, 'leave_request', v_req.id,
           concat_ws(' ', 'Libération après annulation.', p_reason), auth.uid()
    from public.leave_ledger l
    where l.reference_type = 'leave_request'
      and l.reference_id   = p_request_id
      and l.movement       = 'reservation';
  end if;

  update public.leave_approvals
     set status = 'skipped'
   where leave_request_id = p_request_id and status = 'pending';

  update public.leave_requests
     set status = 'cancelled', cancelled_at = now()
   where id = p_request_id;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, entity_id, after)
  values
    (v_req.organization_id, auth.uid(), v_me, 'leave_request.cancelled', 'leave_request',
     p_request_id, jsonb_build_object('reason', p_reason, 'previous_status', v_req.status));
end $$;

-- =============================================================================
-- 6. ACQUISITION ET AJUSTEMENTS DE SOLDE (RH)
-- =============================================================================

create or replace function public.accrue_leave(
  p_organization_id uuid,
  p_period_start    date,
  p_period_end      date
) returns integer
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_count int := 0;
  r       record;
  v_ref   uuid;
begin
  if not public.is_hr_or_admin(p_organization_id) then
    raise exception 'Réservé aux RH et administrateurs' using errcode = '42501';
  end if;

  for r in
    select m.id as member_id, lp.leave_type_id, lp.accrual_amount
    from public.organization_members m
    join public.leave_policies lp
      on lp.organization_id = m.organization_id
     and lp.accrual_frequency <> 'none'
     and lp.accrual_amount > 0
     and lp.effective_from <= p_period_end
     and (lp.effective_to is null or lp.effective_to >= p_period_start)
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
       'Acquisition ' || to_char(p_period_start, 'MM/YYYY'), auth.uid())
    on conflict do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, after)
  values
    (p_organization_id, auth.uid(), public.current_member_id(p_organization_id),
     'leave.accrual_run', 'leave_ledger',
     jsonb_build_object('period_start', p_period_start, 'period_end', p_period_end,
                        'entries', v_count));

  return v_count;
end $$;

-- Correction manuelle de solde par les RH (justification obligatoire)
create or replace function public.adjust_leave_balance(
  p_organization_id uuid,
  p_member_id       uuid,
  p_leave_type_id   uuid,
  p_amount          numeric,
  p_effective_date  date,
  p_note            text
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  if not public.is_hr_or_admin(p_organization_id) then
    raise exception 'Réservé aux RH et administrateurs' using errcode = '42501';
  end if;

  if p_amount = 0 then
    raise exception 'Le montant doit être différent de zéro' using errcode = '23514';
  end if;

  if length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Une justification est obligatoire' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.organization_members
    where id = p_member_id and organization_id = p_organization_id
  ) then
    raise exception 'Membre hors de cette organisation' using errcode = '42501';
  end if;

  insert into public.leave_ledger
    (organization_id, member_id, leave_type_id, movement, amount,
     effective_date, reference_type, note, created_by)
  values
    (p_organization_id, p_member_id, p_leave_type_id, 'correction', p_amount,
     coalesce(p_effective_date, current_date), 'manual_adjustment', btrim(p_note), auth.uid())
  returning id into v_id;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, entity_id, after)
  values
    (p_organization_id, auth.uid(), public.current_member_id(p_organization_id),
     'leave_balance.adjusted', 'leave_ledger', v_id,
     jsonb_build_object('member_id', p_member_id, 'leave_type_id', p_leave_type_id,
                        'amount', p_amount, 'note', p_note));

  return v_id;
end $$;

-- =============================================================================
-- 7. INSCRIPTION : création automatique du profil après signup
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 8. DROITS D'EXÉCUTION
-- =============================================================================
revoke execute on all functions in schema public from anon;
grant  execute on all functions in schema public to authenticated, service_role;
