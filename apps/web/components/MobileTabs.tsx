"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
const TABS: [string, string, IconName][] = [["Digest", "/digest", "digest"], ["Letters", "/letters", "letter"], ["People", "/people", "people"], ["Town", "/town", "town"], ["Gazette", "/gazette", "gazette"], ["You", "/account", "you"]];
/** Six tabs on phones, hidden on desktop where the top bar carries navigation. */
export function MobileTabs() {
  const path = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-shell border-t border-line flex px-2 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]" aria-label="Sections">
      {TABS.map(([n, h, d]) => { const on = path.startsWith(h); return <Link key={h} href={h} className="flex-1 flex flex-col items-center gap-0.5 min-h-11 transition-colors" style={{ color: on ? "#1F5F5B" : "#6F7A78" }} aria-current={on ? "page" : undefined}><Icon name={d} size={24} /><span className="text-[11px] font-bold">{n}</span></Link>; })}
    </nav>
  );
}
