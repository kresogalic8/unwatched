"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Clock } from "@/lib/api";
import { currentOwner, rememberedAgent } from "@/lib/auth";
import { MobileTabs } from "./MobileTabs";
import { Icon, type IconName } from "./icons";

export function Button({ kind = "primary", size = 44, className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "secondary" | "tertiary" | "leaving"; size?: 36 | 44 | 52 }) {
  const k = { primary: "bg-teal text-sand hover:bg-teal-deep", secondary: "bg-glass text-teal hover:bg-glass-2", tertiary: "bg-sand text-kelp hover:bg-sand-2", leaving: "bg-transparent text-coral border-2 border-coral hover:bg-coral/10" }[kind];
  return <button {...p} style={{ height: size, paddingInline: size * 0.45, borderRadius: 8 }} className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold text-[15px] disabled:opacity-50 disabled:pointer-events-none transition-colors ${k} ${className}`} />;
}
export function LinkButton({ href, kind = "primary", size = 44, className = "", children }: { href: string; kind?: "primary" | "secondary" | "tertiary"; size?: 36 | 44 | 52; className?: string; children: React.ReactNode }) {
  const k = { primary: "bg-teal text-sand hover:bg-teal-deep", secondary: "bg-glass text-teal hover:bg-glass-2", tertiary: "bg-sand text-kelp hover:bg-sand-2" }[kind];
  return <Link href={href} style={{ height: size, paddingInline: size * 0.45, borderRadius: 8 }} className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold text-[15px] transition-colors ${k} ${className}`}>{children}</Link>;
}
export function Card({ tone = "shell", className = "", children }: { tone?: "shell" | "glass" | "teal" | "sand"; className?: string; children: React.ReactNode }) {
  const t = { shell: "bg-shell", glass: "bg-glass", teal: "bg-teal text-sand", sand: "bg-sand" }[tone];
  return <div className={`rounded-card p-6 flex flex-col gap-3 ${t} ${className}`}>{children}</div>;
}
export function Label({ children, tone }: { children: React.ReactNode; tone?: "teal" | "mist" }) {
  return <div className="label" style={tone === "teal" ? { color: "#1F5F5B" } : tone === "mist" ? { color: "#B9CFC8" } : undefined}>{children}</div>;
}
export function Dot({ changed = false, size }: { changed?: boolean; size?: number }) {
  const s = size ?? (changed ? 12 : 8);
  return <span aria-hidden className={changed ? "ring-once" : ""} style={{ width: s, height: s, borderRadius: s / 2, background: changed ? "#E8735A" : "#1F5F5B", flexShrink: 0, display: "inline-block" }} />;
}
export function Changed() { return <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-coral border-[1.5px] border-coral rounded-lg px-1.5">changed</span>; }
export function Bubble({ children, mine = false, max = 420 }: { children: React.ReactNode; mine?: boolean; max?: number }) {
  return mine
    ? <div className="bg-teal text-sand px-4 py-3 text-[15px] self-end" style={{ borderRadius: "18px 18px 4px 18px", maxWidth: max }}>{children}</div>
    : <div className="bg-glass px-4 py-3 text-[15px] italic leading-[1.4]" style={{ borderRadius: "18px 18px 18px 4px", maxWidth: max }}>{children}</div>;
}
export function Tide({ name, trust, word, width = 100 }: { name: string; trust: number; word: string; width?: number }) {
  const ebb = word === "ebbing" || word === "gone";
  return (
    <div className="flex items-center gap-3">
      <div className="font-bold text-[15px] truncate" style={{ width }}>{name}</div>
      <div className="grow h-2.5 rounded-full bg-glass relative overflow-hidden"><div className="absolute left-0 top-0 h-2.5 rounded-full" style={{ width: `${Math.round(trust * 100)}%`, background: ebb ? "#E8735A" : "#1F5F5B", transition: `width ${ebb ? 800 : 400}ms var(--ease-in-out)` }} /></div>
      <div className="text-[13px] w-16" style={{ color: ebb ? "#E8735A" : "#6F7A78" }}>{ebb ? "▼ " : ""}{word}</div>
    </div>
  );
}
export function Chip({ active = false, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`h-9 px-3.5 rounded-full text-[13px] font-bold transition-colors ${active ? "bg-teal text-sand" : "bg-sand text-kelp hover:bg-[#E7E3D6]"}`}>{children}</button>;
}
export function Logo({ size = 30, dark = false }: { size?: number; dark?: boolean }) {
  // drawn inline so the frame takes the text colour: ink on paper, paper on ink; the dot is always the signal
  return <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" style={{ display: "block", color: dark ? "#F7F6F3" : "var(--color-kelp)" }}><path d="M44 96 V44 H96 M104 44 H156 V96 M44 104 V156 H96" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="square" /><circle cx="168" cy="168" r="15" fill="#E4572E" /></svg>;
}
export function Wordmark({ size = 21, dark = false }: { size?: number; dark?: boolean }) {
  return <Link href="/" className="flex items-center gap-2.5"><Logo size={size * 1.4} dark={dark} /><span className="display" style={{ fontSize: size * 1.05, fontWeight: 600, letterSpacing: "-0.03em", whiteSpace: "nowrap", color: dark ? "#F7F6F3" : "var(--color-kelp)" }}>unwatched</span></Link>;
}

const TABS: [string, string, IconName][] = [["Digest", "/digest", "digest"], ["Letters", "/letters", "letter"], ["People", "/people", "people"], ["Town", "/town", "town"], ["Gazette", "/gazette", "gazette"], ["Library", "/library", "book"]];
export function TopBar() {
  const path = usePathname();
  const [c, setC] = useState<Clock | null>(null);
  const [me, setMe] = useState<{ name: string; sub: string } | null>(null);
  useEffect(() => {
    void api<Clock>("/api/town").then(setC).catch(() => {});
    void (async () => {
      const o = await currentOwner(); if (!o) return;
      const mine = await api<{ id: string; name: string; budget: { tier1Left: number } }[]>("/api/me/agents").catch(() => []);
      const rem = rememberedAgent(); const a = mine.find((x) => x.id === rem) ?? mine[0];
      setMe(a ? { name: a.name, sub: `${a.budget.tier1Left} thoughts left today` } : { name: o.email ?? o.id, sub: "no agent on the island" });
    })();
  }, [path]);
  return (
    <div className="flex items-center justify-between h-14 shrink-0">
      <div className="flex items-center gap-8">
        <Wordmark />
        <div className="hidden lg:flex gap-1.5 bg-shell rounded-full p-1">
          {TABS.map(([t, h, ic]) => <Link key={h} href={h} className={`h-9 px-4 rounded-full text-sm font-bold inline-flex items-center gap-1.5 transition-colors ${path.startsWith(h) ? "bg-teal text-sand" : "text-ink2 hover:bg-sand"}`}><Icon name={ic} size={16} />{t}</Link>)}
        </div>
      </div>
      <div className="flex items-center gap-3.5 text-sm">
        {c && <div className="text-drift hidden md:block">Day {c.day} · {String(c.hour).padStart(2, "0")}:{String(c.minute % 60).padStart(2, "0")} · {c.weather}{typeof c.temperatureC === "number" ? ` · ${Math.round(c.temperatureC)}°` : ""}{c.place ? ` · live sky, ${c.place}` : ""}</div>}
        <Link href="/account" className="flex items-center gap-2.5 bg-shell rounded-full py-1 pr-3.5 pl-1">
          <div className="w-9 h-9 rounded-full bg-glass text-teal flex items-center justify-center display font-bold">{me?.name?.[0] ?? "?"}</div>
          <div className="leading-tight hidden sm:block"><div className="font-bold">{me?.name ?? "Sign in"}</div><div className="text-xs text-drift">{me?.sub ?? "at the harbor office"}</div></div>
        </Link>
      </div>
    </div>
  );
}
export function Page({ children }: { children: React.ReactNode }) {
  return <><main className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-3 sm:pt-5 pb-24 lg:pb-6 flex flex-col gap-4 sm:gap-5 min-h-screen"><TopBar />{children}</main><MobileTabs /></>;
}
/** A timeline. A row with `share` carries a quiet link to that moment's own page, for passing on. */
export function Strip({ items }: { items: { t: string; changed: boolean; text: React.ReactNode; share?: string; key?: string | number }[] }) {
  return <div className="flex flex-col">{items.map((it, i) => <div key={it.key ?? i} className="grid items-center gap-x-3 py-2.5 rise" style={{ gridTemplateColumns: "90px 16px minmax(0,1fr) auto", "--i": i } as React.CSSProperties}><div className="text-[13px] text-drift tabular">{it.t}</div><div className="justify-self-center"><Dot changed={it.changed} /></div><div className={`text-[15px] ${it.changed ? "font-semibold" : ""}`}>{it.text}</div><div>{it.share ? <Link href={it.share} className="text-drift hover:text-teal inline-flex items-center gap-1 text-[12px] font-bold" title="This moment, on its own page"><Icon name="share" size={16} /><span className="hidden sm:inline">Share</span></Link> : null}</div></div>)}</div>;
}
