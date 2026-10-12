-- =============================================================================
-- GereoTimes — Migration 0001 : schéma initial
-- 16 tables, contraintes d'intégrité, index de performance
-- Cible : Supabase / PostgreSQL 15+
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
do $$ begin create type org_role          as enum ('employee','manager','hr','admin'); end $$;
do $$ begin create type member_status     as enum ('active','inactive'); end $$;
do $$ begin create type time_entry_status as enum ('open','closed','corrected','flagged'); end $$;
do $$ begin create type time_entry_source as enum ('clock','manual'); end $$;
do $$ begin create type break_kind        as enum ('paid','unpaid'); end $$;
do $$ begin create type adjustment_status as enum ('pending','approved','rejected','cancelled'); end $$;
do $$ begin create type request_status    as enum ('draft','pending','approved','rejected','cancelled'); end $$;
do $$ begin create type approval_status   as enum ('pending','approved','rejected','skipped'); end $$;
do $$ begin create type half_day          as enum ('am','pm'); end $$;
do $$ begin create type ledger_movement   as enum ('accrual','carryover','expiry','correction','reservation','release','consumption','restitution'); end $$;
do $$ begin create type accrual_frequency as enum ('none','monthly','quarterly','yearly'); end $$;

-- -----------------------------------------------------------------------------
-- Fonction générique : mise à jour de updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 1. organizations
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) > 0),
  slug         text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  legal_name   text,
  country_code char(2) not null default 'MG',
  timezone     text not null default 'Indian/Antananarivo',
  locale       text not null default 'fr',
  currency     char(3) not null default 'MGA',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. profiles — identité globale (un utilisateur peut appartenir à N organisations)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  avatar_url text,
  phone      text,
  locale     text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- -----------------------------------------------------------------------------
-- 3. departments
-- -----------------------------------------------------------------------------
create table if not exists public.departments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null check (length(btrim(name)) > 0),
  code              text,
  manager_member_id uuid,           -- FK ajoutée après organization_members
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, name)
);

-- -----------------------------------------------------------------------------
-- 4. work_schedules — calendriers / horaires de travail
-- weekly_pattern exemple :
--   {"mon":{"start":"08:00","end":"17:00","break_minutes":60},"sat":null, ...}
-- -----------------------------------------------------------------------------
create table if not exists public.work_schedules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  timezone        text not null default 'Indian/Antananarivo',
  weekly_pattern  jsonb not null default '{}'::jsonb,
  daily_hours     numeric(5,2) not null default 8.00 check (daily_hours >= 0 and daily_hours <= 24),
  break_minutes   integer not null default 60 check (break_minutes >= 0 and break_minutes <= 1440),
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (jsonb_typeof(weekly_pattern) = 'object')
);
create unique index if not exists work_schedules_one_default_idx
  on public.work_schedules (organization_id) where is_default;

-- -----------------------------------------------------------------------------
-- 5. organization_members — appartenance + rôle + rattachement hiérarchique
-- -----------------------------------------------------------------------------
create table if not exists public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  role             org_role not null default 'employee',
  status           member_status not null default 'active',
  department_id    uuid references public.departments(id) on delete set null,
  manager_id       uuid references public.organization_members(id) on delete set null,
  work_schedule_id uuid references public.work_schedules(id) on delete set null,
  job_title        text,
  employee_number  text,
  hire_date        date,
  end_date         date,
  weekly_hours     numeric(5,2) check (weekly_hours is null or (weekly_hours > 0 and weekly_hours <= 168)),
  timezone         text,
  invited_by       uuid references public.profiles(id) on delete set null,
  joined_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, user_id),
  check (manager_id is null or manager_id <> id),
  check (end_date is null or hire_date is null or end_date >= hire_date)
);
create index if not exists om_org_idx        on public.organization_members (organization_id, status);
create index if not exists om_user_idx       on public.organization_members (user_id);
create index if not exists om_manager_idx    on public.organization_members (manager_id);
create index if not exists om_department_idx on public.organization_members (department_id);

-- FK différée : departments.manager_member_id -> organization_members
alter table public.departments drop constraint if exists departments_manager_member_id_fkey;
alter table public.departments
  add constraint departments_manager_member_id_fkey
  foreign key (manager_member_id) references public.organization_members(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 6. holidays — jours fériés par organisation
-- -----------------------------------------------------------------------------
create table if not exists public.holidays (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  holiday_date    date not null,
  is_recurring    boolean not null default false,
  country_code    char(2),
  created_at      timestamptz not null default now(),
  unique (organization_id, holiday_date)
);
create index if not exists holidays_org_date_idx on public.holidays (organization_id, holiday_date);

-- -----------------------------------------------------------------------------
-- 7. leave_types — types de congés configurables
-- -----------------------------------------------------------------------------
create table if not exists public.leave_types (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  code                   text not null,
  name                   text not null,
  is_paid                boolean not null default true,
  requires_justification boolean not null default false,
  color                  text not null default '#2563eb',
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, code)
);

-- -----------------------------------------------------------------------------
-- 8. leave_policies — règles d'acquisition et de validation (versionnées)
-- -----------------------------------------------------------------------------
create table if not exists public.leave_policies (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  leave_type_id          uuid not null references public.leave_types(id) on delete cascade,
  name                   text not null,
  effective_from         date not null default current_date,
  effective_to           date,
  accrual_frequency      accrual_frequency not null default 'monthly',
  accrual_amount         numeric(6,3) not null default 0 check (accrual_amount >= 0),
  carryover_max          numeric(6,2) check (carryover_max is null or carryover_max >= 0),
  carryover_expiry_months integer check (carryover_expiry_months is null or carryover_expiry_months > 0),
  proration              boolean not null default true,
  waiting_period_days    integer not null default 0 check (waiting_period_days >= 0),
  min_notice_days        integer not null default 0 check (min_notice_days >= 0),
  max_consecutive_days   integer check (max_consecutive_days is null or max_consecutive_days > 0),
  allow_half_days        boolean not null default true,
  allow_negative_balance boolean not null default false,
  approval_levels        smallint not null default 1 check (approval_levels between 1 and 3),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create index if not exists leave_policies_lookup_idx
  on public.leave_policies (organization_id, leave_type_id, effective_from desc);

-- -----------------------------------------------------------------------------
-- 9. leave_requests — demandes de congés
-- -----------------------------------------------------------------------------
create table if not exists public.leave_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id       uuid not null references public.organization_members(id) on delete cascade,
  leave_type_id   uuid not null references public.leave_types(id) on delete restrict,
  start_date      date not null,
  end_date        date not null,
  start_half      half_day,
  end_half        half_day,
  total_days      numeric(6,2) not null default 0 check (total_days >= 0),
  business_days   numeric(6,2),
  reason          text,
  status          request_status not null default 'draft',
  submitted_at    timestamptz,
  decided_at      timestamptz,
  cancelled_at    timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists leave_requests_member_idx
  on public.leave_requests (member_id, start_date desc);
create index if not exists leave_requests_org_status_idx
  on public.leave_requests (organization_id, status, submitted_at desc);
create index if not exists leave_requests_manager_idx
  on public.leave_requests (organization_id, status) where status = 'pending';

-- Anti-chevauchement : deux demandes actives ne peuvent pas se superposer
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leave_requests_no_overlap') then
    alter table public.leave_requests
      add constraint leave_requests_no_overlap
      exclude using gist (
        member_id with =,
        daterange(start_date, end_date, '[]') with &&
      ) where (status in ('pending','approved'));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 10. leave_approvals — étapes de validation
-- -----------------------------------------------------------------------------
create table if not exists public.leave_approvals (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  leave_request_id   uuid not null references public.leave_requests(id) on delete cascade,
  level              smallint not null default 1 check (level between 1 and 3),
  approver_member_id uuid references public.organization_members(id) on delete set null,
  status             approval_status not null default 'pending',
  comment            text,
  decided_at         timestamptz,
  created_at         timestamptz not null default now(),
  unique (leave_request_id, level)
);

-- -----------------------------------------------------------------------------
-- 11. leave_ledger — journal des mouvements de solde (source de vérité)
-- Convention de signe : acquisition/carryover/release/correction(+) positifs,
-- reservation/consumption/expiry négatifs. Solde disponible = somme(amount).
-- -----------------------------------------------------------------------------
create table if not exists public.leave_ledger (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id       uuid not null references public.organization_members(id) on delete cascade,
  leave_type_id   uuid not null references public.leave_types(id) on delete restrict,
  movement        ledger_movement not null,
  amount          numeric(7,3) not null check (amount <> 0),
  effective_date  date not null default current_date,
  reference_type  text,
  reference_id    uuid,
  note            text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists leave_ledger_balance_idx
  on public.leave_ledger (organization_id, member_id, leave_type_id);
create index if not exists leave_ledger_ref_idx
  on public.leave_ledger (reference_type, reference_id);

-- GARDE-FOU ANTI-DOUBLE-DÉDUCTION :
-- une seule réservation par (demande, type de congé), quel que soit le
-- nombre de validations concurrentes.
create unique index if not exists leave_ledger_one_reservation_per_ref_idx
  on public.leave_ledger (reference_type, reference_id, leave_type_id)
  where movement = 'reservation';

-- -----------------------------------------------------------------------------
-- 12. time_entries — pointage (une ligne = une session)
-- -----------------------------------------------------------------------------
create table if not exists public.time_entries (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  member_id         uuid not null references public.organization_members(id) on delete cascade,
  work_date         date not null,
  clock_in          timestamptz not null,
  clock_out         timestamptz,
  status            time_entry_status not null default 'open',
  source            time_entry_source not null default 'clock',
  break_minutes     integer not null default 0 check (break_minutes >= 0),
  worked_minutes    integer check (worked_minutes is null or worked_minutes >= 0),
  effective_minutes integer check (effective_minutes is null or effective_minutes >= 0),
  planned_minutes   integer,
  variance_minutes  integer,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (clock_out is null or clock_out > clock_in)
);
-- Une seule session active par employé, tous jours confondus
create unique index if not exists time_entries_one_open_per_member_idx
  on public.time_entries (member_id) where (clock_out is null);
create index if not exists time_entries_member_date_idx
  on public.time_entries (member_id, work_date desc);
create index if not exists time_entries_org_date_idx
  on public.time_entries (organization_id, work_date desc);

-- -----------------------------------------------------------------------------
-- 13. break_entries — pauses rattachées à une session
-- -----------------------------------------------------------------------------
create table if not exists public.break_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  time_entry_id   uuid not null references public.time_entries(id) on delete cascade,
  started_at      timestamptz not null,
  ended_at        timestamptz,
  minutes         integer check (minutes is null or minutes >= 0),
  kind            break_kind not null default 'unpaid',
  created_at      timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);
create unique index if not exists break_entries_one_open_idx
  on public.break_entries (time_entry_id) where (ended_at is null);
create index if not exists break_entries_entry_idx on public.break_entries (time_entry_id);

-- -----------------------------------------------------------------------------
-- 14. time_adjustments — corrections de pointage justifiées
-- -----------------------------------------------------------------------------
create table if not exists public.time_adjustments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  time_entry_id     uuid references public.time_entries(id) on delete cascade,
  member_id         uuid not null references public.organization_members(id) on delete cascade,
  requested_by      uuid references public.profiles(id) on delete set null,
  reason            text not null check (length(btrim(reason)) > 0),
  original_in       timestamptz,
  original_out      timestamptz,
  new_in            timestamptz,
  new_out           timestamptz,
  status            adjustment_status not null default 'pending',
  decided_by        uuid references public.organization_members(id) on delete set null,
  decided_at        timestamptz,
  decision_comment  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (new_in is not null or new_out is not null),
  check (new_out is null or new_in is null or new_out > new_in)
);
create index if not exists time_adjustments_pending_idx
  on public.time_adjustments (organization_id, status) where status = 'pending';

-- -----------------------------------------------------------------------------
-- 15. notifications
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id       uuid not null references public.organization_members(id) on delete cascade,
  kind            text not null,
  title           text not null,
  body            text,
  link            text,
  payload         jsonb not null default '{}'::jsonb,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists notifications_unread_idx
  on public.notifications (member_id, created_at desc) where read_at is null;

-- -----------------------------------------------------------------------------
-- 16. audit_logs
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id              bigserial primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id   uuid references public.profiles(id) on delete set null,
  actor_member_id uuid references public.organization_members(id) on delete set null,
  action          text not null,
  entity_type     text not null,
  entity_id       uuid,
  before          jsonb,
  after           jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);
create index if not exists audit_logs_org_idx    on public.audit_logs (organization_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- Triggers updated_at
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','departments','work_schedules','organization_members',
    'leave_types','leave_policies','leave_requests','time_entries','time_adjustments'
  ] loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format(
      'create trigger trg_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Vue : soldes de congés par (membre, type)
-- Le journal est en AJOUT SEUL : une réservation libérée ou une consommation
-- restituée produit une NOUVELLE ligne de signe opposé, jamais une réécriture.
--   reserved = -(reservation + release)      → une réservation vivante
--   used     = -(consumption + restitution)  → une consommation vivante
--   available = somme signée de tous les mouvements
-- -----------------------------------------------------------------------------
create or replace view public.leave_balances
with (security_invoker = on) as
select
  organization_id,
  member_id,
  leave_type_id,
  coalesce(sum(amount) filter (where movement in ('accrual','carryover','correction')), 0)::numeric(9,3) as accrued_days,
  coalesce(-sum(amount) filter (where movement in ('consumption','restitution')), 0)::numeric(9,3) as used_days,
  coalesce(-sum(amount) filter (where movement in ('reservation','release')), 0)::numeric(9,3)     as reserved_days,
  coalesce(-sum(amount) filter (where movement = 'expiry'), 0)::numeric(9,3)                        as expired_days,
  coalesce(sum(amount), 0)::numeric(9,3)                                                            as available_days
from public.leave_ledger
group by organization_id, member_id, leave_type_id;

comment on view public.leave_balances is
  'Soldes de congés reconstruits depuis leave_ledger (ajout seul). available_days = somme signée de tous les mouvements.';
