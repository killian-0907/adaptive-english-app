-- Private service-owned commercial state. No browser mutation policies.
create table public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text not null unique check (customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at timestamptz not null default now()
);
create table public.billing_events (
  event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  processed_at timestamptz not null default now()
);
create table public.billing_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.billing_customers enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_locks enable row level security;
revoke all on public.billing_customers, public.billing_events, public.billing_locks from public, anon, authenticated;
grant all on public.billing_customers, public.billing_events, public.billing_locks to service_role;

create function public.acquire_billing_lock(p_user uuid, p_token uuid, p_deleting boolean default false)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  -- Lock the app-owned identity row; service_role intentionally has no direct
  -- auth.users table permission. Do not widen Auth schema grants.
  perform 1 from public.profiles where user_id=p_user for update;
  if not found then return p_deleting; end if;
  if not p_deleting and exists(select 1 from public.account_deletion_jobs where user_id=p_user) then return false; end if;
  insert into public.billing_locks values(p_user,p_token,now()+interval '5 minutes')
    on conflict(user_id) do update set token=excluded.token,expires_at=excluded.expires_at
    where public.billing_locks.expires_at < now();
  return found;
end $$;
revoke all on function public.acquire_billing_lock(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.acquire_billing_lock(uuid,uuid,boolean) to service_role;

-- Caller holds per-customer lease while retrieving fresh provider state. Event insert
-- and entitlement state commit together; a failed transaction remains retryable.
create function public.apply_billing_event(p_event text,p_user uuid,p_token uuid,p_subscription text,p_status public.subscription_status,p_start timestamptz,p_end timestamptz,p_cancel boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_plan uuid;
begin
  perform 1 from public.billing_locks where user_id=p_user and token=p_token and expires_at>now() for update;
  if not found then raise exception 'Billing lease expired'; end if;
  if exists(select 1 from public.account_deletion_jobs where user_id=p_user) then return false; end if;
  insert into public.billing_events(event_id) values(p_event) on conflict do nothing;
  if not found then return false; end if;
  select id into strict v_plan from public.plans where plan_key='premium' and is_active;
  update public.subscriptions set is_current=false where user_id=p_user and is_current;
  insert into public.subscriptions(user_id,plan_id,status,started_at,ends_at,provider,provider_reference,provider_metadata)
    values(p_user,v_plan,p_status,p_start,p_end,'stripe_test',p_subscription,jsonb_build_object('cancel_at_period_end',p_cancel));
  return true;
end $$;
revoke all on function public.apply_billing_event(text,uuid,uuid,text,public.subscription_status,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.apply_billing_event(text,uuid,uuid,text,public.subscription_status,timestamptz,timestamptz,boolean) to service_role;

-- Allowances are monthly provider-call counts, independent of learner state.
-- Reservation happens BEFORE a provider call; advisory lock prevents concurrent overspend.
create function public.reserve_provider_usage(p_user uuid,p_resource text,p_limit integer,p_key text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_total numeric;
begin
  if p_resource not in ('premium_voice_calls','premium_ai_calls') or p_limit<0 then raise exception 'Invalid allowance'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  if exists(select 1 from public.account_deletion_jobs where user_id=p_user) then raise exception 'Account unavailable'; end if;
  select id into v_id from public.usage_records where user_id=p_user and dedupe_key=p_key;
  if found then raise exception 'Duplicate reservation'; end if;
  select coalesce(sum(amount),0) into v_total from public.usage_records where user_id=p_user and resource_type=p_resource
    and period_start=date_trunc('month',now() at time zone 'UTC')::date and status in ('pending','recorded');
  if p_limit is not null and v_total>=p_limit then return null; end if;
  insert into public.usage_records(user_id,resource_type,amount,unit,period_start,period_end,dedupe_key,status)
    values(p_user,p_resource,1,'calls',date_trunc('month',now() at time zone 'UTC')::date,
      (date_trunc('month',now() at time zone 'UTC')+interval '1 month - 1 day')::date,p_key,'pending') returning id into v_id;
  return v_id;
end $$;
revoke all on function public.reserve_provider_usage(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_provider_usage(uuid,text,integer,text) to service_role;

-- Production bootstrap must not depend on running the development seed (which
-- deliberately resets commercial settings). Preserve all existing configuration.
insert into public.entitlement_definitions(entitlement_key,description,value_type,default_value) values
('can_use_voice','Voice capabilities available','boolean','true'),
('voice_usage_allowance','Monthly successful or pending provider voice calls; null means unlimited','integer','null'),
('ai_usage_allowance','Monthly successful or pending enhanced evaluator calls; null means unlimited','integer','null'),
('advanced_learning_modes','Future advanced learning modes','boolean','false'),
('advanced_progress_access','Future advanced progress','boolean','false'),
('ads_enabled','Eligible for approved non-learning ad placements','boolean','false'),
('extended_session_length','Future extended sessions','boolean','false'),
('premium_voice_quality','Future premium voice','boolean','false') on conflict do nothing;
insert into public.plans(plan_key,display_name,description,sort_order,metadata)
values('free','Free','Adaptive practice with browser voice, core scenarios and basic progress.',0,
 '{"features":[{"label":"Adaptive learning","available":true},{"label":"Browser voice where supported","available":true},{"label":"Core scenarios and progress","available":true}]}') on conflict do nothing;
insert into public.plan_entitlements(plan_id,entitlement_definition_id,value)
select p.id,e.id,e.default_value from public.plans p cross join public.entitlement_definitions e where p.plan_key='free' on conflict do nothing;
insert into public.ad_placement_configs(surface_key) values('dashboard'),('progress'),('session_complete'),('between_learning_blocks') on conflict do nothing;

insert into public.plans(plan_key,display_name,description,sort_order,metadata)
values('premium','Premium','Test-mode membership. Core learning remains available on Free.',2,
  '{"features":[{"label":"Ad-free eligible surfaces","available":true},{"label":"Premium voice (provider availability required)","available":false},{"label":"Advanced learning modes","available":false}]}');
insert into public.plan_entitlements(plan_id,entitlement_definition_id,value)
select p.id,e.id,case when e.entitlement_key='ads_enabled' then 'false'::jsonb
  when e.entitlement_key='can_use_voice' then 'true'::jsonb else e.default_value end
from public.plans p cross join public.entitlement_definitions e where p.plan_key='premium';
update public.plans set is_active=false where plan_key='membership_preview';
