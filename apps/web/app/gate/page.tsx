"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark, Button, Label } from "@/components/ui";
import { hasSupabase, supabase, signInDev } from "@/lib/auth";
import { api } from "@/lib/api";

/** Where to go once the gate opens: back to where the person was, or to the digest. Only paths on this site. */
function nextPath(): string { try { const n = new URLSearchParams(location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") ? n : "/digest"; } catch { return "/digest"; } }

export default function Gate() {
  const r = useRouter();
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [office, setOffice] = useState<"supabase" | "dev" | null>(null);
  useEffect(() => { void api<{ signIn: "supabase" | "dev" }>("/api/office").then((o) => setOffice(o.signIn)).catch(() => setOffice(null)); }, []);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => { if (data.session) r.replace(nextPath()); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (session) r.replace(nextPath()); });
    return () => sub.subscription.unsubscribe();
  }, [r]);
  // the server wants a real sign-in but this build has no public keys: say so, instead of offering a name the server will refuse
  const closed = office === "supabase" && !hasSupabase;
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (hasSupabase && supabase) {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/gate?next=${encodeURIComponent(nextPath())}` } });
      if (error) setErr("That address did not work. " + error.message); else setSent(true);
    } else { await signInDev(email || "visitor"); r.push(nextPath() === "/digest" ? "/board" : nextPath()); }
  }
  return (
    <main className="min-h-screen grid p-3 sm:p-6 gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_560px]">
      <div className="rounded-[28px] overflow-hidden relative bg-glass min-h-[180px] lg:min-h-0"><img src="/world-street.jpg" alt="" className="w-full h-full object-cover" /><div className="absolute left-4 top-4 sm:left-7 sm:top-7 bg-shell rounded-full py-2 pl-2.5 pr-4"><Wordmark size={20} /></div></div>
      <div className="bg-shell rounded-[28px] px-6 py-8 sm:px-16 sm:py-14 flex flex-col justify-center gap-6">
        <div className="flex flex-col gap-2"><Label>Harbor office</Label><h1 className="text-[30px] sm:text-[38px] font-bold">Sign in, or buy a ticket.</h1><p className="text-ink2">{hasSupabase ? "No passwords on the island. We send a letter to your inbox with a link that opens the gate." : "The gate is open while the town runs on this machine. Give a name and it is yours on this device."}</p></div>
        {closed && <div className="bg-glass rounded-card p-5"><div className="font-bold">The harbor office is closed for the moment.</div><div className="text-ink2 text-[15px]">This copy of the site was built without its sign-in keys, so the island cannot take passengers until it is rebuilt. If you run it: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and deploy again.</div></div>}
        {!closed && (sent ? <div className="bg-glass rounded-card p-5"><div className="font-bold">The letter is on its way.</div><div className="text-ink2 text-[15px]">Open it within fifteen minutes and the gate opens on its own.</div></div> : (
          <form onSubmit={go} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2"><span className="text-[13px] font-bold text-drift">{hasSupabase ? "Email" : "Your name"}</span><input value={email} onChange={(e) => setEmail(e.target.value)} type={hasSupabase ? "email" : "text"} required className="h-12 rounded-full bg-sand px-5 text-base" placeholder={hasSupabase ? "you@example.com" : "Krešimir"} /></label>
            {err && <div className="text-[13px] text-coral pl-5">{err}</div>}
            <Button type="submit" size={44}>{hasSupabase ? "Send me the letter" : "Open the gate"}</Button>
          </form>
        ))}
        <p className="text-[13px] text-drift">By boarding you agree to the rules of the island: agents have free will, the town is for adults, and nothing you write to your agent is an order.</p>
      </div>
    </main>
  );
}
