-- =============================================================================
-- GereoTimes — Migration 0004 : invitations de collaborateurs
-- Un RH ou un administrateur invite par email ; l'invité rejoint
-- l'organisation automatiquement à sa première connexion.
-- =============================================================================

do $$ begin
  create type invitation_status as enum ('pending','accepted','revoked','expired');
end $$;

-- -----------------------------------------------------------------------------
-- Table des invitations
-- -----------------------------------------------------------------------------
create table if not exists public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null check (position('@' in email) > 1),
  role            org_role not null default 'employee',
  department_id   uuid references public.departments(id) on delete set null,
  manager_id      uuid references public.organization_members(id) on delete set null,
  job_title       text,
  hire_date       date,
  status          invitation_status not null default 'pending',
  invited_by      uuid references public.profiles(id) on delete set null,
  expires_at      timestamptz not null default (now() + interval '14 days'),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, email)
);

create index if not exists invitations_pending_idx
  on public.invitations (lower(email)) where status = 'pending';

drop trigger if exists trg_set_updated_at on public.invitations;
create trigger trg_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS : strictement RH / administrateur.
-- L'invité accède à SA propre invitation via la RPC SECURITY DEFINER ci-dessous,
-- jamais par lecture directe.
-- -----------------------------------------------------------------------------
alter table public.invitations enable row level security;

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
  for select to authenticated
  using (public.is_hr_or_admin(organization_id));

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (public.is_hr_or_admin(organization_id));

drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations
  for update to authenticated
  using (public.is_hr_or_admin(organization_id))
  with check (public.is_hr_or_admin(organization_id));

drop policy if exists invitations_delete on public.invitations;
create policy invitations_delete on public.invitations
  for delete to authenticated
  using (public.has_org_role(organization_id, array['admin']::org_role[]));

-- =============================================================================
-- Inviter un collaborateur
-- =============================================================================
create or replace function public.invite_member(
  p_organization_id uuid,
  p_email           text,
  p_role            org_role default 'employee',
  p_department_id   uuid default null,
  p_manager_id      uuid default null,
  p_job_title       text default null,
  p_hire_date       date default null
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_email  text := lower(btrim(p_email));
  v_me     uuid;
  v_id     uuid;
begin
  if not public.is_hr_or_admin(p_organization_id) then
    raise exception 'Réservé aux RH et administrateurs' using errcode = '42501';
  end if;

  if v_email is null or position('@' in v_email) < 2 then
    raise exception 'Adresse email invalide' using errcode = '23514';
  end if;

  v_me := public.current_member_id(p_organization_id);

  -- Déjà membre ?
  if exists (
    select 1
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_organization_id
      and lower(p.email) = v_email
  ) then
    raise exception 'Cette personne fait déjà partie de l''organisation'
      using errcode = '23505';
  end if;

  -- Le département et le manager doivent appartenir à la même organisation
  if p_department_id is not null and not exists (
    select 1 from public.departments
    where id = p_department_id and organization_id = p_organization_id
  ) then
    raise exception 'Département hors de cette organisation' using errcode = '42501';
  end if;

  if p_manager_id is not null and not exists (
    select 1 from public.organization_members
    where id = p_manager_id and organization_id = p_organization_id
  ) then
    raise exception 'Responsable hors de cette organisation' using errcode = '42501';
  end if;

  insert into public.invitations
    (organization_id, email, role, department_id, manager_id, job_title, hire_date, invited_by)
  values
    (p_organization_id, v_email, p_role, p_department_id, p_manager_id, p_job_title, p_hire_date, auth.uid())
  on conflict (organization_id, email) do update
    set role          = excluded.role,
        department_id = excluded.department_id,
        manager_id    = excluded.manager_id,
        job_title     = excluded.job_title,
        hire_date     = excluded.hire_date,
        status        = 'pending',
        expires_at    = now() + interval '14 days',
        accepted_at   = null,
        invited_by    = auth.uid()
  returning id into v_id;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, entity_id, after)
  values
    (p_organization_id, auth.uid(), v_me, 'invitation.created', 'invitation', v_id,
     jsonb_build_object('email', v_email, 'role', p_role));

  return v_id;
end $$;

-- =============================================================================
-- Accepter une invitation à la première connexion
-- Renvoie l'identifiant du membre créé, ou null s'il n'y a rien à accepter.
-- =============================================================================
create or replace function public.accept_pending_invitation()
returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_user   uuid := auth.uid();
  v_email  text;
  v_inv    public.invitations;
  v_member uuid;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  select email into v_email from public.profiles where id = v_user;
  if v_email is null then
    return null;
  end if;

  select * into v_inv
  from public.invitations
  where lower(email) = lower(v_email)
    and status = 'pending'
    and expires_at > now()
  order by created_at
  limit 1
  for update;

  if v_inv.id is null then
    return null;
  end if;

  -- Déjà rattaché entre-temps : on solde simplement l'invitation.
  if exists (
    select 1 from public.organization_members
    where organization_id = v_inv.organization_id and user_id = v_user
  ) then
    update public.invitations
       set status = 'accepted', accepted_at = now()
     where id = v_inv.id;
    return null;
  end if;

  insert into public.organization_members
    (organization_id, user_id, role, status, department_id, manager_id,
     job_title, hire_date, invited_by)
  values
    (v_inv.organization_id, v_user, v_inv.role, 'active', v_inv.department_id,
     v_inv.manager_id, v_inv.job_title, v_inv.hire_date, v_inv.invited_by)
  returning id into v_member;

  update public.invitations
     set status = 'accepted', accepted_at = now()
   where id = v_inv.id;

  -- Prévenir les RH et administrateurs
  insert into public.notifications (organization_id, member_id, kind, title, body, link, payload)
  select
    v_inv.organization_id,
    m.id,
    'member.joined',
    'Nouveau collaborateur',
    coalesce(p.full_name, p.email) || ' a rejoint l''organisation',
    '/equipe',
    jsonb_build_object('member_id', v_member)
  from public.organization_members m
  join public.profiles p on p.id = v_user
  where m.organization_id = v_inv.organization_id
    and m.role in ('hr', 'admin')
    and m.id <> v_member;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, entity_id, after)
  values
    (v_inv.organization_id, v_user, v_member, 'invitation.accepted', 'organization_member', v_member,
     jsonb_build_object('invitation_id', v_inv.id, 'role', v_inv.role));

  return v_member;
end $$;

-- =============================================================================
-- Révoquer une invitation
-- =============================================================================
create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_inv public.invitations;
  v_me  uuid;
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  if v_inv.id is null then
    raise exception 'Invitation introuvable' using errcode = 'P0002';
  end if;

  if not public.is_hr_or_admin(v_inv.organization_id) then
    raise exception 'Réservé aux RH et administrateurs' using errcode = '42501';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'Cette invitation n''est plus en attente' using errcode = '23514';
  end if;

  v_me := public.current_member_id(v_inv.organization_id);

  update public.invitations
     set status = 'revoked'
   where id = p_invitation_id;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action, entity_type, entity_id, before)
  values
    (v_inv.organization_id, auth.uid(), v_me, 'invitation.revoked', 'invitation', p_invitation_id,
     jsonb_build_object('email', v_inv.email));
end $$;

-- =============================================================================
-- Droits d'exécution
-- =============================================================================
revoke execute on all functions in schema public from anon;
grant  execute on all functions in schema public to authenticated, service_role;
