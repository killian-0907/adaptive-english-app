create table public.plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique check (length(plan_key) between 1 and 80),
  display_name text not null check (length(display_name) between 1 and 120),
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status public.subscription_status not null default 'free',
  is_current boolean not null default true,
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  ends_at timestamptz,
  provider text,
  provider_reference text,
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ends_at is null or ends_at >= started_at)
);

create unique index subscriptions_one_current_per_user
  on public.subscriptions(user_id)
  where is_current = true;

create table public.entitlement_definitions (
  id uuid primary key default gen_random_uuid(),
  entitlement_key text not null unique check (length(entitlement_key) between 1 and 100),
  description text not null,
  value_type text not null check (value_type in ('boolean', 'integer', 'numeric', 'text', 'json')),
  default_value jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_entitlements (
  plan_id uuid not null references public.plans(id) on delete restrict,
  entitlement_definition_id uuid not null references public.entitlement_definitions(id) on delete restrict,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, entitlement_definition_id)
);

create table public.user_entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_definition_id uuid not null references public.entitlement_definitions(id) on delete restrict,
  value jsonb not null,
  source text not null check (length(source) between 1 and 80),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (length(resource_type) between 1 and 80),
  amount numeric not null check (amount >= 0),
  unit text not null check (length(unit) between 1 and 40),
  period_start date not null,
  period_end date not null,
  session_id uuid,
  activity_id uuid,
  status text not null default 'recorded' check (status in ('pending', 'recorded', 'voided')),
  dedupe_key text not null check (length(dedupe_key) between 16 and 200),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  check (period_end >= period_start),
  constraint usage_records_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete set null (session_id),
  constraint usage_records_activity_owner_fk
    foreign key (activity_id, user_id)
    references public.activities(id, user_id)
    on delete set null (activity_id)
);

create table public.ad_placement_configs (
  id uuid primary key default gen_random_uuid(),
  surface_key text not null unique check (length(surface_key) between 1 and 100),
  enabled boolean not null default false,
  protected_surface boolean not null default false,
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.operational_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid,
  activity_id uuid,
  event_name text not null check (length(event_name) between 1 and 120),
  severity text check (severity is null or severity in ('debug', 'info', 'warning', 'error')),
  request_id text,
  occurred_at timestamptz not null default now(),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  constraint operational_events_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete set null (session_id),
  constraint operational_events_activity_owner_fk
    foreign key (activity_id, user_id)
    references public.activities(id, user_id)
    on delete set null (activity_id)
);

create trigger plans_set_updated_at before update on public.plans
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();
create trigger entitlement_definitions_set_updated_at before update on public.entitlement_definitions
for each row execute function public.set_updated_at();
create trigger plan_entitlements_set_updated_at before update on public.plan_entitlements
for each row execute function public.set_updated_at();
create trigger entitlement_overrides_set_updated_at before update on public.user_entitlement_overrides
for each row execute function public.set_updated_at();
create trigger ad_placement_configs_set_updated_at before update on public.ad_placement_configs
for each row execute function public.set_updated_at();

-- Private bucket; no browser Storage policies are created in this phase. Future
-- voice code should use signed/server-owned uploads and delete raw audio quickly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-temp',
  'voice-temp',
  false,
  10485760,
  array['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
