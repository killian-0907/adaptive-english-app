import type { EffectiveEntitlements } from "../entitlements/types";
export function subscriptionActive(subscription:{status:string;started_at:string;ends_at:string|null}|null|undefined,now=new Date()){
  return !!subscription&&["free","active","trial"].includes(subscription.status)&&Date.parse(subscription.started_at)<=now.getTime()&&(!subscription.ends_at||Date.parse(subscription.ends_at)>now.getTime());
}
const safeAdSurfaces=new Set(["dashboard","progress","session_complete","between_learning_blocks"]);
export function adEligible(entitlements:EffectiveEntitlements,placement:{enabled:boolean;protected_surface:boolean}|null,surface:string,protectedLearning:boolean){
  return !protectedLearning&&safeAdSurfaces.has(surface)&&entitlements.ads_enabled===true&&placement?.enabled===true&&placement.protected_surface!==true;
}
export function deliveryCapabilities(entitlements:EffectiveEntitlements){return {voice:entitlements.can_use_voice===true,ads:entitlements.ads_enabled===true,premiumVoice:entitlements.premium_voice_quality===true,advancedProgress:entitlements.advanced_progress_access===true,extendedSessions:entitlements.extended_session_length===true,advancedModes:entitlements.advanced_learning_modes===true};}
export function membershipSummary(name:string,entitlements:EffectiveEntitlements){const c=deliveryCapabilities(entitlements);return {name,ads:c.ads?"Eligible for ad placements outside learning":"Ad placements disabled",voice:c.voice?"Browser voice available where supported":"Typing and readable prompts available",future:[{label:"Premium voice",eligible:c.premiumVoice},{label:"Advanced progress",eligible:c.advancedProgress},{label:"Extended sessions",eligible:c.extendedSessions},{label:"Advanced learning modes",eligible:c.advancedModes}],paymentNotice:"Payments are not enabled yet. No payment details are collected."};}
