-- Browser transcripts are untrusted client observations, never authoritative scores.
create function public.record_client_transcript(p_user uuid,p_activity uuid,p_attempt uuid,p_text text,p_provider text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare a public.activities; receipt uuid; n integer;
begin
  if p_provider not in ('browser_native','native_os') then raise exception 'Invalid client provider'; end if;
  perform 1 from public.profiles where user_id=p_user for update;
  select * into a from public.activities where id=p_activity and user_id=p_user and activity_type in ('normal_learning','initial_assessment') for update;
  if not found then raise exception 'Invalid activity'; end if;
  select id into receipt from public.voice_interactions where id=p_attempt and user_id=p_user and activity_id=p_activity and provider=p_provider;
  if receipt is not null then
    if exists(select 1 from public.voice_interactions where id=receipt and transcript is distinct from trim(p_text)) then raise exception 'Transcript attempt changed'; end if;
    return receipt;
  end if;
  if a.status<>'active' or not exists(select 1 from public.learning_sessions where id=a.session_id and user_id=p_user and status='active') then raise exception 'Inactive session'; end if;
  if (a.metadata->>'lease_until')::timestamptz>now() then raise exception 'Response processing'; end if;
  if (a.activity_type='normal_learning' and not coalesce((a.metadata->'task'->>'spoken')::boolean,false)) or length(trim(p_text)) not between 1 and 3000 then raise exception 'Invalid transcript'; end if;
  select coalesce(max(attempt_no),0)+1 into n from public.voice_interactions where activity_id=p_activity and interaction_type='stt';
  if n>10 then raise exception 'Use typed fallback after repeated attempts'; end if;
  insert into public.voice_interactions(id,user_id,session_id,activity_id,attempt_no,interaction_type,provider,model,transcript,recognition_status,processing_status,processing_complete,completed_at)
  values(p_attempt,p_user,a.session_id,a.id,n,'stt',p_provider,case when p_provider='native_os' then 'os-managed-en-US' else 'browser-managed-en-US' end,trim(p_text),'client_confirmed_unverified','completed',true,now()) returning id into receipt;
  return receipt;
end $$;

revoke all on function public.record_client_transcript(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_client_transcript(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.record_browser_transcript(p_user uuid,p_activity uuid,p_attempt uuid,p_text text) returns uuid language sql security invoker set search_path='' as $$ select public.record_client_transcript(p_user,p_activity,p_attempt,p_text,'browser_native'); $$;
revoke all on function public.record_browser_transcript(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_browser_transcript(uuid,uuid,uuid,text) to service_role;

create or replace function public.record_native_transcript(p_user uuid,p_activity uuid,p_attempt uuid,p_text text) returns uuid language sql security invoker set search_path='' as $$ select public.record_client_transcript(p_user,p_activity,p_attempt,p_text,'native_os'); $$;
revoke all on function public.record_native_transcript(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_native_transcript(uuid,uuid,uuid,text) to service_role;
