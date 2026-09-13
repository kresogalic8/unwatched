"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { currentOwner, supabase } from "@/lib/auth";
import { observeSession, type SessionState } from "@/lib/session-state";

export function useSessionState() {
  const [state, setState] = useState<SessionState>("loading");
  useEffect(() => {
    if (supabase) return observeSession(supabase.auth, setState);
    let active = true;
    const refresh = () => {
      void currentOwner().then((owner) => {
        if (active) setState(owner ? "signed-in" : "signed-out");
      });
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("unwatched-auth-change", refresh);
    return () => {
      active = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("unwatched-auth-change", refresh);
    };
  }, []);
  return state;
}

export function SessionLink({ className }: { className?: string }) {
  const state = useSessionState();
  // A neutral account link avoids flashing a false signed-out state during hydration or network errors.
  return (
    <Link
      className={className}
      href={state === "signed-out" ? "/gate" : "/account"}
    >
      {state === "signed-out" ? "Sign in" : "Account"}{" "}
      <span aria-hidden="true">↗</span>
    </Link>
  );
}
