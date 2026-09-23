create extension if not exists pgcrypto with schema extensions;

create type public.ability_dimension as enum (
  'listening',
  'spoken_expression',
  'spoken_fluency',
  'conversational_response',
  'intelligibility',
  'reading',
  'written_expression',
  'vocabulary',
  'grammar',
  'sentence_formation',
  'practical_communication'
);

create type public.knowledge_item_type as enum (
  'vocabulary',
  'grammar_pattern',
  'sentence_pattern',
  'expression',
  'communication_behavior'
);

create type public.knowledge_modality as enum (
  'reading_recognition',
  'listening_recognition',
  'written_production',
  'spoken_production',
  'real_life_use'
);

create type public.knowledge_state as enum (
  'unknown',
  'emerging',
  'recognized',
  'supported',
  'independent',
  'strong'
);

create type public.trend_direction as enum ('unknown', 'declining', 'stable', 'improving');
create type public.evidence_source as enum ('deterministic', 'evaluator', 'user_feedback', 'voice_processor', 'system');
create type public.evidence_result as enum ('success', 'partial', 'failure', 'neutral');
create type public.evidence_strength as enum ('low', 'medium', 'high', 'very_high');
create type public.independence_level as enum ('independent', 'light_support', 'moderate_support', 'heavy_support');
create type public.session_status as enum ('active', 'completed', 'interrupted', 'abandoned');
create type public.learning_purpose as enum ('weakness_repair', 'review', 'progression', 'transfer', 'communication', 'consolidation');
create type public.mistake_status as enum ('candidate', 'likely', 'established', 'improving', 'resolved_monitor');
create type public.method_effectiveness_state as enum ('insufficient_evidence', 'promising', 'repeatedly_helpful', 'mixed', 'not_currently_showing_benefit');
create type public.subscription_status as enum ('free', 'trial', 'active', 'canceled', 'expired', 'payment_issue');
create type public.voice_interaction_type as enum ('stt', 'tts', 'listening_attempt', 'spoken_response');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
