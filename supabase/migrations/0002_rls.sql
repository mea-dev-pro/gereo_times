-- =============================================================================
-- GereoTimes — Migration 0002 : sécurité (RLS + helpers + garde-fous)
-- Isolation stricte des données entre organisations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers — SECURITY DEFINER pour éviter la récursion des policies
-- -----------------------------------------------------------------------------
create or replace function public.current_member_id(p_org uuid)
returns uuid
language sql stable security definer
set search_path = public, auth
as $$
  select m.id
  from public.organization_members m
  where m.organization_id = p_org
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
$$;

create or replace function public.has_org_role(p_org uuid, p_roles org_role[])
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(p_roles)
  )
$$;

create or replace function public.is_hr_or_admin(p_org uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$ select public.has_org_role(p_org, array['hr','admin']::org_role[]) $$;

-- L'utilisateur courant encadre-t-il ce membre ? (manager direct, ou RH/admin)
create or replace function public.manages_member(p_member_id uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members target
    join public.organization_members me
      on me.organization_id = target.organization_id
     and me.user_id = auth.uid()
     and me.status = 'active'
     and me.role in ('manager','hr','admin')
    where target.id = p_member_id
      and (me.role in ('hr','admin') or target.manager_id = me.id)
  )
$$;

-- Le membre visé appartient-il à une organisation de l'utilisateur courant ?
create or replace function public.shares_org_with_member(p_member_id uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members target
    where target.id = p_member_id
      and public.is_org_member(target.organization_id)
  )
$$;

-- -----------------------------------------------------------------------------
-- Garde-fou : un membre non-privilégié ne peut pas modifier son propre rôle,
-- son statut, son organisation ni son manager (anti-escalade de privilèges).
-- -----------------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if auth.uid() = old.user_id
     and not public.is_hr_or_admin(old.organization_id)
     and (
          new.role            is distinct from old.role
       or new.status          is distinct from old.status
       or new.organization_id is distinct from old.organization_id
       or new.manager_id      is distinct from old.manager_id
       or new.department_id   is distinct from old.department_id
     )
  then
    raise exception 'Modification non autorisée : rôle, statut, rattachement ou département'
      using errcode = '42501';
  end if;

  -- Un manager ne peut pas s'auto-désigner comme son propre responsable
  if new.manager_id = new.id then
    raise exception 'Un membre ne peut pas être son propre manager' using errcode = '23514';
  end if;

  return new;
end $$;

drop trigger if exists trg_prevent_role_escalation on public.organization_members;
create trigger trg_prevent_role_escalation
  before update on public.organization_members
  for each row execute function public.prevent_role_escalation();

-- -----------------------------------------------------------------------------
-- Garde-fou : protection des pointages clôturés
-- (seuls RH/admin ou un manager peuvent modifier une session fermée ;
--  l'employé doit passer par time_adjustments)
-- -----------------------------------------------------------------------------
create or replace function public.prevent_closed_entry_edit()
returns trigger
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if old.clock_out is not null
     and (new.clock_in is distinct from old.clock_in
       or new.clock_out is distinct from old.clock_out
       or new.work_date is distinct from old.work_date)
     and not public.is_hr_or_admin(old.organization_id)
     and not public.manages_member(old.member_id)
  then
    raise exception 'Session clôturée : une correction justifiée est requise'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_prevent_closed_entry_edit on public.time_entries;
create trigger trg_prevent_closed_entry_edit
  before update on public.time_entries
  for each row execute function public.prevent_closed_entry_edit();

-- -----------------------------------------------------------------------------
-- Garde-fou : gel des demandes de congés une fois décidées
-- -----------------------------------------------------------------------------
create or replace function public.prevent_decided_request_edit()
returns trigger
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if old.status in ('approved','rejected','cancelled')
     and new.status is distinct from old.status
     and new.status not in ('cancelled')
     and not public.is_hr_or_admin(old.organization_id)
  then
    raise exception 'Demande déjà décidée : modification interdite' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_prevent_decided_request_edit on public.leave_requests;
create trigger trg_prevent_decided_request_edit
  before update on public.leave_requests
  for each row execute function public.prevent_decided_request_edit();

-- =============================================================================
-- RLS — activation sur toutes les tables
-- =============================================================================
alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.departments          enable row level security;
alter table public.work_schedules       enable row level security;
alter table public.organization_members enable row level security;
alter table public.holidays             enable row level security;
alter table public.leave_types          enable row level security;
alter table public.leave_policies       enable row level security;
alter table public.leave_requests       enable row level security;
alter table public.leave_approvals      enable row level security;
alter table public.leave_ledger         enable row level security;
alter table public.time_entries         enable row level security;
alter table public.break_entries        enable row level security;
alter table public.time_adjustments     enable row level security;
alter table public.notifications        enable row level security;
alter table public.audit_logs           enable row level security;

-- -----------------------------------------------------------------------------
-- organizations — lecture par les membres, écriture par les admins
-- (création via RPC create_organization, en SECURITY DEFINER)
-- -----------------------------------------------------------------------------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['admin']::org_role[]))
  with check (public.has_org_role(id, array['admin']::org_role[]));

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.has_org_role(id, array['admin']::org_role[]));

-- -----------------------------------------------------------------------------
-- profiles — soi-même en écriture, collègues de ses organisations en lecture
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_colleagues on public.profiles;
create policy profiles_select_colleagues on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.user_id = profiles.id
      and public.is_org_member(m.organization_id)
  ));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- organization_members
-- -----------------------------------------------------------------------------
drop policy if exists om_select on public.organization_members;
create policy om_select on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists om_insert on public.organization_members;
create policy om_insert on public.organization_members
  for insert to authenticated
  with check (public.is_hr_or_admin(organization_id));

drop policy if exists om_update on public.organization_members;
create policy om_update on public.organization_members
  for update to authenticated
  using (public.is_hr_or_admin(organization_id) or user_id = auth.uid())
  with check (public.is_hr_or_admin(organization_id) or user_id = auth.uid());

drop policy if exists om_delete on public.organization_members;
create policy om_delete on public.organization_members
  for delete to authenticated
  using (public.has_org_role(organization_id, array['admin']::org_role[]));

-- -----------------------------------------------------------------------------
-- Tables de configuration : lecture pour tous les membres,
-- écriture réservée à RH/admin
-- -----------------------------------------------------------------------------
drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists departments_write on public.departments;
create policy departments_write on public.departments
  for all to authenticated
  using (public.is_hr_or_admin(organization_id))
  with check (public.is_hr_or_admin(organization_id));

drop policy if exists work_schedules_select on public.work_schedules;
create policy work_schedules_select on public.work_schedules
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists work_schedules_write on public.work_schedules;
create policy work_schedules_write on public.work_schedules
  for all to authenticated
  using (public.is_hr_or_admin(organization_id))
  with check (public.is_hr_or_admin(organization_id));

drop policy if exists holidays_select on public.holidays;
create policy holidays_select on public.holidays
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists holidays_write on public.holidays;
create policy holidays_write on public.holidays
  for all to authenticated
  using (public.is_hr_or_admin(organization_id))
  with check (public.is_hr_or_admin(organization_id));

drop policy if exists leave_types_select on public.leave_types;
create policy leave_types_select on public.leave_types
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists leave_types_write on public.leave_types;
create policy leave_types_write on public.leave_types
  for all to authenticated
  using (public.is_hr_or_admin(organization_id))
  with check (public.is_hr_or_admin(organization_id));

drop policy if exists leave_policies_select on public.leave_policies;
create policy leave_policies_select on public.leave_policies
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists leave_policies_write on public.leave_policies;
create policy leave_policies_write on public.leave_policies
  for all to authenticated
  using (public.is_hr_or_admin(organization_id))
  with check (public.is_hr_or_admin(organization_id));

-- -----------------------------------------------------------------------------
-- time_entries — l'employé voit et crée les siennes ; le manager voit son équipe
-- -----------------------------------------------------------------------------
drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries
  for select to authenticated
  using (
    member_id = public.current_member_id(organization_id)
    or public.manages_member(member_id)
  );

drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (member_id = public.current_member_id(organization_id));

drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries
  for update to authenticated
  using (
    member_id = public.current_member_id(organization_id)
    or public.manages_member(member_id)
  )
  with check (
    member_id = public.current_member_id(organization_id)
    or public.manages_member(member_id)
  );

drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (public.is_hr_or_admin(organization_id));

-- -----------------------------------------------------------------------------
-- break_entries — rattachées à une session accessible
-- -----------------------------------------------------------------------------
drop policy if exists break_entries_select on public.break_entries;
create policy break_entries_select on public.break_entries
  for select to authenticated
  using (exists (
    select 1 from public.time_entries te
    where te.id = break_entries.time_entry_id
      and (te.member_id = public.current_member_id(te.organization_id)
           or public.manages_member(te.member_id))
  ));

drop policy if exists break_entries_write on public.break_entries;
create policy break_entries_write on public.break_entries
  for all to authenticated
  using (exists (
    select 1 from public.time_entries te
    where te.id = break_entries.time_entry_id
      and (te.member_id = public.current_member_id(te.organization_id)
           or public.manages_member(te.member_id))
  ))
  with check (exists (
    select 1 from public.time_entries te
    where te.id = break_entries.time_entry_id
      and (te.member_id = public.current_member_id(te.organization_id)
           or public.manages_member(te.member_id))
  ));

-- -----------------------------------------------------------------------------
-- time_adjustments — l'employé demande, le manager/RH décide
-- -----------------------------------------------------------------------------
drop policy if exists time_adjustments_select on public.time_adjustments;
create policy time_adjustments_select on public.time_adjustments
  for select to authenticated
  using (
    member_id = public.current_member_id(organization_id)
    or public.manages_member(member_id)
  );

drop policy if exists time_adjustments_insert on public.time_adjustments;
create policy time_adjustments_insert on public.time_adjustments
  for insert to authenticated
  with check (member_id = public.current_member_id(organization_id));

drop policy if exists time_adjustments_update on public.time_adjustments;
create policy time_adjustments_update on public.time_adjustments
  for update to authenticated
  using (
    (member_id = public.current_member_id(organization_id) and status = 'pending')
    or public.manages_member(member_id)
  )
  with check (
    (member_id = public.current_member_id(organization_id) and status = 'pending')
    or public.manages_member(member_id)
  );

-- -----------------------------------------------------------------------------
-- leave_requests — CRITÈRE : un employé ne voit ni ne modifie les données
-- d'un autre employé sans permission
-- -----------------------------------------------------------------------------
drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (
    member_id = public.current_member_id(organization_id)
    or public.manages_member(member_id)
  );

drop policy if exists leave_requests_insert on public.leave_requests;
create policy leave_requests_insert on public.leave_requests
  for insert to authenticated
  with check (member_id = public.current_member_id(organization_id));

drop policy if exists leave_requests_update on public.leave_requests;
create policy leave_requests_update on public.leave_requests
  for update to authenticated
  using (
    (member_id = public.current_member_id(organization_id) and status in ('draft','pending'))
    or public.manages_member(member_id)
  )
  with check (
    (member_id = public.current_member_id(organization_id) and status in ('draft','pending','cancelled'))
    or public.manages_member(member_id)
  );

drop policy if exists leave_requests_delete on public.leave_requests;
create policy leave_requests_delete on public.leave_requests
  for delete to authenticated
  using (member_id = public.current_member_id(organization_id) and status = 'draft');

-- -----------------------------------------------------------------------------
-- leave_approvals
-- -----------------------------------------------------------------------------
drop policy if exists leave_approvals_select on public.leave_approvals;
create policy leave_approvals_select on public.leave_approvals
  for select to authenticated
  using (exists (
    select 1 from public.leave_requests lr
    where lr.id = leave_approvals.leave_request_id
      and (lr.member_id = public.current_member_id(lr.organization_id)
           or public.manages_member(lr.member_id))
  ));
-- Pas de policy d'écriture : les décisions passent par les RPC SECURITY DEFINER.

-- -----------------------------------------------------------------------------
-- leave_ledger — lecture seule côté client. Toute écriture passe par les RPC.
-- -----------------------------------------------------------------------------
drop policy if exists leave_ledger_select on public.leave_ledger;
create policy leave_ledger_select on public.leave_ledger
  for select to authenticated
  using (
    member_id = public.current_member_id(organization_id)
    or public.manages_member(member_id)
  );

-- -----------------------------------------------------------------------------
-- notifications — strictement personnelles
-- -----------------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (member_id = public.current_member_id(organization_id));

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update to authenticated
  using (member_id = public.current_member_id(organization_id))
  with check (member_id = public.current_member_id(organization_id));

-- -----------------------------------------------------------------------------
-- audit_logs — lecture RH/admin uniquement, aucune écriture client
-- -----------------------------------------------------------------------------
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (organization_id is not null and public.is_hr_or_admin(organization_id));
