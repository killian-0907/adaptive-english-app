-- A per-learner revision serializes short deterministic writes. No AI calls run here.
alter table public.profiles add column learning_revision bigint not null default 0;
create unique index one_active_normal_session on public.learning_sessions(user_id)
where status='active' and starting_state_summary->>'purpose'='normal_learning_v1';

create function public.start_learning(p_user uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare sid uuid;
begin
  perform 1 from public.profiles where user_id=p_user for update;
  if not exists(select 1 from public.learning_sessions where user_id=p_user and starting_state_summary->>'purpose'='initial_assessment_v1' and status='completed') then raise exception 'Complete the initial assessment first'; end if;
  select id into sid from public.learning_sessions where user_id=p_user and status='active' and starting_state_summary->>'purpose'='normal_learning_v1';
  if sid is null then
    insert into public.learning_sessions(user_id,starting_state_summary,session_summary) values(p_user,'{"purpose":"normal_learning_v1"}','{"completed":0}') returning id into sid;
    insert into public.session_states(user_id,session_id,state_type,strength,confidence_level,source) values(p_user,sid,'normal',1,1,'session_start');
    update public.profiles set learning_revision=learning_revision+1 where user_id=p_user;
  end if;
  return sid;
end $$;

-- One consistent snapshot, including pending evidence after a worker interruption.
create function public.learning_snapshot(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  perform 1 from public.profiles where user_id=p_user for update;
  select jsonb_build_object(
    'revision',p.learning_revision,'language',coalesce(p.native_language,'en'),
    'abilities',coalesce((select jsonb_agg(to_jsonb(x)) from public.learner_ability_estimates x where x.user_id=p_user),'[]'),
    'knowledge',coalesce((select jsonb_agg(to_jsonb(x)) from public.learner_knowledge_states x where x.user_id=p_user),'[]'),
    'patterns',coalesce((select jsonb_agg(to_jsonb(x)) from public.recurring_mistake_patterns x where x.user_id=p_user),'[]'),
    'effects',coalesce((select jsonb_agg(to_jsonb(x)) from public.method_effectiveness x where x.user_id=p_user),'[]'),
    'preferences',coalesce((select jsonb_agg(to_jsonb(x)) from public.learning_preferences x where x.user_id=p_user),'[]'),
    'goals',coalesce((select jsonb_agg(x.goal_type) from public.learning_goals x where x.user_id=p_user and is_active),'[]'),
    'catalog',coalesce((select jsonb_agg(jsonb_build_object('id',id,'normalized_key',normalized_key)) from public.knowledge_items where normalized_key like 'learning:%'),'[]'),
    'evidence',coalesce((select jsonb_agg(to_jsonb(x) order by occurred_at,id) from (select * from public.evidence_events where user_id=p_user and evidence_kind='learning_performance' and (processor_status='pending' or id in (select id from public.evidence_events where user_id=p_user and evidence_kind='learning_performance' order by occurred_at desc,id desc limit 500))) x),'[]'),
    'history',coalesce((select jsonb_agg(to_jsonb(x) order by created_at,id) from (select * from public.activities where user_id=p_user and activity_type='normal_learning' order by created_at desc,id desc limit 100) x),'[]'),
    'states',coalesce((select jsonb_agg(to_jsonb(x)) from public.session_states x where user_id=p_user and ended_at is null),'[]')
  ) into result from public.profiles p where p.user_id=p_user;
  return result;
end $$;

create function public.plan_learning(p_user uuid,p_session uuid,p_revision bigint,p_decision jsonb,p_task jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare rev bigint; aid uuid; kid uuid; seq integer;
begin
  select learning_revision into rev from public.profiles where user_id=p_user for update;
  perform 1 from public.learning_sessions where id=p_session and user_id=p_user and status='active' and starting_state_summary->>'purpose'='normal_learning_v1' for update;
  if not found then raise exception 'Invalid learning session'; end if;
  select id into aid from public.activities where session_id=p_session and user_id=p_user and status='active';
  if aid is not null then return aid; end if;
  if rev<>p_revision then return null; end if;
  if p_decision->>'version'<>'learning-v1' or p_task->>'topic' is distinct from p_decision->>'topic' then raise exception 'Invalid plan'; end if;
  insert into public.knowledge_items(item_type,normalized_key,canonical_text,difficulty_hint)
  values('communication_behavior','learning:'||(p_decision->>'topic'),p_decision->>'objective',(p_decision->>'difficulty')::smallint)
  on conflict(item_type,language_code,normalized_key) do update set normalized_key=excluded.normalized_key returning id into kid;
  select coalesce(max(sequence_no)+1,0) into seq from public.activities where session_id=p_session;
  insert into public.activities(user_id,session_id,sequence_no,activity_type,learning_purpose,target_skill,target_knowledge_item_id,scenario_key,difficulty_level,english_exposure_level,correction_strategy,support_strategy,status,started_at,metadata)
  values(p_user,p_session,seq,'normal_learning',(p_decision->>'purpose')::public.learning_purpose,(p_decision->>'targetSkill')::public.ability_dimension,kid,p_decision->>'scenario',(p_decision->>'difficulty')::smallint,(p_decision->>'exposure')::smallint,p_decision->>'correction',p_decision->'support','active',now(),jsonb_build_object('decision',p_decision,'task',p_task||jsonb_build_object('knowledgeId',kid),'support',(p_decision->'support'->>'initial')::int,'replay',0,'transcript',false)) returning id into aid;
  if p_decision->>'method' in ('sentence_building','grammar_explanation') then
    update public.activities set metadata=jsonb_set(metadata,'{support}',to_jsonb(greatest(4,(metadata->>'support')::int))) where id=aid;
  end if;
  if coalesce((p_task->>'audio')::boolean,false) and coalesce((p_decision->'listening'->>'transcript')::boolean,false) then
    update public.activities set metadata=metadata||jsonb_build_object('support',greatest(5,(metadata->>'support')::int),'transcript',true) where id=aid;
  end if;
  insert into public.teaching_decisions(user_id,session_id,activity_id,learning_objective,target_skill,target_knowledge_item_id,purpose,selected_method,difficulty_level,english_exposure_level,native_support_level,correction_strategy,hint_strategy,evidence_to_collect,adaptation_triggers,return_to_communication_rule,reason_category,evidence_basis,engine_version)
  values(p_user,p_session,aid,p_decision->>'objective',(p_decision->>'targetSkill')::public.ability_dimension,kid,(p_decision->>'purpose')::public.learning_purpose,p_decision->>'method',(p_decision->>'difficulty')::smallint,(p_decision->>'exposure')::smallint,(p_decision->>'nativeSupport')::smallint,p_decision->>'correction',p_decision->'support',p_decision->'collect',p_decision->'triggers',p_decision->>'returnRule','rule_selection',(p_decision->'reasons')::text,'learning-v1');
  update public.profiles set learning_revision=learning_revision+1 where user_id=p_user;
  return aid;
end $$;

create function public.claim_learning_response(p_user uuid,p_activity uuid,p_token uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.profiles where user_id=p_user for update;
  update public.activities a set metadata=metadata||jsonb_build_object('lease',p_token,'lease_until',now()+interval '90 seconds')
  where a.id=p_activity and a.user_id=p_user and a.activity_type='normal_learning' and a.status='active'
  and exists(select 1 from public.learning_sessions s where s.id=a.session_id and s.user_id=p_user and s.status='active')
  and (metadata->>'lease_until' is null or (metadata->>'lease_until')::timestamptz<now());
  return found;
end $$;

-- User feedback changes format/support now; it is never negative ability evidence.
create function public.control_learning(p_user uuid,p_activity uuid,p_action text,p_value text) returns void language plpgsql security invoker set search_path='' as $$
declare a public.activities; lev integer; state text; method text; feedback_eid uuid; state_id uuid; change_id uuid;
begin
  perform 1 from public.profiles where user_id=p_user for update;
  select * into a from public.activities where id=p_activity and user_id=p_user and activity_type='normal_learning' for update;
  if not found then raise exception 'Invalid activity'; end if;
  if a.status='interrupted' and a.metadata->>'feedback'=p_value then return; end if;
  if a.status<>'active' or not exists(select 1 from public.learning_sessions where id=a.session_id and status='active') then raise exception 'Inactive activity'; end if;
  if (a.metadata->>'lease_until')::timestamptz>now() then raise exception 'Response is processing; retry shortly'; end if;
  if p_action='support' then
    if p_value not in ('next','native','transcript','replay') then raise exception 'Invalid support'; end if;
    lev:=coalesce((a.metadata->>'support')::int,0);
    lev:=case when p_value='next' then least(6,lev+1) when p_value in ('native','transcript') then greatest(5,lev) when coalesce((a.metadata->>'replay')::int,0)>0 then greatest(1,lev) else lev end;
    update public.activities set metadata=metadata||jsonb_build_object('support',lev,'replay',coalesce((metadata->>'replay')::int,0)+case when p_value='replay' then 1 else 0 end,'transcript',coalesce((metadata->>'transcript')::boolean,false) or p_value='transcript') where id=p_activity;
  elsif p_action='feedback' then
    if p_value not in ('reject_method','too_difficult','cannot_understand','cannot_retrieve','less_correction','more_speaking','tired','bored','frustrated','engaged','normal','provider_fallback') then raise exception 'Invalid feedback'; end if;
    method:=a.metadata->'decision'->>'method';
    insert into public.user_feedback(user_id,session_id,activity_id,feedback_type,value_text) values(p_user,a.session_id,a.id,p_value,method);
    insert into public.evidence_events(user_id,session_id,activity_id,source,evidence_kind,result,dedupe_key,processor_status,processor_version,processed_at,metadata)
    values(p_user,a.session_id,a.id,'user_feedback','learning_feedback','neutral',a.id::text||':feedback:'||p_value,'applied','learning-v1',now(),jsonb_build_object('feedback',p_value,'method',method)) on conflict(user_id,dedupe_key) do nothing;
    select id into feedback_eid from public.evidence_events where user_id=p_user and dedupe_key=a.id::text||':feedback:'||p_value;
    if p_value='reject_method' then
      insert into public.learning_preferences(user_id,preference_type,target_key,strength,confidence_level,source) values(p_user,'method',method,-2,3,'explicit_feedback')
      on conflict(user_id,preference_type,target_key) do update set strength=-2,confidence_level=3,source='explicit_feedback';
    elsif p_value='less_correction' then
      insert into public.learning_preferences(user_id,preference_type,target_key,value_text,strength,confidence_level,source) values(p_user,'correction','initial','gentle',1,3,'explicit_feedback')
      on conflict(user_id,preference_type,target_key) do update set value_text='gentle',confidence_level=3,source='explicit_feedback';
    elsif p_value='more_speaking' then
      insert into public.learning_preferences(user_id,preference_type,target_key,strength,confidence_level,source) values(p_user,'method','speaking',2,3,'explicit_feedback')
      on conflict(user_id,preference_type,target_key) do update set strength=2,confidence_level=3,source='explicit_feedback';
    end if;
    state:=case p_value when 'too_difficult' then 'overloaded' when 'cannot_understand' then 'increased_support_need' when 'cannot_retrieve' then 'increased_support_need' when 'tired' then 'tired' when 'frustrated' then 'frustrated' when 'bored' then 'bored' when 'engaged' then 'highly_engaged' when 'normal' then 'normal' else null end;
    if state is not null then
      update public.session_states set ended_at=now() where session_id=a.session_id and user_id=p_user and ended_at is null;
      insert into public.session_states(user_id,session_id,state_type,strength,confidence_level,source) values(p_user,a.session_id,state,2,3,'explicit_feedback') returning id into state_id;
      insert into public.learner_model_changes(user_id,changed_entity_type,changed_entity_id,dimension,new_value,new_confidence,reason_category,change_key,model_version)
      values(p_user,'session_state',state_id,'temporary_session_state',jsonb_build_object('state',state),3,'explicit_feedback',a.id::text||':session-state:'||p_value,'learning-v1') returning id into change_id;
      insert into public.learner_model_change_evidence(learner_model_change_id,evidence_event_id,user_id) values(change_id,feedback_eid,p_user);
    end if;
    update public.activities set status='interrupted',ended_at=now(),metadata=metadata||jsonb_build_object('feedback',p_value) where id=p_activity;
  else raise exception 'Invalid control action'; end if;
  update public.profiles set learning_revision=learning_revision+1 where user_id=p_user;
end $$;

create function public.commit_learning_response(p_user uuid,p_activity uuid,p_token uuid,p_revision bigint,p_response jsonb,p_events jsonb,p_patches jsonb,p_applied jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare rev bigint; a public.activities; ev jsonb; patch jsonb; v jsonb; before_value jsonb; after_value jsonb; entity uuid; cid uuid; eid uuid; kind text;
begin
  select learning_revision into rev from public.profiles where user_id=p_user for update;
  select * into a from public.activities where id=p_activity and user_id=p_user and activity_type='normal_learning' for update;
  if not found then raise exception 'Invalid learning activity'; end if;
  if a.status='completed' then return true; end if;
  if a.status<>'active' or a.metadata->>'lease' is distinct from p_token::text then raise exception 'Response lease lost'; end if;
  perform 1 from public.learning_sessions where id=a.session_id and user_id=p_user and status='active' for update;
  if not found then raise exception 'Session ended'; end if;
  if rev<>p_revision then return false; end if;
  if jsonb_array_length(p_events)>12 or jsonb_array_length(p_patches)>100 then raise exception 'Oversized update'; end if;
  for ev in select value from jsonb_array_elements(p_events) loop
    if ev->>'activity_id' is distinct from a.id::text or ev->>'session_id' is distinct from a.session_id::text or ev->>'knowledge_item_id' is distinct from a.target_knowledge_item_id::text then raise exception 'Evidence ownership mismatch'; end if;
    insert into public.evidence_events(id,user_id,session_id,activity_id,source,source_interaction_id,evidence_kind,target_skill,knowledge_item_id,modality,result,response_quality,support_level,evaluator_confidence_level,transfer_success,voice_uncertainty,response_time_ms,dedupe_key,occurred_at,metadata,evidence_strength,independence_level)
    values((ev->>'id')::uuid,p_user,a.session_id,a.id,(ev->>'source')::public.evidence_source,a.id,ev->>'evidence_kind',(ev->>'target_skill')::public.ability_dimension,(ev->>'knowledge_item_id')::uuid,(ev->>'modality')::public.knowledge_modality,(ev->>'result')::public.evidence_result,(ev->>'response_quality')::smallint,(ev->>'support_level')::smallint,(ev->>'evaluator_confidence_level')::smallint,(ev->>'transfer_success')::boolean,(ev->>'voice_uncertainty')::boolean,(ev->>'response_time_ms')::integer,ev->>'dedupe_key',(ev->>'occurred_at')::timestamptz,ev->'metadata',case when (ev->>'transfer_success')::boolean then 'medium'::public.evidence_strength else 'low'::public.evidence_strength end,case when (ev->>'support_level')::int=0 then 'independent'::public.independence_level when (ev->>'support_level')::int<3 then 'light_support'::public.independence_level else 'heavy_support'::public.independence_level end)
    on conflict(user_id,dedupe_key) do nothing;
  end loop;
  for patch in select value from jsonb_array_elements(p_patches) loop
    v:=patch->'values'; kind:=patch->>'kind'; before_value:=null; entity:=null; after_value:=null;
    if jsonb_array_length(patch->'evidence')=0 then raise exception 'Evidence required'; end if;
    for eid in select value::uuid from jsonb_array_elements_text(patch->'evidence') loop
      if not exists(select 1 from public.evidence_events where id=eid and user_id=p_user and evidence_kind='learning_performance') then raise exception 'Invalid supporting evidence'; end if;
    end loop;
    if kind='ability' then
      select to_jsonb(x) into before_value from public.learner_ability_estimates x where user_id=p_user and dimension=(v->>'dimension')::public.ability_dimension for update;
      if abs((v->>'estimate_level')::int-coalesce((before_value->>'estimate_level')::int,0))>1 then raise exception 'Ability change too large'; end if;
      insert into public.learner_ability_estimates(user_id,dimension,estimate_level,confidence_level,trend,last_evidence_at,model_version)
      values(p_user,(v->>'dimension')::public.ability_dimension,(v->>'estimate_level')::smallint,(v->>'confidence_level')::smallint,(v->>'trend')::public.trend_direction,(v->>'last_evidence_at')::timestamptz,'learning-v1')
      on conflict(user_id,dimension) do update set estimate_level=excluded.estimate_level,confidence_level=excluded.confidence_level,trend=excluded.trend,last_evidence_at=excluded.last_evidence_at,model_version=excluded.model_version returning id,to_jsonb(learner_ability_estimates.*) into entity,after_value;
    elsif kind='knowledge' then
      select to_jsonb(x) into before_value from public.learner_knowledge_states x where user_id=p_user and knowledge_item_id=(v->>'knowledge_item_id')::uuid and modality=(v->>'modality')::public.knowledge_modality for update;
      insert into public.learner_knowledge_states(user_id,knowledge_item_id,modality,state,confidence_level,review_need,trend,last_evidence_at,model_version)
      values(p_user,(v->>'knowledge_item_id')::uuid,(v->>'modality')::public.knowledge_modality,(v->>'state')::public.knowledge_state,(v->>'confidence_level')::smallint,(v->>'review_need')::smallint,(v->>'trend')::public.trend_direction,(v->>'last_evidence_at')::timestamptz,'learning-v1')
      on conflict(user_id,knowledge_item_id,modality) do update set state=excluded.state,confidence_level=excluded.confidence_level,review_need=excluded.review_need,trend=excluded.trend,last_evidence_at=excluded.last_evidence_at,model_version=excluded.model_version returning id,to_jsonb(learner_knowledge_states.*) into entity,after_value;
    elsif kind='pattern' then
      select to_jsonb(x) into before_value from public.recurring_mistake_patterns x where user_id=p_user and pattern_key=v->>'pattern_key' for update;
      insert into public.recurring_mistake_patterns(user_id,pattern_key,mistake_category,knowledge_item_id,modality,confidence_level,severity_level,occurrence_count,status,improvement_state,last_observed_at,model_version)
      values(p_user,v->>'pattern_key',v->>'mistake_category',(v->>'knowledge_item_id')::uuid,(v->>'modality')::public.knowledge_modality,(v->>'confidence_level')::smallint,(v->>'severity_level')::smallint,(v->>'occurrence_count')::int,(v->>'status')::public.mistake_status,v->>'improvement_state',(v->>'last_observed_at')::timestamptz,'learning-v1')
      on conflict(user_id,pattern_key) do update set confidence_level=excluded.confidence_level,severity_level=excluded.severity_level,occurrence_count=excluded.occurrence_count,status=excluded.status,improvement_state=excluded.improvement_state,last_observed_at=excluded.last_observed_at,model_version=excluded.model_version returning id,to_jsonb(recurring_mistake_patterns.*) into entity,after_value;
      insert into public.recurring_mistake_evidence(pattern_id,evidence_event_id,user_id) select entity,value::uuid,p_user from jsonb_array_elements_text(patch->'evidence') on conflict do nothing;
    elsif kind='effect' then
      select to_jsonb(x) into before_value from public.method_effectiveness x where user_id=p_user and teaching_method=v->>'teaching_method' and target_skill=(v->>'target_skill')::public.ability_dimension for update;
      insert into public.method_effectiveness(user_id,teaching_method,target_skill,effectiveness_state,confidence_level,evidence_count,last_observed_at,model_version)
      values(p_user,v->>'teaching_method',(v->>'target_skill')::public.ability_dimension,(v->>'effectiveness_state')::public.method_effectiveness_state,(v->>'confidence_level')::smallint,(v->>'evidence_count')::int,(v->>'last_observed_at')::timestamptz,'learning-v1')
      on conflict(user_id,teaching_method,target_skill) do update set effectiveness_state=excluded.effectiveness_state,confidence_level=excluded.confidence_level,evidence_count=excluded.evidence_count,last_observed_at=excluded.last_observed_at,model_version=excluded.model_version returning id,to_jsonb(method_effectiveness.*) into entity,after_value;
    else raise exception 'Invalid model patch'; end if;
    insert into public.learner_model_changes(user_id,changed_entity_type,changed_entity_id,dimension,previous_value,new_value,previous_confidence,new_confidence,reason_category,change_key,model_version)
    values(p_user,kind,entity,left(patch->>'key',120),before_value,after_value,(before_value->>'confidence_level')::smallint,(after_value->>'confidence_level')::smallint,'conservative_learning_evidence',a.id::text||':'||kind||':'||md5(patch->>'key'),'learning-v1') returning id into cid;
    insert into public.learner_model_change_evidence(learner_model_change_id,evidence_event_id,user_id) select cid,value::uuid,p_user from jsonb_array_elements_text(patch->'evidence');
  end loop;
  for eid in select value::uuid from jsonb_array_elements_text(p_applied) loop
    update public.evidence_events set processor_status='applied',processor_version='learning-v1',processed_at=now() where id=eid and user_id=p_user and evidence_kind='learning_performance';
    if not found then raise exception 'Invalid applied evidence'; end if;
  end loop;
  insert into public.activity_messages(user_id,activity_id,sequence_no,role,modality,content_text,voice_interaction_id)
  values(p_user,a.id,0,'learner',case when p_response->>'voiceId' is null then 'text' else 'voice' end,coalesce(p_response->>'text',''),(p_response->>'voiceId')::uuid);
  insert into public.activity_messages(user_id,activity_id,sequence_no,role,modality,content_text) values(p_user,a.id,1,'tutor','text',p_response->>'correction');
  update public.activities set status='completed',ended_at=now(),metadata=(metadata-'lease'-'lease_until')||jsonb_build_object('quality',p_response->'quality','correction',p_response->>'correction','elapsedMs',p_response->'elapsedMs','support',greatest(coalesce((metadata->>'support')::int,0),coalesce((p_response->>'support')::int,0))) where id=a.id;
  update public.learning_sessions set session_summary=jsonb_build_object('completed',coalesce((session_summary->>'completed')::int,0)+1) where id=a.session_id;
  -- Repeated recent difficulty is a temporary teaching signal, not an ability diagnosis.
  if (select count(*) from (select metadata from public.activities where session_id=a.session_id and status='completed' order by sequence_no desc limit 2) x where (metadata->>'quality')::int<=1)=2 then
    update public.session_states set ended_at=now() where session_id=a.session_id and user_id=p_user and ended_at is null and source='observed_pattern';
    if not exists(select 1 from public.session_states where session_id=a.session_id and ended_at is null and source='explicit_feedback') then
      update public.session_states set ended_at=now() where session_id=a.session_id and ended_at is null;
      insert into public.session_states(user_id,session_id,state_type,strength,confidence_level,source) values(p_user,a.session_id,'increased_support_need',1,1,'observed_pattern');
    end if;
  elsif (select count(*) from (select metadata from public.activities where session_id=a.session_id and status='completed' order by sequence_no desc limit 2) x where (metadata->>'quality')::int>=3)=2 then
    update public.session_states set ended_at=now() where session_id=a.session_id and user_id=p_user and ended_at is null and source='observed_pattern';
  end if;
  update public.profiles set learning_revision=learning_revision+1 where user_id=p_user;
  return true;
end $$;

create function public.end_learning(p_user uuid,p_session uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.profiles where user_id=p_user for update;
  perform 1 from public.learning_sessions where id=p_session and user_id=p_user and starting_state_summary->>'purpose'='normal_learning_v1' for update;
  if not found then raise exception 'Invalid session'; end if;
  if exists(select 1 from public.activities where session_id=p_session and status='active' and (metadata->>'lease_until')::timestamptz>now()) then raise exception 'Wait for the current response to finish'; end if;
  update public.activities set status='abandoned',ended_at=now() where session_id=p_session and user_id=p_user and status='active';
  update public.session_states set ended_at=now() where session_id=p_session and user_id=p_user and ended_at is null;
  update public.learning_sessions set status='completed',ended_at=coalesce(ended_at,now()),ending_state_summary=jsonb_build_object('completed',(select count(*) from public.activities where session_id=p_session and status='completed')) where id=p_session;
  update public.profiles set learning_revision=learning_revision+1 where user_id=p_user;
end $$;

revoke all on function public.start_learning(uuid),public.learning_snapshot(uuid),public.plan_learning(uuid,uuid,bigint,jsonb,jsonb),public.claim_learning_response(uuid,uuid,uuid),public.control_learning(uuid,uuid,text,text),public.commit_learning_response(uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb,jsonb),public.end_learning(uuid,uuid) from public,anon,authenticated;
grant execute on function public.start_learning(uuid),public.learning_snapshot(uuid),public.plan_learning(uuid,uuid,bigint,jsonb,jsonb),public.claim_learning_response(uuid,uuid,uuid),public.control_learning(uuid,uuid,text,text),public.commit_learning_response(uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb,jsonb),public.end_learning(uuid,uuid) to service_role;
