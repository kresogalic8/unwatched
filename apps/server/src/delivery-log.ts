import type { SupabaseClient } from "@supabase/supabase-js";
let db: SupabaseClient | null = null;
export function configureDeliveryLog(client: SupabaseClient | null) {
  db = client;
}
export async function recordDelivery(input: {
  channel: string;
  kind: string;
  status: string;
  owner_id?: string;
  agent_id?: string;
  provider_id?: string;
  error?: string;
  retry_of?: string;
  job_id?: string;
}) {
  if (!db) return;
  try {
    const { error } = await db.from("delivery_attempts").insert(input);
    if (error) console.error("[delivery] Could not persist delivery status.");
  } catch {
    console.error("[delivery] Could not persist delivery status.");
  }
}
export function deliveryDatabase() {
  return db;
}
