-- Counter schema: current state, audit log, atomic action function.

create table public.counter (
  channel_id text primary key,
  channel_login text not null,
  session_count integer not null default 0 check (session_count >= 0),
  total_count integer not null default 0,
  last_action text check (last_action in ('increment', 'decrement', 'set_session', 'reset_session')),
  last_actor_login text,
  updated_at timestamptz not null default now(),
  constraint counter_total_gte_session check (total_count >= session_count)
);

create table public.counter_event (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  channel_id text not null references public.counter (channel_id),
  actor_id text not null,
  actor_login text not null,
  action text not null,
  value integer,
  session_after integer not null,
  total_after integer not null,
  created_at timestamptz not null default now()
);

create index counter_event_actor_created_idx on public.counter_event (actor_id, created_at);
create index counter_event_channel_action_created_idx on public.counter_event (channel_id, action, created_at);

alter table public.counter enable row level security;
alter table public.counter_event enable row level security;

-- Public read, no write policies; counter_event has no policies (service_role bypasses RLS).
create policy counter_public_read on public.counter
  for select to anon, authenticated using (true);

-- Supabase default grants give anon/authenticated everything (incl. TRUNCATE, which RLS does not block).
revoke all on public.counter, public.counter_event from anon, authenticated;
grant select on public.counter to anon, authenticated;

alter publication supabase_realtime add table public.counter;

create function public.apply_counter_action(
  p_request_id uuid,
  p_channel_id text,
  p_channel_login text,
  p_actor_id text,
  p_actor_login text,
  p_action text,
  p_value integer default null
) returns public.counter
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.counter;
  v_session integer;
  v_total integer;
  v_last_incrementer text;
begin
  -- 1. Idempotency: a repeated request returns the current state untouched.
  if exists (select 1 from public.counter_event where request_id = p_request_id) then
    select * into v_row from public.counter where channel_id = p_channel_id;
    return v_row;
  end if;

  -- 2. Ensure the row exists, then lock it to serialize concurrent mods.
  insert into public.counter (channel_id, channel_login)
  values (p_channel_id, p_channel_login)
  on conflict (channel_id) do nothing;

  select * into v_row from public.counter where channel_id = p_channel_id for update;

  -- Re-check idempotency now that we hold the lock (a concurrent twin may have finished).
  if exists (select 1 from public.counter_event where request_id = p_request_id) then
    return v_row;
  end if;

  -- 3a. Rate limit: max 10 actions per actor in 10 s.
  if (select count(*) from public.counter_event
      where actor_id = p_actor_id and created_at > now() - interval '10 seconds') >= 10 then
    raise exception 'rate_limited' using errcode = 'ZK429';
  end if;

  -- 3b. Validate the action.
  v_session := v_row.session_count;
  v_total := v_row.total_count;

  if p_action = 'increment' then
    -- 3c. Cooldown: one increment per channel every 3 s.
    select actor_login into v_last_incrementer
    from public.counter_event
    where channel_id = p_channel_id and action = 'increment'
      and created_at > now() - interval '3 seconds'
    order by created_at desc, id desc
    limit 1;
    if found then
      raise exception 'cooldown' using errcode = 'ZK409', detail = v_last_incrementer;
    end if;
    v_session := v_session + 1;
    v_total := v_total + 1;
  elsif p_action = 'decrement' then
    if v_session = 0 then
      raise exception 'bad_request' using errcode = 'ZK400', detail = 'session is already 0';
    end if;
    v_session := v_session - 1;
    v_total := v_total - 1;
  elsif p_action = 'set_session' then
    if p_value is null or p_value < 0 or p_value > 1000000 then
      raise exception 'bad_request' using errcode = 'ZK400', detail = 'value must be an integer in 0..1000000';
    end if;
    v_total := v_total + (p_value - v_session);
    v_session := p_value;
  elsif p_action = 'reset_session' then
    v_session := 0;
  else
    raise exception 'bad_request' using errcode = 'ZK400', detail = 'unknown action';
  end if;

  -- 4. Persist state and audit event.
  update public.counter
  set session_count = v_session,
      total_count = v_total,
      channel_login = p_channel_login,
      last_action = p_action,
      last_actor_login = p_actor_login,
      updated_at = now()
  where channel_id = p_channel_id
  returning * into v_row;

  insert into public.counter_event
    (request_id, channel_id, actor_id, actor_login, action, value, session_after, total_after)
  values
    (p_request_id, p_channel_id, p_actor_id, p_actor_login, p_action,
     case when p_action = 'set_session' then p_value end, v_session, v_total);

  return v_row;
end;
$$;

revoke execute on function public.apply_counter_action(uuid, text, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.apply_counter_action(uuid, text, text, text, text, text, integer)
  to service_role;
