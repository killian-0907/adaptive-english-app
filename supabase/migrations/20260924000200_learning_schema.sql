create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  native_language text,
  interface_language text,
  onboarding_status text not null default 'not_started' check (onboarding_status in ('not_started', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null check (length(goal_type) between 1 and 80),
  priority smallint not null default 3 check (priority between 1 and 5),
  is_active boolean not null default true,
  description text check (description is null or length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, goal_type)
);

create table public.learner_ability_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dimension public.ability_dimension not null,
  estimate_level smallint not null default 0 check (estimate_level between 0 and 6),
  confidence_level smallint not null default 0 check (confidence_level between 0 and 3),
  trend public.trend_direction not null default 'unknown',
  last_evidence_at timestamptz,
  model_version text not null default 'foundation-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, dimension)
);

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  item_type public.knowledge_item_type not null,
  normalized_key text not null check (length(normalized_key) between 1 and 200),
  canonical_text text not null check (length(canonical_text) between 1 and 1000),
  description text,
  language_code text not null default 'en' check (length(language_code) between 2 and 35),
  difficulty_hint smallint check (difficulty_hint is null or difficulty_hint between 0 and 6),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_type, language_code, normalized_key)
);

create table public.learner_knowledge_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete restrict,
  modality public.knowledge_modality not null,
  state public.knowledge_state not null default 'unknown',
  confidence_level smallint not null default 0 check (confidence_level between 0 and 3),
  trend public.trend_direction not null default 'unknown',
  review_need smallint not null default 0 check (review_need between 0 and 3),
  last_evidence_at timestamptz,
  model_version text not null default 'foundation-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, knowledge_item_id, modality)
);

create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status public.session_status not null default 'active',
  primary_goal_id uuid,
  starting_state_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(starting_state_summary) = 'object'),
  ending_state_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(ending_state_summary) = 'object'),
  session_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(session_summary) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint learning_sessions_time_order check (ended_at is null or ended_at >= started_at),
  constraint learning_sessions_primary_goal_owner_fk
    foreign key (primary_goal_id, user_id)
    references public.learning_goals(id, user_id)
    on delete set null (primary_goal_id)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  sequence_no integer not null check (sequence_no >= 0),
  activity_type text not null check (length(activity_type) between 1 and 80),
  learning_purpose public.learning_purpose not null,
  target_skill public.ability_dimension,
  target_knowledge_item_id uuid references public.knowledge_items(id) on delete restrict,
  scenario_key text check (scenario_key is null or length(scenario_key) <= 120),
  difficulty_level smallint not null check (difficulty_level between 0 and 5),
  english_exposure_level smallint not null check (english_exposure_level between 1 and 5),
  correction_strategy text not null check (length(correction_strategy) between 1 and 120),
  support_strategy jsonb not null default '{}'::jsonb check (jsonb_typeof(support_strategy) = 'object'),
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'interrupted', 'abandoned')),
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (session_id, sequence_no),
  constraint activities_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete cascade,
  constraint activities_time_order check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table public.teaching_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  activity_id uuid,
  learning_objective text not null check (length(learning_objective) between 1 and 1000),
  target_skill public.ability_dimension,
  target_knowledge_item_id uuid references public.knowledge_items(id) on delete restrict,
  purpose public.learning_purpose not null,
  selected_method text not null check (length(selected_method) between 1 and 80),
  difficulty_level smallint not null check (difficulty_level between 0 and 5),
  english_exposure_level smallint not null check (english_exposure_level between 1 and 5),
  native_support_level smallint not null check (native_support_level between 0 and 4),
  correction_strategy text not null check (length(correction_strategy) between 1 and 120),
  hint_strategy jsonb not null default '{}'::jsonb check (jsonb_typeof(hint_strategy) = 'object'),
  evidence_to_collect jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_to_collect) = 'array'),
  adaptation_triggers jsonb not null default '[]'::jsonb check (jsonb_typeof(adaptation_triggers) = 'array'),
  return_to_communication_rule text,
  reason_category text not null check (length(reason_category) between 1 and 120),
  evidence_basis text not null check (length(evidence_basis) between 1 and 2000),
  engine_version text not null default 'foundation-v1',
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint teaching_decisions_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete cascade,
  constraint teaching_decisions_activity_owner_fk
    foreign key (activity_id, user_id)
    references public.activities(id, user_id)
    on delete set null (activity_id)
);

create table public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  activity_id uuid,
  feedback_type text not null check (length(feedback_type) between 1 and 80),
  value_text text check (value_text is null or length(value_text) <= 200),
  value_score smallint check (value_score is null or value_score between -5 and 5),
  free_text text check (free_text is null or length(free_text) <= 1000),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint user_feedback_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete set null (session_id),
  constraint user_feedback_activity_owner_fk
    foreign key (activity_id, user_id)
    references public.activities(id, user_id)
    on delete set null (activity_id)
);

create table public.session_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  state_type text not null check (length(state_type) between 1 and 80),
  strength smallint not null check (strength between 0 and 3),
  confidence_level smallint not null check (confidence_level between 0 and 3),
  source text not null check (length(source) between 1 and 80),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint session_states_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete cascade,
  constraint session_states_time_order check (ended_at is null or ended_at >= started_at)
);

create table public.evidence_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  activity_id uuid,
  occurred_at timestamptz not null default now(),
  source public.evidence_source not null,
  source_interaction_id uuid,
  evidence_kind text not null check (length(evidence_kind) between 1 and 120),
  target_skill public.ability_dimension,
  knowledge_item_id uuid references public.knowledge_items(id) on delete restrict,
  modality public.knowledge_modality,
  communication_function text check (communication_function is null or length(communication_function) <= 120),
  result public.evidence_result not null,
  response_quality smallint check (response_quality is null or response_quality between 0 and 4),
  hints_count smallint not null default 0 check (hints_count >= 0),
  retries_count smallint not null default 0 check (retries_count >= 0),
  support_level smallint not null default 0 check (support_level between 0 and 6),
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  transfer_success boolean,
  listening_success boolean,
  voice_uncertainty boolean,
  scenario_success boolean,
  evaluator_confidence_level smallint not null default 0 check (evaluator_confidence_level between 0 and 3),
  evidence_strength public.evidence_strength not null default 'low',
  independence_level public.independence_level not null default 'independent',
  dedupe_key text not null check (length(dedupe_key) between 16 and 200),
  processor_status text not null default 'pending' check (processor_status in ('pending', 'processing', 'applied', 'failed')),
  processor_version text,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, dedupe_key),
  constraint evidence_events_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete set null (session_id),
  constraint evidence_events_activity_owner_fk
    foreign key (activity_id, user_id)
    references public.activities(id, user_id)
    on delete set null (activity_id)
);

create table public.learner_model_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  changed_entity_type text not null check (length(changed_entity_type) between 1 and 80),
  changed_entity_id uuid,
  dimension text not null check (length(dimension) between 1 and 120),
  previous_value jsonb,
  new_value jsonb not null,
  previous_confidence smallint check (previous_confidence is null or previous_confidence between 0 and 3),
  new_confidence smallint check (new_confidence is null or new_confidence between 0 and 3),
  reason_category text not null check (length(reason_category) between 1 and 120),
  change_key text not null check (length(change_key) between 16 and 200),
  model_version text not null default 'foundation-v1',
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, change_key)
);

create table public.learner_model_change_evidence (
  learner_model_change_id uuid not null,
  evidence_event_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (learner_model_change_id, evidence_event_id),
  constraint lmce_change_owner_fk
    foreign key (learner_model_change_id, user_id)
    references public.learner_model_changes(id, user_id)
    on delete cascade,
  constraint lmce_evidence_owner_fk
    foreign key (evidence_event_id, user_id)
    references public.evidence_events(id, user_id)
    on delete cascade
);

create table public.recurring_mistake_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern_key text not null check (length(pattern_key) between 1 and 200),
  mistake_category text not null check (length(mistake_category) between 1 and 120),
  knowledge_item_id uuid references public.knowledge_items(id) on delete restrict,
  modality public.knowledge_modality,
  confidence_level smallint not null default 0 check (confidence_level between 0 and 3),
  severity_level smallint not null default 0 check (severity_level between 0 and 3),
  first_detected_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  occurrence_count integer not null default 1 check (occurrence_count >= 1),
  improvement_state text not null default 'unknown' check (improvement_state in ('unknown', 'worsening', 'stable', 'improving')),
  status public.mistake_status not null default 'candidate',
  model_version text not null default 'foundation-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, pattern_key)
);

create table public.recurring_mistake_evidence (
  pattern_id uuid not null,
  evidence_event_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pattern_id, evidence_event_id),
  constraint rme_pattern_owner_fk
    foreign key (pattern_id, user_id)
    references public.recurring_mistake_patterns(id, user_id)
    on delete cascade,
  constraint rme_evidence_owner_fk
    foreign key (evidence_event_id, user_id)
    references public.evidence_events(id, user_id)
    on delete cascade
);

create table public.learning_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preference_type text not null check (length(preference_type) between 1 and 80),
  target_key text not null check (length(target_key) between 1 and 120),
  value_text text check (value_text is null or length(value_text) <= 500),
  strength smallint not null default 0 check (strength between -2 and 2),
  confidence_level smallint not null default 0 check (confidence_level between 0 and 3),
  source text not null default 'user_feedback' check (length(source) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, preference_type, target_key)
);

create table public.method_effectiveness (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  teaching_method text not null check (length(teaching_method) between 1 and 80),
  target_skill public.ability_dimension,
  effectiveness_state public.method_effectiveness_state not null default 'insufficient_evidence',
  confidence_level smallint not null default 0 check (confidence_level between 0 and 3),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  last_observed_at timestamptz,
  model_version text not null default 'foundation-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.voice_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  activity_id uuid not null,
  attempt_no smallint not null default 1 check (attempt_no >= 1),
  interaction_type public.voice_interaction_type not null,
  source_text text,
  transcript text,
  stt_confidence real check (stt_confidence is null or stt_confidence between 0 and 1),
  recognition_status text,
  replay_count integer not null default 0 check (replay_count >= 0),
  transcript_revealed boolean not null default false,
  translation_revealed boolean not null default false,
  provider text,
  model text,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processing', 'completed', 'failed')),
  processing_complete boolean not null default false,
  audio_object_path text,
  audio_expires_at timestamptz,
  audio_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, user_id),
  unique (activity_id, attempt_no, interaction_type),
  constraint voice_interactions_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete cascade,
  constraint voice_interactions_activity_owner_fk
    foreign key (activity_id, user_id)
    references public.activities(id, user_id)
    on delete cascade,
  constraint voice_interactions_audio_lifecycle check (
    audio_deleted_at is null or audio_object_path is not null
  )
);

create table public.activity_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null,
  sequence_no integer not null check (sequence_no >= 0),
  role text not null check (role in ('learner', 'tutor', 'system_instruction')),
  modality text not null check (modality in ('text', 'voice')),
  content_text text not null,
  voice_interaction_id uuid,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (activity_id, sequence_no),
  constraint activity_messages_activity_owner_fk
    foreign key (activity_id, user_id)
    references public.activities(id, user_id)
    on delete cascade,
  constraint activity_messages_voice_owner_fk
    foreign key (voice_interaction_id, user_id)
    references public.voice_interactions(id, user_id)
    on delete set null (voice_interaction_id)
);

create table public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  activity_id uuid,
  interaction_type text not null check (length(interaction_type) between 1 and 80),
  provider text not null check (length(provider) between 1 and 80),
  model text not null check (length(model) between 1 and 120),
  status text not null check (status in ('pending', 'completed', 'failed')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_units numeric check (estimated_cost_units is null or estimated_cost_units >= 0),
  request_hash text,
  output_message_id uuid,
  error_code text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, user_id),
  constraint ai_interactions_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete set null (session_id),
  constraint ai_interactions_activity_owner_fk
    foreign key (activity_id, user_id)
    references public.activities(id, user_id)
    on delete set null (activity_id),
  constraint ai_interactions_output_message_owner_fk
    foreign key (output_message_id, user_id)
    references public.activity_messages(id, user_id)
    on delete set null (output_message_id)
);

create unique index method_effectiveness_user_method_skill_unique
  on public.method_effectiveness (user_id, teaching_method, target_skill)
  nulls not distinct;

create unique index session_states_one_active_type
  on public.session_states(session_id, state_type)
  where ended_at is null;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger learning_goals_set_updated_at before update on public.learning_goals
for each row execute function public.set_updated_at();
create trigger learner_ability_set_updated_at before update on public.learner_ability_estimates
for each row execute function public.set_updated_at();
create trigger knowledge_items_set_updated_at before update on public.knowledge_items
for each row execute function public.set_updated_at();
create trigger learner_knowledge_set_updated_at before update on public.learner_knowledge_states
for each row execute function public.set_updated_at();
create trigger learning_sessions_set_updated_at before update on public.learning_sessions
for each row execute function public.set_updated_at();
create trigger activities_set_updated_at before update on public.activities
for each row execute function public.set_updated_at();
create trigger recurring_mistakes_set_updated_at before update on public.recurring_mistake_patterns
for each row execute function public.set_updated_at();
create trigger learning_preferences_set_updated_at before update on public.learning_preferences
for each row execute function public.set_updated_at();
create trigger method_effectiveness_set_updated_at before update on public.method_effectiveness
for each row execute function public.set_updated_at();
