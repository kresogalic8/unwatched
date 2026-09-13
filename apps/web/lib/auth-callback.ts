import type { SupabaseClient } from "@supabase/supabase-js";
type Auth = Pick<SupabaseClient["auth"], "initialize" | "getSession" | "exchangeCodeForSession">;
export type CallbackResult = { signedIn: boolean; error: string | null };
export const callbackFailure = "This sign-in link couldn't be completed. Open the link in the same browser where you requested it. If it has expired or was already used, request a new link below.";
const attempts = new WeakMap<Auth, Map<string, Promise<CallbackResult>>>();

/** Let the SDK finish auto-detection first; never exchange the same single-use code twice. */
export function finishAuthCallback(auth: Auth, code: string | null): Promise<CallbackResult> {
  let cache = attempts.get(auth);
  if (!cache) { cache = new Map(); attempts.set(auth, cache); }
  if (code && cache.has(code)) return cache.get(code)!;
  const task = (async (): Promise<CallbackResult> => {
    try {
      const initialized = await auth.initialize();
      const session = await auth.getSession();
      if (session.data.session) return { signedIn: true, error: null };
      if (initialized.error || session.error) return { signedIn: false, error: callbackFailure };
      if (!code) return { signedIn: false, error: null };
      const exchanged = await auth.exchangeCodeForSession(code);
      return exchanged.data.session && !exchanged.error
        ? { signedIn: true, error: null }
        : { signedIn: false, error: callbackFailure };
    } catch {
      return { signedIn: false, error: "We couldn't finish signing you in. Check your connection and request a new link below." };
    }
  })();
  if (code) cache.set(code, task);
  return task;
}
