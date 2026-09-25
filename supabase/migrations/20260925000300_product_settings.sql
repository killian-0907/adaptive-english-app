-- One narrow, atomic preference write. Learner estimates and commercial access are not inputs.
create function public.save_product_settings(p_user uuid,p_data jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare goal jsonb; method text; value jsonb;
begin
  perform 1 from public.profiles where user_id=p_user for update;
  if not found then raise exception 'Unknown learner'; end if;
  if coalesce(jsonb_typeof(p_data),'null')<>'object' or not (p_data ?& array['nativeLanguage','interfaceLanguage','correction','pace','goals','methods'])
    or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('nativeLanguage','interfaceLanguage','correction','pace','goals','methods'))
    or coalesce(jsonb_typeof(p_data->'goals'),'null')<>'array' or coalesce(jsonb_typeof(p_data->'methods'),'null')<>'object'
    or p_data->>'nativeLanguage' is null or p_data->>'interfaceLanguage' is null or p_data->>'correction' is null or p_data->>'pace' is null then raise exception 'Invalid settings'; end if;
  if (select count(*) from jsonb_object_keys(p_data->'methods'))<>10 then raise exception 'Invalid preferences'; end if;
  if p_data->>'nativeLanguage' not in ('en','zh','es') or p_data->>'interfaceLanguage' not in ('en','zh','es')
    or p_data->>'correction' not in ('immediate','gentle','after_turn','minimal') or p_data->>'pace' not in ('gentle','balanced','brisk')
    or jsonb_array_length(p_data->'goals') not between 1 and 4 then raise exception 'Invalid settings'; end if;
  update public.profiles set native_language=p_data->>'nativeLanguage',interface_language=p_data->>'interfaceLanguage',learning_revision=learning_revision+1 where user_id=p_user;
  update public.learning_goals set is_active=false where user_id=p_user;
  if (select count(distinct g->>'key') from jsonb_array_elements(p_data->'goals') g)<>jsonb_array_length(p_data->'goals') then raise exception 'Duplicate goals'; end if;
  for goal in select jsonb_array_elements(p_data->'goals') loop
    if goal->>'key' not in ('daily_communication','work','school','exams') or (goal->>'priority')::int not between 1 and 5 then raise exception 'Invalid goal'; end if;
    insert into public.learning_goals(user_id,goal_type,priority,is_active) values(p_user,goal->>'key',(goal->>'priority')::smallint,true)
    on conflict(user_id,goal_type) do update set priority=excluded.priority,is_active=true;
  end loop;
  delete from public.learning_preferences where user_id=p_user and preference_type in ('method','correction','pace');
  for method,value in select * from jsonb_each(p_data->'methods') loop
    if method not in ('conversation','role_play','listening','speaking','sentence_building','vocabulary_context','grammar_explanation','guided_writing','review','transfer') or (value::text)::int not between -2 and 2 then raise exception 'Invalid preference'; end if;
    insert into public.learning_preferences(user_id,preference_type,target_key,strength,confidence_level,source) values(p_user,'method',method,(value::text)::smallint,3,'explicit_settings');
  end loop;
  insert into public.learning_preferences(user_id,preference_type,target_key,value_text,strength,confidence_level,source)
  values(p_user,'correction','initial',p_data->>'correction',1,3,'explicit_settings'),(p_user,'pace','initial',p_data->>'pace',1,3,'explicit_settings');
end $$;
revoke all on function public.save_product_settings(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_product_settings(uuid,jsonb) to service_role;

-- Configurable preview catalog only: no checkout, prices, payment provider or ad network.
insert into public.plans(plan_key,display_name,description,is_active,sort_order,metadata)
values('membership_preview','Membership preview','Future membership options. Payments are not enabled.',true,1,
'{"preview":true,"features":[{"label":"No ad placements","available":false},{"label":"Higher-quality voice options","available":false},{"label":"Advanced progress insights","available":false},{"label":"Longer enhanced learning modes","available":false}]}')
on conflict(plan_key) do nothing;
update public.plans set description='Adaptive practice with browser voice, core scenarios and basic progress.',metadata='{"features":[{"label":"Adaptive learning","available":true},{"label":"Browser voice where supported","available":true},{"label":"Core scenarios and progress","available":true},{"label":"Ad placements outside learning","available":true}]}' where plan_key='free';
insert into public.plan_entitlements(plan_id,entitlement_definition_id,value)
select p.id,e.id,case when e.entitlement_key='ads_enabled' then 'false'::jsonb when e.value_type='boolean' then 'true'::jsonb else e.default_value end
from public.plans p cross join public.entitlement_definitions e where p.plan_key='membership_preview'
on conflict do nothing;
