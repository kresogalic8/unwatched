"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Who is at the gate. With Supabase configured, a magic link. Without it, a name kept on this device,
 * sent to the server as X-Owner, so the whole app works before the project exists.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const devOwner = process.env.NEXT_PUBLIC_DEV_OWNER === "1";
export const hasSupabase = !!(url && key) && !devOwner;
export const supabase = hasSupabase ? createBrowserClient(url!, key!) : null;

export async function authHeaders(): Promise<Record<string, string>> {
  if (supabase) { const { data } = await supabase.auth.getSession(); return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}; }
  try { const o = localStorage.getItem("ft.owner"); return o ? { "X-Owner": devName(o) } : {}; } catch { return {}; }
}
export async function currentOwner(): Promise<{ id: string; email?: string } | null> {
  if (supabase) { const { data } = await supabase.auth.getUser(); return data.user ? { id: data.user.id, ...(data.user.email ? { email: data.user.email } : {}) } : null; }
  try { const o = localStorage.getItem("ft.owner"); return o ? { id: o } : null; } catch { return null; }
}
/** A dev name travels in a header, which only carries Latin-1, so it becomes a plain slug: "Mira Kovač" is "mira-kovac". */
export function devName(name: string): string { return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "visitor"; }
export async function signInDev(name: string) { localStorage.setItem("ft.owner", devName(name)); window.dispatchEvent(new Event("unwatched-auth-change")); }
export async function signOut() { if (supabase) await supabase.auth.signOut(); try { localStorage.removeItem("ft.owner"); localStorage.removeItem("ft.agent"); } catch {} try { for (const k of Object.keys(sessionStorage)) if (k.startsWith("ft.since.")) sessionStorage.removeItem(k); sessionStorage.removeItem("ft.nudge"); } catch {} window.dispatchEvent(new Event("unwatched-auth-change")); }
export function rememberAgent(id: string) { try { localStorage.setItem("ft.agent", id); } catch {} }
export function rememberedAgent(): string | null { try { return localStorage.getItem("ft.agent"); } catch { return null; } }
