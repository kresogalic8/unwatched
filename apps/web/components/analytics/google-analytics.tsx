"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const ID = "G-3N5R9DC64C";
const CHOICE = "unwatched.analytics.v1";
type Choice = "accepted" | "declined";
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

// Keep route categories, never tokens, search terms, names or private identifiers.
export function analyticsPath(path: string) {
  const routes = new Set(["/", "/town", "/digest", "/account", "/arrive", "/built", "/evolution", "/privacy", "/pricing", "/about"]);
  if (routes.has(path)) return path;
  if (path.startsWith("/agent/")) return "/agent/profile";
  if (path.startsWith("/built/")) return "/built/story";
  return "/other";
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(false);
  const lastPage = useRef<string | null>(null);
  useEffect(() => {
    if (window.location.hostname !== "unwatched.world" && window.location.hostname !== "www.unwatched.world") return;
    try { const saved = localStorage.getItem(CHOICE); if (saved === "accepted" || saved === "declined") setChoice(saved); } catch { /* session-only choice when storage is unavailable */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || choice !== "accepted") return;
    // Auth pages are never measured, even after a previously accepted choice.
    if (/^\/(auth|gate|login)(\/|$)/.test(pathname)) return;
    const w = window as AnalyticsWindow;
    const page = analyticsPath(pathname);
    const location = window.location.origin + page;
    let referrer = "";
    try { referrer = document.referrer ? new URL(document.referrer).origin : ""; } catch { /* omit invalid referrers */ }
    if (!w.gtag) {
      w.dataLayer = w.dataLayer || [];
      w.gtag = function () { w.dataLayer!.push(arguments); };
      w.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      w.gtag("js", new Date());
      w.gtag("config", ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: location, page_referrer: referrer, page_title: `Unwatched ${page}` });
      const script = document.createElement("script");
      script.id = "unwatched-google-analytics";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
      script.referrerPolicy = "strict-origin";
      document.head.appendChild(script);
    }
    if (lastPage.current === pathname) return;
    w.gtag("set", { page_location: location, page_referrer: referrer, page_title: `Unwatched ${page}` });
    w.gtag("event", "page_view", { send_to: ID, page_location: location, page_referrer: referrer, page_title: `Unwatched ${page}` });
    lastPage.current = pathname;
  }, [ready, choice, pathname]);

  function choose(next: Choice) {
    try { localStorage.setItem(CHOICE, next); } catch { /* still honor the choice for this page */ }
    setSettings(false);
    if (choice === "accepted" && next === "declined") {
      // Stop a previously loaded tag before navigating, then remove its first-party cookies.
      (window as unknown as Record<string, unknown>)[`ga-disable-${ID}`] = true;
      for (const cookie of document.cookie.split(";")) {
        const name = cookie.split("=")[0]?.trim();
        if (name === "_ga" || name?.startsWith("_ga_")) {
          for (const domain of ["", "; domain=" + location.hostname, "; domain=.unwatched.world"]) document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;
        }
      }
      setChoice(next);
      window.location.reload();
      return;
    }
    setChoice(next);
  }
  if (!ready) return null;
  return <>
    <button type="button" onClick={() => setSettings(true)} className="fixed bottom-2 left-2 z-[100] rounded bg-[#f7f6f3]/95 px-2 py-1 text-[11px] text-[#454a46] shadow-sm">Privacy</button>
    {(choice === null || settings) && <section role="dialog" aria-label="Analytics preferences" className="fixed bottom-10 left-3 right-3 z-[101] max-w-sm rounded-xl border border-[#d6d9d0] bg-[#f7f6f3] p-4 text-[#202a25] shadow-xl sm:left-4 sm:right-auto">
      <p className="text-sm font-semibold">Help us understand visits</p>
      <p className="mt-2 text-sm leading-relaxed">Allow Google Analytics to measure visits and page views? It is optional. Your letters and account details are not sent. <a className="underline" href="/privacy">Details</a></p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose("declined")} className="flex-1 rounded-md border border-[#b9c1b6] px-3 py-2 text-sm">No thanks</button>
        <button type="button" onClick={() => choose("accepted")} className="flex-1 rounded-md border border-[#b9c1b6] px-3 py-2 text-sm">Allow analytics</button>
      </div>
    </section>}
  </>;
}
