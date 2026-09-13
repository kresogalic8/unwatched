"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "../icons";
import styles from "./consent.module.css";

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
  const banner = useRef<HTMLElement>(null);
  const privacyButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const open = choice === null || settings;
  useEffect(() => {
    if (!ready) return;
    if (settings) banner.current?.focus();
    else if (wasOpen.current && !open) privacyButton.current?.focus();
    wasOpen.current = open;
  }, [ready, open, settings]);
  useEffect(() => {
    try { const saved = localStorage.getItem(CHOICE); if (saved === "accepted" || saved === "declined") setChoice(saved); } catch { /* session-only choice when storage is unavailable */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || choice !== "accepted") return;
    // Render the same preferences locally, but only measure the production site.
    if (!["unwatched.world", "www.unwatched.world"].includes(window.location.hostname)) return;
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
    {!open && <button ref={privacyButton} type="button" onClick={() => setSettings(true)} className={styles.reopen} aria-label="Change privacy preferences" aria-expanded={false}>
      <Icon name="settings" size={16} /><span>Privacy</span>
    </button>}
    {open && <section ref={banner} tabIndex={-1} onKeyDown={event => { if (event.key === "Escape" && choice !== null) setSettings(false); }} aria-labelledby="privacy-heading" aria-describedby="privacy-description" className={styles.banner}>
      <div className={styles.heading}>
        <span className={styles.eyebrow}><span className={styles.dot} />YOUR VISIT. YOUR CHOICE.</span>
        {choice !== null && <button type="button" onClick={() => setSettings(false)} className={styles.close} aria-label="Close privacy preferences"><Icon name="close" size={20} /></button>}
      </div>
      <h2 id="privacy-heading">A little insight.<br />Only with your permission.</h2>
      <p id="privacy-description" className={styles.description}>Optional Google Analytics helps us understand which pages people visit. Your letters and account details stay out of analytics.</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => choose("declined")}>No thanks<Icon name="close" size={16} /></button>
        <button type="button" onClick={() => choose("accepted")}>Allow analytics<Icon name="check" size={16} /></button>
      </div>
      <div className={styles.footer}>
        <span>{choice === null ? "Off until you say yes." : `Analytics is ${choice === "accepted" ? "on" : "off"}. Change anytime.`}</span>
        <a href="/privacy">Privacy details<Icon name="arrowUpRight" size={16} /></a>
      </div>
    </section>}
  </>;
}
