-- Commercial/product scaffolding only. These are deliberately non-final,
-- harmless defaults and may change when monetization is actually designed.
insert into public.plans (plan_key, display_name, description, is_active, sort_order)
values ('free', 'Free', 'Default MVP plan; commercial limits are not finalized.', true, 0)
on conflict (plan_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

insert into public.entitlement_definitions (entitlement_key, description, value_type, default_value)
values
  ('can_use_voice', 'Whether voice learning capabilities may be used.', 'boolean', 'true'::jsonb),
  ('voice_usage_allowance', 'Configurable voice allowance; null means no product limit is enforced yet.', 'integer', 'null'::jsonb),
  ('ai_usage_allowance', 'Configurable AI allowance; null means no product limit is enforced yet.', 'integer', 'null'::jsonb),
  ('advanced_learning_modes', 'Access to future advanced learning modes.', 'boolean', 'false'::jsonb),
  ('advanced_progress_access', 'Access to future advanced progress features.', 'boolean', 'false'::jsonb),
  ('ads_enabled', 'Whether the account is eligible for future ads.', 'boolean', 'false'::jsonb),
  ('extended_session_length', 'Access to future extended sessions.', 'boolean', 'false'::jsonb),
  ('premium_voice_quality', 'Access to future premium voice quality.', 'boolean', 'false'::jsonb)
on conflict (entitlement_key) do update set
  description = excluded.description,
  value_type = excluded.value_type,
  default_value = excluded.default_value;

insert into public.plan_entitlements (plan_id, entitlement_definition_id, value)
select p.id, e.id,
  case e.entitlement_key
    when 'can_use_voice' then 'true'::jsonb
    when 'voice_usage_allowance' then 'null'::jsonb
    when 'ai_usage_allowance' then 'null'::jsonb
    when 'advanced_learning_modes' then 'false'::jsonb
    when 'advanced_progress_access' then 'false'::jsonb
    when 'ads_enabled' then 'false'::jsonb
    when 'extended_session_length' then 'false'::jsonb
    when 'premium_voice_quality' then 'false'::jsonb
  end
from public.plans p
cross join public.entitlement_definitions e
where p.plan_key = 'free'
on conflict (plan_id, entitlement_definition_id) do update set value = excluded.value;

insert into public.ad_placement_configs (surface_key, enabled, protected_surface, configuration)
values
  ('dashboard', false, false, '{"note":"future surface only"}'::jsonb),
  ('between_learning_blocks', false, false, '{"note":"future surface only"}'::jsonb),
  ('session_complete', false, false, '{"note":"future surface only"}'::jsonb),
  ('progress', false, false, '{"note":"future surface only"}'::jsonb)
on conflict (surface_key) do update set
  enabled = excluded.enabled,
  protected_surface = excluded.protected_surface,
  configuration = excluded.configuration;
