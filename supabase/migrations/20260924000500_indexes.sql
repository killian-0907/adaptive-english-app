create index evidence_events_user_time_idx
  on public.evidence_events(user_id, occurred_at desc);
create index evidence_events_user_skill_time_idx
  on public.evidence_events(user_id, target_skill, occurred_at desc);
create index evidence_events_user_knowledge_modality_time_idx
  on public.evidence_events(user_id, knowledge_item_id, modality, occurred_at desc)
  where knowledge_item_id is not null;
create index evidence_events_pending_idx
  on public.evidence_events(user_id, processor_status, occurred_at)
  where processor_status <> 'applied';

create index learner_knowledge_review_idx
  on public.learner_knowledge_states(user_id, review_need desc, last_evidence_at)
  where review_need > 0;

create index learning_sessions_user_started_idx
  on public.learning_sessions(user_id, started_at desc);
create index activities_user_started_idx
  on public.activities(user_id, started_at desc);
create index teaching_decisions_session_created_idx
  on public.teaching_decisions(session_id, created_at);
create index teaching_decisions_activity_idx
  on public.teaching_decisions(activity_id)
  where activity_id is not null;

create index recurring_mistakes_active_idx
  on public.recurring_mistake_patterns(user_id, status, severity_level desc, last_observed_at desc);
create index recurring_mistakes_recent_unresolved_idx
  on public.recurring_mistake_patterns(user_id, last_observed_at desc)
  where status <> 'resolved_monitor';

create index learning_preferences_user_type_idx
  on public.learning_preferences(user_id, preference_type);
create index method_effectiveness_user_method_idx
  on public.method_effectiveness(user_id, teaching_method);

create index voice_interactions_session_activity_time_idx
  on public.voice_interactions(session_id, activity_id, created_at);
create index voice_interactions_audio_expiration_idx
  on public.voice_interactions(audio_expires_at)
  where audio_object_path is not null and audio_deleted_at is null;

create index usage_records_user_resource_period_idx
  on public.usage_records(user_id, resource_type, period_start, period_end);
create index subscriptions_user_current_idx
  on public.subscriptions(user_id, is_current);
create index entitlement_overrides_resolution_idx
  on public.user_entitlement_overrides(user_id, entitlement_definition_id, starts_at, ends_at);

create index operational_events_time_idx on public.operational_events(occurred_at desc);
create index operational_events_name_time_idx on public.operational_events(event_name, occurred_at desc);
