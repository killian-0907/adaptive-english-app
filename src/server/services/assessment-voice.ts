import "server-only";
import { requestSlot } from "./lifecycle";
import { requireVoiceDelivery } from "./delivery";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ownedActivity, AssessmentError, account } from "./assessment";
import { OpenAIAssessmentProvider } from "./assessment-provider";
import { voiceObservations } from "@/domain/voice/observations";

export async function assessmentVoice(userId: string, activityId: string, audio?: File, resolveActivity = ownedActivity) {
  await requireVoiceDelivery(userId);
  const {activity,item} = await resolveActivity(userId,activityId);
  if(activity.status !== "active") throw new AssessmentError("This activity is no longer active.");
  const db = createAdminSupabaseClient();
  const scope = activity.activity_type === "normal_learning" ? "learning" : "assessment";
  const type = audio ? "stt" : "tts";
  if(audio && !["spoken","practical"].includes(item.type)) throw new AssessmentError("This activity does not accept speech.");
  if(!audio && !item.tts) throw new AssessmentError("No listening prompt for this activity.");
  if(audio && (audio.size < 100 || audio.size > 8_000_000 || !/^audio\/(webm|mp4|ogg|mpeg|wav)(;.*)?$/.test(audio.type))) throw new AssessmentError("Use an audio recording under 8 MB.");
  const {data: previous,error} = await db.from("voice_interactions").select("*").eq("user_id",userId).eq("activity_id",activityId).eq("interaction_type",type).order("attempt_no",{ascending:false});
  if(error) throw new AssessmentError("Could not load voice attempts.");
  const last = previous?.[0];
  if(!audio && last?.processing_status === "completed" && last.audio_object_path) {
    const cached = await db.storage.from("voice-temp").download(last.audio_object_path);
    if(cached.data) return {audio:await cached.data.arrayBuffer()};
  }
  if(last?.processing_status === "processing" && Date.now()-Date.parse(last.created_at)<60000) throw new AssessmentError("An audio request is still processing. Retry shortly.");
  await requestSlot(userId,"provider_voice",20,3600);
  const attempt = (last?.attempt_no ?? 0)+1;
  if(attempt>5) throw new AssessmentError("Please use the text fallback for this item after several voice attempts.");
  const {data:receipt,error:insertError} = await db.from("voice_interactions").insert({user_id:userId,session_id:activity.session_id,activity_id:activityId,attempt_no:attempt,interaction_type:type,processing_status:"processing",provider:"openai",model:audio ? process.env.OPENAI_STT_MODEL || "whisper-1" : process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts"}).select("id").single();
  if(insertError || !receipt) throw new AssessmentError("Another audio request is processing. Please retry shortly.");
  try {
    const provider = new OpenAIAssessmentProvider();
    if(audio) {
      // Raw recordings are memory-only; they are never written to disk/Storage.
      const result = await provider.transcribe(audio);
      const saved = await db.from("voice_interactions").update({transcript:result.text,recognition_status:"uncertain_transcript",processing_status:"completed",processing_complete:true,completed_at:new Date().toISOString()}).eq("id",receipt.id);
      if(saved.error) throw new AssessmentError("Could not save the recognized response.");
      for(const observation of voiceObservations(result)) {
        const savedEvidence=await db.from("evidence_events").upsert({user_id:userId,session_id:activity.session_id,activity_id:activityId,source:"voice_processor",source_interaction_id:receipt.id,evidence_kind:observation.kind,target_skill:observation.skill,modality:"spoken_production",result:"neutral",voice_uncertainty:true,evaluator_confidence_level:0,dedupe_key:`${receipt.id}:${observation.kind}`,metadata:observation.metadata},{onConflict:"user_id,dedupe_key",ignoreDuplicates:true});
        if(savedEvidence.error) throw new AssessmentError("Could not save the voice observation. Please retry.");
      }
      await account(userId,activity.session_id,activityId,`${scope}_stt`,`${receipt.id}:stt`);
      return {voiceId:receipt.id,transcript:result.text};
    }
    const bytes = await provider.speak(item.tts!);
    const path = `${userId}/${scope}/${receipt.id}.mp3`;
    const reference=await db.from("voice_interactions").update({audio_object_path:path}).eq("id",receipt.id);
    if(reference.error)throw new AssessmentError("Could not prepare audio storage.");
    const stored = await db.storage.from("voice-temp").upload(path,bytes,{contentType:"audio/mpeg",upsert:true});
    if(stored.error) throw new AssessmentError("Could not cache the listening prompt. Please retry.");
    await db.from("voice_interactions").update({source_text:item.tts,audio_object_path:path,processing_status:"completed",processing_complete:true,completed_at:new Date().toISOString()}).eq("id",receipt.id);
    await account(userId,activity.session_id,activityId,`${scope}_tts`,`${activityId}:tts`);
    return {audio:bytes};
  } catch(error) {
    await db.from("voice_interactions").update({processing_status:"failed",recognition_status:"provider_uncertainty"}).eq("id",receipt.id);
    await db.from("evidence_events").upsert({user_id:userId,session_id:activity.session_id,activity_id:activityId,source:"voice_processor",source_interaction_id:receipt.id,evidence_kind:"voice_uncertainty",result:"neutral",voice_uncertainty:true,dedupe_key:`${receipt.id}:voice_uncertainty`,metadata:{reason:"service_or_audio_failure"}},{onConflict:"user_id,dedupe_key",ignoreDuplicates:true});
    throw error;
  }
}
