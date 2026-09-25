export type AdConfiguration = {client:string;slot:string};
// Opt-in requires a separate, explicit launch decision. Phase 13 leaves this unset/false.
export function adDeliveryEnabled(env:Record<string,string|undefined>) {
  return env.NODE_ENV === "production" && env.ADSENSE_DELIVERY_ENABLED === "true";
}
export function adSenseConfiguration(env:Record<string,string|undefined>,surface:string):AdConfiguration|null {
  if (!["dashboard","progress","session_complete","between_learning_blocks"].includes(surface)) return null;
  const client=env.NEXT_PUBLIC_ADSENSE_CLIENT_ID, slot=env[`ADSENSE_${surface.toUpperCase()}_SLOT_ID`];
  if (!client || !/^ca-pub-\d{16}$/.test(client) || !slot || !/^\d{10}$/.test(slot)) return null;
  return {client,slot};
}
