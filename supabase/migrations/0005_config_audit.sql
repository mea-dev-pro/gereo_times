-- =============================================================================
-- GereoTimes — Migration 0005 : journalisation des modifications de configuration
--
-- Les tables de paramétrage RH sont modifiables directement par les RH et les
-- administrateurs (les policies RLS le permettent). Un déclencheur générique
-- journalise donc chaque création, modification et suppression dans audit_logs,
-- sans dépendre du code applicatif : aucune évolution future ne peut y échapper.
-- =============================================================================

create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_row   jsonb;
  v_org   uuid;
  v_id    uuid;
  v_actor uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_org := nullif(v_row ->> 'organization_id', '')::uuid;
  v_id  := nullif(v_row ->> 'id', '')::uuid;

  -- current_member_id est SECURITY DEFINER : il lit l'appartenance sans
  -- dépendre des policies de organization_members.
  v_actor := public.current_member_id(v_org);

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_member_id, action,
     entity_type, entity_id, before, after)
  values (
    v_org,
    auth.uid(),
    v_actor,
    lower(tg_table_name) || '.' || lower(tg_op),
    tg_table_name,
    v_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

-- Tables de configuration RH
do $$
declare t text;
begin
  foreach t in array array[
    'departments', 'work_schedules', 'holidays', 'leave_types', 'leave_policies'
  ] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format(
      'create trigger trg_audit
         after insert or update or delete on public.%I
         for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- Cloisonnement : le journal d'audit n'est lisible que par les RH et les
-- administrateurs (policy déjà en place), et n'est jamais alimenté par le
-- client — seuls les déclencheurs et les RPC SECURITY DEFINER y écrivent.

-- =============================================================================
revoke execute on all functions in schema public from anon;
grant  execute on all functions in schema public to authenticated, service_role;
