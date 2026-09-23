create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;
select plan(13);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'user-a@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'user-b@example.test');

insert into public.learner_ability_estimates (user_id, dimension, estimate_level, confidence_level)
values
  ('10000000-0000-0000-0000-000000000001', 'listening', 2, 1),
  ('20000000-0000-0000-0000-000000000002', 'listening', 4, 2);

insert into public.learning_sessions (id, user_id)
values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002');

insert into public.knowledge_items (id, item_type, normalized_key, canonical_text)
values ('30000000-0000-0000-0000-000000000003', 'vocabulary', 'test_hello', 'hello');

insert into public.plans (plan_key, display_name)
values ('rls-test-plan', 'RLS test plan')
on conflict (plan_key) do nothing;

insert into public.subscriptions (user_id, plan_id, status, is_current, provider, provider_reference)
select '10000000-0000-0000-0000-000000000001', id, 'free', true, 'test-provider', 'server-only-ref'
from public.plans where plan_key = 'rls-test-plan';

select is(
  (select count(*)::integer from public.profiles where user_id in (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  )),
  2,
  'auth user trigger creates a profile for each new user'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select is((select count(*)::integer from public.profiles), 1, 'User A can read only their own profile');
select is((select count(*)::integer from public.profiles where user_id = '20000000-0000-0000-0000-000000000002'), 0, 'User A cannot read User B profile');
select is((select count(*)::integer from public.learner_ability_estimates where user_id = '20000000-0000-0000-0000-000000000002'), 0, 'User A cannot read User B learner ability');
select is((select count(*)::integer from public.learning_sessions where user_id = '20000000-0000-0000-0000-000000000002'), 0, 'User A cannot access User B session');

select throws_ok(
  $$insert into public.learner_ability_estimates (user_id, dimension, estimate_level, confidence_level)
    values ('10000000-0000-0000-0000-000000000001', 'reading', 6, 3)$$,
  '42501', null,
  'User A cannot insert their own authoritative ability estimate'
);

select throws_ok(
  $$update public.learner_ability_estimates set estimate_level = 6
    where user_id = '10000000-0000-0000-0000-000000000001' and dimension = 'listening'$$,
  '42501', null,
  'User A cannot update their own authoritative ability estimate'
);

select throws_ok(
  $$insert into public.evidence_events
    (user_id, source, evidence_kind, result, evaluator_confidence_level, evidence_strength, independence_level, dedupe_key)
    values
    ('10000000-0000-0000-0000-000000000001', 'evaluator', 'fake_mastery', 'success', 3, 'very_high', 'independent', '0123456789abcdef')$$,
  '42501', null,
  'User A cannot insert trusted evaluator evidence directly'
);

select throws_ok(
  $$insert into public.user_entitlement_overrides
    (user_id, entitlement_definition_id, value, source)
    values
    ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'true'::jsonb, 'self')$$,
  '42501', null,
  'User A cannot grant themselves an entitlement'
);

select throws_ok(
  $$update public.subscriptions set provider = 'evil', provider_reference = 'tampered'
    where user_id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'User A cannot modify subscription provider state'
);

select lives_ok(
  $$insert into public.user_feedback (user_id, feedback_type, value_text)
    values ('10000000-0000-0000-0000-000000000001', 'difficulty', 'appropriate')$$,
  'User A can insert legitimate feedback for themselves'
);

select is(
  (select count(*)::integer from public.knowledge_items where normalized_key = 'test_hello'),
  1,
  'Authenticated users can read active shared knowledge definitions'
);

reset role;
select ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'Anonymous users have no SELECT grant on private learner profiles'
);

select * from finish();
rollback;
