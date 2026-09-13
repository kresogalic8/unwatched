"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hasSupabase, supabase, signInDev } from "@/lib/auth";
import { finishAuthCallback, callbackFailure } from "@/lib/auth-callback";
import { api } from "@/lib/api";
import { SignInView } from "@/components/auth/SignInView";

/** Preserve the requested on-site destination across the magic-link flow. */
function nextPath(): string {
  try {
    const n = new URLSearchParams(location.search).get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/digest";
  } catch {
    return "/digest";
  }
}

export default function Gate() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [err, setErr] = useState<string | null>(null);
  const [office, setOffice] = useState<"supabase" | "dev" | null>(null);
  useEffect(() => {
    let alive = true;
    void api<{ signIn: "supabase" | "dev" }>("/api/office")
      .then((o) => {
        if (alive) setOffice(o.signIn);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const query = new URLSearchParams(location.search);
    const fragment = new URLSearchParams(location.hash.slice(1));
    const code = query.get("code");
    const callback = !!code || fragment.has("access_token") || query.has("error") || fragment.has("error");
    setCompleting(callback);
    void finishAuthCallback(supabase.auth, code).then(result => {
      if (!alive) return;
      if (result.signedIn) { r.replace(nextPath()); return; }
      setCompleting(false);
      if (result.error || callback) setErr(result.error ?? callbackFailure);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) r.replace(nextPath());
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [r]);
  const closed = office === "supabase" && !hasSupabase;
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current || closed || completing) return;
    sending.current = true;
    setBusy(true);
    setErr(null);
    try {
      if (hasSupabase && supabase) {
        const address = email.trim();
        const { error } = await supabase.auth.signInWithOtp({
          email: address,
          options: {
            emailRedirectTo: `${location.origin}/gate?next=${encodeURIComponent(nextPath())}`,
          },
        });
        if (error) {
          setErr(
            error.status === 429
              ? "Too many requests. Please wait a moment before trying again."
              : "We couldn't send your link. Check your email address and try again.",
          );
        } else {
          setEmail(address);
          setSent(true);
        }
      } else {
        await signInDev(email.trim() || "visitor");
        r.push(nextPath() === "/digest" ? "/board" : nextPath());
      }
    } catch {
      setErr(
        "The harbor office couldn't be reached. Check your connection and try again.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <SignInView
      email={email}
      onEmailChange={setEmail}
      sent={sent}
      busy={busy}
      completing={completing}
      error={err}
      closed={closed}
      emailAuth={hasSupabase}
      onSubmit={go}
      onReset={() => {
        setSent(false);
        setErr(null);
      }}
    />
  );
}
