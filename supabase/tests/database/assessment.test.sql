create extension if not exists pgtap with schema extensions;
begin;
set local search_path=public,extensions;
select plan(19);
insert into auth.users(id,email) values ('a0000000-0000-4000-8000-000000000001','assessment-a@example.test'),('b0000000-0000-4000-8000-000000000001','assessment-b@example.test');
select save_assessment_onboarding('a0000000-0000-4000-8000-000000000001','{"nativeLanguage":"zh","interfaceLanguage":"en","goals":["work"],"experience":"none","correction":"gentle","pace":null,"liked":["conversation"],"disliked":["writing"]}');
select is((select count(*)::int from learning_preferences where user_id='a0000000-0000-4000-8000-000000000001'),4,'onboarding stores preferences in existing table');
select is((select count(*)::int from method_effectiveness),0,'preferences do not imply effectiveness');
create temp table assessment_ids as select start_initial_assessment('a0000000-0000-4000-8000-000000000001') sid;
select is(start_initial_assessment('a0000000-0000-4000-8000-000000000001'),(select sid from assessment_ids),'start is idempotent');
insert into activities(id,user_id,session_id,sequence_no,activity_type,learning_purpose,difficulty_level,english_exposure_level,correction_strategy,status,metadata)
select 'a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',sid,0,'initial_assessment','communication',0,1,'assessment','active','{"strategy":"exact","prompt":"Hello","itemId":"listening-0"}' from assessment_ids;
select ok(claim_assessment_response('a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001'),'first worker claims response');
select ok(not claim_assessment_response('a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001'),'second worker cannot duplicate provider work');
select ok(not claim_assessment_response('b0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001'),'cross-owner claim fails');
select is(record_assessment_support('a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','hints')->>'hints','1','support is persisted while response is leased');
select cache_assessment_evaluation('a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','response-hash','{}');
select is((select metadata->'support'->>'hints' from activities where id='a1000000-0000-4000-8000-000000000001'),'1','evaluation caching preserves concurrent support');
select commit_assessment_response('a0000000-0000-4000-8000-000000000001',sid,'a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','{"text":"Hello","voiceId":null}',
'[{"evidence_kind":"listening_recognition_performance","target_skill":"listening","modality":"listening_recognition","result":"success","response_quality":4,"support_level":0,"evaluator_confidence_level":3,"metadata":{"knowledge":"greeting","errors":[]}}]',
'{"version":1,"turns":[{}],"difficulty":0,"complete":true,"reason":"test"}','[{"dimension":"listening","estimate_level":1,"confidence_level":1}]') from assessment_ids;
select is((select count(*)::int from evidence_events where user_id='a0000000-0000-4000-8000-000000000001'),1,'response creates evidence');
select is((select count(*)::int from learner_ability_estimates where user_id='a0000000-0000-4000-8000-000000000001'),1,'completion creates only tested ability');
select is((select modality::text from learner_knowledge_states where user_id='a0000000-0000-4000-8000-000000000001'),'listening_recognition','recognition remains separate from production');
select is((select count(*)::int from learner_model_change_evidence),2,'ability and knowledge changes link to evidence');
select commit_assessment_response('a0000000-0000-4000-8000-000000000001',sid,'a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','{}','[]','{}','[]') from assessment_ids;
select is((select count(*)::int from evidence_events where user_id='a0000000-0000-4000-8000-000000000001'),1,'retry does not duplicate evidence');
select is((select count(*)::int from activity_messages),1,'retry does not duplicate completed activity response');
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select is((select count(*)::int from learning_sessions),0,'other user cannot see assessment progress');
select throws_ok($$select start_initial_assessment('b0000000-0000-4000-8000-000000000001')$$,'42501',null,'client cannot invoke authoritative assessment RPC');
select throws_ok($$select commit_assessment_response('b0000000-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'{}','[]','{}','[]')$$,'42501',null,'client cannot forge evaluation or model');
select throws_ok($$update activities set metadata='{"evaluation":{"quality":4}}'$$,'42501',null,'client cannot forge cached evaluation');
reset role;
select throws_ok($$insert into evidence_events(user_id,activity_id,source,evidence_kind,result,dedupe_key) values('b0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','system','fake','success','cross-owner-test-key')$$,'23503',null,'evidence must belong to activity owner');
select * from finish();
rollback;
