create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;
select plan(9);

insert into auth.users (id, email) values
  ('50000000-0000-0000-0000-000000000005', 'constraint-a@example.test'),
  ('60000000-0000-0000-0000-000000000006', 'constraint-b@example.test');

insert into public.knowledge_items (id, item_type, normalized_key, canonical_text)
values ('70000000-0000-0000-0000-000000000007', 'vocabulary', 'appointment_test', 'appointment');

insert into public.learning_sessions (id, user_id) values
  ('51000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000005'),
  ('61000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000006');

insert into public.activities
  (id, user_id, session_id, sequence_no, activity_type, learning_purpose, difficulty_level, english_exposure_level, correction_strategy)
values
  ('52000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000005', '51000000-0000-0000-0000-000000000005', 1, 'listening', 'communication', 2, 2, 'meaning_first'),
  ('62000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000006', '61000000-0000-0000-0000-000000000006', 1, 'listening', 'communication', 2, 2, 'meaning_first');

select throws_ok(
  $$insert into public.learner_ability_estimates (user_id, dimension, estimate_level, confidence_level)
    values ('50000000-0000-0000-0000-000000000005', 'listening', 7, 0)$$,
  '23514', null,
  'Ability estimate level is constrained to 0..6'
);

insert into public.learner_ability_estimates (user_id, dimension, estimate_level, confidence_level)
values ('50000000-0000-0000-0000-000000000005', 'listening', 2, 1);

select throws_ok(
  $$insert into public.learner_ability_estimates (user_id, dimension, estimate_level, confidence_level)
    values ('50000000-0000-0000-0000-000000000005', 'listening', 3, 2)$$,
  '23505', null,
  'Only one current ability estimate exists per user and dimension'
);

insert into public.learner_knowledge_states (user_id, knowledge_item_id, modality, state, confidence_level)
values
  ('50000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000007', 'reading_recognition', 'strong', 3),
  ('50000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000007', 'spoken_production', 'emerging', 1);

select is(
  (select count(*)::integer from public.learner_knowledge_states where user_id = '50000000-0000-0000-0000-000000000005' and knowledge_item_id = '70000000-0000-0000-0000-000000000007'),
  2,
  'Same knowledge item can carry distinct modality-specific states'
);

select throws_ok(
  $$insert into public.learner_knowledge_states (user_id, knowledge_item_id, modality, state, confidence_level)
    values ('50000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000007', 'spoken_production', 'strong', 3)$$,
  '23505', null,
  'Knowledge state is unique per user, item, and modality'
);

insert into public.evidence_events
  (user_id, activity_id, session_id, source, evidence_kind, result, evaluator_confidence_level, evidence_strength, independence_level, dedupe_key)
values
  ('50000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000005', '51000000-0000-0000-0000-000000000005', 'deterministic', 'test_result', 'success', 3, 'medium', 'independent', 'dedupe-key-000001');

select throws_ok(
  $$insert into public.evidence_events
    (user_id, source, evidence_kind, result, evaluator_confidence_level, evidence_strength, independence_level, dedupe_key)
    values ('50000000-0000-0000-0000-000000000005', 'deterministic', 'duplicate', 'success', 3, 'medium', 'independent', 'dedupe-key-000001')$$,
  '23505', null,
  'Evidence dedupe key prevents duplicate logical evidence for a user'
);

select throws_ok(
  $$insert into public.evidence_events
    (user_id, activity_id, source, evidence_kind, result, evaluator_confidence_level, evidence_strength, independence_level, dedupe_key)
    values ('50000000-0000-0000-0000-000000000005', '62000000-0000-0000-0000-000000000006', 'system', 'cross_user_attempt', 'neutral', 0, 'low', 'independent', 'dedupe-key-000002')$$,
  '23503', null,
  'Composite ownership foreign key blocks User A evidence from pointing at User B activity'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in (
        'profiles','learning_goals','learner_ability_estimates','knowledge_items','learner_knowledge_states',
        'learning_sessions','activities','activity_messages','teaching_decisions','user_feedback','session_states',
        'evidence_events','learner_model_changes','learner_model_change_evidence','recurring_mistake_patterns',
        'recurring_mistake_evidence','learning_preferences','method_effectiveness','voice_interactions','ai_interactions',
        'plans','subscriptions','entitlement_definitions','plan_entitlements','user_entitlement_overrides','usage_records',
        'ad_placement_configs','operational_events'
      )
      and not c.relrowsecurity
  ),
  0,
  'RLS is enabled on all public application tables'
);

select is(
  (select public from storage.buckets where id = 'voice-temp'),
  false,
  'Temporary voice bucket is private'
);

select ok(
  exists(select 1 from pg_indexes where schemaname = 'public' and indexname = 'evidence_events_user_knowledge_modality_time_idx'),
  'Evidence knowledge/modality history index exists'
);

select * from finish();
rollback;
