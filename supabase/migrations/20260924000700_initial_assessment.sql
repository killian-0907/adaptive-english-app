-- Phase 8 reuses sessions/activities/evidence. No duplicate onboarding tables.
create unique index one_initial_assessment_per_user on public.learning_sessions(user_id)
where starting_state_summary->>'purpose' = 'initial_assessment_v1';

create function public.save_assessment_onboarding(p_user uuid, p_data jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare g text; m text; preference text;
begin
  perform 1 from public.profiles where user_id=p_user for update;
  update public.profiles set native_language=p_data->>'nativeLanguage', interface_language=p_data->>'interfaceLanguage', onboarding_status='completed' where user_id=p_user;
  update public.learning_goals set is_active=false where user_id=p_user;
  for g in select jsonb_array_elements_text(p_data->'goals') loop
    insert into public.learning_goals(user_id,goal_type,is_active) values(p_user,g,true)
    on conflict(user_id,goal_type) do update set is_active=true;
  end loop;
  delete from public.learning_preferences where user_id=p_user and source='onboarding_hypothesis';
  foreach preference in array array['experience','correction','pace'] loop
    if p_data->>preference is not null then
      insert into public.learning_preferences(user_id,preference_type,target_key,value_text,strength,confidence_level,source)
      values(p_user,preference,'initial',p_data->>preference,1,1,'onboarding_hypothesis')
      on conflict(user_id,preference_type,target_key) do update set value_text=excluded.value_text,source=excluded.source;
    end if;
  end loop;
  foreach preference in array array['liked','disliked'] loop
    for m in select jsonb_array_elements_text(p_data->preference) loop
      insert into public.learning_preferences(user_id,preference_type,target_key,strength,confidence_level,source)
      values(p_user,'method',m,case when preference='liked' then 1 else -1 end,1,'onboarding_hypothesis')
      on conflict(user_id,preference_type,target_key) do update set strength=excluded.strength,source=excluded.source;
    end loop;
  end loop;
end $$;

create function public.start_initial_assessment(p_user uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare sid uuid;
begin
  perform 1 from public.profiles where user_id=p_user and onboarding_status='completed' for update;
  if not found then raise exception 'Complete onboarding first'; end if;
  select id into sid from public.learning_sessions where user_id=p_user and starting_state_summary->>'purpose'='initial_assessment_v1';
  if sid is null then
    insert into public.learning_sessions(user_id,starting_state_summary,session_summary)
    values(p_user,'{"purpose":"initial_assessment_v1"}', '{"version":1,"turns":[],"difficulty":0,"complete":false,"reason":null}') returning id into sid;
  end if;
  return sid;
end $$;

-- A durable lease serializes response evaluation across tabs/processes. Expired leases
-- recover interrupted requests. Provider results are cached before committing evidence.
create function public.claim_assessment_response(p_user uuid, p_activity uuid, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.activities set metadata=metadata || jsonb_build_object('lease',p_token,'lease_until',now()+interval '90 seconds')
  where id=p_activity and user_id=p_user and activity_type='initial_assessment' and status='active'
    and (metadata->>'lease_until' is null or (metadata->>'lease_until')::timestamptz < now());
  return found;
end $$;

create function public.commit_assessment_response(p_user uuid,p_session uuid,p_activity uuid,p_token uuid,p_response jsonb,p_events jsonb,p_state jsonb,p_model jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare a public.activities; s public.learning_sessions; ev jsonb; est jsonb; eid uuid; kid uuid; cid uuid; k record; pattern record; pid uuid;
begin
  select * into s from public.learning_sessions where id=p_session and user_id=p_user for update;
  if not found or s.starting_state_summary->>'purpose' <> 'initial_assessment_v1' then raise exception 'Invalid session'; end if;
  select * into a from public.activities where id=p_activity and session_id=p_session and user_id=p_user for update;
  if not found then raise exception 'Invalid activity'; end if;
  if a.status='completed' then return; end if;
  if a.metadata->>'lease' is distinct from p_token::text then raise exception 'Response lease lost'; end if;
  if a.sequence_no <> jsonb_array_length(s.session_summary->'turns') then raise exception 'Stale assessment response'; end if;
  insert into public.activity_messages(user_id,activity_id,sequence_no,role,modality,content_text,voice_interaction_id)
  values(p_user,p_activity,0,'learner',case when p_response->>'voiceId' is null then 'text' else 'voice' end,coalesce(p_response->>'text',''),(p_response->>'voiceId')::uuid);
  for ev in select value from jsonb_array_elements(p_events) loop
    kid := null;
    if ev->'metadata'->>'knowledge' is not null then
      insert into public.knowledge_items(item_type,normalized_key,canonical_text,difficulty_hint)
      values('communication_behavior','assessment:'||(ev->'metadata'->>'knowledge'),a.metadata->>'prompt',a.difficulty_level)
      on conflict(item_type,language_code,normalized_key) do update set normalized_key=excluded.normalized_key returning id into kid;
    end if;
    insert into public.evidence_events(user_id,session_id,activity_id,source,source_interaction_id,evidence_kind,target_skill,knowledge_item_id,modality,result,response_quality,support_level,evaluator_confidence_level,evidence_strength,independence_level,dedupe_key,metadata,voice_uncertainty)
    values(p_user,p_session,p_activity,case when ev->>'response_quality' is null then 'user_feedback'::public.evidence_source when a.metadata->>'strategy'='exact' then 'deterministic'::public.evidence_source else 'evaluator'::public.evidence_source end,p_activity,ev->>'evidence_kind',(ev->>'target_skill')::public.ability_dimension,kid,(ev->>'modality')::public.knowledge_modality,(ev->>'result')::public.evidence_result,(ev->>'response_quality')::smallint,(ev->>'support_level')::smallint,(ev->>'evaluator_confidence_level')::smallint,'low',case when (ev->>'support_level')::int=0 then 'independent'::public.independence_level else 'heavy_support'::public.independence_level end,
      p_activity::text||':'||(ev->>'evidence_kind')||':'||coalesce(ev->>'target_skill','interaction'),ev->'metadata',ev->>'evidence_kind'='voice_uncertainty')
    on conflict(user_id,dedupe_key) do nothing;
  end loop;
  update public.activities set status='completed',ended_at=now(),metadata=metadata-'lease'-'lease_until' where id=p_activity;
  update public.learning_sessions set session_summary=p_state where id=p_session;
  if (p_state->>'complete')::boolean then
    for est in select value from jsonb_array_elements(p_model) loop
      insert into public.learner_ability_estimates(user_id,dimension,estimate_level,confidence_level,last_evidence_at,model_version)
      values(p_user,(est->>'dimension')::public.ability_dimension,(est->>'estimate_level')::smallint,(est->>'confidence_level')::smallint,now(),'assessment-v1')
      on conflict(user_id,dimension) do nothing returning id into eid;
      if eid is not null then
        insert into public.learner_model_changes(user_id,changed_entity_type,changed_entity_id,dimension,new_value,new_confidence,reason_category,change_key,model_version)
        values(p_user,'ability',eid,est->>'dimension',est,(est->>'confidence_level')::smallint,'initial_assessment',p_session::text||':'||(est->>'dimension'),'assessment-v1') returning id into cid;
        insert into public.learner_model_change_evidence(learner_model_change_id,evidence_event_id,user_id)
        select cid,id,p_user from public.evidence_events where session_id=p_session and user_id=p_user and target_skill=(est->>'dimension')::public.ability_dimension;
      end if;
    end loop;
    for k in select knowledge_item_id,modality,count(distinct activity_id) n,avg(response_quality) quality,max(support_level) support from public.evidence_events
      where session_id=p_session and user_id=p_user and knowledge_item_id is not null and evaluator_confidence_level>0 group by knowledge_item_id,modality loop
      insert into public.learner_knowledge_states(user_id,knowledge_item_id,modality,state,confidence_level,last_evidence_at,model_version)
      values(p_user,k.knowledge_item_id,k.modality,case when k.quality<2 then 'emerging'::public.knowledge_state when k.support>0 then 'supported'::public.knowledge_state when k.n>=2 and k.modality in ('reading_recognition','listening_recognition') then 'recognized'::public.knowledge_state else 'emerging'::public.knowledge_state end,1,now(),'assessment-v1')
      on conflict(user_id,knowledge_item_id,modality) do nothing returning id into eid;
      if eid is not null then
        insert into public.learner_model_changes(user_id,changed_entity_type,changed_entity_id,dimension,new_value,new_confidence,reason_category,change_key,model_version)
        select p_user,'knowledge',eid,k.modality,to_jsonb(ks),1,'initial_assessment',p_session::text||':'||k.knowledge_item_id::text||':'||k.modality,'assessment-v1'
        from public.learner_knowledge_states ks where ks.id=eid returning id into cid;
        insert into public.learner_model_change_evidence(learner_model_change_id,evidence_event_id,user_id)
        select cid,id,p_user from public.evidence_events where session_id=p_session and user_id=p_user and knowledge_item_id=k.knowledge_item_id and modality=k.modality;
      end if;
    end loop;
    for pattern in select error,modality,count(distinct activity_id) n from public.evidence_events cross join lateral jsonb_array_elements_text(coalesce(metadata->'errors','[]')) error
      where session_id=p_session and user_id=p_user and evaluator_confidence_level>0 group by error,modality having count(distinct activity_id)>=3 loop
      insert into public.recurring_mistake_patterns(user_id,pattern_key,mistake_category,modality,confidence_level,severity_level,occurrence_count,model_version)
      values(p_user,'assessment:'||pattern.modality||':'||pattern.error,pattern.error,pattern.modality,1,1,pattern.n,'assessment-v1')
      on conflict(user_id,pattern_key) do nothing returning id into pid;
      if pid is not null then
        insert into public.recurring_mistake_evidence(pattern_id,evidence_event_id,user_id)
        select pid,id,p_user from public.evidence_events where session_id=p_session and user_id=p_user and modality=pattern.modality and metadata->'errors' ? pattern.error;
      end if;
    end loop;
    update public.evidence_events set processor_status='applied',processor_version='assessment-v1',processed_at=now() where session_id=p_session and user_id=p_user;
    update public.learning_sessions set status='completed',ended_at=now(),ending_state_summary=jsonb_build_object('model',p_model,'support',case when (p_state->>'difficulty')::int<=1 then 'native_supported' when (p_state->>'difficulty')::int<=3 then 'english_with_fallback' else 'mostly_english' end) where id=p_session;
  end if;
end $$;

revoke all on function public.save_assessment_onboarding(uuid,jsonb), public.start_initial_assessment(uuid), public.claim_assessment_response(uuid,uuid,uuid), public.commit_assessment_response(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_assessment_onboarding(uuid,jsonb), public.start_initial_assessment(uuid), public.claim_assessment_response(uuid,uuid,uuid), public.commit_assessment_response(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb) to service_role;

create function public.record_assessment_support(p_user uuid,p_activity uuid,p_kind text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m jsonb; s jsonb;
begin
  if p_kind not in ('hints','replays','translation','transcript') then raise exception 'Invalid support'; end if;
  select metadata into m from public.activities where id=p_activity and user_id=p_user and activity_type='initial_assessment' and status='active' for update;
  if not found then raise exception 'Invalid activity'; end if;
  s := coalesce(m->'support','{"hints":0,"replays":0,"retries":0,"translation":false,"transcript":false}');
  if p_kind in ('hints','replays') then s:=jsonb_set(s,array[p_kind],to_jsonb(least(20,coalesce((s->>p_kind)::int,0)+1)));
  else s:=jsonb_set(s,array[p_kind],'true'); end if;
  update public.activities set metadata=jsonb_set(metadata,'{support}',s) where id=p_activity;
  return s;
end $$;
revoke all on function public.record_assessment_support(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_assessment_support(uuid,uuid,text) to service_role;

-- Merge cached evaluation / release the lease without replacing concurrent support records.
create function public.cache_assessment_evaluation(p_user uuid,p_activity uuid,p_token uuid,p_hash text,p_evaluation jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_hash is null then
    update public.activities set metadata=metadata-'lease'-'lease_until' where id=p_activity and user_id=p_user and metadata->>'lease'=p_token::text;
  else
    update public.activities set metadata=metadata||jsonb_build_object('responseHash',p_hash,'evaluation',p_evaluation) where id=p_activity and user_id=p_user and metadata->>'lease'=p_token::text and status='active';
    if not found then raise exception 'Response lease lost'; end if;
  end if;
end $$;
revoke all on function public.cache_assessment_evaluation(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.cache_assessment_evaluation(uuid,uuid,uuid,text,jsonb) to service_role;
