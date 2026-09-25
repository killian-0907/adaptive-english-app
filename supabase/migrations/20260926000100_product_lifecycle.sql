-- Private durable deletion queue: survives Auth deletion for storage retry.
create table public.account_deletion_jobs (
  user_id uuid primary key,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.account_deletion_jobs enable row level security;
revoke all on public.account_deletion_jobs from public,anon,authenticated;
grant all on public.account_deletion_jobs to service_role;

create table public.request_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  requests integer not null,
  primary key(user_id,action)
);
alter table public.request_limits enable row level security;
revoke all on public.request_limits from public,anon,authenticated;
grant all on public.request_limits to service_role;
create function public.take_request_slot(p_user uuid,p_action text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
  if p_limit not between 1 and 1000 or p_seconds not between 1 and 86400 then raise exception 'Invalid limit'; end if;
  if exists(select 1 from public.account_deletion_jobs where user_id=p_user) then return false; end if;
  insert into public.request_limits values(p_user,p_action,now(),1)
  on conflict(user_id,action) do update set
    requests=case when request_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else request_limits.requests+1 end,
    window_start=case when request_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else request_limits.window_start end
  returning requests into n;
  return n<=p_limit;
end $$;
revoke all on function public.take_request_slot(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.take_request_slot(uuid,text,integer,integer) to service_role;

alter table public.voice_interactions drop constraint voice_interactions_audio_lifecycle;
update public.voice_interactions set audio_object_path=null where audio_deleted_at is not null;
alter table public.voice_interactions add constraint voice_interactions_audio_lifecycle check(audio_deleted_at is null or audio_object_path is null);
create index voice_cleanup_pending_idx on public.voice_interactions(created_at) where audio_object_path is not null and audio_deleted_at is null;
-- Operational events may contain user context. Remove them with the account.
alter table public.operational_events drop constraint operational_events_user_id_fkey;
alter table public.operational_events add constraint operational_events_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
