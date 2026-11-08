begin;
select plan(28);

-- Deterministic request ids and a call helper (channel '1' / 'presarioo').
create function pg_temp.u(n int) returns uuid language sql as
$$ select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;

create function pg_temp.act(n int, p_actor text, p_action text, p_value integer default null)
returns public.counter language sql as
$$ select public.apply_counter_action(pg_temp.u(n), '1', 'presarioo', p_actor, p_actor, p_action, p_value) $$;

create function pg_temp.state() returns table (s int, t int) language sql as
$$ select session_count, total_count from public.counter where channel_id = '1' $$;

-- 1. first action creates the row
select pg_temp.act(1, 'a', 'increment');
select results_eq(
  $$ select session_count, total_count, last_action, last_actor_login from public.counter where channel_id = '1' $$,
  $$ values (1, 1, 'increment'::text, 'a'::text) $$,
  'first increment creates row with 1/1');

-- 2. cooldown
select throws_ok($$ select pg_temp.act(2, 'b', 'increment') $$, 'ZK409', null,
  'second increment within 3s is rejected with ZK409');

-- 3. cooldown detail carries the last incrementer
create temp table cooldown_detail (d text);
do $$
declare v text;
begin
  perform pg_temp.act(3, 'b', 'increment');
exception when sqlstate 'ZK409' then
  get stacked diagnostics v = pg_exception_detail;
  insert into cooldown_detail values (v);
end $$;
select is((select d from cooldown_detail), 'a', 'cooldown detail is last incrementer login');

-- 4. backdated event -> increment allowed again
update public.counter_event set created_at = now() - interval '4 seconds';
select pg_temp.act(4, 'b', 'increment');
select results_eq($$ select * from pg_temp.state() $$, $$ values (2, 2) $$,
  'increment after cooldown gives 2/2');

-- 5. decrement 2/2 -> 1/1
select pg_temp.act(5, 'a', 'decrement');
select results_eq($$ select * from pg_temp.state() $$, $$ values (1, 1) $$, 'decrement gives 1/1');

-- 6./7. idempotency
select pg_temp.act(5, 'a', 'decrement');
select results_eq($$ select * from pg_temp.state() $$, $$ values (1, 1) $$,
  'same request_id again leaves state unchanged');
select is((select count(*)::int from public.counter_event where request_id = pg_temp.u(5)), 1,
  'same request_id writes only one event');

-- 8. reset_session keeps total
select pg_temp.act(6, 'a', 'reset_session');
select results_eq($$ select * from pg_temp.state() $$, $$ values (0, 1) $$, 'reset_session gives 0/1');

-- 9. decrement at 0
select throws_ok($$ select pg_temp.act(7, 'a', 'decrement') $$, 'ZK400', null, 'decrement at session 0 is ZK400');

-- 10. set_session raises total by the difference
update public.counter set session_count = 1, total_count = 3 where channel_id = '1';
select pg_temp.act(10, 'a', 'set_session', 5);
select results_eq($$ select * from pg_temp.state() $$, $$ values (5, 7) $$, 'set_session 5 at 1/3 gives 5/7');

-- 11.-13. invalid set_session values
select throws_ok($$ select pg_temp.act(11, 'a', 'set_session', -1) $$, 'ZK400', null, 'set_session -1 is ZK400');
select throws_ok($$ select pg_temp.act(12, 'a', 'set_session', 1000001) $$, 'ZK400', null, 'set_session 1000001 is ZK400');
select throws_ok($$ select pg_temp.act(13, 'a', 'set_session', null) $$, 'ZK400', null, 'set_session null is ZK400');
select throws_ok($$ select pg_temp.act(14, 'a', 'bogus') $$, 'ZK400', null, 'unknown action is ZK400');

-- 14. reset at 5/7
select pg_temp.act(15, 'a', 'reset_session');
select results_eq($$ select * from pg_temp.state() $$, $$ values (0, 7) $$, 'reset_session at 5/7 gives 0/7');

-- 15./16. events carry resulting values
select results_eq(
  $$ select session_after, total_after from public.counter_event where request_id = pg_temp.u(10) $$,
  $$ values (5, 7) $$, 'set_session event has 5/7');
select results_eq(
  $$ select session_after, total_after from public.counter_event where request_id = pg_temp.u(15) $$,
  $$ values (0, 7) $$, 'reset event has 0/7');

-- 17. exactly one event per successful action (1,4,5,6,10,15)
select is((select count(*)::int from public.counter_event where channel_id = '1'), 6,
  'one event per successful action');

-- 18./19. rate limit: 10 events in 10s for actor r, 11th (non-increment) is rejected
insert into public.counter_event (request_id, channel_id, actor_id, actor_login, action, session_after, total_after)
select pg_temp.u(100 + i), '1', 'r', 'r', 'reset_session', 0, 7 from generate_series(1, 10) i;
select throws_ok($$ select pg_temp.act(200, 'r', 'reset_session') $$, 'ZK429', null,
  '11th action within 10s is ZK429');
select is((select count(*)::int from public.counter_event where request_id = pg_temp.u(200)), 0,
  'rejected action writes no event');

-- table privileges
select table_privs_are('public', 'counter', 'anon', array['SELECT'], 'anon only has SELECT on counter');
select table_privs_are('public', 'counter', 'authenticated', array['SELECT'], 'authenticated only has SELECT on counter');
select table_privs_are('public', 'counter_event', 'anon', array[]::text[], 'anon has no privileges on counter_event');
select table_privs_are('public', 'counter_event', 'authenticated', array[]::text[], 'authenticated has no privileges on counter_event');

-- 20.-23. anon access
set local role anon;
select is((select count(*)::int from public.counter), 1, 'anon can read counter');
select throws_ok($$ update public.counter set session_count = 99 $$, '42501', null, 'anon cannot update counter');
select throws_ok($$ select count(*) from public.counter_event $$, '42501', null, 'anon cannot read counter_event');
select throws_ok(
  $$ select public.apply_counter_action(gen_random_uuid(), '1', 'presarioo', 'a', 'a', 'increment', null) $$,
  '42501', null, 'anon cannot execute apply_counter_action');
reset role;

select * from finish();
rollback;
