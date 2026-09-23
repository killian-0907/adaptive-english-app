-- Start from least privilege. RLS and SQL grants are both intentional layers.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Client-readable / client-writable safe surfaces.
grant select on public.profiles to authenticated;
grant update (native_language, interface_language, onboarding_status) on public.profiles to authenticated;

grant select, delete on public.learning_goals to authenticated;
grant insert (user_id, goal_type, priority, is_active, description) on public.learning_goals to authenticated;
grant update (goal_type, priority, is_active, description) on public.learning_goals to authenticated;

grant select on public.learner_ability_estimates to authenticated;
grant select on public.knowledge_items to authenticated;
grant select on public.learner_knowledge_states to authenticated;
grant select on public.learning_sessions to authenticated;
grant select on public.activities to authenticated;
grant select on public.activity_messages to authenticated;
grant select on public.learning_preferences to authenticated;
grant select on public.user_feedback to authenticated;
grant insert (user_id, session_id, activity_id, feedback_type, value_text, value_score, free_text) on public.user_feedback to authenticated;
grant select on public.voice_interactions to authenticated;

-- Enable RLS on every public table, including backend-only tables.
alter table public.profiles enable row level security;
alter table public.learning_goals enable row level security;
alter table public.learner_ability_estimates enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.learner_knowledge_states enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.activities enable row level security;
alter table public.activity_messages enable row level security;
alter table public.teaching_decisions enable row level security;
alter table public.user_feedback enable row level security;
alter table public.session_states enable row level security;
alter table public.evidence_events enable row level security;
alter table public.learner_model_changes enable row level security;
alter table public.learner_model_change_evidence enable row level security;
alter table public.recurring_mistake_patterns enable row level security;
alter table public.recurring_mistake_evidence enable row level security;
alter table public.learning_preferences enable row level security;
alter table public.method_effectiveness enable row level security;
alter table public.voice_interactions enable row level security;
alter table public.ai_interactions enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlement_definitions enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.user_entitlement_overrides enable row level security;
alter table public.usage_records enable row level security;
alter table public.ad_placement_configs enable row level security;
alter table public.operational_events enable row level security;

create policy profiles_select_own
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_update_own
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy learning_goals_select_own
on public.learning_goals for select to authenticated
using ((select auth.uid()) = user_id);
create policy learning_goals_insert_own
on public.learning_goals for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy learning_goals_update_own
on public.learning_goals for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy learning_goals_delete_own
on public.learning_goals for delete to authenticated
using ((select auth.uid()) = user_id);

create policy learner_ability_select_own
on public.learner_ability_estimates for select to authenticated
using ((select auth.uid()) = user_id);

create policy knowledge_items_authenticated_read
on public.knowledge_items for select to authenticated
using (is_active = true);

create policy learner_knowledge_select_own
on public.learner_knowledge_states for select to authenticated
using ((select auth.uid()) = user_id);

create policy learning_sessions_select_own
on public.learning_sessions for select to authenticated
using ((select auth.uid()) = user_id);

create policy activities_select_own
on public.activities for select to authenticated
using ((select auth.uid()) = user_id);

create policy activity_messages_select_own
on public.activity_messages for select to authenticated
using ((select auth.uid()) = user_id);

create policy learning_preferences_select_own
on public.learning_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy user_feedback_select_own
on public.user_feedback for select to authenticated
using ((select auth.uid()) = user_id);
create policy user_feedback_insert_own
on public.user_feedback for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy voice_interactions_select_own
on public.voice_interactions for select to authenticated
using ((select auth.uid()) = user_id);

-- Backend-only tables intentionally have RLS enabled but no authenticated policy
-- and no authenticated grant. Authoritative mutations use the server-only
-- service-role client through the owning repository/service boundary.
