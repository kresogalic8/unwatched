import type { SupabaseClient } from "@supabase/supabase-js";
export type SessionState =
  | "loading"
  | "signed-in"
  | "signed-out"
  | "unavailable";

/** Observe UI session state without retaining credentials. Auth events outrank an older initial read. */
export function observeSession(
  auth: SupabaseClient["auth"],
  update: (state: SessionState) => void,
) {
  let active = true;
  let revision = 0;
  const { data } = auth.onAuthStateChange((_event, session) => {
    revision++;
    if (active) update(session ? "signed-in" : "signed-out");
  });
  const initialRevision = revision;
  void auth
    .getSession()
    .then(({ data, error }) => {
      if (active && revision === initialRevision)
        update(
          error ? "unavailable" : data.session ? "signed-in" : "signed-out",
        );
    })
    .catch(() => {
      if (active && revision === initialRevision) update("unavailable");
    });
  return () => {
    active = false;
    data.subscription.unsubscribe();
  };
}
